import type { CatalogEpisode, CatalogEpisodeInput, CatalogGenre, CatalogSeason, CatalogSeasonInput, CatalogTitle, CatalogTitleInput, MediaPurpose, PublicationStatus } from "@netflix/shared-types";

export interface CatalogPlaybackSource { contentId: string; contentType: "MOVIE" | "EPISODE"; url: string; titleStatus: PublicationStatus; }

export interface CatalogRepository {
  listAll(): Promise<CatalogTitle[]>;
  listPublished(): Promise<CatalogTitle[]>;
  findById(id: string): Promise<CatalogTitle | null>;
  listGenres(): Promise<CatalogGenre[]>;
  createGenre(id: string, name: string, slug: string): Promise<CatalogGenre>;
  create(id: string, input: CatalogTitleInput): Promise<CatalogTitle>;
  update(id: string, input: CatalogTitleInput): Promise<CatalogTitle | null>;
  setStatus(id: string, status: PublicationStatus): Promise<CatalogTitle | null>;
  listSeasons(titleId: string): Promise<CatalogSeason[]>;
  createSeason(id: string, titleId: string, input: CatalogSeasonInput): Promise<CatalogSeason>;
  updateSeason(id: string, input: CatalogSeasonInput): Promise<CatalogSeason | null>;
  createEpisode(id: string, seasonId: string, input: CatalogEpisodeInput): Promise<CatalogEpisode>;
  updateEpisode(id: string, input: CatalogEpisodeInput): Promise<CatalogEpisode | null>;
  findPlaybackSource(contentId: string): Promise<CatalogPlaybackSource | null>;
  mediaTargetExists(contentId: string, purpose: MediaPurpose): Promise<boolean>;
  setMediaUrl(contentId: string, purpose: MediaPurpose, url: string): Promise<boolean>;
  clearMediaUrl(contentId: string, purpose: MediaPurpose, expectedUrl: string): Promise<boolean>;
  close(): Promise<void>;
}
