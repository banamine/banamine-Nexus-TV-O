import express from "express";
import path from "path";
import crypto from "crypto";
import { createServer as createViteServer } from "vite";

const app = express();
const PORT = 3000;

app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: true, limit: "50mb" }));

// In-Memory Storage Engine for default state & server execution
interface ServerEpisode {
  id: string;
  season: number;
  episode: number;
  title: string;
  duration: number;
  url: string;
  resolvedUrl?: string;
  status: "valid" | "warning" | "invalid" | "pending";
  groupTitle: string;
  tvgId?: string;
  tvgName?: string;
  tvgLogo?: string;
  sourceHost?: string;
  description?: string;
  contentType?: "news" | "movie" | "series" | "live" | "bumper";
  allowedPlayers?: ("player1" | "player2" | "all")[];
}

let episodesStore: ServerEpisode[] = [
  {
    id: "ch-101",
    season: 1,
    episode: 1,
    title: "News 24 Global Morning - World Financial & Geopolitical Digest",
    duration: 3600,
    url: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4",
    status: "valid",
    groupTitle: "News",
    tvgId: "news24.global",
    tvgName: "News 24 Global",
    tvgLogo: "https://images.unsplash.com/photo-1585829365295-ab7cd400c167?w=150&h=150&fit=crop",
    sourceHost: "live.news24.network",
    contentType: "news",
    allowedPlayers: ["player1", "all"],
  },
  {
    id: "ch-102",
    season: 1,
    episode: 2,
    title: "Sports Network HD - Premier European Football Live Matchday",
    duration: 5400,
    url: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4",
    status: "valid",
    groupTitle: "Sports",
    tvgId: "sports.net.hd",
    tvgName: "Sports Network HD",
    tvgLogo: "https://images.unsplash.com/photo-1508098682722-e99c43a406b2?w=150&h=150&fit=crop",
    sourceHost: "stream.sportsnet.com",
    contentType: "live",
    allowedPlayers: ["player2", "all"],
  },
  {
    id: "ch-103",
    season: 1,
    episode: 3,
    title: "Cinema Stream 4K - Sci-Fi Feature Presentation: Nebula Horizon",
    duration: 7200,
    url: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4",
    status: "valid",
    groupTitle: "Movies",
    tvgId: "cinema.stream.4k",
    tvgName: "Cinema Stream 4K",
    tvgLogo: "https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?w=150&h=150&fit=crop",
    sourceHost: "vod.cinemastream.tv",
    contentType: "movie",
    allowedPlayers: ["all"],
  },
];

// --- Watchdog Circuit Breaker Engine ---
let watchdogState = {
  circuitEngaged: false,
  activeFallbackUrl: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/TearsOfSteel.mp4",
  droppedStreamsCount: 0,
  statusMessage: "Watchdog Engine Nominal. Monitoring 24/7 stream feeds.",
  lastFailoverAt: undefined as string | undefined,
  healthScore: 98,
};

// --- ThirdEye Signal Processing Service ---
export type RejectionReason = "THRESHOLD" | "BLACKLIST" | "ALERT_MODE" | "DUPLICATE";

export interface RejectionEntry {
  title: string;
  reason: RejectionReason;
  score?: number;
  rejectedAt: string;
}

const thirdEyeState = {
  currentMode: "filtered" as "filtered" | "all",
  garbleThreshold: 65,
  blacklist: ["SPAM", "CLICKBAIT", "VIRUS"],
  alertMode: false,
  rejectionBuffer: [] as RejectionEntry[],
  whitelist: ["BREAKING", "URGENT", "ALERT", "FLASH", "UPDATE"],
  stats: {
    inserted: 142,
    skipped: 18,
    received: 180,
    parseFailed: 2,
    garbleRejected: 18,
  },
};

function alphanumericRatio(text: string): number {
  if (!text || text.length === 0) return 0;
  const alphanumCount = (text.match(/[a-z0-9\s\:\!\?\-\.]/gi) || []).length;
  return alphanumCount / text.length;
}

function processThirdEyeSignal(rawText: string): { accepted: boolean; reason?: RejectionReason; score?: number } {
  // (1) Blacklist check
  if (thirdEyeState.blacklist.length > 0) {
    const lower = rawText.toLowerCase();
    const blocked = thirdEyeState.blacklist.some(kw => kw && lower.includes(kw.toLowerCase()));
    if (blocked) return { accepted: false, reason: "BLACKLIST" };
  }

  // (2) Alert-mode check
  if (thirdEyeState.alertMode) {
    const upper = rawText.toUpperCase();
    const passes = thirdEyeState.whitelist.some(kw => upper.includes(kw));
    if (!passes) return { accepted: false, reason: "ALERT_MODE" };
  }

  // (3) Whitelist prefix check
  const words = rawText.trim().toUpperCase().split(/\s+/);
  const firstWord = (words[0] || "").replace(/[^A-Z0-9]+$/, "");
  const whitelistBypass = thirdEyeState.whitelist.some(kw => firstWord === kw);
  if (whitelistBypass) return { accepted: true };

  // (4) Garble score check
  const ratio = alphanumericRatio(rawText);
  const score = Math.round(ratio * 100);
  if (score < thirdEyeState.garbleThreshold) {
    return { accepted: false, reason: "THRESHOLD", score };
  }

  return { accepted: true };
}

// --- API ROUTES ---

app.get("/api/health", (_req, res) => {
  res.json({
    status: "ok",
    serverTime: new Date().toISOString(),
    watchdog: watchdogState,
  });
});

// EPISODES CRUD
app.get("/api/episodes", (req, res) => {
  const { group, search, contentType } = req.query;
  let result = [...episodesStore];

  if (group && group !== "All") {
    result = result.filter(e => e.groupTitle.toLowerCase() === String(group).toLowerCase());
  }

  if (search) {
    const q = String(search).toLowerCase();
    result = result.filter(e => e.title.toLowerCase().includes(q) || e.url.toLowerCase().includes(q));
  }

  if (contentType) {
    result = result.filter(e => e.contentType === contentType);
  }

  res.json({ episodes: result, total: result.length });
});

app.post("/api/episodes", (req, res) => {
  const newEp: ServerEpisode = {
    id: "ep-" + crypto.randomUUID().slice(0, 8),
    season: req.body.season || 1,
    episode: req.body.episode || 1,
    title: req.body.title || "Untitled Channel",
    duration: req.body.duration || 3600,
    url: req.body.url || "",
    status: req.body.status || "valid",
    groupTitle: req.body.groupTitle || "General",
    tvgId: req.body.tvgId,
    tvgName: req.body.tvgName,
    tvgLogo: req.body.tvgLogo,
    sourceHost: req.body.sourceHost,
    contentType: req.body.duration <= 300 ? "news" : req.body.contentType || "live",
    allowedPlayers: req.body.allowedPlayers || ["all"],
  };

  episodesStore.unshift(newEp);
  res.json({ success: true, episode: newEp });
});

app.patch("/api/episodes/:id", (req, res) => {
  const idx = episodesStore.findIndex(e => e.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: "Episode not found" });

  episodesStore[idx] = { ...episodesStore[idx], ...req.body };
  res.json({ success: true, episode: episodesStore[idx] });
});

app.delete("/api/episodes/:id", (req, res) => {
  episodesStore = episodesStore.filter(e => e.id !== req.params.id);
  res.json({ success: true, id: req.params.id });
});

app.post("/api/episodes/bulk-delete", (req, res) => {
  const ids: string[] = req.body.ids || [];
  episodesStore = episodesStore.filter(e => !ids.includes(e.id));
  res.json({ success: true, deletedCount: ids.length });
});

app.patch("/api/episodes/bulk-group", (req, res) => {
  const { ids, groupTitle } = req.body;
  if (!ids || !groupTitle) return res.status(400).json({ error: "Missing parameters" });

  episodesStore = episodesStore.map(e => (ids.includes(e.id) ? { ...e, groupTitle } : e));
  res.json({ success: true, updatedCount: ids.length });
});

app.post("/api/episodes/batch-renumber", (req, res) => {
  const { strategy, startNum, groupTitle } = req.body;
  let targetEps = episodesStore;
  if (groupTitle && groupTitle !== "All") {
    targetEps = episodesStore.filter(e => e.groupTitle === groupTitle);
  }

  let count = Number(startNum) || 1;
  targetEps.forEach(e => {
    e.episode = count++;
  });

  res.json({ success: true, renumberedCount: targetEps.length });
});

app.post("/api/episodes/auto-tag", (_req, res) => {
  let taggedCount = 0;
  episodesStore.forEach(e => {
    if (e.duration <= 300) {
      e.contentType = "news";
      taggedCount++;
    } else if (/movie|cinema|film|4k|uhd/i.test(e.title + e.groupTitle)) {
      e.contentType = "movie";
      taggedCount++;
    } else if (/series|season|s\d+e\d+/i.test(e.title + e.groupTitle)) {
      e.contentType = "series";
      taggedCount++;
    }
  });

  res.json({ success: true, taggedCount });
});

// --- CORS PROXY FOR MULTI-SCREEN & HLS ---
app.get("/api/proxy", async (req, res) => {
  const targetUrl = req.query.url as string;
  if (!targetUrl) return res.status(400).send("Missing url parameter");

  try {
    const response = await fetch(targetUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) IPTV Smarters Pro Matrix Agent",
      },
    });

    if (!response.ok) {
      return res.status(response.status).send(`Upstream returned ${response.status}`);
    }

    const contentType = response.headers.get("content-type") || "video/mp4";
    res.setHeader("Content-Type", contentType);
    res.setHeader("Access-Control-Allow-Origin", "*");

    const arrayBuffer = await response.arrayBuffer();
    res.send(Buffer.from(arrayBuffer));
  } catch (err: any) {
    console.error("[Proxy Error]:", err.message);
    res.status(500).send("Proxy fetch failed: " + err.message);
  }
});

// --- WATCHDOG FALLBACK CONTROLLER ---
app.get("/api/watchdog/status", (_req, res) => {
  res.json(watchdogState);
});

app.post("/api/watchdog/trigger-failover", (req, res) => {
  watchdogState.droppedStreamsCount++;
  watchdogState.circuitEngaged = true;
  watchdogState.lastFailoverAt = new Date().toISOString();
  watchdogState.statusMessage = `Engaging Fallback Stream... Swapped manifest automatically at ${new Date().toLocaleTimeString()}`;

  res.json({ success: true, watchdog: watchdogState });
});

app.post("/api/watchdog/reset", (_req, res) => {
  watchdogState.circuitEngaged = false;
  watchdogState.statusMessage = "Watchdog Engine Reset to Nominal State.";
  res.json({ success: true, watchdog: watchdogState });
});

// --- THIRDEYE SERVICE API ---
app.get("/api/thirdeye/status", (_req, res) => {
  res.json(thirdEyeState);
});

app.post("/api/thirdeye/process", (req, res) => {
  const { title } = req.body;
  if (!title) return res.status(400).json({ error: "Missing title parameter" });

  const result = processThirdEyeSignal(title);

  if (!result.accepted && result.reason) {
    thirdEyeState.rejectionBuffer.unshift({
      title,
      reason: result.reason,
      score: result.score,
      rejectedAt: new Date().toISOString(),
    });
    if (thirdEyeState.rejectionBuffer.length > 10) {
      thirdEyeState.rejectionBuffer = thirdEyeState.rejectionBuffer.slice(0, 10);
    }
  }

  res.json(result);
});

app.post("/api/thirdeye/config", (req, res) => {
  if (req.body.garbleThreshold !== undefined) thirdEyeState.garbleThreshold = Number(req.body.garbleThreshold);
  if (req.body.currentMode !== undefined) thirdEyeState.currentMode = req.body.currentMode;
  if (req.body.alertMode !== undefined) thirdEyeState.alertMode = Boolean(req.body.alertMode);
  if (req.body.blacklist !== undefined) thirdEyeState.blacklist = req.body.blacklist;

  res.json({ success: true, config: thirdEyeState });
});

// --- M3U / XTREAM CODES PARSER & EXPORT ---
app.post("/api/m3u/parse", (req, res) => {
  const { content } = req.body;
  if (!content) return res.status(400).json({ error: "Missing content string" });

  const lines = content.split(/\r?\n/);
  const parsedEpisodes: Partial<ServerEpisode>[] = [];

  let currentTitle = "";
  let currentGroup = "Imported";
  let currentLogo = "";
  let currentDuration = 3600;

  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith("#EXTINF:")) {
      const durationMatch = trimmed.match(/#EXTINF:(-?\d+)/);
      if (durationMatch) currentDuration = Math.max(1, parseInt(durationMatch[1], 10));

      const groupMatch = trimmed.match(/group-title="([^"]+)"/i);
      if (groupMatch) currentGroup = groupMatch[1];

      const logoMatch = trimmed.match(/tvg-logo="([^"]+)"/i);
      if (logoMatch) currentLogo = logoMatch[1];

      const commaIdx = trimmed.indexOf(",");
      if (commaIdx !== -1) currentTitle = trimmed.substring(commaIdx + 1).trim();
    } else if (trimmed.length > 0 && !trimmed.startsWith("#")) {
      parsedEpisodes.push({
        id: "m3u-" + crypto.randomUUID().slice(0, 8),
        title: currentTitle || "Imported Stream",
        groupTitle: currentGroup,
        tvgLogo: currentLogo,
        duration: currentDuration,
        url: trimmed,
        status: "valid",
        contentType: currentDuration <= 300 ? "news" : "live",
      });
      currentTitle = "";
    }
  }

  res.json({ success: true, count: parsedEpisodes.length, items: parsedEpisodes });
});

app.post("/api/xtream/login", (req, res) => {
  const { serverUrl, username, password } = req.body;
  if (!serverUrl || !username || !password) {
    return res.status(400).json({ error: "Server URL, username, and password required" });
  }

  res.json({
    user_info: {
      username,
      status: "Active",
      exp_date: "1798761600",
      is_trial: "0",
      active_cons: "1",
      max_connections: "4",
    },
    categories: {
      live: [
        { category_id: "1", category_name: "News Channels" },
        { category_id: "2", category_name: "Sports Network" },
        { category_id: "3", category_name: "4K Movies Cinema" },
      ],
      vod: [
        { category_id: "10", category_name: "Action Blockbusters" },
        { category_id: "11", category_name: "Sci-Fi Classics" },
      ],
      series: [
        { category_id: "20", category_name: "Top Rated Series" },
      ]
    }
  });
});

app.get("/api/export/xmltv", (_req, res) => {
  let xml = `<?xml version="1.0" encoding="UTF-8"?>\n<tv generator-info-name="M3U StripTool Smarters Engine">\n`;

  episodesStore.forEach(e => {
    xml += `  <channel id="${e.tvgId || e.id}">\n`;
    xml += `    <display-name>${e.title.replace(/&/g, "&amp;")}</display-name>\n`;
    if (e.tvgLogo) xml += `    <icon src="${e.tvgLogo}"/>\n`;
    xml += `  </channel>\n`;
  });

  const now = new Date();
  const startStr = now.toISOString().replace(/[-:]/g, "").slice(0, 14) + " +0000";
  const end = new Date(now.getTime() + 7200000);
  const endStr = end.toISOString().replace(/[-:]/g, "").slice(0, 14) + " +0000";

  episodesStore.forEach(e => {
    xml += `  <programme start="${startStr}" stop="${endStr}" channel="${e.tvgId || e.id}">\n`;
    xml += `    <title lang="en">${e.title.replace(/&/g, "&amp;")}</title>\n`;
    xml += `    <desc lang="en">${(e.description || "Continuous broadcast").replace(/&/g, "&amp;")}</desc>\n`;
    xml += `    <category lang="en">${e.groupTitle}</category>\n`;
    xml += `  </programme>\n`;
  });

  xml += `</tv>`;

  res.setHeader("Content-Type", "application/xml");
  res.send(xml);
});

// --- VITE MIDDLEWARE SETUP ---
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (_req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`[M3U Matrix Stripper] Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
