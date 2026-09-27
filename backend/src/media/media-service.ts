import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { lstat, mkdir, rm, unlink } from "node:fs/promises";
import { join, resolve, sep } from "node:path";
import type { MediaJob, MediaPurpose } from "@netflix/shared-types";
import type { CatalogRepository } from "../catalog/repository.js";
import type { MediaJobRecord, MediaRepository } from "./repository.js";
import { SignedMediaDelivery } from "./media-delivery.js";
import { LocalObjectStorage, type ObjectStorage } from "./object-storage.js";

export class InvalidMediaUploadError extends Error {}
export class MediaJobNotFoundError extends Error {}
export class MediaJobBusyError extends Error {}
export interface UploadedVideo { originalname: string; path: string; size: number; }

export class MediaService {
  readonly uploadDirectory: string;
  readonly publicDirectory: string;
  readonly workDirectory: string;
  readonly delivery: SignedMediaDelivery;
  private readonly storage: ObjectStorage;
  constructor(private readonly repository: MediaRepository, private readonly catalog: CatalogRepository, private readonly root: string, private readonly ffmpegPath = "ffmpeg", storage?: ObjectStorage, delivery?: SignedMediaDelivery) {
    this.uploadDirectory = join(root, "uploads");
    this.publicDirectory = join(root, "hls");
    this.workDirectory = join(root, "work");
    this.storage = storage ?? new LocalObjectStorage(join(root, "objects"));
    this.delivery = delivery ?? new SignedMediaDelivery(this.storage, "local-media-development-secret");
  }
  async initialize() { await mkdir(this.uploadDirectory, { recursive: true }); await mkdir(this.publicDirectory, { recursive: true }); await mkdir(this.workDirectory, { recursive: true }); }
  async submit(contentId: string, purpose: MediaPurpose, file: UploadedVideo): Promise<MediaJob> {
    if (!/^[me]_[A-Za-z0-9_-]+$/.test(contentId)) throw new InvalidMediaUploadError("Invalid movie or episode identifier");
    if (purpose !== "TRAILER" && purpose !== "MAIN_CONTENT") throw new InvalidMediaUploadError("Invalid media purpose");
    if (purpose === "TRAILER" && contentId.startsWith("e_")) throw new InvalidMediaUploadError("Trailers belong to movies or series, not episodes");
    if (!await this.catalog.mediaTargetExists(contentId, purpose)) throw new InvalidMediaUploadError("Media target was not found");
    const now = new Date().toISOString();
    const job: MediaJobRecord = { id: `job_${randomUUID().replaceAll("-", "")}`, contentId, purpose, originalFilename: file.originalname, sizeBytes: file.size, sourcePath: file.path, status: "QUEUED", outputUrl: "", errorMessage: "", createdAt: now, updatedAt: now };
    await this.repository.create(job);
    setImmediate(() => { void this.process(job); });
    return publicJob(job);
  }
  async list(contentId?: string) { return (await this.repository.list(contentId)).map(publicJob); }
  async delete(jobId: string): Promise<MediaJob> {
    if (!/^job_[A-Za-z0-9_-]+$/.test(jobId)) throw new MediaJobNotFoundError("Media job was not found");
    const job = await this.repository.findById(jobId);
    if (!job) throw new MediaJobNotFoundError("Media job was not found");
    if (job.status === "QUEUED" || job.status === "PROCESSING") throw new MediaJobBusyError("Wait for media processing to finish before deleting it");
    if (job.status === "DELETED") return publicJob(job);
    if (job.status === "READY") {
      const keyPrefix = `${job.contentId}/${job.purpose.toLowerCase()}/${job.id}`;
      await this.storage.deletePrefix(keyPrefix);
      await safeRemoveLegacyDirectory(this.publicDirectory, keyPrefix);
      await this.catalog.clearMediaUrl(job.contentId, job.purpose, job.outputUrl);
    }
    const deleted = await this.repository.update(job.id, "DELETED", "", "");
    if (!deleted) throw new MediaJobNotFoundError("Media job was not found");
    return publicJob(deleted);
  }
  private async process(job: MediaJobRecord) {
    await this.repository.update(job.id, "PROCESSING");
    const outputDirectory = join(this.workDirectory, job.id);
    await mkdir(outputDirectory, { recursive: true });
    try {
      const probe = await probeMedia(this.ffmpegPath, job.sourcePath);
      for (const rendition of adaptiveRenditions(probe.height)) await mkdir(join(outputDirectory, rendition.name), { recursive: true });
      await runFfmpeg(this.ffmpegPath, adaptiveHlsArguments(job.sourcePath, outputDirectory, probe.hasAudio, probe.height));
      const keyPrefix = `${job.contentId}/${job.purpose.toLowerCase()}/${job.id}`;
      await this.storage.putDirectory(outputDirectory, keyPrefix);
      const outputUrl = this.delivery.objectReference(`${keyPrefix}/master.m3u8`);
      if (!await this.catalog.setMediaUrl(job.contentId, job.purpose, outputUrl)) throw new Error("Catalog item disappeared during processing");
      await this.repository.update(job.id, "READY", outputUrl, "");
    } catch (error) {
      const message = error instanceof Error ? error.message.slice(-2000) : "Unknown FFmpeg failure";
      await this.repository.update(job.id, "FAILED", "", message);
    } finally { await unlink(job.sourcePath).catch(() => undefined); await rm(outputDirectory, { recursive: true, force: true }).catch(() => undefined); }
  }
}

function publicJob({ sourcePath: _sourcePath, ...job }: MediaJobRecord): MediaJob { return job; }
function runFfmpeg(command: string, args: string[]) { return new Promise<void>((resolve, reject) => { const child = spawn(command, args, { windowsHide: true, shell: false }); let stderr = ""; let settled = false; child.stderr.on("data", chunk => { stderr = (stderr + String(chunk)).slice(-8000); }); child.on("error", error => { if (!settled) { settled = true; reject(new Error(error.message.includes("ENOENT") ? "FFmpeg executable was not found. Configure FFMPEG_PATH." : error.message)); } }); child.on("close", code => { if (settled) return; settled = true; code === 0 ? resolve() : reject(new Error(`FFmpeg exited with code ${code}: ${stderr}`)); }); }); }

async function safeRemoveLegacyDirectory(root: string, keyPrefix: string) {
  const normalizedRoot = resolve(root);
  const target = resolve(normalizedRoot, keyPrefix);
  if (!target.startsWith(`${normalizedRoot}${sep}`)) throw new Error("Invalid legacy media directory");
  try {
    const details = await lstat(target);
    if (details.isSymbolicLink()) await unlink(target);
    else await rm(target, { recursive: true, force: false });
  } catch (error) { if (!(typeof error === "object" && error && "code" in error && error.code === "ENOENT")) throw error; }
}

interface Rendition { name: string; height: number; bitrate: string; maxrate: string; buffer: string; }

export function adaptiveRenditions(sourceHeight: number): Rendition[] {
  const standard: Rendition[] = [
    { name: "360p", height: 360, bitrate: "800k", maxrate: "856k", buffer: "1200k" },
    { name: "720p", height: 720, bitrate: "2800k", maxrate: "2996k", buffer: "4200k" },
    { name: "1080p", height: 1080, bitrate: "5000k", maxrate: "5350k", buffer: "7500k" }
  ];
  const variants = standard.filter(variant => variant.height <= sourceHeight);
  if (!variants.some(variant => variant.height === sourceHeight) && sourceHeight < 1080) {
    const bitrate = sourceHeight <= 480 ? "1400k" : sourceHeight <= 576 ? "1800k" : "3500k";
    variants.push({ name: `${sourceHeight}p`, height: sourceHeight, bitrate, maxrate: bitrate, buffer: sourceHeight <= 480 ? "2100k" : "5250k" });
  }
  return variants.length ? variants : [{ name: `${sourceHeight}p`, height: sourceHeight, bitrate: "600k", maxrate: "642k", buffer: "900k" }];
}

export function adaptiveHlsArguments(source: string, outputDirectory: string, hasAudio = true, sourceHeight = 1080) {
  const variants = adaptiveRenditions(sourceHeight);
  const split = variants.length > 1 ? `[0:v:0]split=${variants.length}${variants.map((_variant, index) => `[v${index}]`).join("")};` : "";
  const filters = `${split}${variants.map((variant, index) => `[${variants.length > 1 ? `v${index}` : "0:v:0"}]scale=w=-2:h=${variant.height}:force_original_aspect_ratio=decrease[v${index}out]`).join(";")}`;
  const args = ["-hide_banner", "-y", "-i", source, "-filter_complex", filters];
  for (const [index, variant] of variants.entries()) {
    args.push("-map", `[v${index}out]`);
    if (hasAudio) args.push("-map", "0:a:0");
    args.push(`-c:v:${index}`, "libx264", `-b:v:${index}`, variant.bitrate, `-maxrate:v:${index}`, variant.maxrate, `-bufsize:v:${index}`, variant.buffer);
    if (hasAudio) args.push(`-c:a:${index}`, "aac", `-b:a:${index}`, "128k");
  }
  args.push("-preset", "medium", "-sc_threshold", "0", "-g", "48", "-keyint_min", "48", "-hls_time", "6", "-hls_playlist_type", "vod", "-hls_flags", "independent_segments", "-master_pl_name", "master.m3u8", "-var_stream_map", variants.map((variant, index) => `v:${index}${hasAudio ? `,a:${index}` : ""},name:${variant.name}`).join(" "), "-hls_segment_filename", join(outputDirectory, "%v", "segment_%05d.ts"), join(outputDirectory, "%v", "index.m3u8"));
  return args;
}

function probeMedia(ffmpegPath: string, source: string) {
  const command = ffmpegPath.replace(/ffmpeg(?:\.exe)?$/i, process.platform === "win32" ? "ffprobe.exe" : "ffprobe");
  return new Promise<{ height: number; hasAudio: boolean }>(resolve => {
    const fallback = { height: 1080, hasAudio: true };
    const child = spawn(command, ["-v", "error", "-show_entries", "stream=codec_type,height", "-of", "json", source], { windowsHide: true, shell: false });
    let output = "";
    child.stdout.on("data", chunk => { output += String(chunk); });
    child.on("error", () => resolve(fallback));
    child.on("close", code => {
      if (code !== 0) { resolve(fallback); return; }
      try {
        const streams = (JSON.parse(output) as { streams?: Array<{ codec_type?: string; height?: number }> }).streams ?? [];
        const height = streams.find(stream => stream.codec_type === "video")?.height;
        resolve({ height: typeof height === "number" && height > 0 ? height : 1080, hasAudio: streams.some(stream => stream.codec_type === "audio") });
      } catch { resolve(fallback); }
    });
  });
}
