import React, { useEffect, useRef, useState } from "react";
import Hls from "hls.js";
import { AlertTriangle, RefreshCw } from "lucide-react";

interface HlsVideoPlayerProps {
  src: string;
  autoPlay?: boolean;
  loop?: boolean;
  muted?: boolean;
  controls?: boolean;
  className?: string;
  onTimeUpdate?: (currentTime: number, duration: number) => void;
  onError?: (error: any) => void;
  fallbackSrc?: string;
}

export const HlsVideoPlayer: React.FC<HlsVideoPlayerProps> = ({
  src,
  autoPlay = true,
  loop = true,
  muted = false,
  controls = false,
  className = "w-full h-full object-cover",
  onTimeUpdate,
  onError,
  fallbackSrc = "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4",
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const hlsRef = useRef<Hls | null>(null);
  const [hasError, setHasError] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isUsingFallback, setIsUsingFallback] = useState(false);
  const [currentResolution, setCurrentResolution] = useState<string>("1080p");

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    setHasError(false);
    setIsLoading(true);
    setIsUsingFallback(false);

    // Clean up previous Hls instance if exists
    if (hlsRef.current) {
      hlsRef.current.destroy();
      hlsRef.current = null;
    }

    const streamUrl = src || fallbackSrc;
    const isM3u8 = streamUrl.includes(".m3u8") || streamUrl.includes("m3u8") || streamUrl.includes("/hls");

    if (isM3u8 && Hls.isSupported()) {
      const hls = new Hls({
        enableWorker: true,
        lowLatencyMode: true,
        backBufferLength: 90,
      });
      hlsRef.current = hls;

      hls.loadSource(streamUrl);
      hls.attachMedia(video);

      hls.on(Hls.Events.MANIFEST_PARSED, (_, data) => {
        setIsLoading(false);
        if (data.levels && data.levels.length > 0) {
          const maxLevel = data.levels[data.levels.length - 1];
          if (maxLevel.height) setCurrentResolution(`${maxLevel.height}p`);
        }
        if (autoPlay) {
          video.play().catch(() => {
            // Autoplay with sound might be blocked by browser; retry muted
            video.muted = true;
            video.play().catch(() => {});
          });
        }
      });

      hls.on(Hls.Events.LEVEL_SWITCHED, (_, data) => {
        const level = hls.levels[data.level];
        if (level && level.height) {
          setCurrentResolution(`${level.height}p`);
        }
      });

      hls.on(Hls.Events.ERROR, (_, data) => {
        console.warn("[HlsPlayer] Stream error:", data);
        if (data.fatal) {
          switch (data.type) {
            case Hls.ErrorTypes.NETWORK_ERROR:
              console.log("[HlsPlayer] Network error encountered, trying to recover...");
              hls.startLoad();
              break;
            case Hls.ErrorTypes.MEDIA_ERROR:
              console.log("[HlsPlayer] Media error encountered, recovering media...");
              hls.recoverMediaError();
              break;
            default:
              console.warn("[HlsPlayer] Unrecoverable stream error, switching to failover feed.");
              hls.destroy();
              hlsRef.current = null;
              setHasError(true);
              setIsUsingFallback(true);
              video.src = fallbackSrc;
              video.play().catch(() => {});
              if (onError) onError(data);
              break;
          }
        }
      });
    } else if (isM3u8 && video.canPlayType("application/vnd.apple.mpegurl")) {
      // Native Apple Safari HLS support
      video.src = streamUrl;
      video.addEventListener("loadedmetadata", () => {
        setIsLoading(false);
        if (autoPlay) video.play().catch(() => {});
      });
      video.addEventListener("error", () => {
        setHasError(true);
        setIsUsingFallback(true);
        video.src = fallbackSrc;
        video.play().catch(() => {});
      });
    } else {
      // Direct MP4 / WebM video stream
      video.src = streamUrl;
      video.onloadeddata = () => {
        setIsLoading(false);
      };
      video.onerror = () => {
        setHasError(true);
        setIsUsingFallback(true);
        video.src = fallbackSrc;
        video.play().catch(() => {});
      };
      if (autoPlay) {
        video.play().catch(() => {
          video.muted = true;
          video.play().catch(() => {});
        });
      }
    }

    const handleTimeUpdate = () => {
      if (onTimeUpdate && video) {
        onTimeUpdate(video.currentTime, video.duration || 0);
      }
    };

    video.addEventListener("timeupdate", handleTimeUpdate);

    return () => {
      video.removeEventListener("timeupdate", handleTimeUpdate);
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
    };
  }, [src, fallbackSrc, autoPlay]);

  return (
    <div className="relative w-full h-full flex items-center justify-center bg-black overflow-hidden">
      <video
        ref={videoRef}
        autoPlay={autoPlay}
        loop={loop}
        muted={muted}
        controls={controls}
        playsInline
        className={className}
      />

      {/* Loading Overlay */}
      {isLoading && (
        <div className="absolute inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-10 font-mono text-xs text-[#0088FF] space-x-2">
          <RefreshCw className="w-4 h-4 animate-spin text-[#0088FF]" />
          <span>INITIALIZING HLS FEED [{currentResolution}]...</span>
        </div>
      )}

      {/* Watchdog Fallback Badge */}
      {isUsingFallback && (
        <div className="absolute top-3 left-3 z-20 bg-amber-500/90 text-black font-bold text-[10px] px-2.5 py-1 rounded-md flex items-center gap-1.5 shadow-md font-mono">
          <AlertTriangle className="w-3 h-3 fill-black" />
          <span>WATCHDOG ENGAGED: BACKUP FEED ACTIVE</span>
        </div>
      )}
    </div>
  );
};
