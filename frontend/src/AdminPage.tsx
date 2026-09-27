import { useEffect, useState, type FormEvent } from "react";
import type { CatalogGenre, CatalogTitle, CatalogTitleInput, MediaPurpose } from "@netflix/shared-types";
import { adminCreateGenre, adminCreateTitle, adminListGenres, adminListTitles, adminSetTitleStatus, adminUpdateTitle } from "./api";
import { SeriesManager } from "./SeriesManager";
import { MediaUploadPanel } from "./MediaUploadPanel";
import { ArtworkUploadField } from "./ArtworkUploadField";
import { LanguageSelector, useI18n } from "./I18nContext";

function emptyTitle(): CatalogTitleInput { return { kind: "MOVIE", title: "", slug: "", synopsis: "", releaseYear: new Date().getFullYear(), maturityRating: "14", durationMinutes: 90, thumbnailUrl: "/assets/hero-cidade-carmim.png", heroImageUrl: "/assets/hero-cidade-carmim.png", previewUrl: "", genreIds: [] }; }

export function AdminPage({ accessToken, onLogout }: { accessToken: string; onLogout: () => void }) {
  const { t } = useI18n();
  const [items, setItems] = useState<CatalogTitle[]>([]);
  const [genres, setGenres] = useState<CatalogGenre[]>([]);
  const [input, setInput] = useState<CatalogTitleInput>(emptyTitle);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [managingSeries, setManagingSeries] = useState<CatalogTitle | null>(null);
  const [mediaTarget, setMediaTarget] = useState<{ id: string; label: string; purposes: MediaPurpose[] } | null>(null);
  const [genreName, setGenreName] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [statusChangingId, setStatusChangingId] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  useEffect(() => {
    setLoading(true);
    Promise.all([adminListTitles(accessToken), adminListGenres(accessToken)])
      .then(([titlesResult, genresResult]) => { setItems(titlesResult.items); setGenres(genresResult.items); })
      .catch(() => setError("Não foi possível carregar o catálogo."))
      .finally(() => setLoading(false));
  }, [accessToken]);

  function change<K extends keyof CatalogTitleInput>(key: K, value: CatalogTitleInput[K]) { setInput(current => ({ ...current, [key]: value })); }
  function titleChanged(title: string) { setInput(current => ({ ...current, title, slug: current.slug && current.slug !== slugify(current.title) ? current.slug : slugify(title) })); }
  function toggleGenre(id: string) { change("genreIds", input.genreIds.includes(id) ? input.genreIds.filter(current => current !== id) : [...input.genreIds, id]); }
  function resetForm() { setInput(emptyTitle()); setEditingId(null); }

  async function submit(event: FormEvent) {
    event.preventDefault(); setSaving(true); setError(""); setNotice("");
    try {
      const saved = editingId ? await adminUpdateTitle(accessToken, editingId, input) : await adminCreateTitle(accessToken, input);
      setItems(current => editingId ? current.map(item => item.id === editingId ? saved : item) : [saved, ...current]);
      setNotice(editingId ? "Alterações salvas." : "Título salvo como rascunho.");
      resetForm();
    } catch { setError("Revise os campos. O slug deve ser único e a sinopse precisa ter ao menos 20 caracteres."); }
    finally { setSaving(false); }
  }

  function edit(item: CatalogTitle) {
    setEditingId(item.id);
    setInput({ kind: item.kind, title: item.title, slug: item.slug, synopsis: item.synopsis, releaseYear: item.releaseYear, maturityRating: item.maturityRating, durationMinutes: item.durationMinutes, thumbnailUrl: item.thumbnailUrl, heroImageUrl: item.heroImageUrl, previewUrl: item.previewUrl, genreIds: item.genres.map(genre => genre.id) });
    setError(""); setNotice(""); window.scrollTo({ top: 180, behavior: "smooth" });
  }

  async function createGenre() {
    const name = genreName.trim(); if (!name) return;
    setError("");
    try { const created = await adminCreateGenre(accessToken, name, slugify(name)); setGenres(current => [...current, created].sort((a, b) => a.name.localeCompare(b.name))); setGenreName(""); toggleGenre(created.id); }
    catch { setError("Não foi possível criar o gênero. Verifique se ele já existe."); }
  }

  async function setStatus(id: string, status: "PUBLISHED" | "ARCHIVED") {
    setError(""); setNotice(""); setStatusChangingId(id);
    try { const updated = await adminSetTitleStatus(accessToken, id, status); setItems(current => current.map(item => item.id === id ? updated : item)); setNotice(status === "PUBLISHED" ? "Título publicado no catálogo." : "Título arquivado e retirado do catálogo."); }
    catch { setError("Não foi possível alterar a publicação."); }
    finally { setStatusChangingId(""); }
  }

  return <main className="admin-page">
    <header className="admin-header"><a className="brand" href="/"><span>C</span>INEVAULT</a><div><LanguageSelector compact/><a href="/">{t("admin.view")}</a><button onClick={onLogout}>{t("nav.logout")}</button></div></header>
    <section className="admin-intro"><p className="eyebrow"><span>V</span> {t("admin.center")}</p><h1>{t("admin.catalog")}</h1><p>{t("admin.description")}</p></section>
    <div className="admin-layout">
      <form className="admin-form" onSubmit={submit}>
        <div className="admin-section-title"><span>01</span><div><h2>{editingId ? "Editar título" : "Novo título"}</h2><p>{editingId ? "Atualize os dados sem alterar o estado de publicação." : "O conteúdo nasce como rascunho."}</p></div></div>
        <div className="form-grid"><label>Tipo<select value={input.kind} onChange={e => change("kind", e.target.value as CatalogTitleInput["kind"])}><option value="MOVIE">Filme</option><option value="SERIES">Série</option></select></label><label>Ano<input type="number" min="1888" max="2200" value={input.releaseYear} onChange={e => change("releaseYear", Number(e.target.value))}/></label></div>
        <label>Título<input value={input.title} onChange={e => titleChanged(e.target.value)} required minLength={2}/></label>
        <label>Slug<input value={input.slug} onChange={e => change("slug", e.target.value)} required pattern="[a-z0-9]+(?:-[a-z0-9]+)*"/></label>
        <label>Sinopse<textarea rows={5} value={input.synopsis} onChange={e => change("synopsis", e.target.value)} minLength={20} required/></label>
        <div className="form-grid"><label>Classificação<input value={input.maturityRating} onChange={e => change("maturityRating", e.target.value)} required/></label><label>Duração (min)<input type="number" min="1" value={input.durationMinutes ?? ""} onChange={e => change("durationMinutes", e.target.value ? Number(e.target.value) : null)}/></label></div>
        <fieldset className="genre-field"><legend>Gêneros</legend><div className="genre-options">{genres.map(genre => <label key={genre.id} className={input.genreIds.includes(genre.id) ? "selected" : ""}><input type="checkbox" checked={input.genreIds.includes(genre.id)} onChange={() => toggleGenre(genre.id)}/><span>{genre.name}</span></label>)}</div><div className="genre-create"><input placeholder="Novo gênero" value={genreName} onChange={e => setGenreName(e.target.value)}/><button type="button" onClick={() => void createGenre()}>Adicionar</button></div></fieldset>
        <div className="artwork-fields"><ArtworkUploadField accessToken={accessToken} label="Capa do catálogo" help="JPG, PNG ou WebP · recomendado 1600 × 900" value={input.thumbnailUrl} onChange={value => change("thumbnailUrl", value)}/><ArtworkUploadField accessToken={accessToken} label="Imagem de destaque" help="Imagem panorâmica para a apresentação da obra" value={input.heroImageUrl} onChange={value => change("heroImageUrl", value)}/></div><label>URL do trailer (opcional)<input value={input.previewUrl} onChange={e => change("previewUrl", e.target.value)}/></label>
        {error && <div className="login-error">{error}</div>}{notice && <div className="admin-notice">{notice}</div>}
        <div className="admin-form-actions"><button className="button admin-save" disabled={saving}>{saving ? "Salvando..." : editingId ? "Salvar alterações" : "Salvar rascunho"}</button>{editingId && <button type="button" className="admin-cancel" onClick={resetForm}>Cancelar edição</button>}</div>
      </form>
      <section className="admin-list">{managingSeries && <SeriesManager accessToken={accessToken} series={managingSeries} onClose={() => setManagingSeries(null)}/>}<div className="admin-section-title"><span>02</span><div><h2>Títulos cadastrados</h2><p>{items.length} itens no catálogo</p></div></div>{loading ? <div className="admin-empty">Carregando...</div> : items.length === 0 ? <div className="admin-empty">Nenhum título cadastrado.</div> : <div className="admin-items">{items.map(item => <article className="admin-item" key={item.id}><div className="admin-item__art" style={{ backgroundImage: `url(${item.thumbnailUrl || item.heroImageUrl})` }}/><div className="admin-item__content"><div><span className={`status status--${item.status.toLowerCase()}`}>{statusLabel(item.status)}</span><small>{item.kind === "MOVIE" ? "FILME" : "SÉRIE"} · {item.releaseYear}</small></div><h3>{item.title}</h3>{item.genres.length > 0 && <div className="admin-item__genres">{item.genres.map(genre => <span key={genre.id}>{genre.name}</span>)}</div>}<p>{item.synopsis}</p><div className="admin-item__actions">{item.kind === "MOVIE" && <button type="button" className="episodes" onClick={() => setMediaTarget({ id: item.id, label: item.title, purposes: ["TRAILER", "MAIN_CONTENT"] })}>Mídia</button>}{item.kind === "SERIES" && <button type="button" className="episodes" onClick={() => setMediaTarget({ id: item.id, label: `${item.title} · Trailer`, purposes: ["TRAILER"] })}>Trailer</button>}{item.kind === "SERIES" && <button type="button" className="episodes" onClick={() => setManagingSeries(item)}>Temporadas</button>}<button type="button" className="edit" onClick={() => edit(item)}>Editar</button>{item.status !== "PUBLISHED" && <button type="button" disabled={statusChangingId === item.id} onClick={() => void setStatus(item.id, "PUBLISHED")}>{statusChangingId === item.id ? "Publicando…" : "Publicar"}</button>}{item.status !== "ARCHIVED" && <button type="button" className="muted" disabled={statusChangingId === item.id} onClick={() => void setStatus(item.id, "ARCHIVED")}>{statusChangingId === item.id ? "Arquivando…" : "Arquivar"}</button>}</div></div></article>)}</div>}</section>
    </div>{mediaTarget && <div className="media-overlay" onMouseDown={event => event.currentTarget === event.target && setMediaTarget(null)}><MediaUploadPanel accessToken={accessToken} contentId={mediaTarget.id} label={mediaTarget.label} purposes={mediaTarget.purposes} onClose={() => setMediaTarget(null)}/></div>}
  </main>;
}

function slugify(value: string) { return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""); }
function statusLabel(status: CatalogTitle["status"]) { return status === "PUBLISHED" ? "Publicado" : status === "ARCHIVED" ? "Arquivado" : "Rascunho"; }
