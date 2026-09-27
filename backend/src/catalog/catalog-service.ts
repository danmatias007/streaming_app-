import { randomUUID } from "node:crypto";
import type { CatalogEpisodeInput, CatalogSeasonInput, CatalogTitleInput, PublicationStatus, TitleDetailsResponse } from "@netflix/shared-types";
import type { CatalogRepository } from "./repository.js";

export class InvalidCatalogTitleError extends Error {}

export class CatalogService {
  constructor(private readonly repository: CatalogRepository, private readonly resolveMediaUrl: (url: string) => string = url => url) {}
  listAll() { return this.repository.listAll(); }
  listPublished() { return this.repository.listPublished(); }
  async getPublishedDetails(id: string): Promise<TitleDetailsResponse | null> {
    const title = await this.repository.findById(id);
    if (!title || title.status !== "PUBLISHED") return null;
    const seasons = title.kind === "SERIES" ? await this.repository.listSeasons(id) : [];
    return { id: title.id, kind: title.kind, title: title.title, synopsis: title.synopsis, releaseYear: title.releaseYear, maturityRating: title.maturityRating, durationMinutes: title.durationMinutes, heroImageUrl: title.heroImageUrl, trailerUrl: this.resolveMediaUrl(title.previewUrl), genres: title.genres, seasons: seasons.map(season => ({ id: season.id, seasonNumber: season.seasonNumber, title: season.title, synopsis: season.synopsis, episodes: season.episodes.map(episode => ({ id: episode.id, episodeNumber: episode.episodeNumber, title: episode.title, synopsis: episode.synopsis, durationMinutes: episode.durationMinutes, thumbnailUrl: episode.thumbnailUrl })) })) };
  }
  listGenres() { return this.repository.listGenres(); }
  createGenre(name: string, slug: string) {
    const normalizedName = name.trim();
    const normalizedSlug = slug.trim().toLowerCase();
    if (normalizedName.length < 2 || normalizedName.length > 80) throw new InvalidCatalogTitleError("Genre name must have between 2 and 80 characters");
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(normalizedSlug)) throw new InvalidCatalogTitleError("Genre slug is invalid");
    return this.repository.createGenre(`g_${randomUUID().replaceAll("-", "").slice(0, 16)}`, normalizedName, normalizedSlug);
  }
  async create(input: CatalogTitleInput) { validate(input); return this.repository.create(`m_${randomUUID().replaceAll("-", "").slice(0, 16)}`, normalize(input)); }
  async update(id: string, input: CatalogTitleInput) { validate(input); if (input.kind === "MOVIE" && (await this.repository.listSeasons(id)).length > 0) throw new InvalidCatalogTitleError("A series with seasons cannot be changed into a movie"); return this.repository.update(id, normalize(input)); }
  async setStatus(id: string, status: PublicationStatus) {
    if (status === "PUBLISHED") {
      const title = await this.repository.findById(id);
      if (!title) return null;
      if (title.kind === "SERIES") { const seasons = await this.repository.listSeasons(id); if (!seasons.some(season => season.episodes.length > 0)) throw new InvalidCatalogTitleError("A series needs at least one episode before publication"); }
    }
    return this.repository.setStatus(id, status);
  }
  listSeasons(titleId: string) { return this.repository.listSeasons(titleId); }
  async createSeason(titleId: string, input: CatalogSeasonInput) {
    validateSeason(input);
    const title = await this.repository.findById(titleId);
    if (!title) return null;
    if (title.kind !== "SERIES") throw new InvalidCatalogTitleError("Seasons can only be added to a series");
    return this.repository.createSeason(`s_${randomUUID().replaceAll("-", "").slice(0, 16)}`, titleId, normalizeSeason(input));
  }
  updateSeason(id: string, input: CatalogSeasonInput) { validateSeason(input); return this.repository.updateSeason(id, normalizeSeason(input)); }
  createEpisode(seasonId: string, input: CatalogEpisodeInput) { validateEpisode(input); return this.repository.createEpisode(`e_${randomUUID().replaceAll("-", "").slice(0, 16)}`, seasonId, normalizeEpisode(input)); }
  updateEpisode(id: string, input: CatalogEpisodeInput) { validateEpisode(input); return this.repository.updateEpisode(id, normalizeEpisode(input)); }
}

function normalize(input: CatalogTitleInput): CatalogTitleInput { return { ...input, title: input.title.trim(), slug: input.slug.trim().toLowerCase(), synopsis: input.synopsis.trim(), maturityRating: input.maturityRating.trim(), thumbnailUrl: input.thumbnailUrl.trim(), heroImageUrl: input.heroImageUrl.trim(), previewUrl: input.previewUrl.trim(), genreIds: [...new Set(input.genreIds)] }; }
function validate(input: CatalogTitleInput) {
  if (input.kind !== "MOVIE" && input.kind !== "SERIES") throw new InvalidCatalogTitleError("Invalid title kind");
  if (input.title.trim().length < 2 || input.title.length > 160) throw new InvalidCatalogTitleError("Title must have between 2 and 160 characters");
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(input.slug.trim().toLowerCase())) throw new InvalidCatalogTitleError("Slug must contain lowercase letters, numbers and hyphens");
  if (input.synopsis.trim().length < 20 || input.synopsis.length > 2000) throw new InvalidCatalogTitleError("Synopsis must have between 20 and 2000 characters");
  if (!Number.isInteger(input.releaseYear) || input.releaseYear < 1888 || input.releaseYear > 2200) throw new InvalidCatalogTitleError("Release year is invalid");
  if (!input.maturityRating.trim() || input.maturityRating.length > 10) throw new InvalidCatalogTitleError("Maturity rating is invalid");
  if (input.durationMinutes !== null && (!Number.isInteger(input.durationMinutes) || input.durationMinutes < 1 || input.durationMinutes > 10_000)) throw new InvalidCatalogTitleError("Duration is invalid");
  if (!Array.isArray(input.genreIds) || input.genreIds.some(id => !/^g_[A-Za-z0-9_-]+$/.test(id))) throw new InvalidCatalogTitleError("Genres are invalid");
  for (const [name, value] of [["thumbnailUrl", input.thumbnailUrl], ["heroImageUrl", input.heroImageUrl], ["previewUrl", input.previewUrl]] as const) if (value && !isSafeUrl(value)) throw new InvalidCatalogTitleError(`${name} is invalid`);
}
function isSafeUrl(value: string) { return value.startsWith("/") || /^https:\/\/[^\s]+$/i.test(value); }
function normalizeSeason(input: CatalogSeasonInput): CatalogSeasonInput { return { ...input, title: input.title.trim(), synopsis: input.synopsis.trim() }; }
function validateSeason(input: CatalogSeasonInput) {
  if (!Number.isInteger(input.seasonNumber) || input.seasonNumber < 1 || input.seasonNumber > 999) throw new InvalidCatalogTitleError("Season number is invalid");
  if (input.title.trim().length < 2 || input.title.length > 160) throw new InvalidCatalogTitleError("Season title is invalid");
  if (input.synopsis.length > 2000) throw new InvalidCatalogTitleError("Season synopsis is too long");
}
function normalizeEpisode(input: CatalogEpisodeInput): CatalogEpisodeInput { return { ...input, title: input.title.trim(), synopsis: input.synopsis.trim(), thumbnailUrl: input.thumbnailUrl.trim(), videoUrl: input.videoUrl.trim() }; }
function validateEpisode(input: CatalogEpisodeInput) {
  if (!Number.isInteger(input.episodeNumber) || input.episodeNumber < 1 || input.episodeNumber > 9999) throw new InvalidCatalogTitleError("Episode number is invalid");
  if (input.title.trim().length < 2 || input.title.length > 160) throw new InvalidCatalogTitleError("Episode title is invalid");
  if (input.synopsis.trim().length < 10 || input.synopsis.length > 2000) throw new InvalidCatalogTitleError("Episode synopsis is invalid");
  if (!Number.isInteger(input.durationMinutes) || input.durationMinutes < 1 || input.durationMinutes > 10000) throw new InvalidCatalogTitleError("Episode duration is invalid");
  if ((input.thumbnailUrl && !isSafeUrl(input.thumbnailUrl)) || (input.videoUrl && !isSafeUrl(input.videoUrl))) throw new InvalidCatalogTitleError("Episode media URL is invalid");
}
