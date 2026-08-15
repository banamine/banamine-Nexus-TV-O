import React, { useState, useRef, useEffect } from "react";
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
  Zap,
  Layers,
  Database,
  ListVideo,
  History,
  Trash2,
  Filter,
  X,
  FileCode,
  Globe,
  ArrowRight
} from "lucide-react";
import { Episode, WatchdogState } from "../types";
import { HlsVideoPlayer } from "./HlsVideoPlayer";
import { 
  unwrapM3uOnDemand, 
  getCachedPlaylistJSON, 
  slugifyTitle,
  preloadAdjacentTitleChunks 
} from "../utils/archiveHarvesterDB";
import { 
  getStoredFavorites, 
  saveStoredFavorites, 
  getStoredWatchHistory, 
  recordWatchHistory, 
  clearStoredWatchHistory,
  WatchHistoryEntry
} from "../utils/historyFavoritesStorage";

interface LiveTVThreeColumnProps {
  episodes: Episode[];
  selectedEpisode: Episode | null;
  onSelectEpisode: (ep: Episode) => void;
  pinUnlocked: boolean;
  onOpenPinModal: () => void;
  watchdogState: WatchdogState;
  onTriggerFailover: () => void;
  onResetFailover?: () => void;
}

export const LiveTVThreeColumn: React.FC<LiveTVThreeColumnProps> = ({
  episodes,
  selectedEpisode,
  onSelectEpisode,
  pinUnlocked,
  onOpenPinModal,
  watchdogState,
  onTriggerFailover,
  onResetFailover,
}) => {
  const [selectedCategory, setSelectedCategory] = useState<string>("All");
  const [categoryFilter, setCategoryFilter] = useState<string>("");
  const [channelSearch, setChannelSearch] = useState<string>("");
  const [activeTypePill, setActiveTypePill] = useState<"all" | "news" | "movies" | "series" | "archive" | "favorites" | "history">("all");
  const [isPlaying, setIsPlaying] = useState<boolean>(true);
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);

  // Persistent Favorites & Recent Watch History
  const [favorites, setFavorites] = useState<Set<string>>(() => getStoredFavorites());
  const [watchHistory, setWatchHistory] = useState<WatchHistoryEntry[]>(() => getStoredWatchHistory());

  // Unwrapped playlist state for multi-track M3Us / Archive items
  const [unwrappedTracks, setUnwrappedTracks] = useState<Episode[]>([]);
  const [activeTrackIndex, setActiveTrackIndex] = useState<number>(0);
  const [isUnwrapping, setIsUnwrapping] = useState<boolean>(false);
  const [isServedFromDBCache, setIsServedFromDBCache] = useState<boolean>(false);
  const [activeChunkFilename, setActiveChunkFilename] = useState<string>("");

  const playerContainerRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  const activeEp = selectedEpisode || episodes[0] || null;

  // Record episode into persistent watch history on selection
  useEffect(() => {
    if (activeEp) {
      const updated = recordWatchHistory(activeEp);
      setWatchHistory(updated);
    }
  }, [activeEp?.id, activeEp?.url]);

  // Unpack M3U playlist lazily on channel switch with modular per-title JSON chunking
  useEffect(() => {
    if (!activeEp) {
      setUnwrappedTracks([]);
      setActiveChunkFilename("");
      return;
    }

    const currentIdx = episodes.findIndex(e => e.id === activeEp.id);
    const m3uUrl = activeEp.m3uSourceUrl || activeEp.url || "";
    const chunkName = slugifyTitle(activeEp.title, activeEp.id);
    setActiveChunkFilename(chunkName);

    const isM3u =
      ((m3uUrl.toLowerCase().endsWith(".m3u") || m3uUrl.toLowerCase().includes(".m3u?")) &&
        !m3uUrl.toLowerCase().includes(".m3u8")) ||
      Boolean(activeEp.isLazy);

    if (isM3u) {
      setIsUnwrapping(true);
      const cached = getCachedPlaylistJSON(m3uUrl);
      if (cached && cached.length > 0) {
        setUnwrappedTracks(cached);
        setActiveTrackIndex(0);
        setIsServedFromDBCache(true);
        setIsUnwrapping(false);
      } else {
        setIsServedFromDBCache(false);
        unwrapM3uOnDemand(activeEp).then((res) => {
          setUnwrappedTracks(res.episodes);
          setActiveTrackIndex(0);
          setIsServedFromDBCache(res.fromCache);
          setActiveChunkFilename(res.chunkFilename);
          setIsUnwrapping(false);
        }).catch((err) => {
          console.warn("Unwrap error:", err);
          setUnwrappedTracks([activeEp]);
          setIsUnwrapping(false);
        });
      }

      // Trigger background on-demand preloader for adjacent title JSON chunks
      if (currentIdx !== -1) {
        preloadAdjacentTitleChunks(currentIdx, episodes);
      }
    } else {
      setUnwrappedTracks([activeEp]);
      setActiveTrackIndex(0);
      setIsServedFromDBCache(false);
      setIsUnwrapping(false);
    }
  }, [activeEp?.id, activeEp?.url]);

  // Determine current active stream URL
  const currentStreamUrl = (() => {
    if (watchdogState.circuitEngaged) return watchdogState.activeFallbackUrl;
    if (unwrappedTracks.length > 0 && unwrappedTracks[activeTrackIndex]) {
      return unwrappedTracks[activeTrackIndex].url;
    }
    return activeEp?.url || "";
  })();

  // Dynamically derive all category buckets from existing episodes
  const distinctGroups: string[] = Array.from(new Set(episodes.map(e => e.groupTitle || "General")));

  interface CategoryItem {
    id: string;
    name: string;
    count: number;
    icon: React.ComponentType<{ className?: string }>;
    restricted: boolean;
  }

  const categories: CategoryItem[] = [
    { id: "All", name: "All Channels", count: episodes.length, icon: Tv, restricted: false },
    { id: "Favorites", name: "Favorites ★", count: favorites.size, icon: Star, restricted: false },
    { id: "History", name: "Recent History", count: watchHistory.length, icon: History, restricted: false },
    ...distinctGroups.map((grp: string): CategoryItem => {
      const isRestricted = grp.toLowerCase().includes("restricted");
      const isArchive = grp.toLowerCase().includes("archive") || grp.toLowerCase().includes("crime") || grp.toLowerCase().includes("highlights");
      const isSports = grp.toLowerCase().includes("sport");
      const isNews = grp.toLowerCase().includes("news");
      const isMovies = grp.toLowerCase().includes("movie") || grp.toLowerCase().includes("series");

      let icon: React.ComponentType<{ className?: string }> = Tv;
      if (isArchive) icon = Film;
      else if (isSports) icon = Zap;
      else if (isNews) icon = Radio;
      else if (isMovies) icon = Layers;
      else if (isRestricted) icon = Lock;

      return {
        id: grp,
        name: grp,
        count: episodes.filter(e => (e.groupTitle || "General") === grp).length,
        icon,
        restricted: isRestricted,
      };
    }),
  ];

  const filteredCategories = categories.filter(c => 
    c.name.toLowerCase().includes(categoryFilter.toLowerCase())
  );

  // Filter episodes by category, quick pill filter, and quick search term
  let displayedEpisodes = episodes.filter(ep => {
    // Quick Category Pillar Filter
    if (selectedCategory === "Favorites") {
      if (!favorites.has(ep.id)) return false;
    } else if (selectedCategory === "History") {
      const historyIds = new Set(watchHistory.map(h => h.episode.id));
      if (!historyIds.has(ep.id)) return false;
    } else if (selectedCategory.includes("Restricted")) {
      if (!pinUnlocked) return false;
      if (!(ep.groupTitle || "").includes("Restricted")) return false;
    } else if (selectedCategory !== "All") {
      if ((ep.groupTitle || "General") !== selectedCategory) return false;
    }

    // Quick Filter Pills
    if (activeTypePill === "news") {
      const isNews = ep.contentType === "news" || (ep.groupTitle || "").toLowerCase().includes("news");
      if (!isNews) return false;
    } else if (activeTypePill === "movies") {
      const isMovie = ep.contentType === "movie" || (ep.groupTitle || "").toLowerCase().includes("movie") || (ep.groupTitle || "").toLowerCase().includes("cinema") || (ep.groupTitle || "").toLowerCase().includes("vod");
      if (!isMovie) return false;
    } else if (activeTypePill === "series") {
      const isSeries = ep.contentType === "series" || (ep.groupTitle || "").toLowerCase().includes("series") || (ep.groupTitle || "").toLowerCase().includes("tv show");
      if (!isSeries) return false;
    } else if (activeTypePill === "archive") {
      const isArchive = ep.sourceHost === "archive.org" || (ep.groupTitle || "").toLowerCase().includes("archive") || (ep.groupTitle || "").toLowerCase().includes("crime") || (ep.groupTitle || "").toLowerCase().includes("highlights");
      if (!isArchive) return false;
    } else if (activeTypePill === "favorites") {
      if (!favorites.has(ep.id)) return false;
    } else if (activeTypePill === "history") {
      const historyIds = new Set(watchHistory.map(h => h.episode.id));
      if (!historyIds.has(ep.id)) return false;
    }

    // Quick Channel Search Query
    if (channelSearch.trim()) {
      const q = channelSearch.toLowerCase();
      const matchTitle = ep.title.toLowerCase().includes(q);
      const matchGroup = (ep.groupTitle || "").toLowerCase().includes(q);
      const matchTvg = (ep.tvgName || "").toLowerCase().includes(q);
      if (!matchTitle && !matchGroup && !matchTvg) return false;
    }

    return true;
  });

  // If History is selected, maintain chronological watch order
  if (selectedCategory === "History" || activeTypePill === "history") {
    const historyMap = new Map<string, number>(watchHistory.map((h, idx) => [h.episode.id, idx]));
    displayedEpisodes = [...displayedEpisodes].sort((a, b) => {
      const aIdx: number = historyMap.get(a.id) ?? 9999;
      const bIdx: number = historyMap.get(b.id) ?? 9999;
      return aIdx - bIdx;
    });
  }

  const toggleFavorite = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setFavorites(prev => {
      const next = new Set<string>(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      saveStoredFavorites(next);
      return next;
    });
  };

  const handleClearHistory = () => {
    clearStoredWatchHistory();
    setWatchHistory([]);
  };

  const handleCategorySelect = (cat: CategoryItem) => {
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
                  <Icon className={`w-4 h-4 shrink-0 ${isSelected ? "text-white" : cat.id === "Favorites" ? "text-amber-400" : cat.id === "History" ? "text-cyan-400" : "text-[#0088FF]"}`} />
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

      {/* COLUMN 2: CHANNEL INVENTORY PANEL WITH FILTER PILLS & SEARCH (Middle) */}
      <div id="column-2-inventory" className="column-2 w-full lg:w-96 bg-[#05070A] border-r border-white/10 flex flex-col h-1/3 lg:h-full shrink-0">
        {/* Header with Title & Resolution */}
        <div className="p-3 border-b border-white/10 bg-[#0D121D] space-y-2.5">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-mono font-bold uppercase tracking-widest text-white/70 flex items-center gap-1.5">
              {selectedCategory === "Favorites" ? (
                <Star className="w-3.5 h-3.5 text-amber-400 fill-amber-400" />
              ) : selectedCategory === "History" ? (
                <History className="w-3.5 h-3.5 text-cyan-400" />
              ) : (
                <Tv className="w-3.5 h-3.5 text-[#0088FF]" />
              )}
              <span>{selectedCategory}</span>
              <span className="text-white/40 font-normal">({displayedEpisodes.length})</span>
            </span>

            <div className="flex items-center gap-1.5">
              {selectedCategory === "History" && watchHistory.length > 0 && (
                <button
                  onClick={handleClearHistory}
                  className="px-2 py-0.5 bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/30 rounded text-[10px] font-mono flex items-center gap-1 cursor-pointer transition-colors"
                  title="Clear Recent History"
                >
                  <Trash2 className="w-3 h-3" />
                  <span>Clear</span>
                </button>
              )}
              <span className="text-[10px] font-mono text-[#00FF9D] bg-[#00FF9D]/10 px-1.5 py-0.5 rounded border border-[#00FF9D]/20">
                1080p / 4K
              </span>
            </div>
          </div>

          {/* Quick Search Bar */}
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-white/30 absolute left-2.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Quick search channels, movies, genres..."
              value={channelSearch}
              onChange={(e) => setChannelSearch(e.target.value)}
              className="w-full bg-[#05070A] border border-white/10 text-xs rounded-xl pl-8 pr-7 py-1.5 text-white placeholder-white/30 outline-none focus:border-[#0088FF]"
            />
            {channelSearch && (
              <button
                onClick={() => setChannelSearch("")}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-white/30 hover:text-white cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Category Filter Pills Directly Above Channel List */}
          <div className="flex items-center gap-1 overflow-x-auto pb-0.5 scrollbar-none font-mono text-[10px]">
            <button
              onClick={() => setActiveTypePill("all")}
              className={`px-2.5 py-1 rounded-lg font-bold transition-all cursor-pointer whitespace-nowrap ${
                activeTypePill === "all"
                  ? "bg-[#0088FF] text-white shadow-sm shadow-[#0088FF]/30"
                  : "bg-[#05070A] text-white/50 hover:text-white border border-white/5 hover:border-white/20"
              }`}
            >
              All ({episodes.length})
            </button>
            <button
              onClick={() => setActiveTypePill("news")}
              className={`px-2.5 py-1 rounded-lg font-bold transition-all cursor-pointer whitespace-nowrap flex items-center gap-1 ${
                activeTypePill === "news"
                  ? "bg-red-600 text-white shadow-sm shadow-red-600/30"
                  : "bg-[#05070A] text-white/50 hover:text-white border border-white/5 hover:border-white/20"
              }`}
            >
              <Radio className="w-2.5 h-2.5 text-red-400" />
              <span>Live News</span>
            </button>
            <button
              onClick={() => setActiveTypePill("movies")}
              className={`px-2.5 py-1 rounded-lg font-bold transition-all cursor-pointer whitespace-nowrap flex items-center gap-1 ${
                activeTypePill === "movies"
                  ? "bg-purple-600 text-white shadow-sm shadow-purple-600/30"
                  : "bg-[#05070A] text-white/50 hover:text-white border border-white/5 hover:border-white/20"
              }`}
            >
              <Film className="w-2.5 h-2.5 text-purple-400" />
              <span>VOD Movies</span>
            </button>
            <button
              onClick={() => setActiveTypePill("series")}
              className={`px-2.5 py-1 rounded-lg font-bold transition-all cursor-pointer whitespace-nowrap flex items-center gap-1 ${
                activeTypePill === "series"
                  ? "bg-emerald-600 text-white shadow-sm shadow-emerald-600/30"
                  : "bg-[#05070A] text-white/50 hover:text-white border border-white/5 hover:border-white/20"
              }`}
            >
              <Layers className="w-2.5 h-2.5 text-emerald-400" />
              <span>TV Series</span>
            </button>
            <button
              onClick={() => setActiveTypePill("archive")}
              className={`px-2.5 py-1 rounded-lg font-bold transition-all cursor-pointer whitespace-nowrap flex items-center gap-1 ${
                activeTypePill === "archive"
                  ? "bg-amber-600 text-white shadow-sm shadow-amber-600/30"
                  : "bg-[#05070A] text-white/50 hover:text-white border border-white/5 hover:border-white/20"
              }`}
            >
              <Database className="w-2.5 h-2.5 text-amber-400" />
              <span>Archive Classics</span>
            </button>
            <button
              onClick={() => setActiveTypePill("favorites")}
              className={`px-2.5 py-1 rounded-lg font-bold transition-all cursor-pointer whitespace-nowrap flex items-center gap-1 ${
                activeTypePill === "favorites"
                  ? "bg-amber-500 text-black font-extrabold shadow-sm shadow-amber-500/30"
                  : "bg-[#05070A] text-amber-400/70 hover:text-amber-400 border border-white/5 hover:border-white/20"
              }`}
            >
              <Star className="w-2.5 h-2.5 fill-current" />
              <span>★ Favs ({favorites.size})</span>
            </button>
            <button
              onClick={() => setActiveTypePill("history")}
              className={`px-2.5 py-1 rounded-lg font-bold transition-all cursor-pointer whitespace-nowrap flex items-center gap-1 ${
                activeTypePill === "history"
                  ? "bg-cyan-600 text-white shadow-sm shadow-cyan-600/30"
                  : "bg-[#05070A] text-cyan-400/70 hover:text-cyan-400 border border-white/5 hover:border-white/20"
              }`}
            >
              <History className="w-2.5 h-2.5" />
              <span>History ({watchHistory.length})</span>
            </button>
          </div>
        </div>

        {/* Channel Cards Inventory List */}
        <div className="flex-1 overflow-y-auto p-2 space-y-1.5">
          {displayedEpisodes.length === 0 ? (
            <div className="p-8 text-center space-y-3 text-white/40 font-mono">
              {selectedCategory.includes("Restricted") ? (
                <>
                  <Lock className="w-8 h-8 text-amber-400 mx-auto" />
                  <p className="text-xs">Category Restricted.</p>
                  <button 
                    onClick={onOpenPinModal} 
                    className="px-3 py-1 bg-amber-500/20 text-amber-400 text-xs rounded border border-amber-500/40 cursor-pointer"
                  >
                    Unlock PIN Shield
                  </button>
                </>
              ) : activeTypePill === "favorites" || selectedCategory === "Favorites" ? (
                <>
                  <Star className="w-8 h-8 text-amber-400/50 mx-auto" />
                  <p className="text-xs text-white/60 font-semibold">No favorited channels yet.</p>
                  <p className="text-[11px] text-white/30">Click the ★ star icon on any channel card to bookmark it for instant access!</p>
                </>
              ) : activeTypePill === "history" || selectedCategory === "History" ? (
                <>
                  <History className="w-8 h-8 text-cyan-400/50 mx-auto" />
                  <p className="text-xs text-white/60 font-semibold">Watch history is empty.</p>
                  <p className="text-[11px] text-white/30">Channels and movies you play will automatically appear here.</p>
                </>
              ) : (
                <>
                  <Search className="w-8 h-8 text-white/20 mx-auto" />
                  <p className="text-xs">No channels match filter &ldquo;{channelSearch}&rdquo;</p>
                  <button
                    onClick={() => {
                      setChannelSearch("");
                      setActiveTypePill("all");
                      setSelectedCategory("All");
                    }}
                    className="px-3 py-1 bg-white/5 hover:bg-white/10 text-white/60 text-xs rounded border border-white/10 cursor-pointer"
                  >
                    Reset Filters
                  </button>
                </>
              )}
            </div>
          ) : (
            displayedEpisodes.map((ep, idx) => {
              const isSelected = activeEp?.id === ep.id;
              const isFav = favorites.has(ep.id);

              return (
                <div
                  key={ep.id}
                  id={`channel-item-${ep.id}`}
                  onClick={() => onSelectEpisode(ep)}
                  className={`channel-card p-3 rounded-xl border transition-all cursor-pointer flex items-center justify-between gap-3 ${
                    isSelected
                      ? "badge-active active-indicator bg-[#0D121D] border-[#0088FF] glow-blue"
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
                        {ep.contentType === "news" ? (
                          <Radio className="w-4 h-4 text-red-400" />
                        ) : ep.contentType === "movie" ? (
                          <Film className="w-4 h-4 text-purple-400" />
                        ) : ep.contentType === "series" ? (
                          <Layers className="w-4 h-4 text-emerald-400" />
                        ) : (
                          <Tv className="w-4 h-4 text-[#0088FF]" />
                        )}
                      </div>
                    )}

                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5 truncate">
                        <h4 className="text-xs font-bold text-white truncate group-hover:text-[#0088FF]">
                          {ep.title}
                        </h4>
                        {ep.isLazy && (
                          <span className="text-[9px] font-mono px-1 py-0.2 bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 rounded shrink-0">
                            MODULAR DB
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-white/50 truncate flex items-center gap-1.5 mt-0.5">
                        <span className="text-[#0088FF] font-semibold">{ep.groupTitle || "General"}</span>
                        <span>• {ep.description || "Continuous Live Broadcast"}</span>
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      onClick={(e) => toggleFavorite(ep.id, e)}
                      title={isFav ? "Remove Favorite" : "Add to Favorites (★)"}
                      className={`p-1.5 rounded-lg transition-all cursor-pointer ${
                        isFav 
                          ? "text-amber-400 bg-amber-400/10 hover:bg-amber-400/20" 
                          : "text-white/30 hover:text-amber-400 hover:bg-white/5"
                      }`}
                    >
                      <Star className={`w-3.5 h-3.5 ${isFav ? "fill-amber-400" : ""}`} />
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* COLUMN 3: LIVE PREVIEW & EPG WORKSPACE (Right) */}
      <div id="column-3-workspace" className="column-3 flex-1 bg-[#05070A] flex flex-col h-1/3 lg:h-full overflow-y-auto">
        <div className="p-4 space-y-4 max-w-5xl mx-auto w-full">
          {/* VIDEO PLAYER CONTAINER */}
          <div 
            ref={playerContainerRef} 
            className="relative bg-black rounded-2xl overflow-hidden border border-[#0088FF]/50 glow-blue shadow-2xl group crt-scanlines"
          >
            <div className="osd-label flex items-center gap-2">
              <span>PLAYER 1 // {activeEp?.groupTitle?.toUpperCase() || "TV NEWS PRIMARY"}</span>
              {activeEp && favorites.has(activeEp.id) && (
                <span className="text-amber-400 text-[10px]">★ FAVORITED</span>
              )}
            </div>

            {activeEp ? (
              <div className="w-full aspect-video relative">
                <HlsVideoPlayer
                  src={currentStreamUrl}
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

                {/* Lazy Unwrapping Spinner / Notice */}
                {isUnwrapping && (
                  <div className="absolute inset-0 bg-black/70 backdrop-blur-sm flex flex-col items-center justify-center gap-2 z-30 font-mono">
                    <RefreshCw className="w-6 h-6 text-[#0088FF] animate-spin" />
                    <span className="text-xs font-bold text-white">Unwrapping M3U into Modular JSON DB...</span>
                    <span className="text-[10px] text-white/50">archive.org &rarr; {activeChunkFilename || "title.json"}</span>
                  </div>
                )}
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
                  <div className="flex items-center gap-2">
                    <h3 className="font-bold text-white text-sm truncate max-w-xs">{activeEp?.title}</h3>
                    {activeEp && (
                      <button
                        onClick={(e) => toggleFavorite(activeEp.id, e)}
                        className={`cursor-pointer transition-colors ${
                          favorites.has(activeEp.id) ? "text-amber-400" : "text-white/40 hover:text-amber-400"
                        }`}
                        title="Bookmark Favorite"
                      >
                        <Star className={`w-3.5 h-3.5 ${favorites.has(activeEp.id) ? "fill-amber-400" : ""}`} />
                      </button>
                    )}
                  </div>
                  <p className="text-[11px] text-white/50 font-mono flex items-center gap-1.5">
                    <span>{activeEp?.groupTitle}</span>
                    <span>•</span>
                    <span className="text-white/40 truncate">{unwrappedTracks[activeTrackIndex]?.title || "HLS 1080p60"}</span>
                  </p>
                </div>
              </div>

              {/* STREAM QUALITY BADGES */}
              <div className="flex items-center gap-2 font-mono text-[10px]">
                {isServedFromDBCache && (
                  <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center gap-1">
                    <Database className="w-3 h-3" />
                    <span>DB CACHED</span>
                  </span>
                )}
                {activeChunkFilename && (
                  <span className="px-2 py-0.5 rounded bg-[#0088FF]/20 text-[#0088FF] border border-[#0088FF]/30 flex items-center gap-1">
                    <FileCode className="w-3 h-3" />
                    <span className="truncate max-w-[120px]">{activeChunkFilename}</span>
                  </span>
                )}
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

          {/* UNWRAPPED ARCHIVE PLAYLIST TRACKS / MULTI-EPISODES SELECTOR */}
          {unwrappedTracks.length > 1 && (
            <div className="glass-card p-4 space-y-3 border-l-4 border-l-[#0088FF]">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <ListVideo className="w-4 h-4 text-[#0088FF]" />
                  <h3 className="text-xs font-mono font-bold text-white uppercase tracking-wider">
                    Unwrapped Playlist Episodes ({unwrappedTracks.length} Tracks In DB)
                  </h3>
                </div>
                <div className="flex items-center gap-2 font-mono text-[10px]">
                  <span className="text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20 flex items-center gap-1">
                    <Database className="w-3 h-3" />
                    <span>On-Demand JSON Preloaded</span>
                  </span>
                  {activeChunkFilename && (
                    <span className="text-cyan-400 bg-cyan-500/10 px-2 py-0.5 rounded border border-cyan-500/20 flex items-center gap-1">
                      <FileCode className="w-3 h-3" />
                      <span>{activeChunkFilename}</span>
                    </span>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-56 overflow-y-auto pr-1">
                {unwrappedTracks.map((trk, tIdx) => {
                  const isTrackActive = activeTrackIndex === tIdx;
                  const isMp4 = trk.url.toLowerCase().includes(".mp4");
                  const isM3u8 = trk.url.toLowerCase().includes(".m3u8");

                  return (
                    <button
                      key={trk.id || tIdx}
                      id={`episode-btn-${trk.id || tIdx}`}
                      onClick={() => {
                        setActiveTrackIndex(tIdx);
                        if (onResetFailover) onResetFailover();
                      }}
                      className={`episode-button p-2.5 rounded-xl border text-left flex items-center justify-between gap-2 text-xs font-mono transition-all cursor-pointer ${
                        isTrackActive
                          ? "badge-active active-indicator bg-[#0088FF]/20 border-[#0088FF] text-white shadow-md shadow-[#0088FF]/20 font-bold"
                          : "bg-[#05070A] border-white/5 text-white/70 hover:border-white/20 hover:text-white"
                      }`}
                    >
                      <div className="flex items-center gap-2 truncate">
                        <span className={`w-5 h-5 rounded flex items-center justify-center text-[10px] shrink-0 font-bold ${
                          isTrackActive ? "bg-[#0088FF] text-white" : "bg-white/10 text-white/40"
                        }`}>
                          {tIdx + 1}
                        </span>
                        <span className="truncate">{trk.title}</span>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <span className={`text-[9px] px-1.5 py-0.5 rounded font-mono ${
                          isM3u8 ? "bg-purple-500/20 text-purple-300" : isMp4 ? "bg-blue-500/20 text-blue-300" : "bg-white/10 text-white/40"
                        }`}>
                          {isM3u8 ? "HLS" : isMp4 ? "MP4" : "STREAM"}
                        </span>
                        {isTrackActive && <Play className="w-3.5 h-3.5 text-[#00FF9D] shrink-0 fill-[#00FF9D]" />}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* TIMELINE PROGRESS & WATCHDOG FAILOVER TOOLBAR */}
          <div id="stream-toolbar" className="stream-toolbar glass-card p-4 space-y-3">
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
                {watchdogState.circuitEngaged ? (
                  <button
                    onClick={onResetFailover}
                    className="reset-toggle px-3 py-1.5 bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-400 border border-emerald-500/40 rounded-xl text-xs font-mono font-bold flex items-center gap-1.5 transition-all cursor-pointer"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Reset to Live Channel Feed</span>
                  </button>
                ) : (
                  <button
                    onClick={onTriggerFailover}
                    className="reset-toggle px-3 py-1.5 bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/30 rounded-xl text-xs font-mono font-bold flex items-center gap-1.5 transition-all cursor-pointer"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    <span>Test Watchdog Fallback</span>
                  </button>
                )}
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
