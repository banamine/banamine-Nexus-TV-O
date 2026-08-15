import React, { useState, useRef } from "react";
import { 
  Search, 
  Tv, 
  Star, 
  Lock, 
  Unlock, 
  Play, 
  Pause, 
  Maximize, 
  Volume2, 
  VolumeX, 
  Radio, 
  AlertTriangle, 
  Sparkles, 
  Clock, 
  Activity,
  CheckCircle2,
  RefreshCw,
  Film,
  Zap
} from "lucide-react";
import { Episode, WatchdogState } from "../types";
import { HlsVideoPlayer } from "./HlsVideoPlayer";

interface LiveTVThreeColumnProps {
  episodes: Episode[];
  selectedEpisode: Episode | null;
  onSelectEpisode: (ep: Episode) => void;
  pinUnlocked: boolean;
  onOpenPinModal: () => void;
  watchdogState: WatchdogState;
  onTriggerFailover: () => void;
}

export const LiveTVThreeColumn: React.FC<LiveTVThreeColumnProps> = ({
  episodes,
  selectedEpisode,
  onSelectEpisode,
  pinUnlocked,
  onOpenPinModal,
  watchdogState,
  onTriggerFailover,
}) => {
  const [selectedCategory, setSelectedCategory] = useState<string>("All");
  const [categoryFilter, setCategoryFilter] = useState<string>("");
  const [isPlaying, setIsPlaying] = useState<boolean>(true);
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const [favorites, setFavorites] = useState<Set<string>>(new Set(["ch-101", "ch-103"]));

  const playerContainerRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  // Group list categories
  const categories = [
    { id: "All", name: "All Channels", count: episodes.length, icon: Tv },
    { id: "Favorites", name: "Favorites ★", count: favorites.size, icon: Star },
    { id: "News", name: "News Network", count: episodes.filter(e => e.groupTitle === "News").length, icon: Radio },
    { id: "Sports", name: "Sports HD", count: episodes.filter(e => e.groupTitle === "Sports").length, icon: Zap },
    { id: "Movies", name: "Movies & Cinema", count: episodes.filter(e => e.groupTitle === "Movies").length, icon: Film },
    { id: "Kids", name: "Kids Zone", count: episodes.filter(e => e.groupTitle === "Kids").length, icon: Sparkles },
    { id: "Documentaries", name: "Documentaries", count: episodes.filter(e => e.groupTitle === "Documentaries").length, icon: Clock },
    { id: "Restricted 🔒", name: "Restricted Vault", count: episodes.filter(e => e.groupTitle.includes("Restricted")).length, icon: Lock, restricted: true },
  ];

  const filteredCategories = categories.filter(c => 
    c.name.toLowerCase().includes(categoryFilter.toLowerCase())
  );

  // Filter episodes by category
  let displayedEpisodes = episodes.filter(ep => {
    if (selectedCategory === "All") return true;
    if (selectedCategory === "Favorites") return favorites.has(ep.id);
    if (selectedCategory === "Restricted 🔒") {
      if (!pinUnlocked) return false;
      return ep.groupTitle.includes("Restricted");
    }
    return ep.groupTitle.toLowerCase().includes(selectedCategory.toLowerCase());
  });

  const toggleFavorite = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setFavorites(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const activeEp = selectedEpisode || episodes[0] || null;

  const handleCategorySelect = (cat: typeof categories[0]) => {
    if (cat.restricted && !pinUnlocked) {
      onOpenPinModal();
      return;
    }
    setSelectedCategory(cat.id);
  };

  const toggleFullscreen = () => {
    if (!playerContainerRef.current) return;
    if (!document.fullscreenElement) {
      playerContainerRef.current.requestFullscreen().catch(() => {});
      setIsFullscreen(true);
    } else {
      document.exitFullscreen().catch(() => {});
      setIsFullscreen(false);
    }
  };

  return (
    <div className="flex flex-col lg:flex-row h-[calc(100vh-80px)] overflow-hidden bg-[#05070A]">
      {/* COLUMN 1: CATEGORIES PANEL (Left) */}
      <div className="w-full lg:w-64 bg-[#0D121D] border-r border-white/10 flex flex-col h-1/3 lg:h-full shrink-0">
        <div className="p-3 border-b border-white/10 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-mono font-bold uppercase tracking-widest text-white/40">Categories</span>
            <span className="text-[10px] font-mono text-[#0088FF] bg-[#0088FF]/10 px-1.5 py-0.5 rounded border border-[#0088FF]/30">
              {episodes.length} TOTAL
            </span>
          </div>
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-white/30 absolute left-2.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Filter categories..."
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="w-full bg-[#05070A] border border-white/10 text-xs rounded-lg pl-8 pr-3 py-1.5 text-white placeholder-white/30 outline-none focus:border-[#0088FF]"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {filteredCategories.map((cat) => {
            const Icon = cat.icon;
            const isSelected = selectedCategory === cat.id;

            return (
              <button
                key={cat.id}
                onClick={() => handleCategorySelect(cat)}
                className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                  isSelected
                    ? "bg-[#0088FF] text-white shadow-lg shadow-[#0088FF]/30 font-bold"
                    : "text-white/60 hover:bg-white/5 hover:text-white"
                }`}
              >
                <div className="flex items-center gap-2.5 truncate">
                  <Icon className={`w-4 h-4 shrink-0 ${isSelected ? "text-white" : "text-[#0088FF]"}`} />
                  <span className="truncate">{cat.name}</span>
                </div>
                <div className="flex items-center gap-1">
                  {cat.restricted && !pinUnlocked && (
                    <Lock className="w-3 h-3 text-amber-400" />
                  )}
                  <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded ${
                    isSelected ? "bg-white/20 text-white" : "bg-[#05070A] text-white/40 border border-white/5"
                  }`}>
                    {cat.count}
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* COLUMN 2: CHANNEL INVENTORY PANEL (Middle) */}
      <div className="w-full lg:w-80 bg-[#05070A] border-r border-white/10 flex flex-col h-1/3 lg:h-full shrink-0">
        <div className="p-3 border-b border-white/10 flex items-center justify-between bg-[#0D121D]">
          <span className="text-[11px] font-mono font-bold uppercase tracking-widest text-white/40">
            {selectedCategory} ({displayedEpisodes.length})
          </span>
          <span className="text-[10px] font-mono text-[#00FF9D]">1080p / 4K</span>
        </div>

        <div className="flex-1 overflow-y-auto p-2 space-y-1.5">
          {displayedEpisodes.length === 0 ? (
            <div className="p-8 text-center space-y-2 text-white/40 font-mono">
              <Lock className="w-8 h-8 text-amber-400 mx-auto" />
              <p className="text-xs">Category Restricted or Empty.</p>
              <button 
                onClick={onOpenPinModal} 
                className="px-3 py-1 bg-amber-500/20 text-amber-400 text-xs rounded border border-amber-500/40 cursor-pointer"
              >
                Unlock PIN Shield
              </button>
            </div>
          ) : (
            displayedEpisodes.map((ep, idx) => {
              const isSelected = activeEp?.id === ep.id;
              const isFav = favorites.has(ep.id);

              return (
                <div
                  key={ep.id}
                  onClick={() => onSelectEpisode(ep)}
                  className={`p-3 rounded-xl border transition-all cursor-pointer flex items-center justify-between gap-3 ${
                    isSelected
                      ? "bg-[#0D121D] border-[#0088FF] glow-blue"
                      : "bg-[#0D121D]/60 border-white/5 hover:bg-[#0D121D] hover:border-white/20"
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="font-mono text-xs font-bold text-[#0088FF] w-8 shrink-0">
                      [{101 + idx}]
                    </span>

                    {ep.tvgLogo ? (
                      <img 
                        src={ep.tvgLogo} 
                        alt={ep.title} 
                        className="w-9 h-9 rounded-lg object-cover bg-black border border-white/10 shrink-0" 
                      />
                    ) : (
                      <div className="w-9 h-9 rounded-lg bg-[#161E2E] flex items-center justify-center shrink-0 border border-white/10">
                        <Tv className="w-4 h-4 text-[#0088FF]" />
                      </div>
                    )}

                    <div className="min-w-0">
                      <h4 className="text-xs font-bold text-white truncate group-hover:text-[#0088FF]">
                        {ep.title}
                      </h4>
                      <p className="text-[11px] text-white/50 truncate flex items-center gap-1.5 mt-0.5">
                        <span className="text-[#0088FF] font-semibold">Now:</span>
                        <span>{ep.description || "Continuous Live Broadcast"}</span>
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      onClick={(e) => toggleFavorite(ep.id, e)}
                      className={`p-1 rounded transition-colors cursor-pointer ${
                        isFav ? "text-amber-400 fill-amber-400" : "text-white/30 hover:text-white"
                      }`}
                    >
                      <Star className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* COLUMN 3: LIVE PREVIEW & EPG WORKSPACE (Right) */}
      <div className="flex-1 bg-[#05070A] flex flex-col h-1/3 lg:h-full overflow-y-auto">
        <div className="p-4 space-y-4 max-w-5xl mx-auto w-full">
          {/* VIDEO PLAYER CONTAINER */}
          <div 
            ref={playerContainerRef} 
            className="relative bg-black rounded-2xl overflow-hidden border border-[#0088FF]/50 glow-blue shadow-2xl group crt-scanlines"
          >
            <div className="osd-label">
              PLAYER 1 // {activeEp?.groupTitle?.toUpperCase() || "TV NEWS PRIMARY"}
            </div>

            {activeEp ? (
              <div className="w-full aspect-video">
                <HlsVideoPlayer
                  src={watchdogState.circuitEngaged ? watchdogState.activeFallbackUrl : activeEp.url}
                  autoPlay={isPlaying}
                  loop={true}
                  muted={isMuted}
                  controls={false}
                  className="w-full aspect-video object-cover"
                  onError={() => {
                    if (!watchdogState.circuitEngaged) {
                      onTriggerFailover();
                    }
                  }}
                />
              </div>
            ) : (
              <div className="aspect-video flex items-center justify-center text-white/40 text-xs font-mono">
                No Channel Selected
              </div>
            )}

            {/* WATCHDOG CIRCUIT BREAKER BADGE */}
            {watchdogState.circuitEngaged && (
              <div className="absolute top-12 left-4 z-20 bg-amber-500 text-black font-bold text-xs px-3 py-1.5 rounded-lg flex items-center gap-2 shadow-lg animate-pulse font-mono">
                <AlertTriangle className="w-4 h-4 fill-black" />
                <span>ENGAGING FALLBACK STREAM... (Watchdog Active)</span>
              </div>
            )}

            {/* MINI NEWS BREAK OSD BADGE */}
            {activeEp && activeEp.duration <= 300 && (
              <div className="absolute top-4 right-4 z-20 bg-red-600 text-white font-extrabold text-xs px-3 py-1.5 rounded-lg flex items-center gap-2 shadow-lg font-mono">
                <Radio className="w-4 h-4 animate-ping" />
                <span>INTERSTITIAL NEWS BREAK INJECTED</span>
              </div>
            )}

            {/* OVERLAY PLAYER CONTROLS & STREAM SPECS */}
            <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black/90 via-black/50 to-transparent z-10 opacity-90 group-hover:opacity-100 transition-opacity flex flex-wrap items-center justify-between gap-3 text-xs">
              <div className="flex items-center gap-3">
                <button
                  onClick={() => {
                    if (videoRef.current) {
                      if (isPlaying) videoRef.current.pause();
                      else videoRef.current.play();
                      setIsPlaying(!isPlaying);
                    }
                  }}
                  className="p-2 bg-[#0088FF] text-white rounded-lg hover:scale-105 transition-transform cursor-pointer"
                >
                  {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                </button>

                <button
                  onClick={() => setIsMuted(!isMuted)}
                  className="p-2 bg-white/10 hover:bg-white/20 text-white rounded-lg cursor-pointer"
                >
                  {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
                </button>

                <div>
                  <h3 className="font-bold text-white text-sm truncate max-w-xs">{activeEp?.title}</h3>
                  <p className="text-[11px] text-white/50 font-mono">{activeEp?.groupTitle} • DECODING HLS STREAM 1080p60</p>
                </div>
              </div>

              {/* STREAM QUALITY BADGES */}
              <div className="flex items-center gap-2 font-mono text-[10px]">
                <span className="px-2 py-0.5 rounded bg-[#00FF9D]/20 text-[#00FF9D] border border-[#00FF9D]/30">4K UHD</span>
                <span className="px-2 py-0.5 rounded bg-purple-500/20 text-purple-400 border border-purple-500/30">AAC 5.1</span>
                <span className="px-2 py-0.5 rounded bg-blue-500/20 text-blue-400 border border-blue-500/30">60 FPS</span>

                <button
                  onClick={toggleFullscreen}
                  className="p-2 bg-white/10 hover:bg-white/20 text-white rounded-lg ml-2 cursor-pointer"
                  title="Fullscreen OSD"
                >
                  <Maximize className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>

          {/* TIMELINE PROGRESS & WATCHDOG FAILOVER TOOLBAR */}
          <div className="glass-card p-4 space-y-3">
            <div className="flex items-center justify-between text-xs font-mono text-white/40">
              <span>00:14:20</span>
              <div className="flex-1 mx-4 h-1.5 bg-black/60 rounded-full overflow-hidden relative border border-white/5">
                <div className="h-full bg-gradient-to-r from-[#0088FF] to-[#00FF9D] w-1/4 rounded-full" />
              </div>
              <span>01:30:00</span>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-white/5">
              <div className="flex items-center gap-2 text-xs font-mono">
                <Activity className="w-4 h-4 text-[#00FF9D]" />
                <span className="text-white/40">Stream Health:</span>
                <span className="text-[#00FF9D] font-bold">100% (0 Dropouts)</span>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={onTriggerFailover}
                  className="px-3 py-1.5 bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/30 rounded-xl text-xs font-mono font-bold flex items-center gap-1.5 transition-all cursor-pointer"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Test Watchdog Fallback</span>
                </button>
              </div>
            </div>
          </div>

          {/* EPG NEXT UP PROGRAM SCHEDULE */}
          <div className="glass-card p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-[11px] font-mono font-extrabold uppercase tracking-widest text-white/40">
                NEXT UP PROGRAMMING SCHEDULE
              </h3>
              <span className="text-[10px] font-mono text-[#0088FF] uppercase">EPG SYNCED</span>
            </div>

            <div className="space-y-2 text-xs font-mono">
              <div className="p-2.5 rounded-xl bg-[#05070A] border border-white/5 flex items-center justify-between">
                <div>
                  <span className="text-[#0088FF] font-bold mr-2">11:00 AM</span>
                  <span className="font-semibold text-white">Deep Ocean Documentary: Abyssal Secrets</span>
                </div>
                <span className="text-[10px] text-white/40">60 Min</span>
              </div>

              <div className="p-2.5 rounded-xl bg-[#05070A] border border-white/5 flex items-center justify-between">
                <div>
                  <span className="text-[#0088FF] font-bold mr-2">12:00 PM</span>
                  <span className="font-semibold text-white">Daily Mail Breaking News Bulletin &amp; World Update</span>
                </div>
                <span className="text-[10px] text-white/40">30 Min</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
