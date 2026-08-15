import React, { useState } from "react";
import { 
  Grid2x2, 
  Tv, 
  Volume2, 
  VolumeX, 
  Maximize, 
  Radio, 
  Zap, 
  CheckCircle2, 
  RefreshCw,
  Layers
} from "lucide-react";
import { Episode } from "../types";
import { HlsVideoPlayer } from "./HlsVideoPlayer";

interface MultiScreenGridProps {
  episodes: Episode[];
}

export const MultiScreenGrid: React.FC<MultiScreenGridProps> = ({ episodes }) => {
  const [gridMode, setGridMode] = useState<2 | 4>(4);
  const [audioFocusIndex, setAudioFocusIndex] = useState<number>(0);

  // Active channel selection per tile
  const [activeChannels, setActiveChannels] = useState<Episode[]>([
    episodes[0] || null,
    episodes[1] || episodes[0] || null,
    episodes[2] || episodes[0] || null,
    episodes[3] || episodes[0] || null,
  ]);

  const setChannelForTile = (tileIdx: number, epId: string) => {
    const found = episodes.find(e => e.id === epId);
    if (!found) return;
    setActiveChannels(prev => {
      const next = [...prev];
      next[tileIdx] = found;
      return next;
    });
  };

  const visibleTiles = activeChannels.slice(0, gridMode);

  return (
    <div className="p-4 sm:p-8 max-w-7xl mx-auto space-y-6">
      {/* Header & Grid Mode Selector */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 glass p-5 rounded-2xl border border-white/10">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#0088FF]/20 text-[#0088FF] border border-[#0088FF]/30 flex items-center justify-center shrink-0">
            <Grid2x2 className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-xl font-black text-white uppercase tracking-tight">Multi-Screen Stream Matrix</h1>
            <p className="text-xs text-white/50">Synchronized 2x / 4x video grid powered by CORS proxy server.</p>
          </div>
        </div>

        {/* Controls */}
        <div className="flex items-center gap-3 font-mono">
          <div className="flex bg-[#05070A] p-1 rounded-xl border border-white/10">
            <button
              onClick={() => setGridMode(2)}
              className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-colors cursor-pointer ${
                gridMode === 2 ? "bg-[#0088FF] text-white" : "text-white/40 hover:text-white"
              }`}
            >
              2x Grid
            </button>
            <button
              onClick={() => setGridMode(4)}
              className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-colors cursor-pointer ${
                gridMode === 4 ? "bg-[#0088FF] text-white" : "text-white/40 hover:text-white"
              }`}
            >
              4x Grid
            </button>
          </div>

          <div className="text-xs font-mono px-3 py-1.5 rounded-xl bg-[#05070A] border border-white/10 text-[#00FF9D] flex items-center gap-1.5">
            <Radio className="w-3.5 h-3.5 animate-pulse text-[#0088FF]" />
            <span>Proxy CORS Active</span>
          </div>
        </div>
      </div>

      {/* MULTI-STREAM VIDEO TILES */}
      <div className={`grid gap-4 ${gridMode === 2 ? "grid-cols-1 md:grid-cols-2" : "grid-cols-1 sm:grid-cols-2 lg:grid-cols-2"}`}>
        {visibleTiles.map((ep, idx) => {
          const hasAudio = audioFocusIndex === idx;

          return (
            <div
              key={idx}
              className={`bg-[#0D121D] border rounded-2xl overflow-hidden relative group transition-all ${
                hasAudio ? "border-[#0088FF] glow-blue" : "border-white/10 hover:border-white/20"
              }`}
            >
              {/* VIDEO WINDOW */}
              <div className="aspect-video bg-black relative crt-scanlines">
                <div className="osd-label">
                  STREAM MATRIX #{idx + 1} // {ep?.groupTitle?.toUpperCase() || "LIVE"}
                </div>

                {ep ? (
                  <HlsVideoPlayer
                    src={ep.url}
                    autoPlay={true}
                    loop={true}
                    muted={!hasAudio}
                    controls={false}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-white/40 text-xs font-mono">
                    Select Channel
                  </div>
                )}

                {/* AUDIO FOCUS BADGE */}
                <button
                  onClick={() => setAudioFocusIndex(idx)}
                  className={`absolute top-10 left-3 z-20 px-2.5 py-1 rounded-lg text-[10px] font-mono font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                    hasAudio
                      ? "bg-[#0088FF] text-white shadow-lg shadow-[#0088FF]/40"
                      : "bg-black/80 text-white/50 border border-white/10 hover:bg-black hover:text-white"
                  }`}
                >
                  {hasAudio ? <Volume2 className="w-3.5 h-3.5" /> : <VolumeX className="w-3.5 h-3.5" />}
                  <span>{hasAudio ? "AUDIO ACTIVE" : "MUTED (CLICK)"}</span>
                </button>

                {/* RESOLUTION BADGE */}
                <div className="absolute top-10 right-3 z-20 px-2 py-0.5 rounded bg-black/80 text-[10px] font-mono text-[#00FF9D] border border-[#00FF9D]/30">
                  1080p60 • CORS OK
                </div>
              </div>

              {/* TILE FOOTER & CHANNEL SELECTOR */}
              <div className="p-3 bg-[#0D121D] flex items-center justify-between gap-3 border-t border-white/10 font-mono">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-xs font-bold text-[#0088FF]">Screen #{idx + 1}</span>
                  <select
                    value={ep?.id || ""}
                    onChange={(e) => setChannelForTile(idx, e.target.value)}
                    className="bg-[#05070A] border border-white/10 text-xs text-white px-2 py-1 rounded-lg outline-none max-w-[200px] truncate"
                  >
                    {episodes.map(e => (
                      <option key={e.id} value={e.id}>{e.title}</option>
                    ))}
                  </select>
                </div>

                <div className="text-[10px] text-white/40">
                  {ep?.groupTitle}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
