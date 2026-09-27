import { useEffect, useState } from "react";
import type { PlaybackAuthorizationResponse, TitleDetailsResponse } from "@netflix/shared-types";
import type { Title } from "./catalog";
import { authorizePlayback, getTitleDetails } from "./api";
import { CheckIcon, CloseIcon, PlayIcon, PlusIcon } from "./icons";
import { PlaybackPlayer } from "./PlaybackPlayer";
import { useI18n } from "./I18nContext";
import { CommunityReviews } from "./CommunityReviews";

export function TitleDetailsModal({ accessToken, fallback, inWatchlist, onToggleWatchlist, onClose }: { accessToken:string; fallback:Title; inWatchlist:boolean; onToggleWatchlist:()=>void; onClose:()=>void }) {
  const { t } = useI18n();
  const [details, setDetails] = useState<TitleDetailsResponse | null>(null);
  const [seasonId, setSeasonId] = useState<string | null>(null);
  const [playback, setPlayback] = useState<{ response: PlaybackAuthorizationResponse; label: string; artworkUrl: string } | null>(null);
  const [loadingPlayback, setLoadingPlayback] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    getTitleDetails(accessToken, fallback.id).then(result => { setDetails(result); setSeasonId(result.seasons[0]?.id ?? null); }).catch(() => setError(t("details.unavailable")));
  }, [accessToken, fallback.id, t]);

  useEffect(() => {
    const key = (event: KeyboardEvent) => event.key === "Escape" && !playback && onClose();
    document.body.classList.add("modal-open"); window.addEventListener("keydown", key);
    return () => { document.body.classList.remove("modal-open"); window.removeEventListener("keydown", key); };
  }, [onClose, playback]);

  async function play(contentId: string, label: string, artworkUrl = details?.heroImageUrl || fallback.thumbnail || "") {
    setLoadingPlayback(true); setError("");
    try { const response = await authorizePlayback(accessToken, contentId); if (response.playbackStatus !== "AUTHORIZED") { setError(t("details.denied")); return; } setPlayback({ response, label, artworkUrl }); }
    catch { setError(t("details.authError")); }
    finally { setLoadingPlayback(false); }
  }
  function playTrailer() { if (!details?.trailerUrl) return; setPlayback({ label: `${details.title} · Trailer`, artworkUrl: details.heroImageUrl || fallback.thumbnail || "", response: { contentId: details.id, contentType: "TRAILER", movieId: details.id, playbackStatus: "AUTHORIZED", manifestUrl: details.trailerUrl, drmLicenseServer: "", telemetryIntervalMs: 5000 } }); }

  const selectedSeason = details?.seasons.find(season => season.id === seasonId) ?? details?.seasons[0];
  const playFirst = () => details?.kind === "SERIES" && details.seasons[0]?.episodes[0] ? play(details.seasons[0].episodes[0].id, `${details.title} · ${details.seasons[0].episodes[0].title}`, details.seasons[0].episodes[0].thumbnailUrl || details.heroImageUrl) : play(fallback.id, details?.title ?? fallback.name);

  return <><div className="modal-backdrop" role="presentation" onMouseDown={event => event.currentTarget === event.target && onClose()}>
    <section className={`modal title-details art-${fallback.art}`} role="dialog" aria-modal="true" aria-label={`Detalhes de ${fallback.name}`}>
      <div className="modal__visual" style={details?.heroImageUrl ? { backgroundImage: `url(${details.heroImageUrl})` } : undefined}/><button className="modal__close" onClick={onClose} aria-label="Fechar"><CloseIcon /></button>
      <div className="modal__body"><p className="eyebrow"><span>V</span> {t(details?.kind === "SERIES" ? "details.series" : "details.collection")}</p><h2>{details?.title ?? fallback.name}</h2>
        <p className="modal__meta"><strong>{fallback.match}% {t("hero.relevant")}</strong> {details?.releaseYear ?? fallback.year} <span>{details?.maturityRating ?? fallback.maturity}</span> {details?.kind === "SERIES" ? `${details.seasons.length} ${t("details.season")}${details.seasons.length === 1 ? "" : "s"}` : formatDuration(details?.durationMinutes) ?? fallback.duration}</p>
        <p>{details?.synopsis ?? fallback.synopsis}</p><p className="genres">{t("details.genres")}: <b>{details?.genres.map(genre => genre.name).join(" · ") || fallback.genres.join(" · ")}</b></p>
        <div className="modal__actions"><button className="button button--light" onClick={() => void playFirst()} disabled={loadingPlayback}><PlayIcon /> {loadingPlayback ? t("details.loading") : details?.kind === "SERIES" ? t("details.first") : t("hero.watch")}</button>{details?.trailerUrl && <button className="button button--glass" onClick={playTrailer}><PlayIcon /> {t("details.trailer")}</button>}<button className={`round-button${inWatchlist?" saved":""}`} aria-label={t("nav.list")} aria-pressed={inWatchlist} onClick={onToggleWatchlist}>{inWatchlist?<CheckIcon/>:<PlusIcon/>}</button></div>{error && <div className="details-error">{error}</div>}
        {details?.kind === "SERIES" && <section className="public-seasons"><div className="public-seasons__header"><h3>{t("details.episodes")}</h3><select aria-label={t("details.season")} value={selectedSeason?.id ?? ""} onChange={event => setSeasonId(event.target.value)}>{details.seasons.map(season => <option key={season.id} value={season.id}>{t("details.season")} {season.seasonNumber}</option>)}</select></div>{selectedSeason?.synopsis && <p className="season-synopsis">{selectedSeason.synopsis}</p>}<div className="public-episodes">{selectedSeason?.episodes.map(episode => <article key={episode.id}><button className="episode-play" onClick={() => void play(episode.id, `${details.title} · ${episode.title}`, episode.thumbnailUrl || details.heroImageUrl)} aria-label={`${t("hero.watch")} ${episode.title}`}><span>{String(episode.episodeNumber).padStart(2, "0")}</span><div style={{ backgroundImage: `url(${episode.thumbnailUrl || details.heroImageUrl})` }}><PlayIcon /></div></button><div><h4>{episode.title}<small>{episode.durationMinutes} min</small></h4><p>{episode.synopsis}</p></div></article>)}</div></section>}
        <CommunityReviews accessToken={accessToken} contentId={fallback.id} title={details?.title ?? fallback.name}/>
      </div>
    </section>
  </div>{playback && <PlaybackPlayer playback={playback.response} title={playback.label} artworkUrl={playback.artworkUrl} onClose={() => setPlayback(null)}/>}</>;
}

function formatDuration(minutes?: number | null) { if (!minutes) return null; return `${Math.floor(minutes / 60)}h ${minutes % 60}min`; }
