import type { MediaJobStatus } from "@netflix/shared-types";
import type { MediaJobRecord, MediaRepository } from "./repository.js";

export class MemoryMediaRepository implements MediaRepository {
  private readonly jobs = new Map<string, MediaJobRecord>();
  async create(job: MediaJobRecord) { this.jobs.set(job.id, job); return job; }
  async findById(id: string) { return this.jobs.get(id) ?? null; }
  async update(id: string, status: MediaJobStatus, outputUrl = "", errorMessage = "") { const current = this.jobs.get(id); if (!current) return null; const updated = { ...current, status, outputUrl, errorMessage, updatedAt: new Date().toISOString() }; this.jobs.set(id, updated); return updated; }
  async list(contentId?: string) { return [...this.jobs.values()].filter(job => !contentId || job.contentId === contentId).sort((a, b) => b.createdAt.localeCompare(a.createdAt)); }
  async close() {}
}
