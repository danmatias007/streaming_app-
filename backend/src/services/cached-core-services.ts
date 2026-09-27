import type { BrowseResponse, PlaybackAuthorizationResponse } from "@netflix/shared-types";
import type { CacheStore } from "../platform/cache/cache-store.js";
import type { CoreServices } from "./core-services.js";

const BROWSE_CACHE_PREFIX = "web:browse:";

export class CachedCoreServices implements CoreServices {
  private readonly inFlight = new Map<string, Promise<BrowseResponse>>();

  constructor(
    private readonly inner: CoreServices,
    private readonly cache: CacheStore,
    private readonly browseTtlSeconds: number
  ) {}

  async getBrowse(profileId: string, preferredGenres: string[] = []): Promise<BrowseResponse> {
    const key = browseCacheKey(profileId, preferredGenres);
    const cached = await this.cache.get<BrowseResponse>(key);
    if (cached) return cached;

    const pending = this.inFlight.get(key);
    if (pending) return pending;

    const load = this.inner
      .getBrowse(profileId, preferredGenres)
      .then(async response => {
        await this.cache.set(key, response, this.browseTtlSeconds);
        return response;
      })
      .finally(() => this.inFlight.delete(key));

    this.inFlight.set(key, load);
    return load;
  }

  authorizePlayback(profileId: string, contentId: string): Promise<PlaybackAuthorizationResponse> {
    return this.inner.authorizePlayback(profileId, contentId);
  }

  invalidateBrowse(): Promise<void> {
    return this.cache.deleteByPrefix(BROWSE_CACHE_PREFIX);
  }
}

function browseCacheKey(profileId: string, preferredGenres: string[]) {
  const preferences = [...new Set(preferredGenres.map(value => value.trim().toLocaleLowerCase()).filter(Boolean))]
    .sort()
    .join(",");
  return `${BROWSE_CACHE_PREFIX}${encodeURIComponent(profileId)}:${encodeURIComponent(preferences)}`;
}
