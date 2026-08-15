export type EpisodeStatus = "valid" | "warning" | "invalid" | "pending";
export type ContentType = "news" | "movie" | "series" | "live" | "bumper";
export type PlayerTarget = "player1" | "player2" | "all";

export interface Episode {
  id: string;
  season: number;
  episode: number;
  title: string;
  duration: number; // in seconds
  url: string;
  resolvedUrl?: string | null;
  status: EpisodeStatus;
  groupTitle: string;
  tvgId?: string | null;
  tvgName?: string | null;
  tvgLogo?: string | null;
  thumbnailUrl?: string | null;
  sourceHost?: string | null;
  subtitleUrl?: string | null;
  description?: string | null;
  contentType?: ContentType | null;
  allowedPlayers?: PlayerTarget[];
  importedAt?: string;
}

export interface VODItem {
  id: string;
  title: string;
  type: "movie" | "series";
  year: number;
  rating: number;
  durationStr: string;
  durationSec: number;
  genre: string;
  posterUrl: string;
  backdropUrl?: string;
  synopsis: string;
  cast: string[];
  director: string;
  audio: string;
  resolution: string;
  url: string;
  groupTitle: string;
  seasons?: number;
  episodesCount?: number;
}

export type RejectionReason = "THRESHOLD" | "BLACKLIST" | "ALERT_MODE" | "DUPLICATE";

export interface RejectionEntry {
  title: string;
  reason: RejectionReason;
  score?: number;
  rejectedAt: string;
}

export interface ThirdEyeStatus {
  currentMode: "filtered" | "all";
  garbleThreshold: number;
  blacklist: string[];
  alertMode: boolean;
  rejectionBuffer: RejectionEntry[];
  stats: {
    inserted: number;
    skipped: number;
    received: number;
    parseFailed: number;
    garbleRejected: number;
  };
}

export interface EPGProgram {
  id: string;
  channelId: string;
  channelName: string;
  channelLogo?: string;
  title: string;
  description: string;
  startTime: string; // HH:mm
  endTime: string;   // HH:mm
  startEpochSec: number;
  endEpochSec: number;
  progressPercent: number;
  category: string;
}

export interface WatchdogState {
  circuitEngaged: boolean;
  activeFallbackUrl: string;
  droppedStreamsCount: number;
  statusMessage: string;
  lastFailoverAt?: string;
  healthScore: number;
}

export interface PlayerPaddockState {
  player1: {
    clockPattern: string;
    nextBreakInSec: number;
    hardSliceActive: boolean;
    currentShow: string;
  };
  player2: {
    mode: "AJ Broadcast" | "VoD" | "Standard";
    ntdBreakSecRemaining: number;
    savedCursorOffsetSec: number;
    activeShow: string;
  };
}

export interface SystemStats {
  totalChannels: number;
  moviesCount: number;
  seriesCount: number;
  validStreams: number;
  watchdogActive: boolean;
  newsRatio: number;
  serverStatus: "online" | "degraded" | "maintenance";
}
