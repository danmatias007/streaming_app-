import { Pool, type PoolClient } from "pg";
import type { CatalogEpisode, CatalogEpisodeInput, CatalogGenre, CatalogSeason, CatalogSeasonInput, CatalogTitle, CatalogTitleInput, MediaPurpose, PublicationStatus } from "@netflix/shared-types";
import type { CatalogPlaybackSource, CatalogRepository } from "./repository.js";

interface Row { id: string; kind: "MOVIE" | "SERIES"; title: string; slug: string; synopsis: string; release_year: number; maturity_rating: string; duration_minutes: number | null; thumbnail_url: string; hero_image_url: string; preview_url: string; media_url: string; genres: CatalogGenre[]; status: PublicationStatus; created_at: Date; updated_at: Date; published_at: Date | null; }
interface GenreRow { id: string; name: string; slug: string; }
interface SeasonRow { id: string; title_id: string; season_number: number; title: string; synopsis: string; created_at: Date; updated_at: Date; }
interface EpisodeRow { id: string; season_id: string; episode_number: number; title: string; synopsis: string; duration_minutes: number; thumbnail_url: string; video_url: string; created_at: Date; updated_at: Date; }
interface PlaybackRow { content_id: string; content_type: "MOVIE" | "EPISODE"; url: string; title_status: PublicationStatus; }
const columns = `ct.id,ct.kind,ct.title,ct.slug,ct.synopsis,ct.release_year,ct.maturity_rating,ct.duration_minutes,ct.thumbnail_url,ct.hero_image_url,ct.preview_url,ct.media_url,ct.status,ct.created_at,ct.updated_at,ct.published_at,
  COALESCE((SELECT json_agg(json_build_object('id',g.id,'name',g.name,'slug',g.slug) ORDER BY g.name)
    FROM catalog_title_genres ctg JOIN catalog_genres g ON g.id=ctg.genre_id WHERE ctg.title_id=ct.id),'[]'::json) AS genres`;

export class PostgresCatalogRepository implements CatalogRepository {
  private readonly pool: Pool;
  constructor(connectionString: string) { this.pool = new Pool({ connectionString, max: 10 }); }
  async listAll() { const result = await this.pool.query<Row>(`SELECT ${columns} FROM catalog_titles ct ORDER BY ct.updated_at DESC`); return result.rows.map(mapRow); }
  async listPublished() { const result = await this.pool.query<Row>(`SELECT ${columns} FROM catalog_titles ct WHERE ct.status='PUBLISHED' ORDER BY ct.published_at DESC NULLS LAST,ct.title`); return result.rows.map(mapRow); }
  async findById(id: string) { return findTitle(this.pool, id); }
  async listGenres() { const result = await this.pool.query<GenreRow>("SELECT id,name,slug FROM catalog_genres ORDER BY name"); return result.rows; }
  async createGenre(id: string, name: string, slug: string) { const result = await this.pool.query<GenreRow>("INSERT INTO catalog_genres(id,name,slug) VALUES($1,$2,$3) RETURNING id,name,slug", [id, name, slug]); return result.rows[0]!; }
  async create(id: string, input: CatalogTitleInput) {
    return this.transaction(async client => {
      await client.query(`INSERT INTO catalog_titles(id,kind,title,slug,synopsis,release_year,maturity_rating,duration_minutes,thumbnail_url,hero_image_url,preview_url) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`, [id, ...inputValues(input)]);
      await syncGenres(client, id, input.genreIds);
      return (await findTitle(client, id))!;
    });
  }
  async update(id: string, input: CatalogTitleInput) {
    return this.transaction(async client => {
      const result = await client.query(`UPDATE catalog_titles SET kind=$2,title=$3,slug=$4,synopsis=$5,release_year=$6,maturity_rating=$7,duration_minutes=$8,thumbnail_url=$9,hero_image_url=$10,preview_url=$11,updated_at=now() WHERE id=$1`, [id, ...inputValues(input)]);
      if (result.rowCount === 0) return null;
      await syncGenres(client, id, input.genreIds);
      return findTitle(client, id);
    });
  }
  async setStatus(id: string, status: PublicationStatus) { const result = await this.pool.query(`UPDATE catalog_titles SET status=$2,updated_at=now(),published_at=CASE WHEN $2='PUBLISHED' THEN COALESCE(published_at,now()) ELSE published_at END WHERE id=$1`, [id, status]); return result.rowCount === 0 ? null : findTitle(this.pool, id); }
  async listSeasons(titleId: string) {
    const seasons = await this.pool.query<SeasonRow>("SELECT id,title_id,season_number,title,synopsis,created_at,updated_at FROM catalog_seasons WHERE title_id=$1 ORDER BY season_number", [titleId]);
    if (!seasons.rowCount) return [];
    const episodes = await this.pool.query<EpisodeRow>("SELECT id,season_id,episode_number,title,synopsis,duration_minutes,thumbnail_url,video_url,created_at,updated_at FROM catalog_episodes WHERE season_id=ANY($1::text[]) ORDER BY season_id,episode_number", [seasons.rows.map(season => season.id)]);
    const bySeason = new Map<string, CatalogEpisode[]>();
    for (const episode of episodes.rows) { const items = bySeason.get(episode.season_id) ?? []; items.push(mapEpisode(episode)); bySeason.set(episode.season_id, items); }
    return seasons.rows.map(season => mapSeason(season, bySeason.get(season.id) ?? []));
  }
  async createSeason(id: string, titleId: string, input: CatalogSeasonInput) { const result = await this.pool.query<SeasonRow>("INSERT INTO catalog_seasons(id,title_id,season_number,title,synopsis) VALUES($1,$2,$3,$4,$5) RETURNING id,title_id,season_number,title,synopsis,created_at,updated_at", [id, titleId, input.seasonNumber, input.title, input.synopsis]); return mapSeason(result.rows[0]!, []); }
  async updateSeason(id: string, input: CatalogSeasonInput) { const result = await this.pool.query<SeasonRow>("UPDATE catalog_seasons SET season_number=$2,title=$3,synopsis=$4,updated_at=now() WHERE id=$1 RETURNING id,title_id,season_number,title,synopsis,created_at,updated_at", [id, input.seasonNumber, input.title, input.synopsis]); if (!result.rows[0]) return null; const episodes = await this.pool.query<EpisodeRow>("SELECT id,season_id,episode_number,title,synopsis,duration_minutes,thumbnail_url,video_url,created_at,updated_at FROM catalog_episodes WHERE season_id=$1 ORDER BY episode_number", [id]); return mapSeason(result.rows[0], episodes.rows.map(mapEpisode)); }
  async createEpisode(id: string, seasonId: string, input: CatalogEpisodeInput) { const result = await this.pool.query<EpisodeRow>("INSERT INTO catalog_episodes(id,season_id,episode_number,title,synopsis,duration_minutes,thumbnail_url,video_url) VALUES($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id,season_id,episode_number,title,synopsis,duration_minutes,thumbnail_url,video_url,created_at,updated_at", [id, seasonId, ...episodeValues(input)]); return mapEpisode(result.rows[0]!); }
  async updateEpisode(id: string, input: CatalogEpisodeInput) { const result = await this.pool.query<EpisodeRow>("UPDATE catalog_episodes SET episode_number=$2,title=$3,synopsis=$4,duration_minutes=$5,thumbnail_url=$6,video_url=$7,updated_at=now() WHERE id=$1 RETURNING id,season_id,episode_number,title,synopsis,duration_minutes,thumbnail_url,video_url,created_at,updated_at", [id, ...episodeValues(input)]); return result.rows[0] ? mapEpisode(result.rows[0]) : null; }
  async findPlaybackSource(contentId: string): Promise<CatalogPlaybackSource | null> {
    const query = contentId.startsWith("e_")
      ? `SELECT e.id AS content_id,'EPISODE'::text AS content_type,e.video_url AS url,ct.status AS title_status FROM catalog_episodes e JOIN catalog_seasons s ON s.id=e.season_id JOIN catalog_titles ct ON ct.id=s.title_id WHERE e.id=$1`
      : `SELECT ct.id AS content_id,'MOVIE'::text AS content_type,ct.media_url AS url,ct.status AS title_status FROM catalog_titles ct WHERE ct.id=$1 AND ct.kind='MOVIE'`;
    const result = await this.pool.query<PlaybackRow>(query, [contentId]);
    const row = result.rows[0];
    return row ? { contentId: row.content_id, contentType: row.content_type, url: row.url, titleStatus: row.title_status } : null;
  }
  async mediaTargetExists(contentId: string, purpose: MediaPurpose) { if (purpose === "TRAILER") { const result = await this.pool.query("SELECT 1 FROM catalog_titles WHERE id=$1", [contentId]); return (result.rowCount ?? 0) > 0; } return Boolean(await this.findPlaybackSource(contentId)); }
  async setMediaUrl(contentId: string, purpose: MediaPurpose, url: string) { const result = purpose === "TRAILER" ? await this.pool.query("UPDATE catalog_titles SET preview_url=$2,updated_at=now() WHERE id=$1", [contentId, url]) : contentId.startsWith("e_") ? await this.pool.query("UPDATE catalog_episodes SET video_url=$2,updated_at=now() WHERE id=$1", [contentId, url]) : await this.pool.query("UPDATE catalog_titles SET media_url=$2,updated_at=now() WHERE id=$1 AND kind='MOVIE'", [contentId, url]); return (result.rowCount ?? 0) > 0; }
  async clearMediaUrl(contentId: string, purpose: MediaPurpose, expectedUrl: string) { const result = purpose === "TRAILER" ? await this.pool.query("UPDATE catalog_titles SET preview_url='',updated_at=now() WHERE id=$1 AND preview_url=$2", [contentId, expectedUrl]) : contentId.startsWith("e_") ? await this.pool.query("UPDATE catalog_episodes SET video_url='',updated_at=now() WHERE id=$1 AND video_url=$2", [contentId, expectedUrl]) : await this.pool.query("UPDATE catalog_titles SET media_url='',updated_at=now() WHERE id=$1 AND kind='MOVIE' AND media_url=$2", [contentId, expectedUrl]); return (result.rowCount ?? 0) > 0; }
  async close() { await this.pool.end(); }
  private async transaction<T>(operation: (client: PoolClient) => Promise<T>) {
    const client = await this.pool.connect();
    try { await client.query("BEGIN"); const result = await operation(client); await client.query("COMMIT"); return result; }
    catch (error) { await client.query("ROLLBACK"); throw error; }
    finally { client.release(); }
  }
}

async function findTitle(database: Pool | PoolClient, id: string) { const result = await database.query<Row>(`SELECT ${columns} FROM catalog_titles ct WHERE ct.id=$1`, [id]); return result.rows[0] ? mapRow(result.rows[0]) : null; }
async function syncGenres(client: PoolClient, titleId: string, genreIds: string[]) { await client.query("DELETE FROM catalog_title_genres WHERE title_id=$1", [titleId]); if (genreIds.length) await client.query("INSERT INTO catalog_title_genres(title_id,genre_id) SELECT $1,unnest($2::text[])", [titleId, genreIds]); }
function inputValues(input: CatalogTitleInput) { return [input.kind, input.title, input.slug, input.synopsis, input.releaseYear, input.maturityRating, input.durationMinutes, input.thumbnailUrl, input.heroImageUrl, input.previewUrl]; }
function mapRow(row: Row): CatalogTitle { return { id: row.id, kind: row.kind, title: row.title, slug: row.slug, synopsis: row.synopsis, releaseYear: row.release_year, maturityRating: row.maturity_rating, durationMinutes: row.duration_minutes, thumbnailUrl: row.thumbnail_url, heroImageUrl: row.hero_image_url, previewUrl: row.preview_url, mediaUrl: row.media_url, genres: row.genres, status: row.status, createdAt: row.created_at.toISOString(), updatedAt: row.updated_at.toISOString(), publishedAt: row.published_at?.toISOString() ?? null }; }
function episodeValues(input: CatalogEpisodeInput) { return [input.episodeNumber, input.title, input.synopsis, input.durationMinutes, input.thumbnailUrl, input.videoUrl]; }
function mapSeason(row: SeasonRow, episodes: CatalogEpisode[]): CatalogSeason { return { id: row.id, titleId: row.title_id, seasonNumber: row.season_number, title: row.title, synopsis: row.synopsis, episodes, createdAt: row.created_at.toISOString(), updatedAt: row.updated_at.toISOString() }; }
function mapEpisode(row: EpisodeRow): CatalogEpisode { return { id: row.id, seasonId: row.season_id, episodeNumber: row.episode_number, title: row.title, synopsis: row.synopsis, durationMinutes: row.duration_minutes, thumbnailUrl: row.thumbnail_url, videoUrl: row.video_url, createdAt: row.created_at.toISOString(), updatedAt: row.updated_at.toISOString() }; }
