import type { MediaJob, MediaJobStatus } from "@netflix/shared-types";

export interface MediaJobRecord extends MediaJob { sourcePath: string; }
export interface MediaRepository {
  create(job: MediaJobRecord): Promise<MediaJobRecord>;
  findById(id: string): Promise<MediaJobRecord | null>;
  update(id: string, status: MediaJobStatus, outputUrl?: string, errorMessage?: string): Promise<MediaJobRecord | null>;
  list(contentId?: string): Promise<MediaJobRecord[]>;
  close(): Promise<void>;
}
