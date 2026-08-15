import React, { useState, useEffect, useRef } from "react";
import { 
  Play, 
  Pause, 
  SkipForward, 
  SkipBack, 
  Volume2, 
  VolumeX, 
  Maximize, 
  Shuffle, 
  Calendar, 
  Layers, 
  Sliders, 
  Radio, 
  Clock, 
  Sparkles, 
  X,
  Tv,
  Zap,
  Activity
} from "lucide-react";
import { Episode, PlayerPaddockState } from "../types";

interface ChannelPlayerViewProps {
  episodes: Episode[];
  initialEpisode?: Episode | null;
}

export const ChannelPlayerView: React.FC<ChannelPlayerViewProps> = ({
  episodes,
  initialEpisode,
}) => {
  const [currentIdx, setCurrentIdx] = useState<number>(0);
  const [isPlaying, setIsPlaying] = useState<boolean>(true);
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [pacingPreset, setPacingPreset] = useState<"Rapid" | "Balanced" | "Dive" | "Nostalgia">("Balanced");
  const [blockSize, setBlockSize] = useState<1 | 2 | 3>(2);
  const [isDrawerOpen, setIsDrawerOpen] = useState<boolean>(false);
  const [isSmartShuffle, setIsSmartShuffle] = useState<boolean>(true);
  const [showNextOverlay, setShowNextOverlay] = useState<boolean>(true);
  const [activePlayerPaddock, setActivePlayerPaddock] = useState<"player1" | "player2">("player1");

  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const activeEp = episodes[currentIdx] || initialEpisode || episodes[0];
  const nextEp = episodes[(currentIdx + 1) % episodes.length];

  // Two-Paddock State Simulation
  const paddockState: PlayerPaddockState = {
    player1: {
      clockPattern: "Pattern 1 — Breaks at :05 (1m), :29 (4m), :57:50 (2m+10s)",
      nextBreakInSec: 320,
      hardSliceActive: true,
      currentShow: activeEp?.title || "24H News Feed",
    },
    player2: {
      mode: "AJ Broadcast",
      ntdBreakSecRemaining: 900,
      savedCursorOffsetSec: 1420,
      activeShow: "Alex Jones Broadcast Hour HD",
    }
  };

  // Keyboard shortcut listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

      if (e.key === "ArrowRight") {
        setCurrentIdx(prev => (prev + 1) % episodes.length);
      } else if (e.key === "ArrowLeft") {
        setCurrentIdx(prev => (prev - 1 + episodes.length) % episodes.length);
      } else if (e.key === "f" || e.key === "F") {
        if (containerRef.current) {
          if (!document.fullscreenElement) containerRef.current.requestFullscreen().catch(() => {});
          else document.exitFullscreen().catch(() => {});
        }
      } else if (e.key === "s" || e.key === "S") {
        setIsDrawerOpen(prev => !prev);
      } else if (e.key === "m" || e.key === "M") {
        setIsMuted(prev => !prev);
      } else if (e.key === "p" || e.key === "P") {
        setPacingPreset(prev => {
          if (prev === "Rapid") return "Balanced";
          if (prev === "Balanced") return "Dive";
          if (prev === "Dive") return "Nostalgia";
          return "Rapid";
        });
      } else if (e.key === "b" || e.key === "B") {
        setBlockSize(prev => (prev % 3 + 1) as any);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [episodes.length]);

  return (
    <div className="relative h-[calc(100vh-80px)] bg-[#05070A] overflow-hidden flex flex-col justify-between">
      {/* VIDEO CONTAINER */}
      <div ref={containerRef} className="relative w-full h-full flex items-center justify-center bg-black crt-scanlines">
        <div className="osd-label">
          {activePlayerPaddock === "player1" ? "PRIMARY LINEAR DECODER" : "AUXILIARY AJ STREAM"} // HLS 1080p60
        </div>

        {activeEp ? (
          <video
            ref={videoRef}
            src={activeEp.url}
            autoPlay
            loop
            muted={isMuted}
            controls={false}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="text-white/40 text-xs font-mono">No media loaded</div>
        )}

        {/* TOP HEADER OVERLAY */}
        <div className="absolute top-0 left-0 right-0 p-6 bg-gradient-to-b from-black/90 via-black/40 to-transparent z-20 flex items-center justify-between">
          <div className="flex items-center gap-3 font-mono">
            <span className="px-3 py-1 rounded-xl bg-[#0088FF] text-white text-xs font-black uppercase tracking-wider shadow-lg shadow-[#0088FF]/30">
              {activePlayerPaddock === "player1" ? "PLAYER 1: 24H TV NEWS" : "PLAYER 2: LIVE BROADCAST"}
            </span>
            <div className="text-xs text-white/50">
              <span>CHANNEL [{101 + currentIdx}]</span>
            </div>
          </div>

          <div className="flex items-center gap-2 font-mono">
            {/* Paddock Switcher */}
            <button
              onClick={() => setActivePlayerPaddock("player1")}
              className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                activePlayerPaddock === "player1" ? "bg-[#0088FF] text-white" : "bg-black/60 text-white/40 border border-white/10"
              }`}
            >
              Player 1 (Linear)
            </button>
            <button
              onClick={() => setActivePlayerPaddock("player2")}
              className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                activePlayerPaddock === "player2" ? "bg-amber-600 text-white" : "bg-black/60 text-white/40 border border-white/10"
              }`}
            >
              Player 2 (AJ / VoD)
            </button>
            <button
              onClick={() => setIsDrawerOpen(true)}
              className="px-3 py-1.5 bg-[#0D121D] hover:bg-white/10 text-white border border-white/10 rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer ml-2"
            >
              <Calendar className="w-3.5 h-3.5 text-[#0088FF]" />
              <span>Aria Schedule (S)</span>
            </button>
          </div>
        </div>

        {/* "COMING UP NEXT" LOWER-THIRD OVERLAY */}
        {showNextOverlay && nextEp && (
          <div className="absolute bottom-24 left-6 z-20 glass-card p-4 max-w-md border border-[#0088FF]/40 glow-blue shadow-2xl animate-in slide-in-from-bottom duration-300">
            <div className="flex items-center justify-between gap-4 mb-1 font-mono">
              <span className="text-[10px] uppercase tracking-wider text-[#0088FF] font-bold">
                COMING UP NEXT
              </span>
              <button onClick={() => setShowNextOverlay(false)} className="text-white/40 hover:text-white cursor-pointer">
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
            <h4 className="text-xs font-bold text-white truncate uppercase">{nextEp.title}</h4>
            <p className="text-[11px] text-white/50 font-mono mt-0.5">{nextEp.groupTitle} • {Math.round(nextEp.duration / 60)} min</p>
          </div>
        )}

        {/* BOTTOM FLOATING CONTROL TOOLBAR */}
        <div className="absolute bottom-0 left-0 right-0 p-6 bg-gradient-to-t from-black/95 via-black/60 to-transparent z-20 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setCurrentIdx(prev => (prev - 1 + episodes.length) % episodes.length)}
              className="p-2.5 bg-white/10 hover:bg-white/20 text-white rounded-xl cursor-pointer"
            >
              <SkipBack className="w-4 h-4" />
            </button>

            <button
              onClick={() => setIsPlaying(!isPlaying)}
              className="p-3 bg-[#0088FF] text-white rounded-xl shadow-lg shadow-[#0088FF]/30 cursor-pointer"
            >
              {isPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5 fill-white" />}
            </button>

            <button
              onClick={() => setCurrentIdx(prev => (prev + 1) % episodes.length)}
              className="p-2.5 bg-white/10 hover:bg-white/20 text-white rounded-xl cursor-pointer"
            >
              <SkipForward className="w-4 h-4" />
            </button>

            <button
              onClick={() => setIsMuted(!isMuted)}
              className="p-2.5 bg-white/10 hover:bg-white/20 text-white rounded-xl cursor-pointer ml-2"
            >
              {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
            </button>

            <div className="hidden sm:block ml-2">
              <h3 className="text-xs font-bold text-white truncate max-w-xs uppercase">{activeEp?.title}</h3>
              <p className="text-[10px] text-white/50 font-mono">{activeEp?.groupTitle}</p>
            </div>
          </div>

          {/* SMART SHUFFLE & PACING CONTROLS */}
          <div className="flex items-center gap-2 text-xs font-mono">
            <button
              onClick={() => setIsSmartShuffle(!isSmartShuffle)}
              className={`px-3 py-1.5 rounded-xl border flex items-center gap-1.5 transition-all cursor-pointer ${
                isSmartShuffle ? "bg-[#0088FF]/20 text-[#0088FF] border-[#0088FF]/40" : "bg-black/60 text-white/40 border-white/10"
              }`}
              title="Smart Shuffle v3"
            >
              <Shuffle className="w-3.5 h-3.5" />
              <span>Shuffle v3</span>
            </button>

            <button
              onClick={() => {
                const presets: ("Rapid" | "Balanced" | "Dive" | "Nostalgia")[] = ["Rapid", "Balanced", "Dive", "Nostalgia"];
                const nextIdx = (presets.indexOf(pacingPreset) + 1) % presets.length;
                setPacingPreset(presets[nextIdx]);
              }}
              className="px-3 py-1.5 bg-[#0D121D] text-amber-400 border border-white/10 rounded-xl flex items-center gap-1.5 cursor-pointer"
            >
              <Zap className="w-3.5 h-3.5" />
              <span>Preset: {pacingPreset}</span>
            </button>

            <button
              onClick={() => setBlockSize(prev => (prev % 3 + 1) as any)}
              className="px-3 py-1.5 bg-[#0D121D] text-cyan-400 border border-white/10 rounded-xl flex items-center gap-1.5 cursor-pointer"
            >
              <Layers className="w-3.5 h-3.5" />
              <span>Block: {blockSize}</span>
            </button>
          </div>
        </div>
      </div>

      {/* ARIA SCHEDULE DRAWER (Slide-in from Right) */}
      {isDrawerOpen && (
        <div className="fixed inset-y-0 right-0 z-50 w-80 bg-[#0D121D] border-l border-white/10 shadow-2xl p-4 flex flex-col justify-between animate-in slide-in-from-right duration-300">
          <div className="space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-white/10">
              <div className="flex items-center gap-2 text-xs font-mono font-bold text-white uppercase">
                <Calendar className="w-4 h-4 text-[#0088FF]" />
                <span>Aria Schedule Drawer</span>
              </div>
              <button onClick={() => setIsDrawerOpen(false)} className="text-white/40 hover:text-white cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Paddock Info */}
            <div className="p-3 bg-[#05070A] rounded-xl border border-white/5 text-[11px] font-mono space-y-1">
              <div className="text-[#0088FF] font-bold">PADDOCK: {activePlayerPaddock.toUpperCase()}</div>
              <p className="text-white/40">{paddockState[activePlayerPaddock].clockPattern || paddockState.player2.mode}</p>
            </div>

            {/* Schedule Items List */}
            <div className="space-y-2 overflow-y-auto max-h-[calc(100vh-220px)]">
              {episodes.map((ep, idx) => {
                const isCurrent = idx === currentIdx;

                return (
                  <div
                    key={ep.id}
                    onClick={() => setCurrentIdx(idx)}
                    className={`p-2.5 rounded-xl border text-xs cursor-pointer transition-all ${
                      isCurrent
                        ? "bg-[#0088FF]/20 border-[#0088FF] text-white"
                        : "bg-[#05070A]/80 border-white/5 text-white/50 hover:bg-[#05070A] hover:text-white"
                    }`}
                  >
                    <div className="flex items-center justify-between font-mono text-[10px] mb-1">
                      <span className="text-[#0088FF]">[{101 + idx}] NOW</span>
                      <span>{Math.round(ep.duration / 60)}m</span>
                    </div>
                    <h5 className="font-bold text-white truncate uppercase">{ep.title}</h5>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="pt-3 border-t border-white/10 text-[10px] font-mono text-white/40 text-center">
            Press (S) to toggle drawer • (←/→) Change Channel
          </div>
        </div>
      )}
    </div>
  );
};
