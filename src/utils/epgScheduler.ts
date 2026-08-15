import { Episode } from "../types";

export interface ScheduledEpisodeSlot {
  episode: Episode;
  index: number;
  startEpochMs: number;
  endEpochMs: number;
  startTimeFormatted: string;
  endTimeFormatted: string;
  durationSec: number;
  isCurrentlyPlaying: boolean;
  progressPercent: number;
  seekTimestampSec: number;
}

export interface LiveChannelSchedule {
  channelId: string;
  showTitle: string;
  totalDurationSec: number;
  currentPlayingEpisode: Episode | null;
  currentEpisodeIndex: number;
  seekTimestampSec: number;
  progressPercent: number;
  elapsedInPlaylistSec: number;
  remainingInEpisodeSec: number;
  timelineSlots: ScheduledEpisodeSlot[];
}

/**
 * Format timestamp (epoch ms) to standard 12-hour time (e.g., "02:30 PM")
 */
export function formatTimeSlot(epochMs: number): string {
  const date = new Date(epochMs);
  let hours = date.getHours();
  const minutes = date.getMinutes();
  const ampm = hours >= 12 ? "PM" : "AM";
  hours = hours % 12;
  hours = hours ? hours : 12;
  const minutesStr = minutes < 10 ? `0${minutes}` : `${minutes}`;
  const hoursStr = hours < 10 ? `0${hours}` : `${hours}`;
  return `${hoursStr}:${minutesStr} ${ampm}`;
}

/**
 * Step 2: The Deterministic Scheduler (utils/epgScheduler.ts)
 * 
 * Pure mathematical scheduling function:
 * 1. Sum total duration of playlist.
 * 2. Date.now() modulo (%) total playlist duration.
 * 3. Iterate to determine currentPlayingEpisode and exact seekTimestampSec.
 * 4. Generate 24-hour matrix timeline slots.
 * 
 * ZERO render side-effects, fully pure and deterministic.
 */
export function calculateLiveSchedule(
  episodes: Episode[],
  nowMs: number = Date.now(),
  channelId: string = "channel-live"
): LiveChannelSchedule {
  if (!episodes || episodes.length === 0) {
    return {
      channelId,
      showTitle: "Linear Stream",
      totalDurationSec: 0,
      currentPlayingEpisode: null,
      currentEpisodeIndex: 0,
      seekTimestampSec: 0,
      progressPercent: 0,
      elapsedInPlaylistSec: 0,
      remainingInEpisodeSec: 0,
      timelineSlots: [],
    };
  }

  // 1. Sum total playlist duration in seconds
  const totalDurationSec = episodes.reduce((acc, ep) => acc + (ep.duration > 0 ? ep.duration : 1800), 0);
  const totalDurationMs = totalDurationSec * 1000;

  if (totalDurationMs <= 0) {
    return {
      channelId,
      showTitle: episodes[0]?.groupTitle || episodes[0]?.title || "Linear Stream",
      totalDurationSec: 1800,
      currentPlayingEpisode: episodes[0],
      currentEpisodeIndex: 0,
      seekTimestampSec: 0,
      progressPercent: 0,
      elapsedInPlaylistSec: 0,
      remainingInEpisodeSec: 1800,
      timelineSlots: [],
    };
  }

  // 2. Deterministic current offset via Modulo (%) math
  const currentOffsetMs = nowMs % totalDurationMs;
  const currentOffsetSec = currentOffsetMs / 1000;

  // The cycle start timestamp for the current playlist loop
  const cycleStartEpochMs = nowMs - currentOffsetMs;

  let accumulatedSec = 0;
  let currentEpisodeIndex = 0;
  let currentPlayingEpisode: Episode = episodes[0];
  let seekTimestampSec = 0;
  let progressPercent = 0;
  let remainingInEpisodeSec = 0;

  // 3. Iterate through episodes to identify active block
  for (let i = 0; i < episodes.length; i++) {
    const ep = episodes[i];
    const epDuration = ep.duration > 0 ? ep.duration : 1800;
    const startSec = accumulatedSec;
    const endSec = accumulatedSec + epDuration;

    if (currentOffsetSec >= startSec && currentOffsetSec < endSec) {
      currentEpisodeIndex = i;
      currentPlayingEpisode = ep;
      seekTimestampSec = Math.max(0, currentOffsetSec - startSec);
      progressPercent = Math.min(100, Math.max(0, (seekTimestampSec / epDuration) * 100));
      remainingInEpisodeSec = Math.max(0, epDuration - seekTimestampSec);
      break;
    }

    accumulatedSec += epDuration;
  }

  // 4. Build 24-hour linear schedule slots
  const timelineSlots: ScheduledEpisodeSlot[] = [];
  let slotAccumulatedMs = 0;

  // Generate slots for current cycle plus future cycles to fill a 24-Hour window
  const maxWindowMs = 24 * 60 * 60 * 1000; // 24 Hours
  let windowElapsedMs = 0;
  let cycle = 0;

  while (windowElapsedMs < maxWindowMs && cycle < 10) {
    for (let i = 0; i < episodes.length; i++) {
      const ep = episodes[i];
      const epDurationMs = (ep.duration > 0 ? ep.duration : 1800) * 1000;
      const startEpoch = cycleStartEpochMs + (cycle * totalDurationMs) + slotAccumulatedMs;
      const endEpoch = startEpoch + epDurationMs;

      const isCurrent = (cycle === 0 && i === currentEpisodeIndex);
      const slotSeek = isCurrent ? seekTimestampSec : 0;
      const slotProgress = isCurrent ? progressPercent : (nowMs > endEpoch ? 100 : 0);

      timelineSlots.push({
        episode: ep,
        index: i,
        startEpochMs: startEpoch,
        endEpochMs: endEpoch,
        startTimeFormatted: formatTimeSlot(startEpoch),
        endTimeFormatted: formatTimeSlot(endEpoch),
        durationSec: ep.duration > 0 ? ep.duration : 1800,
        isCurrentlyPlaying: isCurrent,
        progressPercent: slotProgress,
        seekTimestampSec: slotSeek,
      });

      slotAccumulatedMs += epDurationMs;
      windowElapsedMs += epDurationMs;

      if (windowElapsedMs >= maxWindowMs) break;
    }
    slotAccumulatedMs = 0;
    cycle++;
  }

  return {
    channelId,
    showTitle: currentPlayingEpisode.groupTitle || currentPlayingEpisode.title || "Linear Broadcast",
    totalDurationSec,
    currentPlayingEpisode,
    currentEpisodeIndex,
    seekTimestampSec,
    progressPercent,
    elapsedInPlaylistSec: currentOffsetSec,
    remainingInEpisodeSec,
    timelineSlots,
  };
}
