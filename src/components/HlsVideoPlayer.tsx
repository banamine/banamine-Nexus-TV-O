import React, { useEffect, useRef, useState } from "react";
import Hls from "hls.js";
import { AlertTriangle, RefreshCw, ShieldAlert, Globe, ExternalLink, HelpCircle } from "lucide-react";
import { diagnoseStreamError, DiagnosticResult } from "../utils/streamDiagnostics";

export interface HlsVideoPlayerProps {
  src: string;
  fallbackSrc?: string;
  autoPlay?: boolean;
  loop?: boolean;
  muted?: boolean;
  controls?: boolean;
  className?: string;
  seekTime?: number;
  onTimeUpdate?: (currentTime: number, duration: number) => void;
  onError?: (error: any) => void;
}

export const HlsVideoPlayer: React.FC<HlsVideoPlayerProps> = ({
  src,
  fallbackSrc = "https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8",
  autoPlay = true,
  loop = true,
  muted = false,
  controls = true,
  className = "w-full h-full object-contain",
  seekTime,
  onTimeUpdate,
  onError,
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const hlsRef = useRef<Hls | null>(null);
  const [hasError, setHasError] = useState(false);
  const [diagnostic, setDiagnostic] = useState<DiagnosticResult | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isUsingFallback, setIsUsingFallback] = useState(false);
  const [useProxy, setUseProxy] = useState(false);
  const [showDiagModal, setShowDiagModal] = useState(false);
  const hasAppliedInitialSeekRef = useRef<boolean>(false);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    setHasError(false);
    setDiagnostic(null);
    setIsLoading(true);
    setIsUsingFallback(false);
    hasAppliedInitialSeekRef.current = false;

    if (hlsRef.current) {
      hlsRef.current.destroy();
      hlsRef.current = null;
    }

    let rawUrl = src || fallbackSrc;
    let streamUrl = rawUrl;

    if (useProxy && rawUrl.startsWith("http")) {
      streamUrl = `https://corsproxy.io/?${encodeURIComponent(rawUrl)}`;
    }

    const applyInitialSeek = () => {
      if (seekTime && seekTime > 0 && !hasAppliedInitialSeekRef.current && video) {
        try {
          video.currentTime = seekTime;
          hasAppliedInitialSeekRef.current = true;
        } catch (e) {
          console.warn("Initial seek error:", e);
        }
      }
    };

    const isM3u8 =
      streamUrl.includes(".m3u8") ||
      streamUrl.includes("m3u8") ||
      streamUrl.includes("/hls");

    if (isM3u8 && Hls.isSupported()) {
      const hls = new Hls({
        enableWorker: true,
        manifestLoadingTimeOut: 8000,
        lowLatencyMode: true,
        backBufferLength: 90,
      });

      hlsRef.current = hls;
      hls.loadSource(streamUrl);
      hls.attachMedia(video);

      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        setIsLoading(false);
        applyInitialSeek();
        if (autoPlay) {
          video.play().catch(() => {
            video.muted = true;
            video.play().catch(() => {});
          });
        }
      });

      hls.on(Hls.Events.ERROR, (_, data) => {
        if (data.fatal) {
          const diag = diagnoseStreamError(src, data);
          setDiagnostic(diag);
          if (onError) onError(diag);
          hls.destroy();
          hlsRef.current = null;
          setHasError(true);
          setIsUsingFallback(true);
          video.src = fallbackSrc;
          video.play().catch(() => {});
        }
      });
    } else {
      video.src = streamUrl;
      const onLoaded = () => {
        setIsLoading(false);
        applyInitialSeek();
        if (autoPlay) {
          video.play().catch(() => {
            video.muted = true;
            video.play().catch(() => {});
          });
        }
      };

      const onErr = (e: any) => {
        setHasError(true);
        const diag = diagnoseStreamError(src, e);
        setDiagnostic(diag);
        if (onError) onError(diag);
        setIsUsingFallback(true);
        video.src = fallbackSrc;
        video.play().catch(() => {});
      };

      video.addEventListener("loadeddata", onLoaded, { once: true });
      video.addEventListener("error", onErr, { once: true });
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
  }, [src, fallbackSrc, autoPlay, useProxy, seekTime]);

  return (
    <div className="relative w-full h-full flex items-center justify-center bg-black overflow-hidden group">
      <video
        ref={videoRef}
        className={className}
        controls={controls}
        loop={loop}
        muted={muted}
        playsInline
        referrerPolicy="no-referrer"
      />

      {/* Loading Spinner */}
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/60 backdrop-blur-sm z-10">
          <RefreshCw className="w-8 h-8 text-blue-500 animate-spin" />
        </div>
      )}

      {/* Watchdog Bar */}
      {isUsingFallback && (
        <div className="absolute top-3 left-3 right-3 z-20 flex flex-wrap items-center justify-between gap-2 pointer-events-auto">
          <div className="bg-amber-500/95 text-black font-mono font-bold text-[10px] px-2.5 py-1 rounded-md flex items-center gap-1.5 shadow-md">
            <AlertTriangle className="w-3.5 h-3.5 fill-black" />
            <span>WATCHDOG ENGAGED: {diagnostic ? diagnostic.title : "BACKUP FEED ACTIVE"}</span>
          </div>

          <div className="flex items-center gap-1.5 font-mono text-[10px]">
            <button
              onClick={() => setUseProxy(!useProxy)}
              className={`px-2.5 py-1 rounded-md border font-bold flex items-center gap-1 transition-all cursor-pointer ${
                useProxy
                  ? "bg-[#0088FF] border-[#0088FF] text-white"
                  : "bg-black/70 border-white/20 text-white/80 hover:bg-white/10"
              }`}
            >
              <Globe className="w-3 h-3" />
              <span>{useProxy ? "CORS Relay: ON" : "Try CORS Relay"}</span>
            </button>

            <button
              onClick={() => setShowDiagModal(!showDiagModal)}
              className="px-2 py-1 rounded-md bg-black/70 border border-white/20 text-white/80 hover:text-white flex items-center gap-1 cursor-pointer"
            >
              <HelpCircle className="w-3 h-3 text-amber-400" />
              <span>Why Stalled?</span>
            </button>
          </div>
        </div>
      )}

      {/* Diagnostic Overlay Modal */}
      {showDiagModal && diagnostic && (
        <div className="absolute inset-4 z-30 bg-[#05070A]/95 border border-amber-500/40 rounded-2xl p-4 font-mono text-xs text-white backdrop-blur-xl shadow-2xl flex flex-col justify-between animate-in fade-in">
          <div className="space-y-3">
            <div className="flex items-center justify-between border-b border-white/10 pb-2">
              <div className="flex items-center gap-2 text-amber-400 font-bold">
                <ShieldAlert className="w-4 h-4" />
                <span>STREAM DIAGNOSTIC REPORT</span>
              </div>
              <button
                onClick={() => setShowDiagModal(false)}
                className="px-2 py-0.5 bg-white/10 hover:bg-white/20 rounded text-[10px] cursor-pointer"
              >
                Close
              </button>
            </div>

            <div>
              <div className="text-[11px] text-white/50 uppercase">Issue Identified</div>
              <div className="text-white font-bold text-sm mt-0.5">{diagnostic.title}</div>
              <p className="text-white/70 text-[11px] mt-1 leading-relaxed">{diagnostic.description}</p>
            </div>

            <div className="p-2.5 bg-white/5 border border-white/10 rounded-xl space-y-1">
              <div className="text-[10px] text-[#0088FF] font-bold uppercase">Recommended Fix</div>
              <div className="text-white/90 text-[11px]">{diagnostic.solution}</div>
            </div>
          </div>

          <div className="flex items-center justify-between pt-2 border-t border-white/10 text-[10px]">
            <a
              href={src}
              target="_blank"
              rel="noreferrer"
              className="text-[#0088FF] hover:underline flex items-center gap-1"
            >
              <span>Open Raw URL</span>
              <ExternalLink className="w-3 h-3" />
            </a>
            <span className="text-white/40">Nexus TV-O Watchdog Core</span>
          </div>
        </div>
      )}
    </div>
  );
};
