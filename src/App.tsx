import React, { useState } from "react";
import { Navbar } from "./components/Navbar";
import { SmartersDashboard } from "./components/SmartersDashboard";
import { LiveTVThreeColumn } from "./components/LiveTVThreeColumn";
import { VODCatalog } from "./components/VODCatalog";
import { MultiScreenGrid } from "./components/MultiScreenGrid";
import { ChannelPlayerView } from "./components/ChannelPlayerView";
import { PinShieldModal } from "./components/PinShieldModal";
import { ImportExportModal } from "./components/ImportExportModal";
import { ThirdEyePanel } from "./components/ThirdEyePanel";
import { EPGGuideModal } from "./components/EPGGuideModal";
import { EPGMatrix } from "./components/EPGMatrix";

import { 
  INITIAL_EPISODES, 
  INITIAL_VOD_CATALOG, 
  INITIAL_EPG_GRID, 
  INITIAL_SYSTEM_STATS 
} from "./data/mockPlaylist";
import { Episode, VODItem, WatchdogState } from "./types";

export default function App() {
  const [currentView, setCurrentView] = useState<string>("home");
  const [searchTerm, setSearchTerm] = useState<string>("");
  const [episodes, setEpisodes] = useState<Episode[]>(INITIAL_EPISODES);
  const [selectedEpisode, setSelectedEpisode] = useState<Episode | null>(INITIAL_EPISODES[0] || null);
  const [vodCatalog] = useState<VODItem[]>(INITIAL_VOD_CATALOG);
  const [epgGrid] = useState(INITIAL_EPG_GRID);
  const [stats, setStats] = useState(INITIAL_SYSTEM_STATS);

  // Modals
  const [pinUnlocked, setPinUnlocked] = useState<boolean>(false);
  const [isPinModalOpen, setIsPinModalOpen] = useState<boolean>(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState<boolean>(false);
  const [isThirdEyeModalOpen, setIsThirdEyeModalOpen] = useState<boolean>(false);
  const [isEPGModalOpen, setIsEPGModalOpen] = useState<boolean>(false);

  // Watchdog Fallback State
  const [watchdogState, setWatchdogState] = useState<WatchdogState>({
    circuitEngaged: false,
    activeFallbackUrl: "https://archive.org/download/Tears-of-Steel/tears_of_steel_720p.mp4",
    droppedStreamsCount: 0,
    statusMessage: "Watchdog Engine Nominal.",
    healthScore: 98,
  });

  const handleTriggerFailover = () => {
    setWatchdogState(prev => ({
      ...prev,
      circuitEngaged: true,
      droppedStreamsCount: prev.droppedStreamsCount + 1,
      statusMessage: "ENGAGING FALLBACK STREAM... Swapped manifest automatically.",
    }));
  };

  const handleResetFailover = () => {
    setWatchdogState(prev => ({
      ...prev,
      circuitEngaged: false,
      statusMessage: "Watchdog Engine Nominal.",
    }));
  };

  const handleSelectEpisode = (ep: Episode) => {
    setSelectedEpisode(ep);
    // Automatically disengage failover lock when user explicitly chooses a channel
    setWatchdogState(prev => ({
      ...prev,
      circuitEngaged: false,
      statusMessage: "Watchdog Engine Nominal.",
    }));
  };

  const handleImportEpisodes = (newEps: Episode[]) => {
    setEpisodes(prev => [...newEps, ...prev]);
    setStats(prev => ({ ...prev, totalChannels: prev.totalChannels + newEps.length }));
  };

  const handleUpdateEpisodes = (updated: Episode[]) => {
    setEpisodes(updated);
    setStats(prev => ({ ...prev, totalChannels: updated.length }));
  };

  const handlePlayVOD = (vod: VODItem) => {
    const vodEp: Episode = {
      id: vod.id,
      season: 1,
      episode: 1,
      title: vod.title,
      duration: vod.durationSec,
      url: vod.url,
      status: "valid",
      groupTitle: vod.groupTitle,
      contentType: vod.type === "movie" ? "movie" : "series",
    };
    setSelectedEpisode(vodEp);
    setWatchdogState(prev => ({
      ...prev,
      circuitEngaged: false,
      statusMessage: "Watchdog Engine Nominal.",
    }));
    setCurrentView("live");
  };

  const handleSelectProgramChannel = (channelName: string) => {
    const match = episodes.find(e => 
      e.title.toLowerCase().includes(channelName.toLowerCase()) || 
      channelName.toLowerCase().includes(e.title.toLowerCase())
    );
    if (match) {
      handleSelectEpisode(match);
      setCurrentView("live");
    }
  };

  // Filter episodes by global search term
  const filteredEpisodes = episodes.filter(e => 
    e.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
    e.groupTitle.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-[#0A0E17] text-white flex flex-col font-sans selection:bg-[#0088FF] selection:text-white">
      {/* Smarters Pro Navbar */}
      <Navbar
        currentView={currentView}
        onNavigate={(v) => setCurrentView(v)}
        pinUnlocked={pinUnlocked}
        onOpenPinModal={() => setIsPinModalOpen(true)}
        onOpenImportModal={() => setIsImportModalOpen(true)}
        onOpenThirdEyeModal={() => setIsThirdEyeModalOpen(true)}
        searchTerm={searchTerm}
        onSearchChange={setSearchTerm}
      />

      {/* Main Dynamic View Controller */}
      <main className="flex-1 overflow-x-hidden">
        {currentView === "home" && (
          <SmartersDashboard
            stats={stats}
            onNavigate={(v) => setCurrentView(v)}
            onOpenEPGModal={() => setIsEPGModalOpen(true)}
            onOpenPinModal={() => setIsPinModalOpen(true)}
            onOpenImportModal={() => setIsImportModalOpen(true)}
            onOpenThirdEyeModal={() => setIsThirdEyeModalOpen(true)}
          />
        )}

        {currentView === "live" && (
          <LiveTVThreeColumn
            episodes={filteredEpisodes}
            selectedEpisode={selectedEpisode}
            onSelectEpisode={handleSelectEpisode}
            pinUnlocked={pinUnlocked}
            onOpenPinModal={() => setIsPinModalOpen(true)}
            watchdogState={watchdogState}
            onTriggerFailover={handleTriggerFailover}
            onResetFailover={handleResetFailover}
          />
        )}

        {currentView === "vod" && (
          <VODCatalog
            catalog={vodCatalog}
            onPlayVOD={handlePlayVOD}
          />
        )}

        {currentView === "epg" && (
          <div className="p-4 sm:p-8 max-w-7xl mx-auto">
            <EPGMatrix
              episodes={filteredEpisodes}
              onSelectChannel={(ep) => {
                setSelectedEpisode(ep);
              }}
            />
          </div>
        )}

        {currentView === "multiscreen" && (
          <MultiScreenGrid
            episodes={episodes}
          />
        )}

        {currentView === "player" && (
          <ChannelPlayerView
            episodes={episodes}
            initialEpisode={selectedEpisode}
          />
        )}
      </main>

      {/* MODALS */}
      <PinShieldModal
        isOpen={isPinModalOpen}
        onClose={() => setIsPinModalOpen(false)}
        pinUnlocked={pinUnlocked}
        onUnlockSuccess={() => setPinUnlocked(true)}
        onLockPin={() => setPinUnlocked(false)}
      />

      <ImportExportModal
        isOpen={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
        episodes={episodes}
        onImportEpisodes={handleImportEpisodes}
        onUpdateEpisodes={handleUpdateEpisodes}
      />

      <ThirdEyePanel
        isOpen={isThirdEyeModalOpen}
        onClose={() => setIsThirdEyeModalOpen(false)}
      />

      <EPGGuideModal
        isOpen={isEPGModalOpen}
        onClose={() => setIsEPGModalOpen(false)}
        episodes={episodes}
        onSelectEpisode={(ep) => {
          setSelectedEpisode(ep);
          setIsEPGModalOpen(false);
          setCurrentView("live");
        }}
      />
    </div>
  );
}
