import { useEffect, useState, type FormEvent } from "react";
import type { MediaJob, MediaPurpose } from "@netflix/shared-types";
import { adminDeleteMediaJob, adminListMediaJobs, adminUploadMedia } from "./api";

export function MediaUploadPanel({ accessToken, contentId, label, purposes = ["MAIN_CONTENT"], onClose }: { accessToken: string; contentId: string; label: string; purposes?: MediaPurpose[]; onClose: () => void }) {
  const [jobs, setJobs] = useState<MediaJob[]>([]);
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [deletingId, setDeletingId] = useState("");
  const [error, setError] = useState("");
  const [purpose, setPurpose] = useState<MediaPurpose>(purposes[0] ?? "MAIN_CONTENT");

  async function load() { const result = await adminListMediaJobs(accessToken, contentId); setJobs(result.items); return result.items; }
  useEffect(() => { setJobs([]); setError(""); void load().catch(() => setError("Não foi possível carregar os processamentos.")); }, [accessToken, contentId]);
  useEffect(() => { if (!jobs.some(job => job.status === "QUEUED" || job.status === "PROCESSING")) return; const timer = window.setInterval(() => { void load(); }, 3000); return () => window.clearInterval(timer); }, [jobs, accessToken, contentId]);

  async function submit(event: FormEvent) {
    event.preventDefault(); if (!file) return; setUploading(true); setError("");
    try { const job = await adminUploadMedia(accessToken, contentId, purpose, file); setJobs(current => [job, ...current]); setFile(null); }
    catch (failure) { setError(failure instanceof Error ? failure.message : "O upload foi rejeitado. Use MP4, WebM, MOV ou MKV com até 5 GB."); }
    finally { setUploading(false); }
  }

  async function deleteJob(job: MediaJob) {
    if (!window.confirm(`Excluir definitivamente o arquivo "${job.originalFilename}" e todas as suas qualidades?`)) return;
    setDeletingId(job.id); setError("");
    try { const deleted = await adminDeleteMediaJob(accessToken, job.id); setJobs(current => current.map(item => item.id === deleted.id ? deleted : item)); }
    catch (failure) { setError(failure instanceof Error ? failure.message : "Não foi possível excluir a mídia."); }
    finally { setDeletingId(""); }
  }

  return <section className="media-upload">
    <header><div><span>PIPELINE DE MÍDIA</span><h4>{label}</h4></div><button type="button" onClick={onClose}>Fechar</button></header>
    {purposes.length > 1 && <div className="media-purpose-tabs">{purposes.map(option => <button type="button" key={option} className={purpose === option ? "active" : ""} onClick={() => setPurpose(option)}>{purposeLabel(option)}</button>)}</div>}
    <div className="media-purpose-help"><strong>{purposeLabel(purpose)}</strong><span>{purpose === "TRAILER" ? "Prévia curta exibida na apresentação do título." : "Vídeo principal protegido para reprodução do assinante."}</span></div>
    <form onSubmit={submit}><input type="file" accept="video/mp4,video/webm,video/quicktime,video/x-matroska,.mkv" onChange={event => setFile(event.target.files?.[0] ?? null)} required/><button disabled={uploading}>{uploading ? "Enviando..." : `Enviar ${purpose === "TRAILER" ? "trailer" : "conteúdo"}`}</button></form>
    {error && <div className="login-error">{error}</div>}
    <div className="media-jobs">{jobs.map(job => <article key={job.id}>
      <span className={`media-status media-status--${job.status.toLowerCase()}`}>{status(job.status)}</span>
      <div><strong>{job.originalFilename}</strong><small>{purposeLabel(job.purpose)} · {formatBytes(job.sizeBytes)} · {new Date(job.createdAt).toLocaleString()}</small>{job.errorMessage && <p>{job.errorMessage}</p>}</div>
      {job.status === "READY" && <button type="button" className="media-delete" disabled={deletingId === job.id} onClick={() => void deleteJob(job)}>{deletingId === job.id ? "Excluindo..." : "Excluir"}</button>}
    </article>)}</div>
    <p className="media-note">Trailer e conteúdo principal são armazenados separadamente. Um upload nunca substitui o outro.</p>
  </section>;
}

function purposeLabel(value: MediaPurpose) { return value === "TRAILER" ? "Trailer" : "Conteúdo principal"; }
function status(value: MediaJob["status"]) { return value === "QUEUED" ? "Na fila" : value === "PROCESSING" ? "Convertendo" : value === "READY" ? "Pronto" : value === "DELETED" ? "Excluído" : "Falhou"; }
function formatBytes(bytes: number) { if (bytes >= 1024 ** 3) return `${(bytes / 1024 ** 3).toFixed(1)} GB`; if (bytes >= 1024 ** 2) return `${(bytes / 1024 ** 2).toFixed(1)} MB`; return `${Math.ceil(bytes / 1024)} KB`; }
