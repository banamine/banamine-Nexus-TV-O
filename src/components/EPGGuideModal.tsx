import React, { useState } from "react";
import { 
  Calendar, 
  Clock, 
  X, 
  Tv, 
  Sparkles, 
  CheckCircle2, 
  Search, 
  Radio, 
  Film, 
  Layers, 
  Star, 
  Play
} from "lucide-react";
import { EPGProgram } from "../types";

interface EPGGuideModalProps {
  isOpen: boolean;
  onClose: () => void;
  epgGrid: EPGProgram[];
  onSelectProgramChannel?: (channelName: string) => void;
}

export const EPGGuideModal: React.FC<EPGGuideModalProps> = ({
  isOpen,
  onClose,
  epgGrid,
  onSelectProgramChannel,
}) => {
  const [guideSearch, setGuideSearch] = useState<string>("");
  const [activeCategoryPill, setActiveCategoryPill] = useState<string>("All");

  if (!isOpen) return null;

  const timeSlots = ["08:00 AM", "09:00 AM", "10:00 AM", "11:00 AM", "12:00 PM", "01:00 PM"];
  const categories = ["All", "News", "Movies", "Documentary", "Tech / Science", "Drama"];

  const filteredGrid = epgGrid.filter((prog) => {
    if (activeCategoryPill !== "All" && !prog.category.toLowerCase().includes(activeCategoryPill.toLowerCase())) {
      return false;
    }
    if (guideSearch.trim()) {
      const q = guideSearch.toLowerCase();
      const matchChannel = prog.channelName.toLowerCase().includes(q);
      const matchTitle = prog.title.toLowerCase().includes(q);
      const matchCat = prog.category.toLowerCase().includes(q);
      if (!matchChannel && !matchTitle && !matchCat) return false;
    }
    return true;
  });

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
      <div className="glass border border-white/10 rounded-3xl max-w-5xl w-full p-6 space-y-5 shadow-2xl relative animate-in fade-in zoom-in duration-200">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 rounded-full bg-[#05070A] text-white/40 hover:text-white cursor-pointer border border-white/10 transition-colors"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Modal Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#0088FF]/20 text-[#0088FF] border border-[#0088FF]/30 flex items-center justify-center shrink-0">
              <Calendar className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-xl font-black text-white uppercase tracking-tight">24-Hour Linear EPG Matrix Guide</h2>
              <p className="text-xs text-white/50">Deterministic wall-clock program schedules, live progress bars, and channel tuner.</p>
            </div>
          </div>

          {/* Quick Search */}
          <div className="relative sm:w-64">
            <Search className="w-3.5 h-3.5 text-white/30 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search programs or channels..."
              value={guideSearch}
              onChange={(e) => setGuideSearch(e.target.value)}
              className="w-full bg-[#05070A] border border-white/10 text-xs rounded-xl pl-8 pr-3 py-1.5 text-white placeholder-white/30 outline-none focus:border-[#0088FF]"
            />
          </div>
        </div>

        {/* Category Filter Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none font-mono text-xs">
          {categories.map((cat) => {
            const isActive = activeCategoryPill === cat;
            return (
              <button
                key={cat}
                onClick={() => setActiveCategoryPill(cat)}
                className={`px-3 py-1.5 rounded-xl font-bold transition-all cursor-pointer whitespace-nowrap ${
                  isActive 
                    ? "bg-[#0088FF] text-white shadow-md shadow-[#0088FF]/30" 
                    : "bg-[#0D121D] text-white/50 hover:text-white border border-white/5"
                }`}
              >
                {cat}
              </button>
            );
          })}
        </div>

        {/* EPG MATRIX GRID */}
        <div className="bg-[#05070A] rounded-2xl border border-white/10 overflow-hidden font-mono max-h-[55vh] overflow-y-auto">
          {/* Time Header */}
          <div className="grid grid-cols-7 border-b border-white/10 p-3 text-xs font-bold text-white/50 bg-[#0D121D] sticky top-0 z-20">
            <div className="col-span-1">CHANNEL</div>
            {timeSlots.map((time, i) => (
              <div key={i} className="col-span-1 text-center">{time}</div>
            ))}
          </div>

          {/* Program Rows */}
          <div className="divide-y divide-white/5">
            {filteredGrid.length === 0 ? (
              <div className="p-8 text-center text-white/40 text-xs">
                No scheduled programs match &ldquo;{guideSearch}&rdquo; in category {activeCategoryPill}.
              </div>
            ) : (
              filteredGrid.map((prog) => (
                <div key={prog.id} className="grid grid-cols-7 p-3 items-center text-xs hover:bg-white/[0.02] transition-colors">
                  <div 
                    onClick={() => {
                      if (onSelectProgramChannel) {
                        onSelectProgramChannel(prog.channelName);
                        onClose();
                      }
                    }}
                    className="col-span-1 flex items-center gap-2 pr-2 cursor-pointer group"
                    title="Click to Tune Channel"
                  >
                    {prog.channelLogo ? (
                      <img src={prog.channelLogo} alt={prog.channelName} className="w-7 h-7 rounded-lg object-cover bg-black border border-white/10 shrink-0" />
                    ) : (
                      <div className="w-7 h-7 rounded-lg bg-[#161E2E] flex items-center justify-center shrink-0 border border-white/10">
                        <Tv className="w-3.5 h-3.5 text-[#0088FF]" />
                      </div>
                    )}
                    <span className="font-bold text-white truncate group-hover:text-[#0088FF] transition-colors">{prog.channelName}</span>
                  </div>

                  <div className="col-span-6 bg-[#0D121D] border border-[#0088FF]/30 rounded-xl p-2.5 relative overflow-hidden group">
                    <div 
                      className="absolute top-0 bottom-0 left-0 bg-[#0088FF]/20 pointer-events-none transition-all" 
                      style={{ width: `${prog.progressPercent}%` }}
                    />
                    <div className="relative z-10 flex items-center justify-between gap-2">
                      <div className="truncate">
                        <span className="font-bold text-white mr-2 uppercase truncate">{prog.title}</span>
                        <span className="text-[10px] text-white/40">({prog.startTime} - {prog.endTime})</span>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="px-2 py-0.5 rounded bg-[#0088FF]/20 text-[#0088FF] text-[10px] font-bold">
                          {prog.category}
                        </span>
                        <span className="text-[10px] text-[#00FF9D] font-mono font-semibold">
                          {prog.progressPercent}%
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
