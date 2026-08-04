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

// AI SEO Generator — generates viral Part 1, Part 2, ... Part N titles, descriptions, and hashtags for max views
router.post("/youtube/generate-seo", (req, res) => {
  const { title, hook, text, index } = req.body;
  const partNum = (typeof index === "number" ? index + 1 : 1);
  const rawTitle = (title || hook || "Must Watch Moment").trim().replace(/^Part \d+\s*[-:]?\s*/i, "");
  const cleanTitle = rawTitle.replace(/^["']|["']$/g, "");
  
  const emojis = ["🔥", "😱", "🤯", "💥", "👀", "✨"];
  const randomEmoji = emojis[(partNum - 1) % emojis.length];
  
  const seoTitle = `[Part ${partNum}] ${randomEmoji} ${cleanTitle} #Shorts`;
  
  const hashtags = [
    `#Part${partNum}`, "#Shorts", "#YouTubeShorts", "#Viral", "#Trending",
    "#FYP", "#MustWatch", "#ShortsVideo", "#ExplorePage", "#ViralShorts"
  ];
  
  const seoDescription = [
    `🎬 Part ${partNum} | ${cleanTitle}`,
    "",
    text ? `"${text.slice(0, 180).trim()}..."` : "Watch this epic scene until the end!",
    "",
    `📌 Watch Part ${partNum + 1} next on the channel!`,
    "👍 Like & Subscribe for more parts!",
    "",
    hashtags.join(" "),
  ].join("\n");

  res.json({
    title: seoTitle,
    description: seoDescription,
    hashtags,
    partNumber: partNum,
  });
});

// Upload video directly to YouTube Studio with optional custom thumbnail
router.post("/youtube/upload", async (req, res) => {
  const { videoPath, filename, thumbnailPath, thumbnailFilename, title, description, privacyStatus = "public", categoryId = "28", tags = [] } = req.body;

  if (!req.session || !req.session.youtubeTokens) {
    return res
      .status(401)
      .json({ error: "YouTube not connected. Click 'Connect YouTube' first." });
  }

  // Resolve target video file path
  let targetVideoPath = videoPath;

  if (!targetVideoPath && filename) {
    // Search in ShortGPT videos directory first, then Clipper output
    const shortgptPath = path.join(__dirname, "..", "..", "ShortGPT", "videos", filename);
    const clipperOutputDir = path.join(
      process.env.PYTHON_PROJECT_DIR || "",
      process.env.LOCAL_OUTPUT_DIR || "output"
    );
    const clipperPath = path.join(clipperOutputDir, filename);

    if (fs.existsSync(shortgptPath)) {
      targetVideoPath = shortgptPath;
    } else if (fs.existsSync(clipperPath)) {
      targetVideoPath = clipperPath;
    }
  }

  if (!targetVideoPath || !fs.existsSync(targetVideoPath)) {
    return res.status(404).json({ error: `Video file not found: ${targetVideoPath || filename}` });
  }

  // Resolve thumbnail file path if provided
  let targetThumbPath = thumbnailPath;
  if (!targetThumbPath && thumbnailFilename) {
    const thumbCandidate = path.join(__dirname, "..", "..", "ShortGPT", "videos", thumbnailFilename);
    if (fs.existsSync(thumbCandidate)) targetThumbPath = thumbCandidate;
  }

  const oauth2Client = getOAuthClient();
  oauth2Client.setCredentials(req.session.youtubeTokens);
  const youtube = google.youtube({ version: "v3", auth: oauth2Client });

  try {
    console.log(`[youtube-upload] Uploading video to YouTube Studio: ${targetVideoPath}`);
    const response = await youtube.videos.insert({
      part: ["snippet", "status"],
      requestBody: {
        snippet: {
          title: (title || "New Short #Shorts").slice(0, 100),
          description: description || "Uploaded via YouTube Automation Studio #Shorts",
          categoryId: categoryId || "28", // Science & Tech
          tags: tags.length ? tags : ["Shorts", "YouTubeShorts", "Viral"],
        },
        status: {
          privacyStatus: privacyStatus || "public",
          selfDeclaredMadeForKids: false,
        },
      },
      media: {
        body: fs.createReadStream(targetVideoPath),
      },
    });

    const videoId = response.data.id;
    let thumbnailUploaded = false;

    // Upload custom thumbnail if thumbnail path exists
    if (targetThumbPath && fs.existsSync(targetThumbPath)) {
      try {
        console.log(`[youtube-upload] Setting custom thumbnail for video ${videoId}...`);
        await youtube.thumbnails.set({
          videoId,
          media: {
            body: fs.createReadStream(targetThumbPath),
          },
        });
        thumbnailUploaded = true;
      } catch (thumbErr) {
        console.warn(`[youtube-upload] Thumbnail upload warning (channel may require phone verification for custom thumbnails): ${thumbErr.message}`);
      }
    }

    res.json({
      success: true,
      videoId,
      url: `https://youtube.com/shorts/${videoId}`,
      watchUrl: `https://www.youtube.com/watch?v=${videoId}`,
      studioUrl: `https://studio.youtube.com/video/${videoId}/edit`,
      thumbnailUploaded,
    });
  } catch (err) {
    console.error("[youtube-upload] YouTube upload error:", err);
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
