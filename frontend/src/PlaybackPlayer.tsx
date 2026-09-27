import { useEffect, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent } from "react";
import type Hls from "hls.js";
import type { PlaybackAuthorizationResponse } from "@netflix/shared-types";
import { CloseIcon, ExitFullscreenIcon, ForwardIcon, FullscreenIcon, MutedIcon, PauseIcon, PictureInPictureIcon, PlayIcon, RewindIcon, SettingsIcon, VolumeIcon } from "./icons";
import { useI18n } from "./I18nContext";

interface Quality { index: number; label: string; }

export function PlaybackPlayer({ playback, title, artworkUrl, onClose }: { playback: PlaybackAuthorizationResponse; title: string; artworkUrl?: string; onClose: () => void }) {
  const { t } = useI18n();
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const hlsRef = useRef<Hls | null>(null);
  const hideTimer = useRef<number | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [playing, setPlaying] = useState(false);
  const [controlsVisible, setControlsVisible] = useState(true);
  const [fullscreen, setFullscreen] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [buffered, setBuffered] = useState(0);
  const [volume, setVolume] = useState(1);
  const [muted, setMuted] = useState(false);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [qualities, setQualities] = useState<Quality[]>([]);
  const [quality, setQuality] = useState(-1);
  const [captionsAvailable, setCaptionsAvailable] = useState(false);
  const [captionsOn, setCaptionsOn] = useState(false);

  useEffect(() => {
    const video = videoRef.current;
    const url = playback.manifestUrl;
    if (!video || !url) return;
    setError(""); setLoading(true); setQualities([]); setQuality(-1);
    if (/\.m3u8(?:$|\?)/i.test(url)) {
      let cancelled = false;
      void import("hls.js").then(({ default: HlsPlayer }) => {
        if (cancelled) return;
        if (!HlsPlayer.isSupported()) {
          if (video.canPlayType("application/vnd.apple.mpegurl")) { video.src = url; void video.play().catch(() => undefined); }
          else setError("Este navegador não oferece suporte a transmissões HLS.");
          return;
        }
        const hls = new HlsPlayer({ enableWorker: true, lowLatencyMode: true }); hlsRef.current = hls;
        hls.loadSource(url); hls.attachMedia(video);
        hls.on(HlsPlayer.Events.MANIFEST_PARSED, (_event, data) => { setQualities(data.levels.map((level, index) => ({ index, label: level.height ? `${level.height}p` : `${Math.round(level.bitrate / 1000)} kbps` }))); setCaptionsAvailable(hls.subtitleTracks.length > 0); void video.play().catch(() => undefined); });
        hls.on(HlsPlayer.Events.ERROR, (_event, data) => { if (data.fatal) setError("Não foi possível carregar esta transmissão HLS."); });
      }).catch(() => setError("Não foi possível iniciar o player HLS."));
      return () => { cancelled = true; hlsRef.current?.destroy(); hlsRef.current = null; };
    }
    video.src = url; void video.play().catch(() => undefined);
    return () => { video.pause(); video.removeAttribute("src"); video.load(); };
  }, [playback]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (isTyping(event.target)) return;
      const video = videoRef.current; if (!video) return;
      if ([" ", "k", "K"].includes(event.key)) { event.preventDefault(); void togglePlay(); }
      else if (event.key === "ArrowLeft") { event.preventDefault(); seekBy(-10); }
      else if (event.key === "ArrowRight") { event.preventDefault(); seekBy(10); }
      else if (event.key === "ArrowUp") { event.preventDefault(); changeVolume(Math.min(1, video.volume + .1)); }
      else if (event.key === "ArrowDown") { event.preventDefault(); changeVolume(Math.max(0, video.volume - .1)); }
      else if (event.key.toLowerCase() === "m") toggleMute();
      else if (event.key.toLowerCase() === "f") { event.preventDefault(); void toggleFullscreen(); }
      else if (event.key.toLowerCase() === "p") { event.preventDefault(); void togglePictureInPicture(); }
      else if (event.key.toLowerCase() === "c") toggleCaptions();
      else if (event.key === "Escape" && !document.fullscreenElement) onClose();
      revealControls();
    };
    const onFullscreenChange = () => { const active = Boolean(document.fullscreenElement); setFullscreen(active); if (!active) unlockOrientation(); };
    window.addEventListener("keydown", onKey); document.addEventListener("fullscreenchange", onFullscreenChange);
    return () => { window.removeEventListener("keydown", onKey); document.removeEventListener("fullscreenchange", onFullscreenChange); if (hideTimer.current) window.clearTimeout(hideTimer.current); };
  }, [onClose, playing, settingsOpen, captionsOn]);

  function revealControls() { setControlsVisible(true); if (hideTimer.current) window.clearTimeout(hideTimer.current); if (!videoRef.current?.paused && !settingsOpen) hideTimer.current = window.setTimeout(() => setControlsVisible(false), 2800); }
  function pointerMoved(event: ReactPointerEvent) { if (event.pointerType === "mouse" || event.pointerType === "pen") revealControls(); }
  async function togglePlay() { const video = videoRef.current; if (!video) return; video.paused ? await video.play().catch(() => undefined) : video.pause(); }
  function seekBy(seconds: number) { const video = videoRef.current; if (!video) return; video.currentTime = Math.max(0, Math.min(video.duration || 0, video.currentTime + seconds)); setCurrentTime(video.currentTime); }
  function seek(value: number) { const video = videoRef.current; if (!video) return; video.currentTime = value; setCurrentTime(value); }
  function changeVolume(value: number) { const video = videoRef.current; if (!video) return; video.volume = value; video.muted = value === 0; setVolume(value); setMuted(video.muted); }
  function toggleMute() { const video = videoRef.current; if (!video) return; video.muted = !video.muted; setMuted(video.muted); }
  function changeRate(rate: number) { const video = videoRef.current; if (!video) return; video.playbackRate = rate; setPlaybackRate(rate); }
  function changeQuality(level: number) { if (hlsRef.current) hlsRef.current.currentLevel = level; setQuality(level); }
  function toggleCaptions() { const hls = hlsRef.current; if (hls?.subtitleTracks.length) { const enabled = !captionsOn; hls.subtitleTrack = enabled ? 0 : -1; setCaptionsOn(enabled); return; } const track = videoRef.current?.textTracks[0]; if (track) { const enabled = track.mode !== "showing"; track.mode = enabled ? "showing" : "hidden"; setCaptionsOn(enabled); } }
  async function togglePictureInPicture() { const video = videoRef.current; if (!video || !("pictureInPictureEnabled" in document)) return; try { document.pictureInPictureElement ? await document.exitPictureInPicture() : await video.requestPictureInPicture(); } catch { setError("Picture-in-Picture não está disponível."); } }
  async function toggleFullscreen() { try { if (document.fullscreenElement) { await document.exitFullscreen(); return; } if (containerRef.current?.requestFullscreen) { await containerRef.current.requestFullscreen(); await lockLandscape(); return; } const safariVideo = videoRef.current as HTMLVideoElement & { webkitEnterFullscreen?: () => void }; if (safariVideo?.webkitEnterFullscreen) safariVideo.webkitEnterFullscreen(); else setError("A tela cheia não é suportada neste navegador."); } catch { setError("Não foi possível abrir o modo de tela cheia."); } }
  function updateTimeline() { const video = videoRef.current; if (!video) return; setCurrentTime(video.currentTime || 0); setDuration(Number.isFinite(video.duration) ? video.duration : 0); if (video.buffered.length && video.duration) setBuffered(video.buffered.end(video.buffered.length - 1) / video.duration * 100); }

  const progress = duration ? currentTime / duration * 100 : 0;
  const timelineStyle = { "--watched": `${progress}%`, "--buffered": `${buffered}%` } as CSSProperties;
  const chromeVisible = controlsVisible || !playing || settingsOpen;

  return <div ref={containerRef} className={`player-overlay netflix-player${fullscreen ? " player-overlay--fullscreen" : ""}${chromeVisible ? " controls-visible" : " controls-hidden"}`} role="dialog" aria-modal="true" aria-label={`Reproduzindo ${title}`} onPointerMove={pointerMoved} onPointerLeave={() => playing && !settingsOpen && setControlsVisible(false)}>
    <div className={`player-stage${error ? " player-stage--error" : ""}`} onDoubleClick={() => void toggleFullscreen()}>
      {artworkUrl && <div className="player-backdrop" style={{ backgroundImage: `url(${artworkUrl})` }} aria-hidden="true"/>}
      {playback.manifestUrl ? <video ref={videoRef} autoPlay playsInline preload="metadata" onClick={() => { if (!controlsVisible && playing) { revealControls(); return; } void togglePlay(); }} onLoadStart={() => setLoading(true)} onLoadedMetadata={event => setCaptionsAvailable(event.currentTarget.textTracks.length > 0 || Boolean(hlsRef.current?.subtitleTracks.length))} onCanPlay={() => setLoading(false)} onPlaying={() => { setLoading(false); setPlaying(true); revealControls(); }} onPause={() => { setPlaying(false); setControlsVisible(true); }} onTimeUpdate={updateTimeline} onProgress={updateTimeline} onDurationChange={updateTimeline} onVolumeChange={event => { setVolume(event.currentTarget.volume); setMuted(event.currentTarget.muted); }} onError={() => { setLoading(false); setError("O navegador não conseguiu reproduzir este arquivo de vídeo."); }}/>: <div className="player-empty"><strong>Vídeo ainda não configurado</strong><p>Adicione uma URL MP4 ou HLS no painel administrativo.</p></div>}
      <div className="player-shade player-shade--top"/><div className="player-shade player-shade--bottom"/>
      <div className="netflix-topbar"><div><span>CINEVAULT</span><strong>{title}</strong></div><button onClick={onClose} aria-label={t("player.close")}><CloseIcon/></button></div>
      {!playing && playback.manifestUrl && !loading && <button className="netflix-center-play" onClick={() => void togglePlay()} aria-label={t("player.play")}><PlayIcon/></button>}
      {loading && playback.manifestUrl && !error && <div className="player-loading"><i/><span>{t("player.loading")}</span></div>}
      {error && <div className="player-error">{error}</div>}
      <div className="netflix-controls" onPointerEnter={revealControls} onPointerMove={event => { event.stopPropagation(); revealControls(); }}>
        <div className="netflix-timeline"><input aria-label="Progresso do vídeo" type="range" min="0" max={duration || 0} step="0.1" value={Math.min(currentTime, duration || 0)} style={timelineStyle} onChange={event => seek(Number(event.target.value))}/><div className="timeline-time">{formatTime(currentTime)} <span>/</span> {formatTime(duration)}</div></div>
        <div className="netflix-control-row"><div className="control-group"><button onClick={() => void togglePlay()} aria-label={t(playing ? "player.pause" : "player.play")}>{playing ? <PauseIcon/> : <PlayIcon/>}</button><button onClick={() => seekBy(-10)} aria-label={t("player.back")}><RewindIcon/></button><button onClick={() => seekBy(10)} aria-label={t("player.forward")}><ForwardIcon/></button><div className="volume-control"><button onClick={toggleMute} aria-label={t(muted ? "player.unmute" : "player.mute")}>{muted || volume === 0 ? <MutedIcon/> : <VolumeIcon/>}</button><input aria-label="Volume" type="range" min="0" max="1" step="0.05" value={muted ? 0 : volume} onChange={event => changeVolume(Number(event.target.value))}/></div><span className="remaining-time">-{formatTime(Math.max(0, duration - currentTime))}</span></div><div className="control-group control-group--right"><button className={`cc-button${captionsOn ? " active" : ""}`} disabled={!captionsAvailable && !videoRef.current?.textTracks.length} onClick={toggleCaptions} aria-label={t("player.captions")}>CC</button><button onClick={() => void togglePictureInPicture()} aria-label="Picture-in-Picture"><PictureInPictureIcon/></button><div className="settings-wrap"><button className={settingsOpen ? "active" : ""} onClick={() => { setSettingsOpen(!settingsOpen); setControlsVisible(true); }} aria-label={t("player.settings")}><SettingsIcon/></button>{settingsOpen && <div className="player-settings"><section><h3>{t("player.speed")}</h3>{[.5, .75, 1, 1.25, 1.5, 2].map(rate => <button key={rate} className={playbackRate === rate ? "selected" : ""} onClick={() => changeRate(rate)}><span>{rate === 1 ? t("player.normal") : `${rate}x`}</span><i/></button>)}</section><section><h3>{t("player.quality")}</h3><button className={quality === -1 ? "selected" : ""} onClick={() => changeQuality(-1)}><span>{t("player.auto")}</span><i/></button>{qualities.map(item => <button key={item.index} className={quality === item.index ? "selected" : ""} onClick={() => changeQuality(item.index)}><span>{item.label}</span><i/></button>)}</section></div>}</div><button onClick={() => void toggleFullscreen()} aria-label={t(fullscreen ? "player.exitFullscreen" : "player.fullscreen")}>{fullscreen ? <ExitFullscreenIcon/> : <FullscreenIcon/>}</button></div></div>
      </div>
    </div>
  </div>;
}

function formatTime(seconds: number) { if (!Number.isFinite(seconds) || seconds < 0) return "0:00"; const whole = Math.floor(seconds); const hours = Math.floor(whole / 3600); const minutes = Math.floor((whole % 3600) / 60); const remainder = whole % 60; return hours ? `${hours}:${String(minutes).padStart(2, "0")}:${String(remainder).padStart(2, "0")}` : `${minutes}:${String(remainder).padStart(2, "0")}`; }
function isTyping(target: EventTarget | null) { return target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement || target instanceof HTMLSelectElement; }
async function lockLandscape() { const orientation = screen.orientation as ScreenOrientation & { lock?: (orientation: "landscape") => Promise<void> }; await orientation?.lock?.("landscape").catch(() => undefined); }
function unlockOrientation() { const orientation = screen.orientation as ScreenOrientation & { unlock?: () => void }; orientation?.unlock?.(); }
