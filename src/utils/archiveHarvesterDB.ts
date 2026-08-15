import { Episode } from "../types";

export interface ArchiveDiscoveredM3U {
  name: string;
  cleanTitle: string;
  size?: number;
  m3uUrl: string;
  identifier: string;
  groupTitle: string;
  posterUrl: string;
}

export interface ArchiveFolderScanResult {
  identifier: string;
  title: string;
  description: string;
  posterUrl: string;
  discoveredM3Us: ArchiveDiscoveredM3U[];
  virtualChannels: Episode[];
}

const DB_STORAGE_KEY_PREFIX = "nexus_archive_m3u_json_";
const DB_INDEX_KEY = "nexus_archive_cached_channels_manifest";

// 1. Cleanly extract Archive identifier from URL or input string
export function parseArchiveIdentifier(input: string): string {
  const trimmed = input.trim();
  // Match archive.org/download/{id} or archive.org/details/{id} or archive.org/metadata/{id}
  const match = trimmed.match(/archive\.org\/(?:download|details|metadata|embed)\/([^/?#]+)/i);
  if (match) {
    return match[1];
  }
  // If it's a bare identifier (e.g. "daily-highlights")
  if (!trimmed.includes("/") && !trimmed.includes(".")) {
    return trimmed;
  }
  // Try getting the last non-empty segment
  const segments = trimmed.replace(/\/+$/, "").split("/");
  return segments[segments.length - 1] || "archive-collection";
}

// 2. Format a clean title from a filename like "70 Odd Couple.m3u"
export function cleanTitleFromFilename(filename: string): string {
  let decoded = filename;
  try {
    decoded = decodeURIComponent(filename);
  } catch {
    // Keep decoded as is
  }
  return decoded
    .replace(/\.m3u8?$/i, "")
    .replace(/^[\d_-]+\s*/, "") // Strip leading numbers if desired, or keep legible
    .replace(/[_]/g, " ")
    .trim() || filename;
}

// 3. Normalize Stream URL without double-encoding and route Archive.org streams to CORS endpoints
export function normalizeStreamUrl(url: string): string {
  if (!url) return "";
  let clean = url.trim();
  if (clean.includes("archive.org/download/")) {
    clean = clean.replace("archive.org/download/", "archive.org/cors/");
  }
  try {
    clean = decodeURI(clean);
  } catch {
    // ignore
  }
  return encodeURI(clean).replace(/#/g, "%23");
}

// 4. Parse Raw M3U Content into Structured Episode Track JSON
export function parseM3uTextToEpisodes(
  rawText: string,
  fallbackGroup: string = "Archive Collection",
  fallbackPoster?: string
): Episode[] {
  if (!rawText) return [];

  // Normalize potential single-line / mashed M3U streams
  let normalizedText = rawText;
  if (!normalizedText.includes("\n") && normalizedText.includes("#EXTINF:")) {
    normalizedText = normalizedText
      .replace(/(#EXTINF:)/g, "\n$1")
      .replace(/(https?:\/\/)/g, "\n$1");
  }

  const lines = normalizedText.split(/\r?\n/);
  const parsed: Episode[] = [];

  let title = "";
  let group = fallbackGroup;
  let logo = fallbackPoster || "";
  let season = 1;
  let epNumber = 1;

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    const upper = trimmed.toUpperCase();
    if (
      upper === "EXTM3U" ||
      upper === "#EXTM3U" ||
      upper.startsWith("#EXTENC:") ||
      upper.startsWith("#EXT-X-") ||
      upper.startsWith("#EXTVLCOPT:") ||
      upper.startsWith("#PLAYLIST:")
    ) {
      if (upper.startsWith("#PLAYLIST:")) {
        group = trimmed.replace(/^#PLAYLIST:\s*/i, "").trim() || fallbackGroup;
      }
      continue;
    }

    if (trimmed.startsWith("#EXTINF:")) {
      const commaIdx = trimmed.indexOf(",");
      if (commaIdx !== -1) {
        const rawTitle = trimmed.substring(commaIdx + 1).trim();
        if (rawTitle.includes("/")) {
          const parts = rawTitle.split("/").map((p) => p.trim());
          if (parts.length >= 3) {
            group = parts[0];
            const epMatch = parts[1].match(/s(?:eason)?-?(\d+)\s*ep?\s*(\d+)/i);
            if (epMatch) {
              season = parseInt(epMatch[1], 10) || 1;
              epNumber = parseInt(epMatch[2], 10) || parsed.length + 1;
            }
            title = parts.slice(2).join(" - ");
          } else if (parts.length === 2) {
            group = parts[0];
            title = parts[1];
          } else {
            title = rawTitle;
          }
        } else {
          title = rawTitle;
        }
      }

      const groupMatch = trimmed.match(/group-title="([^"]+)"/i);
      if (groupMatch) group = groupMatch[1];

      const logoMatch = trimmed.match(/tvg-logo="([^"]+)"/i);
      if (logoMatch) logo = logoMatch[1];
    } else if (
      !trimmed.startsWith("#") &&
      (trimmed.startsWith("http://") || trimmed.startsWith("https://") || trimmed.startsWith("/"))
    ) {
      const isArchive = trimmed.includes("archive.org");
      const archiveItemMatch = trimmed.match(/archive\.org\/(?:download|details)\/([^/?#]+)/i);
      const archiveItemId = archiveItemMatch ? archiveItemMatch[1] : null;

      // Extract filename for fallback title if title is generic or in another language like "Канал 1"
      const urlFileName = trimmed.split("/").pop() || "";
      let decodedFilename = "";
      try {
        decodedFilename = decodeURIComponent(urlFileName)
          .replace(/\.(mp4|mkv|avi|webm|ts|m3u8?)$/i, "")
          .replace(/[_\+]/g, " ")
          .trim();
      } catch {
        decodedFilename = urlFileName;
      }

      let finalTitle = title;
      if (!finalTitle || /^(канал|channel|track|stream)\s*\d+$/i.test(finalTitle.trim())) {
        if (decodedFilename) {
          finalTitle = decodedFilename;
        } else {
          finalTitle = `Track ${parsed.length + 1}`;
        }
      }

      // Check for SxxExx in filename or title
      const seMatch = (finalTitle + " " + decodedFilename).match(/s(?:eason)?-?(\d+)\s*e(?:pisode)?-?(\d+)/i);
      if (seMatch) {
        season = parseInt(seMatch[1], 10) || season;
        epNumber = parseInt(seMatch[2], 10) || epNumber;
      } else {
        const epOnlyMatch = (finalTitle + " " + decodedFilename).match(/ep(?:isode)?\s*(\d+)/i);
        if (epOnlyMatch) {
          epNumber = parseInt(epOnlyMatch[1], 10) || epNumber;
        }
      }

      let finalLogo = logo;
      if (!finalLogo && archiveItemId) {
        finalLogo = `https://archive.org/services/img/${archiveItemId}`;
      } else if (!finalLogo && fallbackPoster) {
        finalLogo = fallbackPoster;
      }

      const cleanUrl = normalizeStreamUrl(trimmed);
      const isSeries = /s\d+e\d+/i.test(finalTitle) || /s-\d+\s*ep/i.test(line) || trimmed.toLowerCase().includes(".mp4");

      parsed.push({
        id: `ep-${Math.random().toString(36).slice(2, 9)}`,
        season: season,
        episode: epNumber || parsed.length + 1,
        title: finalTitle,
        duration: 3600,
        url: cleanUrl,
        status: "valid",
        groupTitle: group || fallbackGroup,
        tvgLogo: finalLogo || undefined,
        sourceHost: isArchive ? "archive.org" : "custom-stream",
        description: isArchive
          ? `Internet Archive classic digital stream [Item: ${archiveItemId || "media"}]`
          : undefined,
        contentType: isSeries ? "series" : "live",
        allowedPlayers: ["all"],
      });

      title = "";
      logo = fallbackPoster || "";
      season = 1;
      epNumber = parsed.length + 1;
    }
  }

  return parsed;
}

// 5. Scan an Archive.org Item/Folder for all .m3u files and generate virtual channels
export async function scanArchiveFolder(inputUrlOrId: string): Promise<ArchiveFolderScanResult> {
  const identifier = parseArchiveIdentifier(inputUrlOrId);
  let metadataJson: any = null;

  // Try local server endpoint first for zero-CORS reliability
  try {
    const res = await fetch(`/api/archive/metadata?id=${encodeURIComponent(identifier)}`, {
      signal: AbortSignal.timeout(9000),
    });
    if (res.ok) {
      metadataJson = await res.json();
    }
  } catch {
    // Fallback to direct archive.org metadata
    try {
      const res = await fetch(`https://archive.org/metadata/${identifier}`, {
        signal: AbortSignal.timeout(9000),
      });
      if (res.ok) {
        metadataJson = await res.json();
      }
    } catch {
      // Fallback to CORS proxy
      try {
        const proxyUrl = `https://corsproxy.io/?${encodeURIComponent(`https://archive.org/metadata/${identifier}`)}`;
        const res = await fetch(proxyUrl, { signal: AbortSignal.timeout(9000) });
        if (res.ok) {
          metadataJson = await res.json();
        }
      } catch (err) {
        console.warn("Archive metadata fetch failed:", err);
      }
    }
  }

  const posterUrl = `https://archive.org/services/img/${identifier}`;
  const collectionTitle = metadataJson?.metadata?.title || identifier.replace(/[-_]/g, " ").toUpperCase();
  const description =
    metadataJson?.metadata?.description ||
    `Internet Archive digital preservation directory for ${collectionTitle}`;

  const files: Array<{ name: string; size?: number; format?: string }> = metadataJson?.files || [];

  // Find all .m3u and .m3u8 files in the archive folder
  const m3uFiles = files.filter(
    (f) => f.name && (f.name.toLowerCase().endsWith(".m3u") || f.name.toLowerCase().endsWith(".m3u8"))
  );

  // If no .m3u files found in metadata or it's a specific single M3U requested
  if (m3uFiles.length === 0 && inputUrlOrId.toLowerCase().includes(".m3u")) {
    const singleName = inputUrlOrId.split("/").pop() || "Archive Playlist.m3u";
    m3uFiles.push({
      name: singleName,
      size: 0,
      format: "M3U",
    });
  }

  const discoveredM3Us: ArchiveDiscoveredM3U[] = m3uFiles.map((file) => {
    const cleanTitle = cleanTitleFromFilename(file.name);
    const m3uUrl = `https://archive.org/download/${identifier}/${encodeURIComponent(file.name)}`;
    return {
      name: file.name,
      cleanTitle,
      size: file.size,
      m3uUrl,
      identifier,
      groupTitle: collectionTitle,
      posterUrl,
    };
  });

  // Create lightweight virtual channels for the player list
  const virtualChannels: Episode[] = discoveredM3Us.map((disc, idx) => {
    return {
      id: `arch-${identifier}-${idx}-${disc.name.replace(/[^a-zA-Z0-9]/g, "_").toLowerCase()}`,
      season: 1,
      episode: idx + 1,
      title: disc.cleanTitle,
      duration: 3600,
      url: disc.m3uUrl, // Points to M3U to be lazily unwrapped on click
      status: "valid",
      groupTitle: `${collectionTitle} (Archive)`,
      tvgId: `archive.${identifier}.${idx + 1}`,
      tvgName: disc.cleanTitle,
      tvgLogo: posterUrl,
      sourceHost: "archive.org",
      description: `Virtual Channel: ${disc.cleanTitle}. Contains playlist tracks hosted on archive.org/${identifier}. Clicks unwrap tracks on demand.`,
      contentType: "series",
      allowedPlayers: ["player1", "player2", "all"],
      isLazy: true,
      m3uSourceUrl: disc.m3uUrl,
    };
  });

  return {
    identifier,
    title: collectionTitle,
    description,
    posterUrl,
    discoveredM3Us,
    virtualChannels,
  };
}

// 6. DB Cache Layer for unwrapped M3U JSON tracks
export function getCachedPlaylistJSON(m3uUrl: string): Episode[] | null {
  if (typeof window === "undefined") return null;
  try {
    const key = DB_STORAGE_KEY_PREFIX + encodeURIComponent(m3uUrl);
    const item = localStorage.getItem(key);
    if (!item) return null;
    return JSON.parse(item) as Episode[];
  } catch (e) {
    console.warn("DB Read Error:", e);
    return null;
  }
}

export function saveCachedPlaylistJSON(m3uUrl: string, episodes: Episode[]): void {
  if (typeof window === "undefined") return;
  try {
    const key = DB_STORAGE_KEY_PREFIX + encodeURIComponent(m3uUrl);
    localStorage.setItem(key, JSON.stringify(episodes));

    // Update index manifest
    const manifestRaw = localStorage.getItem(DB_INDEX_KEY);
    const manifest: string[] = manifestRaw ? JSON.parse(manifestRaw) : [];
    if (!manifest.includes(m3uUrl)) {
      manifest.push(m3uUrl);
      localStorage.setItem(DB_INDEX_KEY, JSON.stringify(manifest));
    }
  } catch (e) {
    console.warn("DB Write Error:", e);
  }
}

// 7. On-Demand (Lazy) Unwrapping: Checks DB first, fetches and parses M3U if needed
export async function unwrapM3uOnDemand(channel: Episode): Promise<{
  episodes: Episode[];
  fromCache: boolean;
  activePlayableUrl: string;
}> {
  const m3uUrl = channel.m3uSourceUrl || channel.url;

  // 1. Check DB Cache
  const cached = getCachedPlaylistJSON(m3uUrl);
  if (cached && cached.length > 0) {
    return {
      episodes: cached,
      fromCache: true,
      activePlayableUrl: cached[0].url,
    };
  }

  // 2. Fetch M3U text: Try local server proxy first for reliable CORS bypass
  let rawText = "";
  try {
    const localProxyUrl = `/api/proxy?url=${encodeURIComponent(m3uUrl)}`;
    const res = await fetch(localProxyUrl, { signal: AbortSignal.timeout(9000) });
    if (res.ok) {
      rawText = await res.text();
    }
  } catch {
    // Try direct fetch
    try {
      const res = await fetch(m3uUrl, { signal: AbortSignal.timeout(8000) });
      if (res.ok) {
        rawText = await res.text();
      }
    } catch {
      // Fallback to external CORS proxy
      try {
        const proxyUrl = `https://corsproxy.io/?${encodeURIComponent(m3uUrl)}`;
        const res = await fetch(proxyUrl, { signal: AbortSignal.timeout(8000) });
        if (res.ok) {
          rawText = await res.text();
        }
      } catch (err) {
        console.error("Failed to fetch M3U playlist file:", err);
      }
    }
  }

  if (!rawText.trim()) {
    // If download completely failed, return channel as-is
    return {
      episodes: [channel],
      fromCache: false,
      activePlayableUrl: channel.url,
    };
  }

  // 3. Parse into Episode JSON
  const parsed = parseM3uTextToEpisodes(rawText, channel.groupTitle, channel.tvgLogo || undefined);

  if (parsed.length > 0) {
    // 4. Save in Local DB Cache
    saveCachedPlaylistJSON(m3uUrl, parsed);
    return {
      episodes: parsed,
      fromCache: false,
      activePlayableUrl: parsed[0].url,
    };
  }

  return {
    episodes: [channel],
    fromCache: false,
    activePlayableUrl: channel.url,
  };
}

// 8. Export Full DB to GitHub-Compatible JSON
export function exportAllChannelsDatabaseJSON(): string {
  if (typeof window === "undefined") return "{}";
  const manifestRaw = localStorage.getItem(DB_INDEX_KEY);
  const manifest: string[] = manifestRaw ? JSON.parse(manifestRaw) : [];

  const dbExport: {
    exportedAt: string;
    schemaVersion: string;
    totalCachedPlaylists: number;
    playlists: Record<string, Episode[]>;
  } = {
    exportedAt: new Date().toISOString(),
    schemaVersion: "1.0.0",
    totalCachedPlaylists: manifest.length,
    playlists: {},
  };

  for (const m3uUrl of manifest) {
    const cached = getCachedPlaylistJSON(m3uUrl);
    if (cached) {
      dbExport.playlists[m3uUrl] = cached;
    }
  }

  return JSON.stringify(dbExport, null, 2);
}

// 9. Import Full DB from GitHub raw URL or JSON string
export function importChannelsDatabaseJSON(jsonString: string): number {
  try {
    const data = JSON.parse(jsonString);
    let count = 0;
    if (data.playlists && typeof data.playlists === "object") {
      for (const [m3uUrl, eps] of Object.entries(data.playlists)) {
        if (Array.isArray(eps)) {
          saveCachedPlaylistJSON(m3uUrl, eps as Episode[]);
          count++;
        }
      }
    }
    return count;
  } catch (e) {
    console.error("Invalid database JSON:", e);
    return 0;
  }
}
