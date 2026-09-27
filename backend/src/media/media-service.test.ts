import { mkdtemp, mkdir, rm, stat, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { describe, expect, it, vi } from "vitest";
import express from "express";
import request from "supertest";
import { MemoryCatalogRepository } from "../catalog/memory-repository.js";
import { MemoryMediaRepository } from "./memory-repository.js";
import { adaptiveHlsArguments, adaptiveRenditions, MediaService } from "./media-service.js";
import { SignedMediaDelivery } from "./media-delivery.js";
import { LocalObjectStorage } from "./object-storage.js";

describe("media pipeline", () => {
  it("keeps trailer and main movie content isolated", async () => {
    const catalog = new MemoryCatalogRepository();
    expect(await catalog.setMediaUrl("m_7721", "TRAILER", "/media/trailer.m3u8")).toBe(true);
    expect((await catalog.findById("m_7721"))?.previewUrl).toBe("/media/trailer.m3u8");
    expect((await catalog.findPlaybackSource("m_7721"))?.url).toBe("");
    expect(await catalog.setMediaUrl("m_7721", "MAIN_CONTENT", "/media/movie.m3u8")).toBe(true);
    expect((await catalog.findPlaybackSource("m_7721"))?.url).toBe("/media/movie.m3u8");
    expect((await catalog.findById("m_7721"))?.previewUrl).toBe("/media/trailer.m3u8");
  });

  it("records an actionable failure when FFmpeg is unavailable", async () => {
    const root = await mkdtemp(join(tmpdir(), "cinevault-media-"));
    try {
      const service = new MediaService(new MemoryMediaRepository(), new MemoryCatalogRepository(), root, "ffmpeg-command-that-does-not-exist");
      await service.initialize();
      const source = join(service.uploadDirectory, "source.mp4");
      await writeFile(source, "not-a-real-video");
      await service.submit("m_7721", "MAIN_CONTENT", { originalname: "source.mp4", path: source, size: 16 });
      await vi.waitFor(async () => { const jobs = await service.list("m_7721"); expect(jobs[0]?.status).toBe("FAILED"); expect(jobs[0]?.errorMessage).toContain("FFmpeg executable was not found"); });
    } finally { await rm(root, { recursive: true, force: true }); }
  });

  it("builds an adaptive ladder with 360p, 720p and 1080p", () => {
    const args = adaptiveHlsArguments("source.mkv", "output", true).join(" ");
    expect(args).toContain("h=360");
    expect(args).toContain("h=720");
    expect(args).toContain("h=1080");
    expect(args).toContain("master.m3u8");
    expect(args).toContain("name:360p");
    expect(args).toContain("name:720p");
    expect(args).toContain("name:1080p");
  });

  it("does not upscale a low-resolution source", () => {
    expect(adaptiveRenditions(480).map(item => item.name)).toEqual(["360p", "480p"]);
    expect(adaptiveRenditions(720).map(item => item.name)).toEqual(["360p", "720p"]);
  });

  it("signs every playlist and segment URL and rejects tampering", async () => {
    const root = await mkdtemp(join(tmpdir(), "cinevault-objects-"));
    try {
      const source = join(root, "source");
      await mkdir(join(source, "360p"), { recursive: true });
      await writeFile(join(source, "master.m3u8"), "#EXTM3U\n360p/index.m3u8\n");
      await writeFile(join(source, "360p", "index.m3u8"), "#EXTM3U\nsegment_00000.ts\n");
      await writeFile(join(source, "360p", "segment_00000.ts"), "segment");
      const storage = new LocalObjectStorage(join(root, "store"));
      await storage.putDirectory(source, "movie/job");
      const delivery = new SignedMediaDelivery(storage, "test-signing-secret", 900);
      const app = express();
      app.get(/^\/stream\/(.+)$/, (incoming, response, next) => { void delivery.handle(incoming, response, next); });
      const masterUrl = delivery.resolve("media-object://movie/job/master.m3u8");
      const master = await request(app).get(masterUrl);
      expect(master.status).toBe(200);
      const variantUrl = master.text.split("\n").find(line => line.startsWith("/stream/"))!;
      const variant = await request(app).get(variantUrl);
      expect(variant.status).toBe(200);
      const segmentUrl = variant.text.split("\n").find(line => line.startsWith("/stream/"))!;
      expect((await request(app).get(segmentUrl)).body.toString("utf8")).toBe("segment");
      expect((await request(app).get(segmentUrl.replace("signature=", "signature=0"))).status).toBe(403);
    } finally { await rm(root, { recursive: true, force: true }); }
  });

  it("deletes stored renditions and clears only the active catalog reference", async () => {
    const root = await mkdtemp(join(tmpdir(), "cinevault-delete-"));
    try {
      const repository = new MemoryMediaRepository();
      const catalog = new MemoryCatalogRepository();
      const service = new MediaService(repository, catalog, root);
      await service.initialize();
      const id = "job_delete_test";
      const keyPrefix = `m_7721/trailer/${id}`;
      const storedFile = join(root, "objects", keyPrefix, "master.m3u8");
      await mkdir(join(root, "objects", keyPrefix), { recursive: true });
      await writeFile(storedFile, "#EXTM3U\n");
      const outputUrl = `media-object://${keyPrefix}/master.m3u8`;
      const now = new Date().toISOString();
      await repository.create({ id, contentId: "m_7721", purpose: "TRAILER", originalFilename: "trailer.mkv", sizeBytes: 100, sourcePath: "", status: "READY", outputUrl, errorMessage: "", createdAt: now, updatedAt: now });
      await catalog.setMediaUrl("m_7721", "TRAILER", outputUrl);
      expect((await service.delete(id)).status).toBe("DELETED");
      await expect(stat(storedFile)).rejects.toMatchObject({ code: "ENOENT" });
      expect((await catalog.findById("m_7721"))?.previewUrl).toBe("");
      expect((await repository.findById(id))?.status).toBe("DELETED");
    } finally { await rm(root, { recursive: true, force: true }); }
  });
});
