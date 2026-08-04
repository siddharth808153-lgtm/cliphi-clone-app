const router = require("express").Router();
const { google } = require("googleapis");
const { loadTokens } = require("../services/tokenStore");
const {
  getTrendingTopics,
  saveTrendingTopics,
} = require("../services/analyticsStore");

/* ------------------------------------------------------------------ */
/*  TRENDING TOPICS DISCOVERY ENGINE                                   */
/*  Uses YouTube Data API v3 to fetch currently trending videos,       */
/*  extracts viral topics, and ranks them by engagement potential.      */
/* ------------------------------------------------------------------ */

function getOAuthClient() {
  return new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI
  );
}

/* ---------- Niche category mapping for scoring ---------- */
const NICHE_KEYWORDS = {
  "Finance & Wealth": ["money", "invest", "stock", "crypto", "bitcoin", "wealth", "rich", "millionaire", "budget", "save", "finance", "trading", "hustle", "income", "passive"],
  "AI & Technology": ["ai", "chatgpt", "artificial intelligence", "tech", "robot", "future", "gadget", "apple", "openai", "gemini", "coding", "software", "app"],
  "Space & Science": ["space", "nasa", "planet", "universe", "black hole", "physics", "quantum", "mars", "galaxy", "star", "astronomy", "cosmos"],
  "Motivation": ["motivation", "success", "mindset", "discipline", "grind", "goal", "dream", "hustle", "stoic", "confidence", "self improvement"],
  "Dark History": ["history", "ancient", "mystery", "secret", "war", "empire", "king", "queen", "civilization", "conspiracy", "dark"],
  "Facts & Curiosity": ["fact", "mind blowing", "amazing", "did you know", "unbelievable", "impossible", "crazy", "secret", "truth", "shocking"],
  "Animals & Nature": ["animal", "cat", "dog", "monkey", "nature", "wildlife", "ocean", "shark", "lion", "bear"],
  "Entertainment": ["funny", "comedy", "prank", "reaction", "meme", "trend", "challenge", "viral", "tiktok"],
};

function detectNiche(text) {
  const lower = (text || "").toLowerCase();
  let bestNiche = "General";
  let bestScore = 0;
  for (const [niche, keywords] of Object.entries(NICHE_KEYWORDS)) {
    let score = 0;
    for (const kw of keywords) {
      if (lower.includes(kw)) score++;
    }
    if (score > bestScore) {
      bestScore = score;
      bestNiche = niche;
    }
  }
  return bestNiche;
}

function computeViralScore(video) {
  const views = parseInt(video.statistics?.viewCount || 0);
  const likes = parseInt(video.statistics?.likeCount || 0);
  const comments = parseInt(video.statistics?.commentCount || 0);
  const publishedAt = new Date(video.snippet?.publishedAt || Date.now());
  const ageHours = Math.max(1, (Date.now() - publishedAt.getTime()) / (1000 * 60 * 60));

  // Viral velocity: views per hour (recent = higher score)
  const velocity = views / ageHours;

  // Engagement rate: (likes + comments) / views
  const engagement = views > 0 ? (likes + comments) / views : 0;

  // Weighted score on a 0-100 scale
  const velocityScore = Math.min(40, Math.log10(velocity + 1) * 8);
  const viewScore = Math.min(30, Math.log10(views + 1) * 5);
  const engagementScore = Math.min(30, engagement * 300);

  return Math.round(velocityScore + viewScore + engagementScore);
}

/* ---------- GET /api/trending/list ---------- */
router.get("/list", async (req, res) => {
  const { region = "US", category = "0", maxResults = "20", forceRefresh = "false" } = req.query;

  // Return cached data if available and less than 30 minutes old
  if (forceRefresh !== "true") {
    const cached = getTrendingTopics();
    if (cached.lastUpdated) {
      const age = Date.now() - new Date(cached.lastUpdated).getTime();
      if (age < 30 * 60 * 1000 && cached.topics.length > 0) {
        return res.json({
          topics: cached.topics,
          lastUpdated: cached.lastUpdated,
          source: "cache",
        });
      }
    }
  }

  // Try YouTube Data API first, fall back to curated trending topics
  const tokens = loadTokens();
  let topics = [];

  if (tokens && process.env.GOOGLE_CLIENT_ID) {
    try {
      const oauth2Client = getOAuthClient();
      oauth2Client.setCredentials(tokens);
      const youtube = google.youtube({ version: "v3", auth: oauth2Client });

      const trendingRes = await youtube.videos.list({
        part: ["snippet", "statistics", "contentDetails"],
        chart: "mostPopular",
        regionCode: region,
        videoCategoryId: category !== "0" ? category : undefined,
        maxResults: parseInt(maxResults),
      });

      const items = trendingRes.data.items || [];

      topics = items.map((video, index) => {
        const snippet = video.snippet || {};
        const stats = video.statistics || {};
        const viralScore = computeViralScore(video);
        const niche = detectNiche(`${snippet.title} ${snippet.description}`);

        return {
          id: video.id,
          rank: index + 1,
          title: snippet.title,
          channelTitle: snippet.channelTitle,
          thumbnail: snippet.thumbnails?.high?.url || snippet.thumbnails?.default?.url,
          publishedAt: snippet.publishedAt,
          views: parseInt(stats.viewCount || 0),
          likes: parseInt(stats.likeCount || 0),
          comments: parseInt(stats.commentCount || 0),
          viralScore,
          niche,
          categoryId: snippet.categoryId,
          description: (snippet.description || "").slice(0, 300),
          tags: (snippet.tags || []).slice(0, 10),
          suggestedTopic: generateTopicFromTitle(snippet.title),
          source: "youtube_api",
        };
      });
    } catch (err) {
      console.warn("[trending] YouTube API failed, using fallback:", err.message);
    }
  }

  // Fallback: curated trending topics based on current viral patterns
  if (topics.length === 0) {
    topics = generateFallbackTrends();
  }

  // Sort by viral score descending
  topics.sort((a, b) => b.viralScore - a.viralScore);

  // Cache results
  saveTrendingTopics(topics);

  res.json({
    topics,
    lastUpdated: new Date().toISOString(),
    source: topics[0]?.source || "fallback",
  });
});

/* ---------- POST /api/trending/generate-from-trend ---------- */
router.post("/generate-from-trend", (req, res) => {
  const { topic, niche, voice } = req.body;

  if (!topic) {
    return res.status(400).json({ error: "topic is required" });
  }

  // Generate the faceless short via SSE streaming
  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
    "X-Accel-Buffering": "no",
  });
  res.flushHeaders();
  res.write(":heartbeat\n\n");

  const { runFacelessPipeline } = require("../services/shortGptRunner");
  let clientDisconnected = false;

  function sendEvent(eventName, data) {
    if (!clientDisconnected && !res.writableEnded) {
      res.write(`event: ${eventName}\ndata: ${JSON.stringify(data)}\n\n`);
    }
  }

  function onProgress(line) {
    const STEP_MAP = [
      { pattern: /\[script\]/, step: "script", label: "Writing AI script from trend" },
      { pattern: /\[tts\]/, step: "tts", label: "Synthesizing voiceover" },
      { pattern: /\[render\]/, step: "render", label: "Rendering 9:16 vertical Short" },
      { pattern: /\[done\]/, step: "done", label: "Short completed" },
    ];
    for (const { pattern, step, label } of STEP_MAP) {
      if (pattern.test(line)) {
        sendEvent("step", { step, label, detail: line.replace(/\[.*?\]\s*/, "") });
        break;
      }
    }
    sendEvent("log", { text: line.trim() });
  }

  const mappedNiche = niche || "Facts";
  const mappedVoice = voice || "en-US-ChristopherNeural";

  const runnerPromise = runFacelessPipeline(
    { topic, niche: mappedNiche, voice: mappedVoice },
    onProgress
  );

  runnerPromise
    .then((result) => {
      sendEvent("complete", result);
      setTimeout(() => {
        if (!res.writableEnded) res.end();
      }, 500);
    })
    .catch((err) => {
      sendEvent("error", { error: err.message || "Trend video generation failed" });
      setTimeout(() => {
        if (!res.writableEnded) res.end();
      }, 500);
    });

  req.on("close", () => {
    clientDisconnected = true;
  });
});

/* ---------- GET /api/trending/categories ---------- */
router.get("/categories", (req, res) => {
  res.json({
    categories: [
      { id: "0", label: "All Categories" },
      { id: "1", label: "Film & Animation" },
      { id: "2", label: "Autos & Vehicles" },
      { id: "10", label: "Music" },
      { id: "15", label: "Pets & Animals" },
      { id: "17", label: "Sports" },
      { id: "20", label: "Gaming" },
      { id: "22", label: "People & Blogs" },
      { id: "23", label: "Comedy" },
      { id: "24", label: "Entertainment" },
      { id: "25", label: "News & Politics" },
      { id: "26", label: "How-To & Style" },
      { id: "27", label: "Education" },
      { id: "28", label: "Science & Technology" },
    ],
  });
});

/* ---------- Helper: Extract short topic from a trending video title ---------- */
function generateTopicFromTitle(title) {
  // Strip bracketed content, channel names, emojis at start/end
  let clean = title
    .replace(/\[.*?\]/g, "")
    .replace(/\(.*?\)/g, "")
    .replace(/[\u{1F300}-\u{1FAFF}]/gu, "")
    .replace(/[|—–-]\s*\S+$/g, "")
    .trim();

  // Truncate to reasonable topic length
  if (clean.length > 80) {
    clean = clean.slice(0, 80).replace(/\s\S*$/, "...");
  }

  return clean || title.slice(0, 60);
}

/* ---------- Fallback trending topics when no API is available ---------- */
function generateFallbackTrends() {
  const now = new Date();
  const fallbackTopics = [
    { title: "AI Just Changed Everything — 5 Tools You MUST Know", niche: "AI & Technology", viralScore: 92, views: 2400000 },
    { title: "Scientists Discover Something Terrifying Under The Ocean", niche: "Space & Science", viralScore: 88, views: 1800000 },
    { title: "5 Money Rules Rich People Follow That You Don't", niche: "Finance & Wealth", viralScore: 86, views: 3200000 },
    { title: "This Ancient Civilization Was More Advanced Than We Think", niche: "Dark History", viralScore: 84, views: 950000 },
    { title: "The Mindset Trick That Changed My Life Forever", niche: "Motivation", viralScore: 82, views: 1200000 },
    { title: "3 Animals More Intelligent Than Humans", niche: "Animals & Nature", viralScore: 79, views: 760000 },
    { title: "NASA Just Found Something Impossible on Mars", niche: "Space & Science", viralScore: 91, views: 4100000 },
    { title: "How This 19-Year-Old Makes $50K/Month Online", niche: "Finance & Wealth", viralScore: 87, views: 2800000 },
    { title: "The Darkest Experiment in Human History", niche: "Dark History", viralScore: 85, views: 1500000 },
    { title: "3 Psychology Tricks That Make You Unstoppable", niche: "Motivation", viralScore: 81, views: 980000 },
    { title: "This New AI Robot Shocked The Entire World", niche: "AI & Technology", viralScore: 90, views: 3700000 },
    { title: "7 Facts About Space That Will Blow Your Mind", niche: "Facts & Curiosity", viralScore: 83, views: 1100000 },
    { title: "The Secret Language Cats Use To Talk To You", niche: "Animals & Nature", viralScore: 78, views: 620000 },
    { title: "Why 99% of People Will Never Be Rich", niche: "Finance & Wealth", viralScore: 89, views: 5100000 },
    { title: "Elon Musk's Latest Announcement Changes EVERYTHING", niche: "AI & Technology", viralScore: 93, views: 6200000 },
  ];

  return fallbackTopics.map((t, i) => ({
    id: `fallback_${i}`,
    rank: i + 1,
    title: t.title,
    channelTitle: "Trending Topic",
    thumbnail: null,
    publishedAt: new Date(now.getTime() - Math.random() * 48 * 60 * 60 * 1000).toISOString(),
    views: t.views,
    likes: Math.round(t.views * 0.04),
    comments: Math.round(t.views * 0.005),
    viralScore: t.viralScore,
    niche: t.niche,
    categoryId: "0",
    description: `Trending topic: ${t.title}`,
    tags: t.niche.split(" & ").map((s) => s.trim().toLowerCase()),
    suggestedTopic: t.title,
    source: "curated_fallback",
  }));
}

module.exports = router;
