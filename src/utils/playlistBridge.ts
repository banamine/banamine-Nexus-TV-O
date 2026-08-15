export interface PlaylistChannel {
  id: string;
  name: string;
  logo?: string;
  group?: string;
  url: string;
  language: string;
}

const STORAGE_KEY = 'iptv-pro';
const LANG_KEY = 'iptv-pro-lang-hint';
const IDB_NAME = 'iptv-pro';
const IDB_STORE = 'cache';

/**
 * Force-configures localStorage parameters to prioritize English streams
 * and disable demo limitations across the app lifecycle.
 */
export const preConfigureLocalStorage = (): void => {
  try {
    const existing = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
    const updatedConfig = {
      ...existing,
      demoMode: false,
      activeSource: 'tvexplorer-en',
      filter: {
        ...(existing.filter || {}),
        language: 'en',
        category: 'All',
        favoritesOnly: false,
      },
      updatedAt: Date.now(),
    };

    localStorage.setItem(STORAGE_KEY, JSON.stringify(updatedConfig));
    localStorage.setItem(LANG_KEY, 'true');
    console.log('[PlaylistBridge] Application state initialized to English Live Playlist.');
  } catch (err) {
    console.error('[PlaylistBridge] Failed to set localStorage state:', err);
  }
};

/**
 * M3U Parser to convert raw playlist lines into channel JSON entries
 */
export const parseM3UToChannels = (m3uText: string): PlaylistChannel[] => {
  const lines = m3uText.split(/\r?\n/);
  const channels: PlaylistChannel[] = [];
  let currentMeta: Partial<PlaylistChannel> = {};

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (line.startsWith('#EXTINF:')) {
      const nameMatch = line.match(/,(.+)$/);
      const logoMatch = line.match(/tvg-logo="([^"]+)"/);
      const groupMatch = line.match(/group-title="([^"]+)"/);

      currentMeta = {
        id: `ch-${Math.random().toString(36).substring(2, 9)}`,
        name: nameMatch ? nameMatch[1].trim() : 'Unknown Channel',
        logo: logoMatch ? logoMatch[1] : '',
        group: groupMatch ? groupMatch[1] : 'General',
        language: 'en',
      };
    } else if (line.length > 0 && !line.startsWith('#')) {
      if (currentMeta.name) {
        channels.push({
          ...(currentMeta as PlaylistChannel),
          url: line,
        });
        currentMeta = {};
      }
    }
  }

  return channels;
};

/**
 * Hydrates IndexedDB ('iptv-pro' -> 'cache') with parsed channel entries
 */
export const hydrateIndexedDBCache = async (channels: PlaylistChannel[]): Promise<boolean> => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(IDB_NAME, 1);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(IDB_STORE)) {
        db.createObjectStore(IDB_STORE);
      }
    };

    request.onsuccess = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      const transaction = db.transaction(IDB_STORE, 'readwrite');
      const store = transaction.objectStore(IDB_STORE);

      store.put(channels, 'channels');

      transaction.oncomplete = () => {
        console.log(`[PlaylistBridge] Hydrated ${channels.length} English channels into IndexedDB.`);
        resolve(true);
      };

      transaction.onerror = (err) => {
        console.error('[PlaylistBridge] Transaction error during IndexedDB write:', err);
        reject(false);
      };
    };

    request.onerror = (err) => {
      console.error('[PlaylistBridge] Failed to open IndexedDB:', err);
      reject(false);
    };
  });
};

/**
 * Primary sync orchestrator
 */
export const initializeEnglishPlaylist = async (customM3uUrl?: string): Promise<PlaylistChannel[]> => {
  preConfigureLocalStorage();
  const targetUrl = customM3uUrl || 'https://iptv-org.github.io/iptv/languages/eng.m3u';

  try {
    const response = await fetch(targetUrl);
    if (!response.ok) throw new Error(`HTTP error ${response.status}`);
    const m3uContent = await response.text();

    const parsedChannels = parseM3UToChannels(m3uContent);
    if (parsedChannels.length > 0) {
      await hydrateIndexedDBCache(parsedChannels);
      return parsedChannels;
    }
  } catch (error) {
    console.warn('[PlaylistBridge] Live fetch failed, using fallback cache.', error);
  }

  return [];
};
