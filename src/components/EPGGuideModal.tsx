import React from "react";
import { 
  Calendar, 
  X
} from "lucide-react";
import { EPGProgram, Episode } from "../types";
import { EPGMatrix } from "./EPGMatrix";

interface EPGGuideModalProps {
  isOpen: boolean;
  onClose: () => void;
  epgGrid?: EPGProgram[];
  episodes?: Episode[];
  onSelectProgramChannel?: (channelName: string) => void;
  onSelectEpisode?: (ep: Episode) => void;
}

export const EPGGuideModal: React.FC<EPGGuideModalProps> = ({
  isOpen,
  onClose,
  episodes = [],
  onSelectEpisode,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-2 sm:p-4 overflow-y-auto">
      <div className="glass border border-white/10 rounded-3xl max-w-6xl w-full p-4 sm:p-6 space-y-4 shadow-2xl relative animate-in fade-in zoom-in duration-200 my-auto">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 rounded-full bg-[#05070A] text-white/40 hover:text-white cursor-pointer border border-white/10 transition-colors z-30"
        >
          <X className="w-5 h-5" />
        </button>

        <EPGMatrix
          episodes={episodes}
          onSelectChannel={(ep) => {
            if (onSelectEpisode) {
              onSelectEpisode(ep);
            }
          }}
        />
      </div>
    </div>
  );
};
