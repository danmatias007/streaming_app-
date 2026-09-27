import { Pool } from "pg";
import type { MediaJobStatus, MediaPurpose } from "@netflix/shared-types";
import type { MediaJobRecord, MediaRepository } from "./repository.js";

interface Row { id: string; content_id: string; media_purpose: MediaPurpose; original_filename: string; size_bytes: string; source_path: string; status: MediaJobStatus; output_url: string; error_message: string; created_at: Date; updated_at: Date; }
const columns = "id,content_id,media_purpose,original_filename,size_bytes,source_path,status,output_url,error_message,created_at,updated_at";
export class PostgresMediaRepository implements MediaRepository {
  private readonly pool: Pool;
  constructor(connectionString: string) { this.pool = new Pool({ connectionString, max: 4 }); }
  async create(job: MediaJobRecord) { const result = await this.pool.query<Row>(`INSERT INTO media_jobs(id,content_id,media_purpose,original_filename,size_bytes,source_path,status,output_url,error_message,created_at,updated_at) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING ${columns}`, [job.id, job.contentId, job.purpose, job.originalFilename, job.sizeBytes, job.sourcePath, job.status, job.outputUrl, job.errorMessage, job.createdAt, job.updatedAt]); return map(result.rows[0]!); }
  async findById(id: string) { const result = await this.pool.query<Row>(`SELECT ${columns} FROM media_jobs WHERE id=$1`, [id]); return result.rows[0] ? map(result.rows[0]) : null; }
  async update(id: string, status: MediaJobStatus, outputUrl = "", errorMessage = "") { const result = await this.pool.query<Row>(`UPDATE media_jobs SET status=$2,output_url=$3,error_message=$4,updated_at=now() WHERE id=$1 RETURNING ${columns}`, [id, status, outputUrl, errorMessage]); return result.rows[0] ? map(result.rows[0]) : null; }
  async list(contentId?: string) { const result = contentId ? await this.pool.query<Row>(`SELECT ${columns} FROM media_jobs WHERE content_id=$1 ORDER BY created_at DESC`, [contentId]) : await this.pool.query<Row>(`SELECT ${columns} FROM media_jobs ORDER BY created_at DESC LIMIT 100`); return result.rows.map(map); }
  async close() { await this.pool.end(); }
}
function map(row: Row): MediaJobRecord { return { id: row.id, contentId: row.content_id, purpose: row.media_purpose, originalFilename: row.original_filename, sizeBytes: Number(row.size_bytes), sourcePath: row.source_path, status: row.status, outputUrl: row.output_url, errorMessage: row.error_message, createdAt: row.created_at.toISOString(), updatedAt: row.updated_at.toISOString() }; }
