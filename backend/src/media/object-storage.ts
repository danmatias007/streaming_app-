import { createReadStream } from "node:fs";
import { cp, lstat, mkdir, readdir, rm, stat, unlink } from "node:fs/promises";
import { join, relative, resolve, sep } from "node:path";
import { Readable } from "node:stream";
import { DeleteObjectsCommand, GetObjectCommand, ListObjectsV2Command, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";

export interface StoredObject {
  body: Readable;
  contentLength?: number;
  contentType: string;
}

export interface ObjectStorage {
  putDirectory(sourceDirectory: string, keyPrefix: string): Promise<void>;
  get(key: string): Promise<StoredObject | null>;
  deletePrefix(keyPrefix: string): Promise<void>;
}

export class LocalObjectStorage implements ObjectStorage {
  constructor(readonly root: string) {}
  async initialize() { await mkdir(this.root, { recursive: true }); }
  async putDirectory(sourceDirectory: string, keyPrefix: string) {
    const destination = safeLocalPath(this.root, keyPrefix);
    if (resolve(sourceDirectory) === resolve(destination)) return;
    await mkdir(destination, { recursive: true });
    await cp(sourceDirectory, destination, { recursive: true, force: true });
  }
  async get(key: string): Promise<StoredObject | null> {
    try {
      const path = safeLocalPath(this.root, key);
      const details = await stat(path);
      if (!details.isFile()) return null;
      return { body: createReadStream(path), contentLength: details.size, contentType: contentType(key) };
    } catch (error) {
      if (isMissing(error)) return null;
      throw error;
    }
  }
  async deletePrefix(keyPrefix: string) {
    const path = safeLocalPath(this.root, keyPrefix);
    try {
      const details = await lstat(path);
      if (details.isSymbolicLink()) await unlink(path);
      else await rm(path, { recursive: true, force: false });
    } catch (error) { if (!isMissing(error)) throw error; }
  }
}

export interface S3ObjectStorageOptions {
  bucket: string;
  region: string;
  endpoint?: string;
  forcePathStyle: boolean;
}

export class S3ObjectStorage implements ObjectStorage {
  private readonly client: S3Client;
  constructor(private readonly options: S3ObjectStorageOptions) {
    this.client = new S3Client({ region: options.region, ...(options.endpoint ? { endpoint: options.endpoint } : {}), forcePathStyle: options.forcePathStyle });
  }
  async putDirectory(sourceDirectory: string, keyPrefix: string) {
    for (const file of await filesInside(sourceDirectory)) {
      const objectKey = `${keyPrefix}/${relative(sourceDirectory, file).split(sep).join("/")}`;
      await this.client.send(new PutObjectCommand({ Bucket: this.options.bucket, Key: objectKey, Body: createReadStream(file), ContentType: contentType(objectKey), CacheControl: objectKey.endsWith(".m3u8") ? "no-cache" : "public,max-age=31536000,immutable" }));
    }
  }
  async get(key: string): Promise<StoredObject | null> {
    try {
      const result = await this.client.send(new GetObjectCommand({ Bucket: this.options.bucket, Key: key }));
      if (!result.Body) return null;
      return { body: result.Body as Readable, ...(result.ContentLength === undefined ? {} : { contentLength: result.ContentLength }), contentType: result.ContentType ?? contentType(key) };
    } catch (error) {
      if (isMissing(error)) return null;
      throw error;
    }
  }
  async deletePrefix(keyPrefix: string) {
    let continuationToken: string | undefined;
    do {
      const listed = await this.client.send(new ListObjectsV2Command({ Bucket: this.options.bucket, Prefix: `${keyPrefix.replace(/\/$/, "")}/`, ...(continuationToken ? { ContinuationToken: continuationToken } : {}) }));
      const objects = (listed.Contents ?? []).flatMap(item => item.Key ? [{ Key: item.Key }] : []);
      if (objects.length) await this.client.send(new DeleteObjectsCommand({ Bucket: this.options.bucket, Delete: { Objects: objects, Quiet: true } }));
      continuationToken = listed.IsTruncated ? listed.NextContinuationToken : undefined;
    } while (continuationToken);
  }
}

async function filesInside(directory: string): Promise<string[]> {
  const found: string[] = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) found.push(...await filesInside(path));
    else if (entry.isFile()) found.push(path);
  }
  return found;
}

function safeLocalPath(root: string, key: string) {
  const normalizedRoot = resolve(root);
  const candidate = resolve(normalizedRoot, key);
  if (candidate !== normalizedRoot && !candidate.startsWith(`${normalizedRoot}${sep}`)) throw new Error("Invalid object key");
  return candidate;
}

function contentType(key: string) {
  if (key.endsWith(".m3u8")) return "application/vnd.apple.mpegurl";
  if (key.endsWith(".ts")) return "video/mp2t";
  if (key.endsWith(".m4s")) return "video/iso.segment";
  if (key.endsWith(".mp4")) return "video/mp4";
  return "application/octet-stream";
}

function isMissing(error: unknown) { return typeof error === "object" && error !== null && (("code" in error && error.code === "ENOENT") || ("name" in error && ["NoSuchKey", "NotFound"].includes(String(error.name)))); }
