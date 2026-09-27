import { useEffect, useRef } from "react";
import type Hls from "hls.js";

export function HoverPreview({ url, onFinished }: { url: string; onFinished: () => void }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const hlsRef = useRef<Hls | null>(null);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    let cancelled = false;
    video.muted = true;

    const start = () => {
      if (cancelled) return;
      video.currentTime = 0;
      void video.play().catch(onFinished);
    };

    if (/\.m3u8(?:$|\?)/i.test(url)) {
      void import("hls.js").then(({ default: HlsPlayer }) => {
        if (cancelled) return;
        if (HlsPlayer.isSupported()) {
          const hls = new HlsPlayer({ enableWorker: true, startLevel: 0, capLevelToPlayerSize: true });
          hlsRef.current = hls;
          hls.attachMedia(video);
          hls.on(HlsPlayer.Events.MEDIA_ATTACHED, () => hls.loadSource(url));
          hls.on(HlsPlayer.Events.MANIFEST_PARSED, start);
          hls.on(HlsPlayer.Events.ERROR, (_event, data) => data.fatal && onFinished());
          return;
        }
        if (video.canPlayType("application/vnd.apple.mpegurl")) { video.src = url; start(); }
        else onFinished();
      }).catch(onFinished);
    } else { video.src = url; start(); }

    return () => {
      cancelled = true;
      hlsRef.current?.destroy();
      hlsRef.current = null;
      video.pause();
      video.removeAttribute("src");
      video.load();
    };
  }, [url, onFinished]);

  return <div className="card-preview" aria-hidden="true">
    <video ref={videoRef} muted playsInline preload="auto" onTimeUpdate={event => event.currentTarget.currentTime >= 10 && onFinished()} onError={onFinished}/>
    <span><i/> Prévia · 10 s</span>
  </div>;
}
