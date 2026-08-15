import { Episode } from "../types";

export interface ArchiveDiscoveredM3U {
  name: string;
  cleanTitle: string;
  size?: number;
  m3uUrl: string;
  identifier: string;
  groupTitle: string;
  posterUrl: string;
  chunkFilename: string; // e.g. "daily-highlights.json", "01-tv-fighting-crime.json"
}

export interface ArchiveFolderScanResult {
  identifier: string;
  title: string;
  description: string;
  posterUrl: string;
  discoveredM3Us: ArchiveDiscoveredM3U[];
  virtualChannels: Episode[];
}

export interface TitleJsonChunk {
  chunkFilename: string;
  title: string;
  identifier: string;
  m3uUrl: string;
  updatedAt: string;
  trackCount: number;
  episodes: Episode[];
}

const DB_CHUNK_PREFIX = "nexus_archive_chunk_";
const DB_STORAGE_KEY_PREFIX = "nexus_archive_m3u_json_";
const DB_INDEX_KEY = "nexus_archive_cached_channels_manifest";
const DB_CHUNKS_INDEX_KEY = "nexus_archive_title_chunks_manifest";

// 1. Slugify helper for modular per-title .json filenames (e.g. "daily-highlights.json", "01-tv-fighting-crime.json")
export function slugifyTitle(title: string, fallbackId: string = "channel"): string {
  if (!title) return `${fallbackId}.json`;
  const clean = title
    .toLowerCase()
    .replace(/\.m3u8?$/i, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return `${clean || fallbackId}.json`;
}

// 2. Cleanly extract Archive identifier from URL or input string
export function parseArchiveIdentifier(input: string): string {
  const trimmed = input.trim();
  // Match archive.org/download/{id} or archive.org/details/{id} or archive.org/metadata/{id}
  const match = trimmed.match(/archive\.org\/(?:download|details|metadata|embed|cors)\/([^/?#]+)/i);
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

// 3. Format a clean human-readable title from a filename
export function cleanTitleFromFilename(filename: string): string {
  let decoded = filename;
  try {
    decoded = decodeURIComponent(filename);
  } catch {
    // Keep decoded as is
  }
  return decoded
    .replace(/\.m3u8?$/i, "")
    .replace(/\.(mp4|ogv|ia\.mp4|mkv|webm|ts)$/i, "")
    .replace(/^[\d_-]+\s*/, "") // Strip leading numbers if desired
    .replace(/[_]/g, " ")
    .trim() || filename;
}

// 4. Archive.org Direct File Normalization
// Strict Permalink Routing: routes all Archive.org media directly to https://archive.org/download/IDENTIFIER/FILE
// Zero-Alteration Encoding: preserves exact raw FILE string without decodeURI or re-encoding.
export function normalizeStreamUrl(url: string, _preferCorsEndpoint: boolean = false): string {
  if (!url) return "";
  const trimmed = url.trim();

  // Pattern 1: standard archive.org/(download|details|embed|cors|metadata)/IDENTIFIER/FILE...
  const stdMatch = trimmed.match(/^https?:\/\/(?:www\.)?archive\.org\/(?:download|details|embed|cors|metadata)\/([^/?#]+)\/(.+)$/i);
  if (stdMatch) {
    const identifier = stdMatch[1];
    const rawFilePath = stdMatch[2]; // Preserved verbatim
    return `https://archive.org/download/${identifier}/${rawFilePath}`;
  }

  // Pattern 2: archive cluster direct items e.g. ia800...us.archive.org/(\d+/)?items/IDENTIFIER/FILE...
  const clusterMatch = trimmed.match(/^https?:\/\/[a-z0-9_.-]*archive\.org\/(?:\d+\/)?items\/([^/?#]+)\/(.+)$/i);
  if (clusterMatch) {
    const identifier = clusterMatch[1];
    const rawFilePath = clusterMatch[2];
    return `https://archive.org/download/${identifier}/${rawFilePath}`;
  }

  // Pattern 3: item root link
  const itemMatch = trimmed.match(/^https?:\/\/(?:www\.)?archive\.org\/(?:download|details|embed|cors|metadata)\/([^/?#]+)(?:\/)?$/i);
  if (itemMatch) {
    return `https://archive.org/download/${itemMatch[1]}`;
  }

  return trimmed;
}

// 5. CORS Proxy URL generator for static GitHub Pages / strict CORS boundaries
export function getCorsProxyUrls(originalUrl: string): string[] {
  if (!originalUrl) return [];
  const normalized = normalizeStreamUrl(originalUrl, false);
  const encoded = encodeURIComponent(normalized);
  return [
    `/api/proxy?url=${encoded}`, // Local fullstack backend proxy (first priority if available)
    `https://corsproxy.io/?${encoded}`, // Automated public CORS proxy fallback
    `https://api.allorigins.win/raw?url=${encoded}`, // Secondary CORS proxy watchdog
    normalized, // Direct stream as final candidate
  ];
}

// 6. Parse Raw M3U Content into Structured Episode Track JSON
export function parseM3uTextToEpisodes(
  rawText: string,
  fallbackGroup: string = "Archive Collection",
  fallbackPoster?: string
): Episode[] {
  if (!rawText) return [];

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
      const archiveItemMatch = trimmed.match(/archive\.org\/(?:download|details|cors)\/([^/?#]+)/i);
      const archiveItemId = archiveItemMatch ? archiveItemMatch[1] : null;

      // Extract filename for fallback title
      const urlFileName = trimmed.split("/").pop() || "";
      let decodedFilename = "";
      try {
        decodedFilename = decodeURIComponent(urlFileName)
          .replace(/\.(mp4|ogv|ia\.mp4|mkv|avi|webm|ts|m3u8?)$/i, "")
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

      // Normalize direct media links (resolving /details/ to raw stream URLs)
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
          ? `Internet Archive direct media stream [Item: ${archiveItemId || "media"}]`
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

// 7. Scan Archive.org Item/Folder for all .m3u files with modular JSON DB chunk names
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
      // Fallback to CORS proxy watchdog
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
    const chunkFilename = slugifyTitle(cleanTitle, identifier);
    return {
      name: file.name,
      cleanTitle,
      size: file.size,
      m3uUrl,
      identifier,
      groupTitle: collectionTitle,
      posterUrl,
      chunkFilename,
    };
  });

  // Create lightweight virtual channels with modular JSON DB references
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
      description: `Virtual Channel: ${disc.cleanTitle}. Modular DB chunk: ${disc.chunkFilename}. On-demand preloading enabled.`,
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

// 8. Modular Per-Title JSON Database Chunking & Storage Engine
export function getCachedPlaylistJSON(m3uUrlOrChunkName: string): Episode[] | null {
  if (typeof window === "undefined") return null;
  try {
    // 1. Try URL key
    const urlKey = DB_STORAGE_KEY_PREFIX + encodeURIComponent(m3uUrlOrChunkName);
    const item = localStorage.getItem(urlKey);
    if (item) return JSON.parse(item) as Episode[];

    // 2. Try Chunk key
    const chunkKey = DB_CHUNK_PREFIX + encodeURIComponent(m3uUrlOrChunkName);
    const chunkItem = localStorage.getItem(chunkKey);
    if (chunkItem) {
      const parsedChunk = JSON.parse(chunkItem) as TitleJsonChunk;
      return parsedChunk.episodes;
    }
  } catch (e) {
    console.warn("DB Read Error:", e);
  }
  return null;
}

export function saveCachedPlaylistJSON(
  m3uUrl: string,
  episodes: Episode[],
  title?: string,
  identifier?: string
): void {
  if (typeof window === "undefined") return;
  try {
    const chunkFilename = slugifyTitle(title || "playlist", identifier || "archive");

    // 1. Save standard URL key
    const urlKey = DB_STORAGE_KEY_PREFIX + encodeURIComponent(m3uUrl);
    localStorage.setItem(urlKey, JSON.stringify(episodes));

    // 2. Save modular Per-Title .json DB Chunk
    const chunkKey = DB_CHUNK_PREFIX + encodeURIComponent(chunkFilename);
    const chunkData: TitleJsonChunk = {
      chunkFilename,
      title: title || cleanTitleFromFilename(m3uUrl),
      identifier: identifier || parseArchiveIdentifier(m3uUrl),
      m3uUrl,
      updatedAt: new Date().toISOString(),
      trackCount: episodes.length,
      episodes,
    };
    localStorage.setItem(chunkKey, JSON.stringify(chunkData));

    // 3. Update master index manifests
    const manifestRaw = localStorage.getItem(DB_INDEX_KEY);
    const manifest: string[] = manifestRaw ? JSON.parse(manifestRaw) : [];
    if (!manifest.includes(m3uUrl)) {
      manifest.push(m3uUrl);
      localStorage.setItem(DB_INDEX_KEY, JSON.stringify(manifest));
    }

    const chunkManifestRaw = localStorage.getItem(DB_CHUNKS_INDEX_KEY);
    const chunkManifest: string[] = chunkManifestRaw ? JSON.parse(chunkManifestRaw) : [];
    if (!chunkManifest.includes(chunkFilename)) {
      chunkManifest.push(chunkFilename);
      localStorage.setItem(DB_CHUNKS_INDEX_KEY, JSON.stringify(chunkManifest));
    }
  } catch (e) {
    console.warn("DB Write Error:", e);
  }
}

// 9. On-Demand (Lazy) Unwrapping: Checks DB chunk first, fetches and parses M3U if needed
export async function unwrapM3uOnDemand(channel: Episode): Promise<{
  episodes: Episode[];
  fromCache: boolean;
  activePlayableUrl: string;
  chunkFilename: string;
}> {
  const m3uUrl = channel.m3uSourceUrl || channel.url;
  const chunkFilename = slugifyTitle(channel.title, channel.id);

  // 1. Check DB Cache Chunk
  const cached = getCachedPlaylistJSON(m3uUrl);
  if (cached && cached.length > 0) {
    return {
      episodes: cached,
      fromCache: true,
      activePlayableUrl: cached[0].url,
      chunkFilename,
    };
  }

  // 2. Fetch M3U text using multi-tier proxy fallback (Local Server -> Direct -> CORS Proxy Watchdog)
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
      // Fallback to external CORS proxy watchdog
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
      chunkFilename,
    };
  }

  // 3. Parse into Episode JSON
  const parsed = parseM3uTextToEpisodes(rawText, channel.groupTitle, channel.tvgLogo || undefined);

  if (parsed.length > 0) {
    // 4. Save in Local DB as modular title-specific JSON chunk
    saveCachedPlaylistJSON(m3uUrl, parsed, channel.title, channel.id);
    return {
      episodes: parsed,
      fromCache: false,
      activePlayableUrl: parsed[0].url,
      chunkFilename,
    };
  }

  return {
    episodes: [channel],
    fromCache: false,
    activePlayableUrl: channel.url,
    chunkFilename,
  };
}

// 10. Background On-Demand Preloader for adjacent title JSON chunks
export function preloadAdjacentTitleChunks(currentIdx: number, allChannels: Episode[]): void {
  if (!allChannels || allChannels.length === 0) return;
  const adjacentIndices = [currentIdx + 1, currentIdx + 2, currentIdx - 1].filter(
    (i) => i >= 0 && i < allChannels.length
  );

  adjacentIndices.forEach((idx) => {
    const ep = allChannels[idx];
    if (ep && ep.isLazy && (ep.m3uSourceUrl || ep.url)) {
      const m3uUrl = ep.m3uSourceUrl || ep.url;
      const cached = getCachedPlaylistJSON(m3uUrl);
      if (!cached) {
        // Preload in background
        unwrapM3uOnDemand(ep).catch(() => {});
      }
    }
  });
}

// 11. Export Full DB or Modular Title JSON chunks
export function exportAllChannelsDatabaseJSON(): string {
  if (typeof window === "undefined") return "{}";
  const manifestRaw = localStorage.getItem(DB_INDEX_KEY);
  const manifest: string[] = manifestRaw ? JSON.parse(manifestRaw) : [];

  const chunkManifestRaw = localStorage.getItem(DB_CHUNKS_INDEX_KEY);
  const chunkManifest: string[] = chunkManifestRaw ? JSON.parse(chunkManifestRaw) : [];

  const dbExport: {
    exportedAt: string;
    schemaVersion: string;
    totalCachedPlaylists: number;
    chunkFiles: string[];
    playlists: Record<string, Episode[]>;
  } = {
    exportedAt: new Date().toISOString(),
    schemaVersion: "2.0.0",
    totalCachedPlaylists: manifest.length,
    chunkFiles: chunkManifest,
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

// 12. Import Full DB from GitHub raw URL or JSON string
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
