import type {
  BrowseResponse,
  PlaybackAuthorizationResponse
} from "@netflix/shared-types";
import type { CatalogRepository } from "../catalog/repository.js";

export interface CoreServices {
  getBrowse(profileId: string, preferredGenres?: string[]): Promise<BrowseResponse>;
  authorizePlayback(
    profileId: string,
    contentId: string
  ): Promise<PlaybackAuthorizationResponse>;
}

export class LocalCoreServices implements CoreServices {
  async getBrowse(profileId: string, _preferredGenres: string[] = []): Promise<BrowseResponse> {
    return {
      profile: {
        id: profileId,
        name: "Usuario Principal",
        avatar: "https://cdn.example.test/avatars/a1.png"
      },
      billboard: {
        id: "m_7721",
        title: "Stranger Things",
        synopsis: "Um grupo de amigos descobre misterios sobrenaturais em Hawkins.",
        videoPreviewUrl: "https://stream.example.test/trailer_7721.mpd"
      },
      rows: [
        {
          rowId: "row_trending",
          title: "Em Alta",
          movies: [
            {
              id: "m_101",
              title: "The Witcher",
              thumbnail: "https://cdn.example.test/movies/w101.jpg",
              kind: "SERIES",
              synopsis: "Um caçador de monstros atravessa um continente marcado por magia e conflitos.",
              releaseYear: 2026,
              maturityRating: "16",
              durationMinutes: null,
              genres: ["Fantasia", "Aventura"]
            }
          ]
        }
      ]
    };
  }

  async authorizePlayback(
    _profileId: string,
    contentId: string
  ): Promise<PlaybackAuthorizationResponse> {
    return {
      contentId,
      contentType: contentId.startsWith("e_") ? "EPISODE" : "MOVIE",
      movieId: contentId,
      playbackStatus: "AUTHORIZED",
      manifestUrl: `https://edge-stream.example.test/${encodeURIComponent(contentId)}/manifest.mpd`,
      drmLicenseServer: "https://drm.example.test/widevine/license",
      telemetryIntervalMs: 5_000
    };
  }
}

export class CatalogCoreServices implements CoreServices {
  constructor(private readonly catalog: CatalogRepository, private readonly resolveMediaUrl: (url: string) => string = url => url) {}
  async getBrowse(profileId: string, preferredGenres: string[] = []): Promise<BrowseResponse> {
    const titles = await this.catalog.listPublished();
    if (!titles.length) return new LocalCoreServices().getBrowse(profileId, preferredGenres);
    const billboard = titles[0]!;
    const preferences = new Set(preferredGenres.map(value => value.toLocaleLowerCase()));
    const recommended = preferences.size ? [...titles].sort((a, b) => score(b) - score(a)) : titles;
    function score(title: typeof titles[number]) { return title.genres.reduce((total, genre) => total + (preferences.has(genre.name.toLocaleLowerCase()) || preferences.has(genre.slug.toLocaleLowerCase()) ? 1 : 0), 0); }
    return {
      profile: { id: profileId, name: "Perfil Cinevault", avatar: "CV" },
      billboard: { id: billboard.id, title: billboard.title, synopsis: billboard.synopsis, videoPreviewUrl: billboard.previewUrl },
      rows: [...(preferences.size ? [{ rowId: "row_for_you", title: "Escolhidos para você", movies: recommended.map(summary) }] : []), { rowId: "row_latest", title: "Novidades no Cinevault", movies: titles.map(summary) }]
    };
    function summary(title: typeof titles[number]) { return { id: title.id, title: title.title, thumbnail: title.thumbnailUrl || title.heroImageUrl, kind: title.kind, synopsis: title.synopsis, releaseYear: title.releaseYear, maturityRating: title.maturityRating, durationMinutes: title.durationMinutes, genres: title.genres.map(genre => genre.name) }; }
  }
  async authorizePlayback(_profileId: string, contentId: string): Promise<PlaybackAuthorizationResponse> {
    const source = await this.catalog.findPlaybackSource(contentId);
    if (!source || source.titleStatus !== "PUBLISHED") return { contentId, contentType: contentId.startsWith("e_") ? "EPISODE" : "MOVIE", movieId: contentId, playbackStatus: "DENIED", manifestUrl: "", drmLicenseServer: "", telemetryIntervalMs: 5_000 };
    return { contentId, contentType: source.contentType, movieId: contentId, playbackStatus: "AUTHORIZED", manifestUrl: this.resolveMediaUrl(source.url), drmLicenseServer: "", telemetryIntervalMs: 5_000 };
  }
}
