import { useState, useEffect, useCallback, useRef } from "react";
import { Episode } from "../types";

export interface SavedChannelExitState {
  channelId: string;
  episodeId: string;
  episodeTitle?: string;
  timestamp: number; // in seconds
  exitTime: number; // Date.now()
}

export interface PlaybackDecision {
  isResumed: boolean;
  effectiveEpisodeId: string;
  effectiveSeekSec: number;
  timeSinceExitSec: number;
  reason: "SMART_RESUME" | "LIVE_EPG_SCHEDULE";
}

const STORAGE_KEY_PREFIX = "nexus_smart_resume_";
const EXPIRY_THRESHOLD_MS = 20 * 60 * 1000; // 20 minutes (1,200,000 milliseconds)

/**
 * Step 3: The Smart Resume Hook (hooks/useSmartResume.ts)
 * 
 * Tracks user exit positions and intelligently determines whether to
 * resume playback (< 20 mins) or snap back to the deterministic live EPG schedule (> 20 mins).
 */
export function useSmartResume() {
  const activeChannelRef = useRef<string | null>(null);
  const activeEpisodeRef = useRef<string | null>(null);
  const currentTimestampRef = useRef<number>(0);

  /**
   * Record periodic or exit timestamp for an active channel
   */
  const saveExitState = useCallback(
    (channelId: string, episodeId: string, timestampSec: number, episodeTitle?: string) => {
      if (!channelId || typeof window === "undefined") return;
      if (timestampSec <= 0) return;

      const state: SavedChannelExitState = {
        channelId,
        episodeId,
        episodeTitle,
        timestamp: Math.round(timestampSec),
        exitTime: Date.now(),
      };

      try {
        localStorage.setItem(STORAGE_KEY_PREFIX + channelId, JSON.stringify(state));
      } catch (err) {
        console.warn("SmartResume save error:", err);
      }
    },
    []
  );

  /**
   * Clear saved channel state
   */
  const clearSavedState = useCallback((channelId: string) => {
    if (!channelId || typeof window === "undefined") return;
    try {
      localStorage.removeItem(STORAGE_KEY_PREFIX + channelId);
    } catch (err) {
      console.warn("SmartResume clear error:", err);
    }
  }, []);

  /**
   * Get saved channel exit state if still within 20 minutes validity window
   */
  const getSavedExitState = useCallback((channelId: string): SavedChannelExitState | null => {
    if (!channelId || typeof window === "undefined") return null;
    try {
      const raw = localStorage.getItem(STORAGE_KEY_PREFIX + channelId);
      if (!raw) return null;

      const state: SavedChannelExitState = JSON.parse(raw);
      const elapsedMs = Date.now() - state.exitTime;

      if (elapsedMs < EXPIRY_THRESHOLD_MS && state.timestamp > 0) {
        return state;
      } else {
        // Expired (> 20 mins) -> prune storage
        localStorage.removeItem(STORAGE_KEY_PREFIX + channelId);
        return null;
      }
    } catch {
      return null;
    }
  }, []);

  /**
   * Calculate final playback target on channel entry:
   * Checks if Date.now() - exitTime < 20 minutes (1,200,000 ms).
   * If true: Override Scheduler and resume from saved timestamp.
   * If false: Snap to live EPG schedule.
   */
  const resolvePlaybackTarget = useCallback(
    (
      channelId: string,
      scheduledEpisode: Episode | null,
      scheduledSeekSec: number
    ): PlaybackDecision => {
      const saved = getSavedExitState(channelId);

      if (saved) {
        const elapsedMs = Date.now() - saved.exitTime;
        return {
          isResumed: true,
          effectiveEpisodeId: saved.episodeId,
          effectiveSeekSec: saved.timestamp,
          timeSinceExitSec: Math.round(elapsedMs / 1000),
          reason: "SMART_RESUME",
        };
      }

      return {
        isResumed: false,
        effectiveEpisodeId: scheduledEpisode?.id || "",
        effectiveSeekSec: scheduledSeekSec || 0,
        timeSinceExitSec: 0,
        reason: "LIVE_EPG_SCHEDULE",
      };
    },
    [getSavedExitState]
  );

  /**
   * Update active player tracking ref for window beforeunload listener
   */
  const updateCurrentPlayback = useCallback(
    (channelId: string, episodeId: string, currentSec: number, episodeTitle?: string) => {
      activeChannelRef.current = channelId;
      activeEpisodeRef.current = episodeId;
      currentTimestampRef.current = currentSec;

      // Persist periodically every 5-10s
      saveExitState(channelId, episodeId, currentSec, episodeTitle);
    },
    [saveExitState]
  );

  // Flush state on window unload or tab close
  useEffect(() => {
    const handleUnload = () => {
      if (activeChannelRef.current && activeEpisodeRef.current && currentTimestampRef.current > 0) {
        saveExitState(
          activeChannelRef.current,
          activeEpisodeRef.current,
          currentTimestampRef.current
        );
      }
    };

    window.addEventListener("beforeunload", handleUnload);
    return () => {
      window.removeEventListener("beforeunload", handleUnload);
      handleUnload();
    };
  }, [saveExitState]);

  return {
    saveExitState,
    clearSavedState,
    getSavedExitState,
    resolvePlaybackTarget,
    updateCurrentPlayback,
  };
}
