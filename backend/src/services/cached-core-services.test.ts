import { describe, expect, it, vi } from "vitest";
import type { BrowseResponse, PlaybackAuthorizationResponse } from "@netflix/shared-types";
import { MemoryCacheStore } from "../platform/cache/cache-store.js";
import { CachedCoreServices } from "./cached-core-services.js";
import type { CoreServices } from "./core-services.js";

const browse: BrowseResponse = {
  profile: { id: "p_1", name: "Perfil", avatar: "CV" },
  billboard: { id: "m_1", title: "Filme", synopsis: "Sinopse", videoPreviewUrl: "" },
  rows: []
};

const playback: PlaybackAuthorizationResponse = {
  contentId: "m_1",
  contentType: "MOVIE",
  movieId: "m_1",
  playbackStatus: "AUTHORIZED",
  manifestUrl: "/stream/m_1/master.m3u8",
  drmLicenseServer: "",
  telemetryIntervalMs: 5_000
};

function dependency(): CoreServices {
  return {
    getBrowse: vi.fn(async () => browse),
    authorizePlayback: vi.fn(async () => playback)
  };
}

describe("CachedCoreServices", () => {
  it("uses cache-aside for equivalent catalog requests", async () => {
    const inner = dependency();
    const service = new CachedCoreServices(inner, new MemoryCacheStore(), 30);

    await service.getBrowse("p_1", ["Drama", "Acao"]);
    await service.getBrowse("p_1", ["acao", "drama", "Drama"]);

    expect(inner.getBrowse).toHaveBeenCalledTimes(1);
  });

  it("coalesces concurrent misses to prevent a cache stampede", async () => {
    let release!: (value: BrowseResponse) => void;
    const wait = new Promise<BrowseResponse>(resolve => { release = resolve; });
    const inner = dependency();
    inner.getBrowse = vi.fn(() => wait);
    const service = new CachedCoreServices(inner, new MemoryCacheStore(), 30);

    const first = service.getBrowse("p_1", ["Drama"]);
    const second = service.getBrowse("p_1", ["Drama"]);
    release(browse);

    await expect(Promise.all([first, second])).resolves.toEqual([browse, browse]);
    expect(inner.getBrowse).toHaveBeenCalledTimes(1);
  });

  it("never caches playback authorization", async () => {
    const inner = dependency();
    const service = new CachedCoreServices(inner, new MemoryCacheStore(), 30);

    await service.authorizePlayback("p_1", "m_1");
    await service.authorizePlayback("p_1", "m_1");

    expect(inner.authorizePlayback).toHaveBeenCalledTimes(2);
  });

  it("expires entries after their TTL", async () => {
    let now = 1_000;
    const inner = dependency();
    const service = new CachedCoreServices(inner, new MemoryCacheStore(() => now), 1);

    await service.getBrowse("p_1");
    now += 1_001;
    await service.getBrowse("p_1");

    expect(inner.getBrowse).toHaveBeenCalledTimes(2);
  });

  it("invalidates catalog entries after an administrative change", async () => {
    const inner = dependency();
    const service = new CachedCoreServices(inner, new MemoryCacheStore(), 30);

    await service.getBrowse("p_1");
    await service.invalidateBrowse();
    await service.getBrowse("p_1");

    expect(inner.getBrowse).toHaveBeenCalledTimes(2);
  });
});
