import { useEffect, useState, type FormEvent } from "react";
import type { CatalogEpisode, CatalogEpisodeInput, CatalogSeason, CatalogSeasonInput, CatalogTitle } from "@netflix/shared-types";
import { adminCreateEpisode, adminCreateSeason, adminListSeasons, adminUpdateEpisode, adminUpdateSeason } from "./api";
import { MediaUploadPanel } from "./MediaUploadPanel";
import { ArtworkUploadField } from "./ArtworkUploadField";

const newSeason = (number = 1): CatalogSeasonInput => ({ seasonNumber: number, title: `Temporada ${number}`, synopsis: "" });
const newEpisode = (number = 1): CatalogEpisodeInput => ({ episodeNumber: number, title: "", synopsis: "", durationMinutes: 45, thumbnailUrl: "/assets/hero-cidade-carmim.png", videoUrl: "" });

export function SeriesManager({ accessToken, series, onClose }: { accessToken: string; series: CatalogTitle; onClose: () => void }) {
  const [seasons, setSeasons] = useState<CatalogSeason[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [seasonInput, setSeasonInput] = useState<CatalogSeasonInput>(newSeason());
  const [editingSeasonId, setEditingSeasonId] = useState<string | null>(null);
  const [episodeInput, setEpisodeInput] = useState<CatalogEpisodeInput>(newEpisode());
  const [editingEpisodeId, setEditingEpisodeId] = useState<string | null>(null);
  const [mediaEpisode, setMediaEpisode] = useState<CatalogEpisode | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const selected = seasons.find(season => season.id === selectedId) ?? null;

  async function load(preferredId?: string | null) {
    const result = await adminListSeasons(accessToken, series.id);
    setSeasons(result.items);
    setSelectedId(preferredId === null ? result.items[0]?.id ?? null : preferredId ?? selectedId ?? result.items[0]?.id ?? null);
    return result.items;
  }

  useEffect(() => { setSelectedId(null); setEditingSeasonId(null); setEditingEpisodeId(null); setError(""); void load(null).catch(() => setError("Não foi possível carregar as temporadas.")); }, [series.id, accessToken]);

  function selectSeason(season: CatalogSeason) { setSelectedId(season.id); setEditingEpisodeId(null); setEpisodeInput(newEpisode(season.episodes.length + 1)); }
  function editSeason(season: CatalogSeason) { setEditingSeasonId(season.id); setSeasonInput({ seasonNumber: season.seasonNumber, title: season.title, synopsis: season.synopsis }); }
  function editEpisode(episode: CatalogEpisode) { setEditingEpisodeId(episode.id); setEpisodeInput({ episodeNumber: episode.episodeNumber, title: episode.title, synopsis: episode.synopsis, durationMinutes: episode.durationMinutes, thumbnailUrl: episode.thumbnailUrl, videoUrl: episode.videoUrl }); }
  function resetSeasonForm() { setEditingSeasonId(null); setSeasonInput(newSeason(seasons.length + 1)); }
  function resetEpisodeForm() { setEditingEpisodeId(null); setEpisodeInput(newEpisode((selected?.episodes.length ?? 0) + 1)); }

  async function saveSeason(event: FormEvent) {
    event.preventDefault(); setSaving(true); setError("");
    try { const saved = editingSeasonId ? await adminUpdateSeason(accessToken, editingSeasonId, seasonInput) : await adminCreateSeason(accessToken, series.id, seasonInput); await load(saved.id); resetSeasonForm(); }
    catch { setError("Revise a temporada. O número não pode se repetir nesta série."); }
    finally { setSaving(false); }
  }

  async function saveEpisode(event: FormEvent) {
    event.preventDefault(); if (!selected) return; setSaving(true); setError("");
    try { await (editingEpisodeId ? adminUpdateEpisode(accessToken, editingEpisodeId, episodeInput) : adminCreateEpisode(accessToken, selected.id, episodeInput)); await load(selected.id); resetEpisodeForm(); }
    catch { setError("Revise o episódio. O número não pode se repetir na temporada e a sinopse deve ter ao menos 10 caracteres."); }
    finally { setSaving(false); }
  }

  return <div className="series-manager">
    <div className="series-manager__header"><div><span>ESTRUTURA DA SÉRIE</span><h3>{series.title}</h3></div><button type="button" onClick={onClose}>Fechar</button></div>
    {error && <div className="login-error">{error}</div>}
    <form className="series-form" onSubmit={saveSeason}><div className="series-form__title"><strong>{editingSeasonId ? "Editar temporada" : "Nova temporada"}</strong>{editingSeasonId && <button type="button" onClick={resetSeasonForm}>Cancelar</button>}</div><div className="form-grid"><label>Número<input type="number" min="1" value={seasonInput.seasonNumber} onChange={e => setSeasonInput(current => ({ ...current, seasonNumber: Number(e.target.value) }))}/></label><label>Título<input value={seasonInput.title} minLength={2} required onChange={e => setSeasonInput(current => ({ ...current, title: e.target.value }))}/></label></div><label>Sinopse da temporada<textarea rows={2} value={seasonInput.synopsis} onChange={e => setSeasonInput(current => ({ ...current, synopsis: e.target.value }))}/></label><button className="series-primary" disabled={saving}>{editingSeasonId ? "Salvar temporada" : "Adicionar temporada"}</button></form>
    <div className="season-tabs">{seasons.length === 0 ? <p>Nenhuma temporada cadastrada.</p> : seasons.map(season => <div key={season.id} className={season.id === selectedId ? "active" : ""}><button type="button" onClick={() => selectSeason(season)}>T{season.seasonNumber} <small>{season.episodes.length} episódios</small></button><button type="button" className="season-edit" onClick={() => editSeason(season)}>Editar</button></div>)}</div>
    {selected && <div className="episode-panel"><div className="episode-panel__heading"><div><span>TEMPORADA {selected.seasonNumber}</span><h4>{selected.title}</h4></div><small>{selected.episodes.length} episódios</small></div>
      <div className="episode-list">{selected.episodes.map(episode => <article key={episode.id}><div className="episode-number">{String(episode.episodeNumber).padStart(2, "0")}</div><div><strong>{episode.title}</strong><p>{episode.durationMinutes} min · {episode.synopsis}</p></div><div className="episode-actions"><button type="button" onClick={() => setMediaEpisode(episode)}>Mídia</button><button type="button" onClick={() => editEpisode(episode)}>Editar</button></div></article>)}</div>
      <form className="episode-form" onSubmit={saveEpisode}><div className="series-form__title"><strong>{editingEpisodeId ? "Editar episódio" : "Novo episódio"}</strong>{editingEpisodeId && <button type="button" onClick={resetEpisodeForm}>Cancelar</button>}</div><div className="form-grid"><label>Número<input type="number" min="1" value={episodeInput.episodeNumber} onChange={e => setEpisodeInput(current => ({ ...current, episodeNumber: Number(e.target.value) }))}/></label><label>Duração (min)<input type="number" min="1" value={episodeInput.durationMinutes} onChange={e => setEpisodeInput(current => ({ ...current, durationMinutes: Number(e.target.value) }))}/></label></div><label>Título<input value={episodeInput.title} minLength={2} required onChange={e => setEpisodeInput(current => ({ ...current, title: e.target.value }))}/></label><label>Sinopse<textarea rows={3} minLength={10} required value={episodeInput.synopsis} onChange={e => setEpisodeInput(current => ({ ...current, synopsis: e.target.value }))}/></label><ArtworkUploadField accessToken={accessToken} label="Capa do episódio" help="Aparece na lista e no fundo do player" value={episodeInput.thumbnailUrl} onChange={value => setEpisodeInput(current => ({ ...current, thumbnailUrl: value }))}/><label>URL do vídeo<input value={episodeInput.videoUrl} onChange={e => setEpisodeInput(current => ({ ...current, videoUrl: e.target.value }))}/></label><button className="series-primary" disabled={saving}>{editingEpisodeId ? "Salvar episódio" : "Adicionar episódio"}</button></form>
    </div>}{mediaEpisode && <MediaUploadPanel accessToken={accessToken} contentId={mediaEpisode.id} label={`${series.title} · ${mediaEpisode.title}`} onClose={() => setMediaEpisode(null)}/>}
  </div>;
}
