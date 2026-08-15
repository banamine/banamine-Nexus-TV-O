import React, { useEffect, useRef, useState } from "react";
import Hls from "hls.js";
import { AlertTriangle, RefreshCw, Film, ExternalLink, Globe, Radio, Play, Volume2, VolumeX } from "lucide-react";

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

// Extract Archive.org item identifier if present
function getArchiveOrgDetails(url: string) {
  if (!url) return { isArchive: false, itemId: null, embedUrl: null };
  const match = url.match(/archive\.org\/(?:download|details|embed)\/([^/?#]+)/i);
  if (match) {
    return {
      isArchive: true,
      itemId: match[1],
      embedUrl: `https://archive.org/embed/${match[1]}?autoplay=1`,
    };
  }
  return { isArchive: false, itemId: null, embedUrl: null };
}

// Cleanly normalize URL and translate Archive.org download links to CORS-enabled streams
function normalizeMediaUrl(url: string): string {
  if (!url) return "";
  let clean = url.trim();
  if (clean.includes("archive.org/download/")) {
    clean = clean.replace("archive.org/download/", "archive.org/cors/");
  }
  try {
    clean = decodeURI(clean);
  } catch {
    // Keep as is
  }
  return encodeURI(clean).replace(/#/g, "%23");
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
  fallbackSrc = "https://archive.org/download/Tears-of-Steel/tears_of_steel_720p.mp4",
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const hlsRef = useRef<Hls | null>(null);
  const retryStepRef = useRef<number>(0);
  const animFrameRef = useRef<number | null>(null);

  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [hasError, setHasError] = useState<boolean>(false);
  const [isUsingFallback, setIsUsingFallback] = useState<boolean>(false);
  const [showTestPattern, setShowTestPattern] = useState<boolean>(false);
  const [useArchiveEmbed, setUseArchiveEmbed] = useState<boolean>(false);
  const [useProxy, setUseProxy] = useState<boolean>(false);
  const [currentResolution, setCurrentResolution] = useState<string>("1080p60");

  const normalizedSrc = normalizeMediaUrl(src || fallbackSrc);
  const archiveInfo = getArchiveOrgDetails(src || "");

  // Reset retry counter whenever the source changes
  useEffect(() => {
    retryStepRef.current = 0;
    setShowTestPattern(false);
    setUseArchiveEmbed(false);
    setIsUsingFallback(false);
    setHasError(false);
    setIsLoading(true);
  }, [src]);

  const handleManualRetry = () => {
    retryStepRef.current = 0;
    setShowTestPattern(false);
    setUseArchiveEmbed(false);
    setIsUsingFallback(false);
    setHasError(false);
    setIsLoading(true);
  };

  const handleForceArchiveEmbed = () => {
    setShowTestPattern(false);
    setUseArchiveEmbed(true);
    setIsLoading(false);
    setHasError(false);
  };

  const handleForceDirectPlayback = () => {
    setShowTestPattern(false);
    setUseArchiveEmbed(false);
    setIsUsingFallback(false);
    setUseProxy(false);
    retryStepRef.current = 0;
    setIsLoading(true);
  };

  // Draw animated SMPTE broadcast test pattern on fallback canvas
  useEffect(() => {
    if (!showTestPattern) {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
      return;
    }

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let frame = 0;
    const drawPattern = () => {
      frame++;
      const w = canvas.width;
      const h = canvas.height;

      // Top 67% SMPTE color bars
      const topH = Math.floor(h * 0.67);
      const barColors = [
        "#c0c0c0", // Gray
        "#c0c000", // Yellow
        "#00c0c0", // Cyan
        "#00c000", // Green
        "#c000c0", // Magenta
        "#c00000", // Red
        "#0000c0", // Blue
      ];
      const barW = w / barColors.length;
      barColors.forEach((color, i) => {
        ctx.fillStyle = color;
        ctx.fillRect(i * barW, 0, barW, topH);
      });

      // Middle 8% Castellation bars
      const midH = Math.floor(h * 0.08);
      const midColors = [
        "#0000c0",
        "#131313",
        "#c000c0",
        "#131313",
        "#00c0c0",
        "#131313",
        "#c0c0c0",
      ];
      midColors.forEach((color, i) => {
        ctx.fillStyle = color;
        ctx.fillRect(i * barW, topH, barW, midH);
      });

      // Bottom 25% PLUGE and Black level
      const botH = h - topH - midH;
      ctx.fillStyle = "#0a0a0f";
      ctx.fillRect(0, topH + midH, w, botH);

      // Station ID & Matrix Radar OSD
      ctx.fillStyle = "#0088FF";
      ctx.font = "bold 14px monospace";
      ctx.fillText("M3U MATRIX BROADCAST FEED", 20, topH + midH + 25);

      ctx.fillStyle = "#00FF9D";
      ctx.font = "11px monospace";
      const now = new Date();
      ctx.fillText(
        `CARRIER NOMINAL // UTC: ${now.toISOString().slice(11, 19)} // SYNTH 1080p60`,
        20,
        topH + midH + 45
      );

      // Animated Frequency Visualizer Bars
      const numFrequencies = 24;
      const freqStartX = w - 220;
      for (let i = 0; i < numFrequencies; i++) {
        const barHeight = Math.abs(Math.sin((frame + i * 8) * 0.05)) * 24 + 4;
        ctx.fillStyle = i % 2 === 0 ? "#0088FF" : "#00FF9D";
        ctx.fillRect(freqStartX + i * 8, topH + midH + 45 - barHeight, 6, barHeight);
      }

      // Scanline animation effect
      const scanY = (frame * 2) % h;
      ctx.fillStyle = "rgba(255, 255, 255, 0.08)";
      ctx.fillRect(0, scanY, w, 2);

      animFrameRef.current = requestAnimationFrame(drawPattern);
    };

    drawPattern();

    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, [showTestPattern]);

  // Main stream loading effect
  useEffect(() => {
    const video = videoRef.current;
    if (!video || useArchiveEmbed || showTestPattern) return;

    setHasError(false);
    setIsLoading(true);

    // Clean up previous Hls instance if exists
    if (hlsRef.current) {
      hlsRef.current.destroy();
      hlsRef.current = null;
    }

    let streamUrl = isUsingFallback ? fallbackSrc : normalizedSrc;
    const isM3uPlaylist = (streamUrl.toLowerCase().endsWith(".m3u") || streamUrl.toLowerCase().includes(".m3u?")) && !streamUrl.toLowerCase().includes(".m3u8");
    if (isM3uPlaylist) {
      setIsLoading(true);
      return;
    }

    if (useProxy && streamUrl.startsWith("http")) {
      streamUrl = `/api/proxy?url=${encodeURIComponent(streamUrl)}`;
    }

    const isM3u8 =
      streamUrl.includes(".m3u8") ||
      streamUrl.includes("m3u8") ||
      streamUrl.includes("/hls");

    // Unified error failover handler that guarantees NO infinite loop & NO broken third-party iframes
    const handlePlaybackFailure = (reason?: string) => {
      retryStepRef.current += 1;
      const step = retryStepRef.current;

      if (!useProxy && streamUrl.startsWith("http") && step === 1) {
        // Try streaming proxy relay first
        setUseProxy(true);
        return;
      }

      if (step <= 2 && !isUsingFallback) {
        // Transparently engage verified broadcast fallback
        setIsUsingFallback(true);
        return;
      }

      // If all external sources fail, engage test broadcast generator with interactive recovery
      setIsLoading(false);
      setHasError(true);
      setShowTestPattern(true);
      if (onError) onError(reason || "Fallback test signal engaged");
    };

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
        if (data.fatal) {
          switch (data.type) {
            case Hls.ErrorTypes.NETWORK_ERROR:
              hls.startLoad();
              break;
            case Hls.ErrorTypes.MEDIA_ERROR:
              hls.recoverMediaError();
              break;
            default:
              hls.destroy();
              hlsRef.current = null;
              handlePlaybackFailure("HLS fatal unrecoverable error");
              break;
          }
        }
      });
    } else if (isM3u8 && video.canPlayType("application/vnd.apple.mpegurl")) {
      video.src = streamUrl;
      const onLoaded = () => {
        setIsLoading(false);
        if (autoPlay) video.play().catch(() => {});
      };
      const onErr = () => {
        handlePlaybackFailure("Native Safari HLS error");
      };

      video.addEventListener("loadedmetadata", onLoaded, { once: true });
      video.addEventListener("error", onErr, { once: true });
    } else {
      // Direct MP4 / WebM video stream
      video.src = streamUrl;
      video.onloadeddata = () => {
        setIsLoading(false);
      };
      video.oncanplay = () => {
        setIsLoading(false);
      };
      video.onerror = () => {
        // Detach error listener to prevent loops
        video.onerror = null;
        handlePlaybackFailure("Direct media error");
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
      video.onerror = null;
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
    };
  }, [normalizedSrc, fallbackSrc, autoPlay, useArchiveEmbed, useProxy, isUsingFallback, showTestPattern]);

  return (
    <div className="relative w-full h-full flex items-center justify-center bg-black overflow-hidden group select-none">
      {showTestPattern ? (
        /* Standalone Broadcast Test Signal Canvas with interactive action overlay */
        <div className="relative w-full h-full">
          <canvas
            ref={canvasRef}
            width={640}
            height={360}
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-black/50 flex flex-col items-center justify-center p-4 text-center z-15 backdrop-blur-[2px]">
            <div className="glass-card p-4 max-w-sm rounded-xl border border-white/20 shadow-2xl space-y-3">
              <div className="flex items-center justify-center gap-2 text-amber-400 font-mono text-xs font-bold">
                <AlertTriangle className="w-4 h-4 text-amber-400" />
                <span>Stream Sync Interrupted</span>
              </div>
              <p className="text-[11px] text-white/70 font-mono">
                The stream requires decoder re-sync or proxy relay.
              </p>
              <div className="flex flex-wrap items-center justify-center gap-2 font-mono text-xs pt-1">
                <button
                  onClick={handleForceDirectPlayback}
                  className="px-3 py-1.5 bg-[#0088FF] hover:bg-[#0070D0] text-white font-bold rounded-lg shadow-md flex items-center gap-1.5 cursor-pointer transition-all"
                >
                  <Play className="w-3.5 h-3.5 fill-white" />
                  <span>Direct Play</span>
                </button>
                <button
                  onClick={() => {
                    setUseProxy(true);
                    handleManualRetry();
                  }}
                  className="px-3 py-1.5 bg-emerald-600/80 hover:bg-emerald-600 text-white font-bold rounded-lg shadow-md flex items-center gap-1.5 cursor-pointer transition-all"
                >
                  <Globe className="w-3.5 h-3.5" />
                  <span>CORS Relay</span>
                </button>
                <button
                  onClick={handleManualRetry}
                  className="px-3 py-1.5 bg-white/10 hover:bg-white/20 text-white rounded-lg border border-white/10 flex items-center gap-1.5 cursor-pointer transition-all"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Retry Signal</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : (
        /* HTML5 Native / HLS Video Element */
        <video
          ref={videoRef}
          autoPlay={autoPlay}
          loop={loop}
          muted={muted}
          controls={controls}
          playsInline
          preload="auto"
          referrerPolicy="no-referrer"
          className={className}
        />
      )}

      {/* Loading Overlay */}
      {isLoading && !showTestPattern && (
        <div className="absolute inset-0 bg-black/75 backdrop-blur-xs flex items-center justify-center z-10 font-mono text-xs text-[#0088FF] space-x-2">
          <RefreshCw className="w-4 h-4 animate-spin text-[#0088FF]" />
          <span>DECODING SIGNAL [{archiveInfo.isArchive ? "ARCHIVE.ORG" : currentResolution}]...</span>
        </div>
      )}

      {/* Stream Badges & Controls Header Bar */}
      <div className="absolute top-3 left-3 right-3 z-20 flex flex-wrap items-center justify-between gap-2 pointer-events-none">
        <div className="flex items-center gap-2 pointer-events-auto">
          {archiveInfo.isArchive && (
            <div className="bg-[#0088FF]/90 text-white font-mono font-bold text-[10px] px-2.5 py-1 rounded-md flex items-center gap-1.5 shadow-md backdrop-blur-md">
              <Film className="w-3.5 h-3.5 text-white" />
              <span>ARCHIVE.ORG STREAM</span>
            </div>
          )}

          {showTestPattern ? (
            <div className="bg-[#0088FF]/90 text-white font-mono font-bold text-[10px] px-2.5 py-1 rounded-md flex items-center gap-1.5 shadow-md">
              <Radio className="w-3.5 h-3.5 animate-pulse text-[#00FF9D]" />
              <span>TEST SIGNAL 1080p60 ACTIVE</span>
            </div>
          ) : isUsingFallback ? (
            <div className="bg-amber-500/95 text-black font-mono font-bold text-[10px] px-2.5 py-1 rounded-md flex items-center gap-1.5 shadow-md">
              <AlertTriangle className="w-3.5 h-3.5 fill-black" />
              <span>WATCHDOG BACKUP ACTIVE</span>
            </div>
          ) : null}
        </div>

        {/* Hover Action Controls */}
        <div className="flex items-center gap-1.5 font-mono text-[10px] pointer-events-auto opacity-0 group-hover:opacity-100 transition-opacity">
          {archiveInfo.isArchive && (
            <button
              onClick={() => setUseArchiveEmbed(!useArchiveEmbed)}
              className="px-2.5 py-1 rounded-md bg-black/80 hover:bg-[#0088FF] border border-white/20 hover:border-[#0088FF] text-white flex items-center gap-1 transition-all cursor-pointer shadow-lg"
              title="Toggle between HTML5 Direct Video & Archive.org Web Player"
            >
              <Film className="w-3 h-3 text-[#0088FF]" />
              <span>{useArchiveEmbed ? "HTML5 Direct" : "Archive Embed"}</span>
            </button>
          )}

          <button
            onClick={() => setUseProxy(!useProxy)}
            className={`px-2.5 py-1 rounded-md border font-bold flex items-center gap-1 transition-all cursor-pointer ${
              useProxy
                ? "bg-[#0088FF] border-[#0088FF] text-white"
                : "bg-black/80 border-white/20 text-white/80 hover:bg-white/10"
            }`}
            title="Route stream through server CORS bypass proxy"
          >
            <Globe className="w-3 h-3" />
            <span>{useProxy ? "CORS Relay: ON" : "CORS Relay"}</span>
          </button>

          <a
            href={src}
            target="_blank"
            rel="noreferrer"
            className="px-2 py-1 rounded-md bg-black/80 border border-white/20 text-white/80 hover:text-white flex items-center gap-1 cursor-pointer"
            title="Open stream URL in new tab"
          >
            <ExternalLink className="w-3 h-3" />
          </a>
        </div>
      </div>
    </div>
  );
};
