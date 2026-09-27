import { createHmac, timingSafeEqual } from "node:crypto";
import { posix } from "node:path";
import type { NextFunction, Request, Response } from "express";
import type { ObjectStorage } from "./object-storage.js";

const OBJECT_SCHEME = "media-object://";

export class SignedMediaDelivery {
  constructor(private readonly storage: ObjectStorage, private readonly secret: string, private readonly ttlSeconds = 900, private readonly cdnBaseUrl = "") {}

  objectReference(key: string) { return `${OBJECT_SCHEME}${cleanKey(key)}`; }
  resolve(reference: string) { return reference.startsWith(OBJECT_SCHEME) ? this.sign(reference.slice(OBJECT_SCHEME.length)) : reference; }

  async handle(request: Request, response: Response, next: NextFunction) {
    try {
      const raw = request.params[0];
      const key = cleanKey(typeof raw === "string" ? decodeURIComponent(raw) : "");
      const expires = Number(request.query.expires);
      const signature = typeof request.query.signature === "string" ? request.query.signature : "";
      if (!key || !this.valid(key, expires, signature)) { response.status(403).json({ error: { code: "INVALID_MEDIA_SIGNATURE", message: "Media URL is invalid or expired", requestId: response.locals.requestId } }); return; }
      const object = await this.storage.get(key);
      if (!object) { response.sendStatus(404); return; }
      if (key.endsWith(".m3u8")) {
        const manifest = await streamToString(object.body);
        response.setHeader("Content-Type", object.contentType);
        response.setHeader("Cache-Control", "private,max-age=15");
        response.send(this.rewriteManifest(manifest, key, expires));
        return;
      }
      const remaining = Math.max(0, Math.min(86_400, expires - Math.floor(Date.now() / 1000)));
      response.setHeader("Content-Type", object.contentType);
      response.setHeader("Cache-Control", `public,max-age=${remaining},s-maxage=${remaining},immutable`);
      if (object.contentLength !== undefined) response.setHeader("Content-Length", String(object.contentLength));
      object.body.on("error", next).pipe(response);
    } catch (error) { next(error); }
  }

  private sign(key: string, expires = Math.floor(Date.now() / 1000) + this.ttlSeconds) {
    const path = `/stream/${key.split("/").map(encodeURIComponent).join("/")}`;
    const base = this.cdnBaseUrl.replace(/\/$/, "");
    return `${base}${path}?expires=${expires}&signature=${this.signature(key, expires)}`;
  }
  private valid(key: string, expires: number, signature: string) {
    if (!Number.isSafeInteger(expires) || expires <= Math.floor(Date.now() / 1000) || !/^[a-f0-9]{64}$/.test(signature)) return false;
    const expected = Buffer.from(this.signature(key, expires), "hex");
    const received = Buffer.from(signature, "hex");
    return expected.length === received.length && timingSafeEqual(expected, received);
  }
  private signature(key: string, expires: number) { return createHmac("sha256", this.secret).update(`${key}\n${expires}`).digest("hex"); }
  private rewriteManifest(manifest: string, manifestKey: string, expires: number) {
    const directory = posix.dirname(manifestKey);
    return manifest.split(/\r?\n/).map(line => {
      const value = line.trim();
      if (!value || value.startsWith("#")) return line;
      const child = cleanKey(posix.join(directory, value));
      return this.sign(child, expires);
    }).join("\n");
  }
}

function cleanKey(key: string) {
  const cleaned = posix.normalize(key.replaceAll("\\", "/")).replace(/^\/+/, "");
  if (!cleaned || cleaned === "." || cleaned.startsWith("../") || cleaned.includes("/../")) return "";
  return cleaned;
}
async function streamToString(stream: NodeJS.ReadableStream) { const chunks: Buffer[] = []; for await (const chunk of stream) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)); return Buffer.concat(chunks).toString("utf8"); }
