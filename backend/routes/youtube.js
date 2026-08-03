const router = require("express").Router();
const { google } = require("googleapis");
const path = require("path");
const fs = require("fs");

const SCOPES = [
  "https://www.googleapis.com/auth/youtube.upload",
  "https://www.googleapis.com/auth/youtube.readonly",
];

function getOAuthClient() {
  return new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI
  );
}

// Step 1: Redirect to Google consent screen
router.get("/google", (req, res) => {
  const oauth2Client = getOAuthClient();
  const url = oauth2Client.generateAuthUrl({
    access_type: "offline",
    prompt: "consent",
    scope: SCOPES,
  });
  res.redirect(url);
});

// Step 2: OAuth callback handler
router.get("/google/callback", async (req, res) => {
  const { code } = req.query;
  const oauth2Client = getOAuthClient();
  try {
    const { tokens } = await oauth2Client.getToken(code);
    req.session.youtubeTokens = tokens;
    res.redirect(
      `${process.env.FRONTEND_ORIGIN || "http://localhost:5173"}?youtube=connected`
    );
  } catch (err) {
    res.status(500).send(`YouTube auth failed: ${err.message}`);
  }
});

// Check OAuth connection status
router.get("/youtube/status", (req, res) => {
  res.json({ connected: !!(req.session && req.session.youtubeTokens) });
});

// AI SEO Generator — generates viral title, description, and hashtags for max views
router.post("/youtube/generate-seo", (req, res) => {
  const { title, hook, text } = req.body;
  const rawTitle = (title || hook || "Must Watch Highlight").trim();
  
  // Clean up quotes
  const cleanTitle = rawTitle.replace(/^["']|["']$/g, "");
  
  // Create high-converting viral title variants
  const emojis = ["🔥", "😱", "🤯", "💥", "👀", "✨"];
  const randomEmoji = emojis[Math.floor(Math.random() * emojis.length)];
  
  const seoTitle = `${randomEmoji} ${cleanTitle} #Shorts`;
  
  // High-view SEO hashtag cloud
  const hashtags = [
    "#Shorts", "#YouTubeShorts", "#Viral", "#Trending",
    "#FYP", "#MustWatch", "#ShortsVideo", "#ExplorePage", "#ViralShorts"
  ];
  
  const seoDescription = [
    `🔥 ${cleanTitle}`,
    "",
    text ? `"${text.slice(0, 180).trim()}..."` : "Watch this epic clip until the end!",
    "",
    "👍 Like & Subscribe for daily shorts!",
    "",
    hashtags.join(" "),
  ].join("\n");

  res.json({
    title: seoTitle,
    description: seoDescription,
    hashtags,
  });
});

// Upload clip directly to YouTube
router.post("/youtube/upload", async (req, res) => {
  const { filename, title, description, privacyStatus } = req.body;

  if (!req.session || !req.session.youtubeTokens) {
    return res
      .status(401)
      .json({ error: "YouTube not connected. Click 'Connect YouTube' first." });
  }
  if (!filename) {
    return res.status(400).json({ error: "filename is required" });
  }

  const outputDir = path.join(
    process.env.PYTHON_PROJECT_DIR || "",
    process.env.LOCAL_OUTPUT_DIR || "output"
  );
  const filePath = path.join(outputDir, filename);

  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ error: `Clip file not found: ${filePath}` });
  }

  const oauth2Client = getOAuthClient();
  oauth2Client.setCredentials(req.session.youtubeTokens);
  const youtube = google.youtube({ version: "v3", auth: oauth2Client });

  try {
    const response = await youtube.videos.insert({
      part: ["snippet", "status"],
      requestBody: {
        snippet: {
          title: title || "New Short #Shorts",
          description: description || "Uploaded via Shortcut App #Shorts",
          categoryId: "22",
        },
        status: {
          privacyStatus: privacyStatus || "public",
          selfDeclaredMadeForKids: false,
        },
      },
      media: {
        body: fs.createReadStream(filePath),
      },
    });

    const videoId = response.data.id;
    res.json({
      videoId,
      url: `https://youtube.com/shorts/${videoId}`,
    });
  } catch (err) {
    res.status(500).json({ error: err.message || "YouTube upload failed" });
  }
});

// YouTube Channel Analytics & Stats
router.get("/youtube/analytics", async (req, res) => {
  if (!req.session || !req.session.youtubeTokens) {
    return res.status(401).json({ connected: false, error: "Not connected" });
  }

  const oauth2Client = getOAuthClient();
  oauth2Client.setCredentials(req.session.youtubeTokens);
  const youtube = google.youtube({ version: "v3", auth: oauth2Client });

  try {
    const channelRes = await youtube.channels.list({
      part: ["snippet", "statistics"],
      mine: true,
    });

    const channel = channelRes.data.items?.[0];
    if (!channel) {
      return res.json({ connected: true, noChannel: true });
    }

    const stats = channel.statistics;
    const snippet = channel.snippet;

    res.json({
      connected: true,
      channel: {
        title: snippet.title,
        avatar: snippet.thumbnails?.default?.url,
        customUrl: snippet.customUrl,
        subscribers: parseInt(stats.subscriberCount || 0).toLocaleString(),
        views: parseInt(stats.viewCount || 0).toLocaleString(),
        videos: parseInt(stats.videoCount || 0).toLocaleString(),
      },
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
