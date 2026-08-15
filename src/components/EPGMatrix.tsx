import React, { useState, useEffect, useMemo, useRef } from "react";
import { 
  Calendar, 
  Clock, 
  Tv, 
  Play, 
  RotateCcw, 
  Search, 
  Zap, 
  CheckCircle2, 
  Film, 
  X, 
  Upload,
  Layers,
  Info,
  PlusCircle,
  FileText
} from "lucide-react";
import { Episode } from "../types";
import { calculateLiveSchedule, LiveChannelSchedule, formatTimeSlot } from "../utils/epgScheduler";
import { useSmartResume } from "../hooks/useSmartResume";
import { HlsVideoPlayer } from "./HlsVideoPlayer";
import { parseM3UContent } from "../utils/m3uParser";

interface EPGMatrixProps {
  episodes: Episode[];
  onSelectChannel?: (ep: Episode) => void;
  onImportEpisodes?: (newEps: Episode[]) => void;
  className?: string;
}

interface ChannelGroup {
  channelId: string;
  channelName: string;
  channelLogo?: string;
  category: string;
  episodes: Episode[];
}

export const EPGMatrix: React.FC<EPGMatrixProps> = ({
  episodes,
  onSelectChannel,
  onImportEpisodes,
  className = "",
}) => {
  const [currentWallClockMs, setCurrentWallClockMs] = useState<number>(() => Date.now());
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [selectedCategory, setSelectedCategory] = useState<string>("All");
  const [isUploading, setIsUploading] = useState<boolean>(false);
  const [uploadFeedback, setUploadFeedback] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Selected channel for active playback (Lazy-loaded player instance)
  const [activePlayback, setActivePlayback] = useState<{
    channel: ChannelGroup;
    episode: Episode;
    seekTimestampSec: number;
    isResumed: boolean;
    resumeReasonText: string;
  } | null>(null);

  const { resolvePlaybackTarget, updateCurrentPlayback, clearSavedState, getSavedExitState } = useSmartResume();

  // Wall-clock ticker: updates every 10 seconds without heavy re-renders
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentWallClockMs(Date.now());
    }, 10000);
    return () => clearInterval(timer);
  }, []);

  // Handle local .m3u file upload (supporting single or batch 1-file-per-show manifests)
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setIsUploading(true);
    setUploadFeedback("Reading and parsing .m3u show file(s)...");

    const allNewEpisodes: Episode[] = [];

    let filesRead = 0;
    Array.from(files).forEach((file: File) => {
      const reader = new FileReader();
      reader.onload = (event) => {
        const text = event.target?.result as string;
        if (text) {
          const parsed = parseM3UContent(text, {
            sourceFilename: file.name,
            channelName: file.name.replace(/\.m3u8?$/i, "").replace(/[_-]+/g, " "),
          });
          if (parsed.episodes && parsed.episodes.length > 0) {
            allNewEpisodes.push(...parsed.episodes);
          }
        }
        filesRead++;
        if (filesRead === files.length) {
          setIsUploading(false);
          if (allNewEpisodes.length > 0) {
            if (onImportEpisodes) {
              onImportEpisodes(allNewEpisodes);
            }
            setUploadFeedback(`Successfully imported ${allNewEpisodes.length} tracks across ${files.length} show manifest(s).`);
            setTimeout(() => setUploadFeedback(null), 4000);
          } else {
            setUploadFeedback("No valid tracks were found in the uploaded file(s).");
            setTimeout(() => setUploadFeedback(null), 4000);
          }
        }
      };
      reader.readAsText(file);
    });
  };

  // Group flat episodes into Show/Channel Groups (1-file-per-show architecture)
  const channelGroups = useMemo<ChannelGroup[]>(() => {
    const map = new Map<string, ChannelGroup>();

    episodes.forEach((ep) => {
      // Group by show title or groupTitle
      const groupKey = ep.groupTitle || ep.title.split(/[-–—:]/)[0].trim() || "Broadcast";
      const channelId = ep.tvgId || `show-${groupKey.toLowerCase().replace(/[^a-z0-9]/g, "-")}`;

      if (!map.has(channelId)) {
        map.set(channelId, {
          channelId,
          channelName: groupKey,
          channelLogo: ep.tvgLogo || ep.thumbnailUrl || undefined,
          category: ep.contentType === "news" ? "News" : ep.contentType === "movie" ? "Movies" : ep.contentType === "series" ? "Series" : "Classics",
          episodes: [],
        });
      }

      map.get(channelId)!.episodes.push(ep);
    });

    return Array.from(map.values());
  }, [episodes]);

  // Compute schedules for each channel group using deterministic pure math
  const channelSchedules = useMemo<Map<string, LiveChannelSchedule>>(() => {
    const scheduleMap = new Map<string, LiveChannelSchedule>();

    channelGroups.forEach((group) => {
      const sched = calculateLiveSchedule(group.episodes, currentWallClockMs, group.channelId);
      scheduleMap.set(group.channelId, sched);
    });

    return scheduleMap;
  }, [channelGroups, currentWallClockMs]);

  // Categories list
  const categories = useMemo(() => {
    const set = new Set<string>(["All"]);
    channelGroups.forEach((g) => {
      if (g.category) set.add(g.category);
    });
    return Array.from(set);
  }, [channelGroups]);

  // Filter channels by category and search
  const filteredGroups = useMemo(() => {
    return channelGroups.filter((g) => {
      if (selectedCategory !== "All" && g.category.toLowerCase() !== selectedCategory.toLowerCase()) {
        return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const sched = channelSchedules.get(g.channelId);
        const curTitle = sched?.currentPlayingEpisode?.title.toLowerCase() || "";
        const nameMatch = g.channelName.toLowerCase().includes(q);
        const titleMatch = curTitle.includes(q);
        return nameMatch || titleMatch;
      }
      return true;
    });
  }, [channelGroups, channelSchedules, selectedCategory, searchQuery]);

  // Handle row click -> Lazy mount player and resolve Smart Resume (< 20m) vs EPG live schedule
  const handleTuneChannel = (group: ChannelGroup) => {
    const sched = channelSchedules.get(group.channelId);
    if (!sched || !sched.currentPlayingEpisode) return;

    const scheduledEp = sched.currentPlayingEpisode;
    const scheduledSeek = sched.seekTimestampSec;

    // Resolve Smart Resume Decision
    const decision = resolvePlaybackTarget(group.channelId, scheduledEp, scheduledSeek);

    let targetEpisode = scheduledEp;
    if (decision.isResumed && decision.effectiveEpisodeId) {
      const match = group.episodes.find((e) => e.id === decision.effectiveEpisodeId);
      if (match) targetEpisode = match;
    }

    const resumeReasonText = decision.isResumed
      ? `Resumed from ${Math.floor(decision.effectiveSeekSec / 60)}m ${decision.effectiveSeekSec % 60}s (Left ${Math.floor(decision.timeSinceExitSec / 60)}m ago)`
      : `Live Broadcast Synced at ${formatTimeSlot(currentWallClockMs)}`;

    setActivePlayback({
      channel: group,
      episode: targetEpisode,
      seekTimestampSec: decision.effectiveSeekSec,
      isResumed: decision.isResumed,
      resumeReasonText,
    });

    if (onSelectChannel) {
      onSelectChannel(targetEpisode);
    }
  };

  // Generate 6 header time slots starting around current time
  const headerTimeSlots = useMemo(() => {
    const slots: string[] = [];
    const baseDate = new Date(currentWallClockMs);
    baseDate.setMinutes(baseDate.getMinutes() < 30 ? 0 : 30, 0, 0);
    const baseMs = baseDate.getTime();

    for (let i = 0; i < 5; i++) {
      slots.push(formatTimeSlot(baseMs + i * 30 * 60 * 1000));
    }
    return slots;
  }, [currentWallClockMs]);

  return (
    <div className={`space-y-6 ${className}`}>
      {/* 1. Header Toolbar */}
      <div className="glass rounded-2xl p-5 border border-white/10 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#0088FF]/20 text-[#0088FF] border border-[#0088FF]/30 flex items-center justify-center shrink-0">
            <Calendar className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-black text-white uppercase tracking-tight">24-Hour EPG Playout Matrix</h2>
              <span className="px-2 py-0.5 text-[10px] font-mono font-bold bg-[#00FF9D]/15 text-[#00FF9D] border border-[#00FF9D]/30 rounded uppercase tracking-wider">
                1-File-Per-Show
              </span>
            </div>
            <p className="text-xs text-white/50">
              Live modulo playout sync, strict permalink routing, and zero-alteration Archive.org media preservation.
            </p>
          </div>
        </div>

        {/* Current Time Clock, Search & Upload Trigger */}
        <div className="flex flex-wrap items-center gap-2.5 w-full md:w-auto">
          <div className="flex items-center gap-2 bg-[#05070A] border border-white/10 px-3 py-1.5 rounded-xl font-mono text-xs text-white/80">
            <Clock className="w-3.5 h-3.5 text-[#0088FF] animate-spin-slow" />
            <span>{formatTimeSlot(currentWallClockMs)}</span>
          </div>

          <div className="relative flex-1 sm:w-48">
            <Search className="w-3.5 h-3.5 text-white/40 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search matrix..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-[#05070A] border border-white/10 focus:border-[#0088FF] text-xs rounded-xl pl-8 pr-3 py-1.5 text-white placeholder-white/30 outline-none"
            />
          </div>

          <input
            ref={fileInputRef}
            type="file"
            accept=".m3u,.m3u8"
            multiple
            onChange={handleFileUpload}
            className="hidden"
          />

          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={isUploading}
            className="px-3 py-1.5 bg-[#0088FF] hover:bg-[#0070D0] text-white text-xs font-bold rounded-xl shadow-md flex items-center gap-1.5 transition-all cursor-pointer disabled:opacity-50 shrink-0"
            title="Upload .m3u show file(s) to populate the matrix"
          >
            <Upload className="w-3.5 h-3.5" />
            <span>{isUploading ? "Parsing..." : "Upload .M3U"}</span>
          </button>
        </div>
      </div>

      {uploadFeedback && (
        <div className="p-3 rounded-xl bg-[#0088FF]/15 border border-[#0088FF]/30 text-xs font-mono text-white flex items-center gap-2 animate-in fade-in">
          <CheckCircle2 className="w-4 h-4 text-[#00FF9D] shrink-0" />
          <span>{uploadFeedback}</span>
        </div>
      )}

      {/* 2. Category Filter Pills */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none font-mono text-xs">
        {categories.map((cat) => {
          const isActive = selectedCategory === cat;
          return (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`px-3.5 py-1.5 rounded-xl font-bold transition-all cursor-pointer whitespace-nowrap ${
                isActive
                  ? "bg-[#0088FF] text-white shadow-lg shadow-[#0088FF]/30"
                  : "bg-[#0D121D] text-white/50 hover:text-white border border-white/5"
              }`}
            >
              {cat}
            </button>
          );
        })}
      </div>

      {/* 3. ACTIVE LAZY-LOADED PLAYER (Only mounted when user clicks an active channel) */}
      {activePlayback && (
        <div className="glass border border-[#0088FF]/40 rounded-3xl p-5 space-y-4 shadow-2xl relative animate-in fade-in slide-in-from-top-4 duration-300">
          <div className="flex items-center justify-between gap-4 border-b border-white/10 pb-3">
            <div className="flex items-center gap-3">
              <span className="w-3 h-3 rounded-full bg-red-500 animate-pulse shrink-0" />
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-base font-bold text-white uppercase tracking-tight">
                    {activePlayback.channel.channelName}
                  </h3>
                  <span
                    className={`px-2 py-0.5 text-[10px] font-mono font-bold rounded ${
                      activePlayback.isResumed
                        ? "bg-amber-500/20 text-amber-300 border border-amber-500/40"
                        : "bg-[#0088FF]/20 text-[#0088FF] border border-[#0088FF]/40"
                    }`}
                  >
                    {activePlayback.isResumed ? "⚡ SMART RESUME ACTIVE" : "🔴 LIVE EPG BROADCAST"}
                  </span>
                </div>
                <p className="text-xs text-white/60 font-mono">
                  {activePlayback.episode.title} • {activePlayback.resumeReasonText}
                </p>
              </div>
            </div>

            <button
              onClick={() => setActivePlayback(null)}
              className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-white/60 hover:text-white border border-white/10 transition-colors cursor-pointer"
              title="Close Player"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Video Player Frame with deterministic seekTimestampSec */}
          <div className="aspect-video w-full max-h-[440px] rounded-2xl overflow-hidden bg-black border border-white/10 relative shadow-inner">
            <HlsVideoPlayer
              src={activePlayback.episode.url}
              seekTime={activePlayback.seekTimestampSec}
              autoPlay={true}
              controls={true}
              onTimeUpdate={(currentSec) => {
                // Update Smart Resume position in local storage
                updateCurrentPlayback(
                  activePlayback.channel.channelId,
                  activePlayback.episode.id,
                  currentSec,
                  activePlayback.episode.title
                );
              }}
            />
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 text-xs font-mono text-white/50 pt-1">
            <div className="flex items-center gap-2">
              <Info className="w-3.5 h-3.5 text-[#0088FF]" />
              <span>Seeking initial offset: {Math.floor(activePlayback.seekTimestampSec / 60)}m {Math.floor(activePlayback.seekTimestampSec % 60)}s</span>
            </div>
            <button
              onClick={() => {
                clearSavedState(activePlayback.channel.channelId);
                handleTuneChannel(activePlayback.channel);
              }}
              className="px-3 py-1 rounded-lg bg-white/5 hover:bg-white/10 text-white/70 hover:text-white border border-white/10 text-[11px] flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <RotateCcw className="w-3 h-3" /> Snap to Live EPG
            </button>
          </div>
        </div>
      )}

      {/* 4. THE 24-HOUR EPG MATRIX GRID */}
      <div className="bg-[#05070A] rounded-2xl border border-white/10 overflow-hidden font-mono shadow-2xl">
        {/* Timeline Header Row */}
        <div className="grid grid-cols-12 border-b border-white/10 p-3.5 text-xs font-bold text-white/60 bg-[#0D121D] sticky top-0 z-20">
          <div className="col-span-12 sm:col-span-3 flex items-center gap-2">
            <Tv className="w-3.5 h-3.5 text-[#0088FF]" />
            <span>SHOW CHANNEL (1 FILE PER SHOW)</span>
          </div>
          <div className="col-span-12 sm:col-span-9 hidden sm:grid grid-cols-5 text-center text-white/40">
            {headerTimeSlots.map((slot, idx) => (
              <div key={idx} className="truncate px-1">
                {slot}
              </div>
            ))}
          </div>
        </div>

        {/* Channels Rows */}
        <div className="divide-y divide-white/5 max-h-[600px] overflow-y-auto">
          {filteredGroups.length === 0 ? (
            <div className="p-12 text-center text-white/40 text-xs space-y-3">
              <Film className="w-8 h-8 text-white/20 mx-auto" />
              <p>No active shows parsed yet. Upload your .m3u show file(s) to populate the 24-hour linear matrix.</p>
              <button
                onClick={() => fileInputRef.current?.click()}
                className="px-4 py-2 bg-[#0088FF] hover:bg-[#0070D0] text-white text-xs font-bold rounded-xl inline-flex items-center gap-2 cursor-pointer shadow-lg"
              >
                <Upload className="w-4 h-4" />
                <span>Upload .M3U File(s)</span>
              </button>
            </div>
          ) : (
            filteredGroups.map((group) => {
              const sched = channelSchedules.get(group.channelId);
              const currentEp = sched?.currentPlayingEpisode;
              const savedResume = getSavedExitState(group.channelId);
              const isPlayingHere = activePlayback?.channel.channelId === group.channelId;

              return (
                <div
                  key={group.channelId}
                  className={`grid grid-cols-12 p-3.5 items-center gap-3 text-xs transition-colors hover:bg-white/[0.02] ${
                    isPlayingHere ? "bg-[#0088FF]/10 border-l-4 border-l-[#0088FF]" : ""
                  }`}
                >
                  {/* Channel Meta & Quick Tune Button */}
                  <div className="col-span-12 sm:col-span-3 flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-[#0D121D] border border-white/10 overflow-hidden shrink-0 flex items-center justify-center">
                      {group.channelLogo ? (
                        <img
                          src={group.channelLogo}
                          alt={group.channelName}
                          className="w-full h-full object-cover"
                          referrerPolicy="no-referrer"
                        />
                      ) : (
                        <Tv className="w-4 h-4 text-[#0088FF]" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <span className="font-bold text-white truncate">{group.channelName}</span>
                        {savedResume && (
                          <span
                            className="px-1 py-0.2 text-[9px] bg-amber-500/20 text-amber-300 border border-amber-500/30 rounded font-mono"
                            title={`Saved exit at ${Math.floor(savedResume.timestamp / 60)}m`}
                          >
                            Resume
                          </span>
                        )}
                      </div>
                      <span className="text-[10px] text-white/40 block truncate">
                        {group.episodes.length} Episodes • {group.category}
                      </span>
                    </div>
                  </div>

                  {/* Program Timeline Slot - Interactive Click to Tune */}
                  <div className="col-span-12 sm:col-span-9">
                    <div
                      onClick={() => handleTuneChannel(group)}
                      className="group bg-[#0D121D] hover:bg-[#121927] border border-white/10 hover:border-[#0088FF]/50 rounded-xl p-3 cursor-pointer transition-all relative overflow-hidden flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-md"
                    >
                      {/* Live Progress Background Fill */}
                      {sched && (
                        <div
                          className="absolute top-0 bottom-0 left-0 bg-[#0088FF]/15 pointer-events-none transition-all"
                          style={{ width: `${sched.progressPercent}%` }}
                        />
                      )}

                      <div className="relative z-10 space-y-1 min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-white truncate group-hover:text-[#0088FF] transition-colors">
                            {currentEp ? currentEp.title : "Live Playout Feed"}
                          </span>
                          {currentEp && currentEp.season > 0 && (
                            <span className="px-1.5 py-0.5 text-[9px] bg-white/10 rounded text-white/70 shrink-0">
                              S{currentEp.season} E{currentEp.episode}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-3 text-[10px] text-white/50">
                          <span className="flex items-center gap-1">
                            <Clock className="w-3 h-3 text-[#0088FF]" />
                            {sched ? `${Math.floor(sched.elapsedInPlaylistSec / 60)}m elapsed (${Math.round(sched.progressPercent)}%)` : "Live"}
                          </span>
                          <span>•</span>
                          <span>{sched ? `${Math.floor(sched.remainingInEpisodeSec / 60)}m remaining` : ""}</span>
                        </div>
                      </div>

                      {/* Action Pill */}
                      <div className="relative z-10 shrink-0 flex items-center gap-2">
                        <button className="px-3 py-1.5 rounded-lg bg-[#0088FF] group-hover:bg-[#0070D2] text-white font-bold text-[11px] flex items-center gap-1 shadow transition-colors">
                          <Play className="w-3 h-3 fill-current" />
                          <span>{isPlayingHere ? "Tuned" : "Tune Now"}</span>
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};
