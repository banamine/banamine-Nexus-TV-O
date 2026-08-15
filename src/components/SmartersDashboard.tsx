import React, { useState } from "react";
import { 
  Tv, 
  Film, 
  Clapperboard, 
  RotateCcw, 
  Grid2x2, 
  Calendar, 
  ShieldCheck, 
  Settings, 
  Eye, 
  Zap, 
  CheckCircle2, 
  AlertTriangle,
  Radio,
  Clock,
  Sparkles
} from "lucide-react";
import { SystemStats } from "../types";

interface SmartersDashboardProps {
  stats: SystemStats;
  onNavigate: (view: string) => void;
  onOpenEPGModal: () => void;
  onOpenPinModal: () => void;
  onOpenImportModal: () => void;
  onOpenThirdEyeModal: () => void;
}

export const SmartersDashboard: React.FC<SmartersDashboardProps> = ({
  stats,
  onNavigate,
  onOpenEPGModal,
  onOpenPinModal,
  onOpenImportModal,
  onOpenThirdEyeModal,
}) => {
  const [activeTileIndex, setActiveTileIndex] = useState<number>(0);

  const actionTiles = [
    {
      id: "live",
      title: "LIVE TV",
      subtitle: `${stats.totalChannels.toLocaleString()} Channels Available`,
      icon: Tv,
      color: "from-blue-600 to-indigo-700",
      accent: "text-blue-400",
      action: () => onNavigate("live"),
    },
    {
      id: "movies",
      title: "MOVIES (VOD)",
      subtitle: `${stats.moviesCount.toLocaleString()} Titles in 4K / HD`,
      icon: Film,
      color: "from-purple-600 to-pink-700",
      accent: "text-purple-400",
      action: () => onNavigate("vod"),
    },
    {
      id: "series",
      title: "SERIES",
      subtitle: `${stats.seriesCount.toLocaleString()} Full Seasons`,
      icon: Clapperboard,
      color: "from-emerald-600 to-teal-700",
      accent: "text-emerald-400",
      action: () => onNavigate("vod"),
    },
    {
      id: "catchup",
      title: "CATCH-UP",
      subtitle: "7-Day EPG Lookback & Progress Bar",
      icon: RotateCcw,
      color: "from-amber-600 to-orange-700",
      accent: "text-amber-400",
      action: onOpenEPGModal,
    },
    {
      id: "multiscreen",
      title: "MULTI-SCREEN",
      subtitle: "2x / 4x Synchronized Stream Matrix",
      icon: Grid2x2,
      color: "from-cyan-600 to-blue-700",
      accent: "text-cyan-400",
      action: () => onNavigate("multiscreen"),
    },
    {
      id: "epg",
      title: "EPG GUIDE",
      subtitle: "Linear Broadcast Matrix Grid",
      icon: Calendar,
      color: "from-sky-600 to-blue-800",
      accent: "text-sky-400",
      action: onOpenEPGModal,
    },
    {
      id: "pin",
      title: "PARENTS SHIELD",
      subtitle: "Restricted Category Lock & Master PIN",
      icon: ShieldCheck,
      color: "from-rose-600 to-red-800",
      accent: "text-rose-400",
      action: onOpenPinModal,
    },
    {
      id: "settings",
      title: "SETTINGS & TOOLS",
      subtitle: "M3U Ingestion, Xtream & Program Director",
      icon: Settings,
      color: "from-slate-700 to-slate-900",
      accent: "text-[#0088FF]",
      action: onOpenImportModal,
    },
  ];

  return (
    <div className="p-4 sm:p-8 max-w-7xl mx-auto space-y-6">
      {/* Header Banner - Bento Hero */}
      <div className="glass rounded-2xl p-6 sm:p-8 border border-white/10 relative overflow-hidden shadow-2xl matrix-bg">
        <div className="absolute -top-12 -right-12 w-80 h-80 bg-[#0088FF]/10 rounded-full blur-3xl pointer-events-none" />
        
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6 relative z-10">
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-xs font-mono font-bold uppercase tracking-widest text-[#0088FF]">
              <span className="status-dot bg-[#00FF9D] animate-pulse"></span>
              <span>Bento Matrix Ecosystem</span>
              <span className="text-white/20">//</span>
              <span className="text-white/50">13,071 Live Signals</span>
            </div>
            <h1 className="text-2xl sm:text-4xl font-black text-white tracking-tight uppercase">
              M3U <span className="text-[#0088FF]">Matrix</span> Stripper Workbench
            </h1>
            <p className="text-xs sm:text-sm text-white/60 max-w-2xl leading-relaxed">
              Universal HLS linear playout, 3-column live surfer, multi-screen matrix grid, program director interleaving, and ThirdEye garble signal processing active.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={onOpenThirdEyeModal}
              className="px-4 py-2.5 bg-[#0D121D] hover:bg-white/5 text-cyan-400 border border-cyan-500/30 rounded-xl text-xs font-mono font-bold flex items-center gap-2 shadow-lg transition-all cursor-pointer"
            >
              <Eye className="w-4 h-4 text-cyan-400" />
              <span>ThirdEye Inspector</span>
            </button>
            <button
              onClick={onOpenImportModal}
              className="px-4 py-2.5 bg-[#0088FF] hover:bg-[#006CD0] text-white rounded-xl text-xs font-mono font-bold flex items-center gap-2 shadow-lg shadow-[#0088FF]/30 transition-all cursor-pointer"
            >
              <Settings className="w-4 h-4" />
              <span>Program Director</span>
            </button>
          </div>
        </div>
      </div>

      {/* 2x4 Action Grid Dashboard - Bento Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {actionTiles.map((tile, idx) => {
          const Icon = tile.icon;
          const isFocused = activeTileIndex === idx;

          return (
            <button
              key={tile.id}
              onClick={tile.action}
              onMouseEnter={() => setActiveTileIndex(idx)}
              className={`group text-left glass-card p-5 relative overflow-hidden rounded-2xl border transition-all cursor-pointer ${
                isFocused
                  ? "border-[#0088FF] glow-blue scale-[1.02] bg-[#0D121D]"
                  : "border-white/10 hover:border-[#0088FF]/50"
              }`}
            >
              <div className="flex items-center justify-between mb-4">
                <div className={`w-11 h-11 rounded-xl bg-gradient-to-br ${tile.color} flex items-center justify-center text-white shadow-md group-hover:scale-110 transition-transform`}>
                  <Icon className="w-5 h-5" />
                </div>
                <span className="text-[10px] font-mono text-white/30 group-hover:text-[#0088FF] transition-colors uppercase">
                  Bento_{tile.id}
                </span>
              </div>

              <div className="space-y-1">
                <h3 className="text-base font-black text-white tracking-wide group-hover:text-[#0088FF] transition-colors flex items-center justify-between">
                  <span>{tile.title}</span>
                  <span className={`text-xs font-mono ${tile.accent}`}>→</span>
                </h3>
                <p className="text-xs text-white/50 font-normal leading-normal">
                  {tile.subtitle}
                </p>
              </div>

              <div className="mt-4 pt-3 border-t border-white/5 flex items-center justify-between text-[10px] font-mono text-white/40">
                <span>STATUS: READY</span>
                <span className="text-[#00FF9D] opacity-0 group-hover:opacity-100 transition-opacity">LAUNCH ▶</span>
              </div>
            </button>
          );
        })}
      </div>

      {/* System Status & Telemetry Bar - Bento Diagnostics */}
      <div className="glass rounded-2xl p-4 sm:p-5 border border-white/10 grid grid-cols-1 md:grid-cols-4 gap-4 text-xs font-mono">
        <div className="p-3 bg-[#05070A]/80 rounded-xl border border-white/5 flex items-center gap-3">
          <CheckCircle2 className="w-5 h-5 text-[#00FF9D] shrink-0" />
          <div>
            <div className="text-[10px] uppercase text-white/40">Server Node</div>
            <div className="text-white font-bold">Online (Cloud Run)</div>
          </div>
        </div>

        <div className="p-3 bg-[#05070A]/80 rounded-xl border border-white/5 flex items-center gap-3">
          <Radio className="w-5 h-5 text-[#0088FF] animate-pulse shrink-0" />
          <div>
            <div className="text-[10px] uppercase text-white/40">Watchdog Circuit</div>
            <div className="text-[#00FF9D] font-bold">Active &amp; Shielded</div>
          </div>
        </div>

        <div className="p-3 bg-[#05070A]/80 rounded-xl border border-white/5 flex items-center gap-3">
          <Zap className="w-5 h-5 text-amber-400 shrink-0" />
          <div>
            <div className="text-[10px] uppercase text-white/40">News Interstitials</div>
            <div className="text-white font-bold">{Math.round(stats.newsRatio * 100)}% Balanced Mix</div>
          </div>
        </div>

        <div className="p-3 bg-[#05070A]/80 rounded-xl border border-white/5 flex items-center justify-between">
          <div>
            <div className="text-[10px] uppercase text-white/40">ThirdEye Garble Score</div>
            <div className="text-cyan-400 font-bold">88 / 100</div>
          </div>
          <span className="px-2 py-1 rounded bg-[#0088FF]/20 text-[#0088FF] border border-[#0088FF]/40 text-[9px] font-bold uppercase">
            24H SYNC
          </span>
        </div>
      </div>
    </div>
  );
};
