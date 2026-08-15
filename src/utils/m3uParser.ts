import { Episode } from "../types";

export interface M3UParseOptions {
  fallbackGroup?: string;
  fallbackPoster?: string;
  channelId?: string;
  channelName?: string;
}

export interface ParsedShowManifest {
  showTitle: string;
  channelId: string;
  totalDurationSec: number;
  episodes: Episode[];
}

/**
 * Step 1: The Parser Utility (utils/m3uParser.ts)
 * 
 * Strict Codebase Protection Rules:
 * 1. Zero Mock Data: Parses exclusively real .m3u production manifests.
 * 2. Preserve Raw URL Encodings: Stream URLs are extracted EXACTLY as written.
 *    No decodeURI/encodeURI manipulation that breaks native Archive.org or CDN links.
 * 3. One File Per Show: Respects 1-file-per-show grouping, keeping all multi-season
 *    and multi-episode data structured under its parent show title.
 */
export function parseM3UContent(rawText: string, options: M3UParseOptions = {}): ParsedShowManifest {
  const {
    fallbackGroup = "General",
    fallbackPoster,
    channelId = "ch-parsed",
    channelName,
  } = options;

  if (!rawText || !rawText.trim()) {
    return {
      showTitle: channelName || "Unknown Show",
      channelId,
      totalDurationSec: 0,
      episodes: [],
    };
  }

  // Normalize line breaks without altering URL encoding
  let normalizedText = rawText;
  if (!normalizedText.includes("\n") && normalizedText.includes("#EXTINF:")) {
    normalizedText = normalizedText
      .replace(/(#EXTINF:)/g, "\n$1")
      .replace(/(https?:\/\/)/g, "\n$1");
  }

  const lines = normalizedText.split(/\r?\n/);
  const episodes: Episode[] = [];

  let parentShowTitle = channelName || "";
  let currentTitle = "";
  let currentGroup = fallbackGroup;
  let currentLogo = fallbackPoster || "";
  let currentDuration = 1800; // default 30 min if missing
  let currentSeason = 1;
  let currentEpisodeNumber = 1;
  let currentTvgId: string | undefined;
  let currentTvgName: string | undefined;

  for (let i = 0; i < lines.length; i++) {
    const rawLine = lines[i];
    const trimmed = rawLine.trim();
    if (!trimmed) continue;

    const upper = trimmed.toUpperCase();

    // Check for Playlist/Show parent title metadata
    if (upper.startsWith("#PLAYLIST:") || upper.startsWith("#EXTM3U")) {
      const playlistMatch = trimmed.match(/#PLAYLIST:\s*(.+)$/i);
      if (playlistMatch && playlistMatch[1]) {
        parentShowTitle = playlistMatch[1].trim();
        currentGroup = parentShowTitle;
      }
      continue;
    }

    if (upper.startsWith("#EXTENC:") || upper.startsWith("#EXT-X-") || upper.startsWith("#EXTVLCOPT:")) {
      continue;
    }

    // Extract #EXTINF metadata: duration, tvg attributes, show title, season/episode
    if (trimmed.startsWith("#EXTINF:")) {
      // 1. Duration regex
      const durationMatch = trimmed.match(/#EXTINF:\s*(-?\d+(?:\.\d+)?)/i);
      if (durationMatch) {
        const parsedDur = parseFloat(durationMatch[1]);
        currentDuration = parsedDur > 0 ? Math.round(parsedDur) : 1800;
      } else {
        currentDuration = 1800;
      }

      // 2. Attributes: tvg-logo, tvg-id, tvg-name, group-title
      const groupMatch = trimmed.match(/group-title="([^"]+)"/i);
      if (groupMatch) currentGroup = groupMatch[1];

      const logoMatch = trimmed.match(/tvg-logo="([^"]+)"/i);
      if (logoMatch) currentLogo = logoMatch[1];

      const tvgIdMatch = trimmed.match(/tvg-id="([^"]+)"/i);
      if (tvgIdMatch) currentTvgId = tvgIdMatch[1];

      const tvgNameMatch = trimmed.match(/tvg-name="([^"]+)"/i);
      if (tvgNameMatch) currentTvgName = tvgNameMatch[1];

      // 3. Extract title & Season/Episode tags after the comma
      const commaIdx = trimmed.indexOf(",");
      if (commaIdx !== -1) {
        const rawTitleString = trimmed.substring(commaIdx + 1).trim();

        // Check for hierarchical path: Show / S01E02 / Episode Title
        if (rawTitleString.includes("/")) {
          const parts = rawTitleString.split("/").map((p) => p.trim());
          if (parts.length >= 3) {
            if (!parentShowTitle) parentShowTitle = parts[0];
            currentGroup = parts[0];
            const epMatch = parts[1].match(/s(?:eason)?-?(\d+)\s*e(?:p|pisode)?-?(\d+)/i);
            if (epMatch) {
              currentSeason = parseInt(epMatch[1], 10) || 1;
              currentEpisodeNumber = parseInt(epMatch[2], 10) || episodes.length + 1;
            }
            currentTitle = parts.slice(2).join(" - ");
          } else if (parts.length === 2) {
            if (!parentShowTitle) parentShowTitle = parts[0];
            currentGroup = parts[0];
            currentTitle = parts[1];
          } else {
            currentTitle = rawTitleString;
          }
        } else {
          currentTitle = rawTitleString;
        }

        // Season/Episode regex parsing on title string
        const seMatch = currentTitle.match(/s(?:eason)?-?(\d+)\s*e(?:p|pisode)?-?(\d+)/i);
        if (seMatch) {
          currentSeason = parseInt(seMatch[1], 10) || currentSeason;
          currentEpisodeNumber = parseInt(seMatch[2], 10) || currentEpisodeNumber;
        } else {
          const epOnlyMatch = currentTitle.match(/ep(?:isode)?\s*(\d+)/i);
          if (epOnlyMatch) {
            currentEpisodeNumber = parseInt(epOnlyMatch[1], 10) || currentEpisodeNumber;
          }
        }
      }
    } else if (
      !trimmed.startsWith("#") &&
      (trimmed.startsWith("http://") || trimmed.startsWith("https://") || trimmed.startsWith("/"))
    ) {
      // PRESERVE RAW URL ENCODINGS: Use raw line directly without decode/encode mutations
      const rawStreamUrl = trimmed;

      // Infer show title if still blank
      if (!parentShowTitle) {
        if (currentGroup && currentGroup !== "General") {
          parentShowTitle = currentGroup;
        } else if (currentTitle) {
          parentShowTitle = currentTitle.split(/[-–—:]/)[0].trim();
        } else {
          parentShowTitle = channelName || "Linear Broadcast";
        }
      }

      let epFinalTitle = currentTitle;
      if (!epFinalTitle) {
        epFinalTitle = `Episode ${currentEpisodeNumber}`;
      }

      // Check Archive item thumbnail fallback
      let finalPoster = currentLogo || fallbackPoster;
      const archiveMatch = rawStreamUrl.match(/archive\.org\/(?:download|details|cors)\/([^/?#]+)/i);
      if (!finalPoster && archiveMatch) {
        finalPoster = `https://archive.org/services/img/${archiveMatch[1]}`;
      }

      const isSeries =
        /s\d+e\d+/i.test(epFinalTitle) ||
        currentSeason > 1 ||
        currentEpisodeNumber > 1 ||
        rawStreamUrl.toLowerCase().includes(".mp4");

      const episodeItem: Episode = {
        id: `${channelId}-ep-${episodes.length + 1}-${Math.random().toString(36).substring(2, 7)}`,
        season: currentSeason,
        episode: currentEpisodeNumber,
        title: epFinalTitle,
        duration: currentDuration,
        url: rawStreamUrl, // EXACT raw URL preserved
        status: "valid",
        groupTitle: currentGroup,
        tvgId: currentTvgId,
        tvgName: currentTvgName,
        tvgLogo: finalPoster,
        thumbnailUrl: finalPoster,
        sourceHost: archiveMatch ? "archive.org" : "direct-stream",
        description: `Season ${currentSeason}, Episode ${currentEpisodeNumber} • ${parentShowTitle}`,
        contentType: isSeries ? "series" : "live",
        allowedPlayers: ["all"],
      };

      episodes.push(episodeItem);

      // Reset episode-specific variables for next entry
      currentTitle = "";
      currentDuration = 1800;
      currentSeason = 1;
      currentEpisodeNumber = episodes.length + 1;
      currentTvgId = undefined;
      currentTvgName = undefined;
    }
  }

  const totalDurationSec = episodes.reduce((acc, ep) => acc + (ep.duration || 1800), 0);

  return {
    showTitle: parentShowTitle || channelName || "Show Collection",
    channelId,
    totalDurationSec,
    episodes,
  };
}

/**
 * Fetch and parse a remote M3U URL with multi-proxy fallback while keeping stream URLs unmodified
 */
export async function fetchAndParseM3U(
  url: string,
  options: M3UParseOptions = {}
): Promise<ParsedShowManifest> {
  let rawText = "";

  // 1. Try local server proxy
  try {
    const res = await fetch(`/api/proxy?url=${encodeURIComponent(url)}`, {
      signal: AbortSignal.timeout(9000),
    });
    if (res.ok) {
      rawText = await res.text();
    }
  } catch {
    // 2. Try direct fetch
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
      if (res.ok) {
        rawText = await res.text();
      }
    } catch {
      // 3. Try CORS proxy fallback
      try {
        const res = await fetch(`https://corsproxy.io/?${encodeURIComponent(url)}`, {
          signal: AbortSignal.timeout(8000),
        });
        if (res.ok) {
          rawText = await res.text();
        }
      } catch (err) {
        console.warn("fetchAndParseM3U network fetch failed:", err);
      }
    }
  }

  return parseM3UContent(rawText, options);
}
