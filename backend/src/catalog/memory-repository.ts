import type { CatalogEpisode, CatalogEpisodeInput, CatalogGenre, CatalogSeason, CatalogSeasonInput, CatalogTitle, CatalogTitleInput, MediaPurpose, PublicationStatus } from "@netflix/shared-types";
import type { CatalogRepository } from "./repository.js";

export class MemoryCatalogRepository implements CatalogRepository {
  private readonly titles = new Map<string, CatalogTitle>();
  private readonly genres = new Map<string, CatalogGenre>([
    ["g_drama", { id: "g_drama", name: "Drama", slug: "drama" }],
    ["g_suspense", { id: "g_suspense", name: "Suspense", slug: "suspense" }]
  ]);
  private readonly seasons = new Map<string, CatalogSeason>();
  constructor() {
    const now = new Date().toISOString();
    this.titles.set("m_7721", { id: "m_7721", kind: "MOVIE", title: "Ecos do Abismo", slug: "ecos-do-abismo", synopsis: "Uma cartografa encontra uma cidade que nao deveria existir.", releaseYear: 2026, maturityRating: "16", durationMinutes: 128, thumbnailUrl: "/assets/hero-cidade-carmim.png", heroImageUrl: "/assets/hero-cidade-carmim.png", previewUrl: "", mediaUrl: "", genres: [this.genres.get("g_suspense")!], status: "PUBLISHED", createdAt: now, updatedAt: now, publishedAt: now });
  }
  async listAll() { return [...this.titles.values()].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)); }
  async listPublished() { return (await this.listAll()).filter(title => title.status === "PUBLISHED"); }
  async findById(id: string) { return this.titles.get(id) ?? null; }
  async listGenres() { return [...this.genres.values()].sort((a, b) => a.name.localeCompare(b.name)); }
  async createGenre(id: string, name: string, slug: string) { const genre = { id, name, slug }; this.genres.set(id, genre); return genre; }
  async create(id: string, input: CatalogTitleInput) { const now = new Date().toISOString(); const { genreIds, ...fields } = input; const title: CatalogTitle = { id, ...fields, mediaUrl: "", genres: this.resolveGenres(genreIds), status: "DRAFT", createdAt: now, updatedAt: now, publishedAt: null }; this.titles.set(id, title); return title; }
  async update(id: string, input: CatalogTitleInput) { const current = this.titles.get(id); if (!current) return null; const { genreIds, ...fields } = input; const updated = { ...current, ...fields, genres: this.resolveGenres(genreIds), updatedAt: new Date().toISOString() }; this.titles.set(id, updated); return updated; }
  async setStatus(id: string, status: PublicationStatus) { const current = this.titles.get(id); if (!current) return null; const now = new Date().toISOString(); const updated = { ...current, status, updatedAt: now, publishedAt: status === "PUBLISHED" ? now : current.publishedAt }; this.titles.set(id, updated); return updated; }
  async listSeasons(titleId: string) { return [...this.seasons.values()].filter(season => season.titleId === titleId).sort((a, b) => a.seasonNumber - b.seasonNumber); }
  async createSeason(id: string, titleId: string, input: CatalogSeasonInput) { const now = new Date().toISOString(); const season: CatalogSeason = { id, titleId, ...input, episodes: [], createdAt: now, updatedAt: now }; this.seasons.set(id, season); return season; }
  async updateSeason(id: string, input: CatalogSeasonInput) { const current = this.seasons.get(id); if (!current) return null; const season = { ...current, ...input, updatedAt: new Date().toISOString() }; this.seasons.set(id, season); return season; }
  async createEpisode(id: string, seasonId: string, input: CatalogEpisodeInput) { const season = this.seasons.get(seasonId)!; const now = new Date().toISOString(); const episode: CatalogEpisode = { id, seasonId, ...input, createdAt: now, updatedAt: now }; season.episodes = [...season.episodes, episode].sort((a, b) => a.episodeNumber - b.episodeNumber); season.updatedAt = now; return episode; }
  async updateEpisode(id: string, input: CatalogEpisodeInput) { for (const season of this.seasons.values()) { const index = season.episodes.findIndex(episode => episode.id === id); if (index < 0) continue; const episode = { ...season.episodes[index]!, ...input, updatedAt: new Date().toISOString() }; season.episodes[index] = episode; season.episodes.sort((a, b) => a.episodeNumber - b.episodeNumber); return episode; } return null; }
  async findPlaybackSource(contentId: string) { const title = this.titles.get(contentId); if (title?.kind === "MOVIE") return { contentId, contentType: "MOVIE" as const, url: title.mediaUrl, titleStatus: title.status }; for (const season of this.seasons.values()) { const episode = season.episodes.find(item => item.id === contentId); if (!episode) continue; const parent = this.titles.get(season.titleId); if (!parent) return null; return { contentId, contentType: "EPISODE" as const, url: episode.videoUrl, titleStatus: parent.status }; } return null; }
  async mediaTargetExists(contentId: string, purpose: MediaPurpose) { return purpose === "TRAILER" ? this.titles.has(contentId) : Boolean(await this.findPlaybackSource(contentId)); }
  async setMediaUrl(contentId: string, purpose: MediaPurpose, url: string) { const title = this.titles.get(contentId); if (purpose === "TRAILER" && title) { title.previewUrl = url; return true; } if (title?.kind === "MOVIE") { title.mediaUrl = url; return true; } for (const season of this.seasons.values()) { const episode = season.episodes.find(item => item.id === contentId); if (episode) { episode.videoUrl = url; return true; } } return false; }
  async clearMediaUrl(contentId: string, purpose: MediaPurpose, expectedUrl: string) { const title = this.titles.get(contentId); if (purpose === "TRAILER" && title?.previewUrl === expectedUrl) { title.previewUrl = ""; return true; } if (purpose === "MAIN_CONTENT" && title?.kind === "MOVIE" && title.mediaUrl === expectedUrl) { title.mediaUrl = ""; return true; } for (const season of this.seasons.values()) { const episode = season.episodes.find(item => item.id === contentId); if (purpose === "MAIN_CONTENT" && episode?.videoUrl === expectedUrl) { episode.videoUrl = ""; return true; } } return false; }
  async close() {}
  private resolveGenres(ids: string[]) { return ids.map(id => this.genres.get(id)).filter((genre): genre is CatalogGenre => Boolean(genre)); }
}
