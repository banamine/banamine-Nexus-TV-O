import { Episode } from "../types";

export interface WatchHistoryEntry {
  id: string;
  episode: Episode;
  watchedAt: number; // timestamp
}

const FAVORITES_STORAGE_KEY = "matrix_favorite_channels_v1";
const HISTORY_STORAGE_KEY = "matrix_watch_history_v1";

/**
 * Load favorited channel IDs from localStorage
 */
export function getStoredFavorites(): Set<string> {
  try {
    const raw = localStorage.getItem(FAVORITES_STORAGE_KEY);
    if (!raw) return new Set(["ch-101", "ch-103"]);
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return new Set(parsed);
    }
  } catch (e) {
    console.warn("Failed to load favorites from localStorage:", e);
  }
  return new Set(["ch-101", "ch-103"]);
}

/**
 * Save favorited channel IDs to localStorage
 */
export function saveStoredFavorites(favs: Set<string>): void {
  try {
    localStorage.setItem(FAVORITES_STORAGE_KEY, JSON.stringify(Array.from(favs)));
  } catch (e) {
    console.warn("Failed to save favorites to localStorage:", e);
  }
}

/**
 * Load watch history from localStorage
 */
export function getStoredWatchHistory(): WatchHistoryEntry[] {
  try {
    const raw = localStorage.getItem(HISTORY_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return parsed;
    }
  } catch (e) {
    console.warn("Failed to load watch history from localStorage:", e);
  }
  return [];
}

/**
 * Record an episode to recent watch history (capped to top 20, newest first)
 */
export function recordWatchHistory(ep: Episode): WatchHistoryEntry[] {
  try {
    const current = getStoredWatchHistory();
    // Filter out if already in history to move to top
    const filtered = current.filter(item => item.episode.id !== ep.id && item.episode.url !== ep.url);
    const newEntry: WatchHistoryEntry = {
      id: "hist-" + Date.now(),
      episode: ep,
      watchedAt: Date.now(),
    };
    const updated = [newEntry, ...filtered].slice(0, 25);
    localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(updated));
    return updated;
  } catch (e) {
    console.warn("Failed to record watch history to localStorage:", e);
    return [];
  }
}

/**
 * Clear watch history
 */
export function clearStoredWatchHistory(): void {
  try {
    localStorage.removeItem(HISTORY_STORAGE_KEY);
  } catch (e) {
    console.warn("Failed to clear watch history:", e);
  }
}
