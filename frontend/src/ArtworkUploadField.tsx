import { useId, useState, type ChangeEvent } from "react";
import { adminUploadArtwork } from "./api";

interface ArtworkUploadFieldProps {
  accessToken: string;
  label: string;
  value: string;
  help: string;
  onChange: (url: string) => void;
}

export function ArtworkUploadField({ accessToken, label, value, help, onChange }: ArtworkUploadFieldProps) {
  const fileId = useId();
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");

  async function upload(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    setUploading(true); setError("");
    try { const result = await adminUploadArtwork(accessToken, file); onChange(result.url); }
    catch (failure) { setError(failure instanceof Error ? failure.message : "Não foi possível enviar esta imagem."); }
    finally { setUploading(false); }
  }

  return <section className="artwork-field">
    <div className="artwork-field__preview" style={value ? { backgroundImage: `url(${value})` } : undefined}>
      {!value && <span>Sem imagem</span>}
    </div>
    <div className="artwork-field__body">
      <div><strong>{label}</strong><small>{help}</small></div>
      <input aria-label={`${label} URL`} value={value} placeholder="https://… ou envie um arquivo" onChange={event => onChange(event.target.value)}/>
      <label className={`artwork-upload${uploading ? " is-uploading" : ""}`} htmlFor={fileId} aria-disabled={uploading}>
        {uploading ? "Enviando imagem…" : value ? "Trocar imagem" : "Selecionar imagem"}
      </label>
      <input id={fileId} className="artwork-file" type="file" accept="image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp" disabled={uploading} onChange={event => void upload(event)}/>
      {error && <p role="alert">{error}</p>}
    </div>
  </section>;
}
