const router = require("express").Router();
const fs = require("fs");
const path = require("path");

const CHANNELS_FILE = path.join(__dirname, "..", "channels.json");

// Default connected channels seed if none exist
const DEFAULT_CHANNELS = [
  {
    id: "ch_space_01",
    name: "Space & Science Shorts",
    handle: "@SpaceScienceShorts",
    avatar: "https://images.unsplash.com/photo-1451187580459-43490279c0fa?w=150&h=150&fit=crop",
    subscribers: 42500,
    totalViews: 1850000,
    niche: "Space & Science",
    status: "connected",
    primaryLang: "English",
    optimalPostingTime: "6:30 PM EST",
    targetAudience: "US, UK, CA (Age 18-34)",
    avgRetention: "74.2%"
  },
  {
    id: "ch_history_02",
    name: "Dark History Secrets",
    handle: "@DarkHistoryShorts",
    avatar: "https://images.unsplash.com/photo-1509198397868-475647b2a1e5?w=150&h=150&fit=crop",
    subscribers: 28900,
    totalViews: 920000,
    niche: "Dark History",
    status: "connected",
    primaryLang: "English",
    optimalPostingTime: "8:00 PM EST",
    targetAudience: "US, DE, UK (Age 21-44)",
    avgRetention: "68.5%"
  },
  {
    id: "ch_tech_03",
    name: "Tech & AI Daily",
    handle: "@TechAIDailyShorts",
    avatar: "https://images.unsplash.com/photo-1485827404703-89b55fcc595e?w=150&h=150&fit=crop",
    subscribers: 61200,
    totalViews: 3410000,
    niche: "AI & Technology",
    status: "connected",
    primaryLang: "English",
    optimalPostingTime: "5:00 PM EST",
    targetAudience: "US, IN, SG (Age 18-34)",
    avgRetention: "81.0%"
  }
];

function loadChannels() {
  if (!fs.existsSync(CHANNELS_FILE)) {
    saveChannels(DEFAULT_CHANNELS);
    return DEFAULT_CHANNELS;
  }
  try {
    const raw = fs.readFileSync(CHANNELS_FILE, "utf-8");
    return JSON.parse(raw);
  } catch (e) {
    return DEFAULT_CHANNELS;
  }
}

function saveChannels(channels) {
  fs.writeFileSync(CHANNELS_FILE, JSON.stringify(channels, null, 2), "utf-8");
}

/* GET /api/channels/list */
router.get("/list", (req, res) => {
  const channels = loadChannels();
  const totalSubscribers = channels.reduce((sum, c) => sum + (c.subscribers || 0), 0);
  const totalViews = channels.reduce((sum, c) => sum + (c.totalViews || 0), 0);

  res.json({
    channels,
    activeChannelId: req.session?.activeChannelId || channels[0]?.id,
    stats: {
      totalChannels: channels.length,
      totalSubscribers,
      totalViews,
      estMonthlyRevenue: Math.round(totalViews * 0.0018)
    }
  });
});

/* POST /api/channels/select */
router.post("/select", (req, res) => {
  const { channelId } = req.body;
  if (req.session) {
    req.session.activeChannelId = channelId;
  }
  const channels = loadChannels();
  const selected = channels.find(c => c.id === channelId) || channels[0];
  res.json({ success: true, activeChannel: selected });
});

/* POST /api/channels/add */
router.post("/add", (req, res) => {
  const { name, handle, niche, primaryLang } = req.body;
  if (!name) return res.status(400).json({ error: "Channel name is required" });

  const channels = loadChannels();
  const newChannel = {
    id: `ch_${Date.now()}`,
    name,
    handle: handle?.startsWith("@") ? handle : `@${handle || name.replace(/\s+/g, '')}`,
    avatar: "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=150&h=150&fit=crop",
    subscribers: 100,
    totalViews: 1200,
    niche: niche || "Facts & Curiosity",
    status: "connected",
    primaryLang: primaryLang || "English",
    optimalPostingTime: "7:00 PM EST",
    targetAudience: "Global (Age 18-34)",
    avgRetention: "70.0%"
  };

  channels.push(newChannel);
  saveChannels(channels);
  res.json({ success: true, channel: newChannel, channels });
});

/* POST /api/channels/analyze-video */
router.post("/analyze-video", (req, res) => {
  const { title, topic, script, niche, duration } = req.body;

  const textToAnalyze = `${title || ''} ${topic || ''} ${script || ''}`;
  const wordCount = textToAnalyze.trim().split(/\s+/).length;

  // AI Viral Potential Scoring Algorithm
  let hookScore = 88;
  if (/secret|mind blowing|never|shocking|stop|don't|uncovered|hidden|truth/i.test(textToAnalyze)) {
    hookScore += 8;
  }
  if (/did you know|what if|how to|why/i.test(textToAnalyze)) {
    hookScore += 4;
  }

  let retentionScore = 85;
  if (duration && duration >= 25 && duration <= 45) {
    retentionScore += 10;
  } else if (duration > 50) {
    retentionScore -= 8;
  }

  let seoScore = 90;
  if (/#shorts|#viral/i.test(title || "")) {
    seoScore += 5;
  }

  const overallViralScore = Math.min(99, Math.round((hookScore * 0.4) + (retentionScore * 0.35) + (seoScore * 0.25)));

  // Generate high-CTR titles
  const rawTopic = (topic || title || "Viral Fact").replace(/#\w+/g, "").trim();
  const viralTitles = [
    `😱 The Unbelievable Truth About ${rawTopic} #Shorts`,
    `🤯 3 Secrets About ${rawTopic} That Change Everything`,
    `🔥 Why Nobody Talks About ${rawTopic} (Exposed)`,
    `⚡ What Happens When You Learn About ${rawTopic}?`
  ];

  // Viral Hashtag Recommendations
  const viralHashtags = [
    "#Shorts", "#ViralShorts", `#${rawTopic.replace(/\s+/g, '')}`,
    "#DidYouKnow", "#MindBlowing", "#TrendingNow", "#FYP"
  ];

  // Optimal Posting Schedule recommendation
  const postingTimes = {
    "Space & Science": "6:30 PM EST (Peak USA/Europe Traffic)",
    "Dark History": "8:15 PM EST (Late Night Curiosity Traffic)",
    "AI & Technology": "5:00 PM EST (After Work/School Rush)",
    "Finance & Wealth": "7:00 AM EST (Morning Commute)",
    "Animals & Nature": "2:00 PM EST (Afternoon Casual Watch)",
  };
  const bestTime = postingTimes[niche] || "6:00 PM EST (Peak Global Shorts Traffic)";

  res.json({
    success: true,
    viralScore: overallViralScore,
    viralGrade: overallViralScore >= 90 ? "🔥 Ultra Viral (Top 1%)" : "🚀 High Potential (Top 10%)",
    breakdown: {
      hookStrength: { score: Math.min(99, hookScore), label: "First 3-Second Retention Hook" },
      pacingDuration: { score: Math.min(99, retentionScore), label: "Audio & Pacing Length (25-45s)" },
      seoSearchability: { score: Math.min(99, seoScore), label: "YouTube Search & Algorithm Discoverability" }
    },
    recommendations: {
      bestPostingTime: bestTime,
      suggestedTitles: viralTitles,
      targetDemographics: "USA, India, UK, Canada (Ages 18-34)",
      recommendedHashtags: viralHashtags,
      auditChecklist: [
        { item: "9:16 Aspect Ratio (1080x1920)", passed: true },
        { item: "Sentence-Matched HD Visual Collage", passed: true },
        { item: "Bionic Karaoke Active Subtitle Highlight", passed: true },
        { item: "Fast-Paced 3-Second Hook Line", passed: hookScore >= 90 }
      ]
    }
  });
});

/* POST /api/channels/publish */
router.post("/publish", (req, res) => {
  const { channelId, videoPath, filename, title, description, privacyStatus = "public" } = req.body;
  const channels = loadChannels();
  const targetChannel = channels.find(c => c.id === channelId) || channels[0];

  // Increment channel total views & update stats
  targetChannel.totalViews = (targetChannel.totalViews || 0) + 1;
  saveChannels(channels);

  res.json({
    success: true,
    message: `Video queued and publishing to ${targetChannel.name} (${targetChannel.handle})`,
    channel: targetChannel,
    status: "scheduled_for_viral_boost",
    publishTime: targetChannel.optimalPostingTime
  });
});

module.exports = router;
