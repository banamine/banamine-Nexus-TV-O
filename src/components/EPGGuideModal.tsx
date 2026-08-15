import React from "react";
import { Calendar, Clock, X, Tv, Sparkles, CheckCircle2 } from "lucide-react";
import { EPGProgram } from "../types";

interface EPGGuideModalProps {
  isOpen: boolean;
  onClose: () => void;
  epgGrid: EPGProgram[];
}

export const EPGGuideModal: React.FC<EPGGuideModalProps> = ({
  isOpen,
  onClose,
  epgGrid,
}) => {
  if (!isOpen) return null;

  const timeSlots = ["08:00 AM", "09:00 AM", "10:00 AM", "11:00 AM", "12:00 PM", "01:00 PM"];

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
      <div className="glass border border-white/10 rounded-3xl max-w-4xl w-full p-6 space-y-6 shadow-2xl relative animate-in fade-in zoom-in duration-200">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 rounded-full bg-[#05070A] text-white/40 hover:text-white cursor-pointer border border-white/10"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#0088FF]/20 text-[#0088FF] border border-[#0088FF]/30 flex items-center justify-center shrink-0">
            <Calendar className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-xl font-black text-white uppercase tracking-tight">24-Hour Linear EPG Matrix Guide</h2>
            <p className="text-xs text-white/50">Deterministic wall-clock program schedules and XMLTV integration.</p>
          </div>
        </div>

        {/* EPG MATRIX GRID */}
        <div className="bg-[#05070A] rounded-2xl border border-white/10 overflow-hidden font-mono">
          {/* Time Header */}
          <div className="grid grid-cols-7 border-b border-white/10 p-3 text-xs font-bold text-white/50 bg-[#0D121D]">
            <div className="col-span-1">CHANNEL</div>
            {timeSlots.map((time, i) => (
              <div key={i} className="col-span-1 text-center">{time}</div>
            ))}
          </div>

          {/* Program Rows */}
          <div className="divide-y divide-white/5">
            {epgGrid.map((prog) => (
              <div key={prog.id} className="grid grid-cols-7 p-3 items-center text-xs">
                <div className="col-span-1 flex items-center gap-2 pr-2">
                  {prog.channelLogo && (
                    <img src={prog.channelLogo} alt={prog.channelName} className="w-6 h-6 rounded object-cover" />
                  )}
                  <span className="font-bold text-white truncate">{prog.channelName}</span>
                </div>

                <div className="col-span-6 bg-[#0D121D] border border-[#0088FF]/30 rounded-xl p-2.5 relative overflow-hidden">
                  <div 
                    className="absolute top-0 bottom-0 left-0 bg-[#0088FF]/15 pointer-events-none" 
                    style={{ width: `${prog.progressPercent}%` }}
                  />
                  <div className="relative z-10 flex items-center justify-between">
                    <div>
                      <span className="font-bold text-white mr-2 uppercase">{prog.title}</span>
                      <span className="text-[10px] text-white/40">({prog.startTime} - {prog.endTime})</span>
                    </div>
                    <span className="px-2 py-0.5 rounded bg-[#0088FF]/20 text-[#0088FF] text-[10px] font-bold">
                      {prog.category}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
