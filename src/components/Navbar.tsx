import React from "react";
import { 
  Tv, 
  Search, 
  Zap, 
  Settings, 
  Shield, 
  Eye, 
  Layers, 
  RotateCcw,
  Sparkles,
  Calendar,
  Lock,
  Unlock
} from "lucide-react";

interface NavbarProps {
  currentView: string;
  onNavigate: (view: string) => void;
  pinUnlocked: boolean;
  onOpenPinModal: () => void;
  onOpenImportModal: () => void;
  onOpenThirdEyeModal: () => void;
  searchTerm: string;
  onSearchChange: (q: string) => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  currentView,
  onNavigate,
  pinUnlocked,
  onOpenPinModal,
  onOpenImportModal,
  onOpenThirdEyeModal,
  searchTerm,
  onSearchChange,
}) => {
  return (
    <header className="bg-[#05070A]/90 border-b border-white/10 px-4 py-3 sticky top-0 z-40 backdrop-blur-xl flex flex-wrap items-center justify-between gap-4">
      {/* Brand & Mode Indicator */}
      <div className="flex items-center gap-3">
        <button 
          onClick={() => onNavigate("home")}
          className="flex items-center gap-2.5 group text-left cursor-pointer"
        >
          <div className="w-10 h-10 rounded-xl bg-[#0088FF] flex items-center justify-center text-white shadow-lg shadow-[#0088FF]/30 group-hover:scale-105 transition-transform">
            <Tv className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-black text-lg tracking-tight text-white uppercase">
                M3U <span className="text-[#0088FF]">MATRIX</span>
              </span>
              <span className="px-1.5 py-0.5 text-[9px] font-bold bg-[#00FF9D]/15 text-[#00FF9D] border border-[#00FF9D]/30 rounded uppercase tracking-wider mono">
                <span className="status-dot bg-[#00FF9D] mr-1"></span>ONLINE
              </span>
            </div>
            <p className="text-[11px] mono text-white/50">SMARTERS PRO STRIPPER ENGINE</p>
          </div>
        </button>

        {/* View Switcher Tabs */}
        <div className="hidden lg:flex items-center gap-1 ml-6 bg-[#0D121D] p-1 rounded-xl border border-white/10">
          <button
            onClick={() => onNavigate("home")}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
              currentView === "home"
                ? "bg-[#0088FF] text-white shadow-lg shadow-[#0088FF]/40"
                : "text-white/60 hover:text-white hover:bg-white/5"
            }`}
          >
            <Layers className="w-3.5 h-3.5" /> Dashboard
          </button>
          <button
            onClick={() => onNavigate("live")}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
              currentView === "live"
                ? "bg-[#0088FF] text-white shadow-lg shadow-[#0088FF]/40"
                : "text-white/60 hover:text-white hover:bg-white/5"
            }`}
          >
            <Tv className="w-3.5 h-3.5" /> Live TV
          </button>
          <button
            onClick={() => onNavigate("vod")}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
              currentView === "vod"
                ? "bg-[#0088FF] text-white shadow-lg shadow-[#0088FF]/40"
                : "text-white/60 hover:text-white hover:bg-white/5"
            }`}
          >
            <Sparkles className="w-3.5 h-3.5" /> VOD & Series
          </button>
          <button
            onClick={() => onNavigate("epg")}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
              currentView === "epg"
                ? "bg-[#0088FF] text-white shadow-lg shadow-[#0088FF]/40"
                : "text-white/60 hover:text-white hover:bg-white/5"
            }`}
          >
            <Calendar className="w-3.5 h-3.5" /> EPG Matrix
          </button>
          <button
            onClick={() => onNavigate("multiscreen")}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
              currentView === "multiscreen"
                ? "bg-[#0088FF] text-white shadow-lg shadow-[#0088FF]/40"
                : "text-white/60 hover:text-white hover:bg-white/5"
            }`}
          >
            <Zap className="w-3.5 h-3.5" /> Multi-Screen
          </button>
          <button
            onClick={() => onNavigate("player")}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
              currentView === "player"
                ? "bg-[#0088FF] text-white shadow-lg shadow-[#0088FF]/40"
                : "text-white/60 hover:text-white hover:bg-white/5"
            }`}
          >
            <RotateCcw className="w-3.5 h-3.5" /> Universal Player
          </button>
        </div>
      </div>

      {/* Center Search Bar */}
      <div className="flex-1 max-w-xs md:max-w-md relative hidden md:block">
        <Search className="w-4 h-4 text-white/40 absolute left-3 top-1/2 -translate-y-1/2" />
        <input
          type="text"
          placeholder="Search channels, movies, EPG guides..."
          value={searchTerm}
          onChange={(e) => onSearchChange(e.target.value)}
          className="w-full bg-[#0D121D] border border-white/10 focus:border-[#0088FF] text-xs rounded-xl pl-9 pr-4 py-2 text-white placeholder-white/30 outline-none transition-all focus:ring-2 focus:ring-[#0088FF]/30"
        />
      </div>

      {/* Right User Actions & Status Badges */}
      <div className="flex items-center gap-2">
        {/* User Badge */}
        <div className="hidden sm:flex items-center gap-2 bg-[#0D121D] border border-white/10 px-3 py-1.5 rounded-xl text-xs font-mono">
          <span className="status-dot bg-[#00FF9D] animate-pulse"></span>
          <span className="font-semibold text-white">Admin: James_W</span>
        </div>

        {/* Speed Test Simulator Badge */}
        <div className="hidden sm:flex items-center gap-1.5 bg-[#0D121D] border border-white/10 px-2.5 py-1.5 rounded-xl text-[11px] text-[#00FF9D] font-mono">
          <Zap className="w-3 h-3 text-amber-400 fill-amber-400" />
          <span>142 Mbps</span>
        </div>

        {/* Parental PIN Shield Toggle */}
        <button
          onClick={onOpenPinModal}
          className={`p-2 rounded-xl border text-xs flex items-center gap-1.5 transition-all cursor-pointer ${
            pinUnlocked
              ? "bg-[#00FF9D]/10 border-[#00FF9D]/30 text-[#00FF9D] hover:bg-[#00FF9D]/20"
              : "bg-amber-500/10 border-amber-500/30 text-amber-400 hover:bg-amber-500/20"
          }`}
          title="Parental Control Shield"
        >
          {pinUnlocked ? <Unlock className="w-4 h-4" /> : <Lock className="w-4 h-4" />}
          <span className="hidden sm:inline font-semibold">{pinUnlocked ? "Unlocked" : "PIN Locked"}</span>
        </button>

        {/* ThirdEye Signal Inspector Button */}
        <button
          onClick={onOpenThirdEyeModal}
          className="p-2 bg-[#0D121D] hover:bg-white/5 text-cyan-400 border border-white/10 rounded-xl text-xs flex items-center gap-1.5 transition-all cursor-pointer"
          title="ThirdEye Signal Processor"
        >
          <Eye className="w-4 h-4" />
          <span className="hidden md:inline font-semibold">ThirdEye</span>
        </button>

        {/* Settings / Import/Export Suite Button */}
        <button
          onClick={onOpenImportModal}
          className="p-2 bg-[#0088FF] hover:bg-[#006CD0] text-white rounded-xl text-xs flex items-center gap-1.5 shadow-lg shadow-[#0088FF]/30 transition-all cursor-pointer"
          title="Import / Export & Program Director Suite"
        >
          <Settings className="w-4 h-4" />
          <span className="hidden md:inline font-semibold">Import / Suite</span>
        </button>
      </div>
    </header>
  );
};
