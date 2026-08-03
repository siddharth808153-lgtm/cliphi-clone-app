const router = require("express").Router();
const { google } = require("googleapis");
const path = require("path");
const fs = require("fs");

const SCOPES = ["https://www.googleapis.com/auth/youtube.upload"];

function getOAuthClient() {
  return new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI
  );
}

// Step 1: send the user to Google's consent screen.
router.get("/google", (req, res) => {
  const oauth2Client = getOAuthClient();
  const url = oauth2Client.generateAuthUrl({
    access_type: "offline",
    prompt: "consent",
    scope: SCOPES,
  });
  res.redirect(url);
});

// Step 2: Google redirects back here with a one-time code; exchange it
// for tokens and stash them in the session (fine for local single-user use).
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

router.get("/youtube/status", (req, res) => {
  res.json({ connected: !!(req.session && req.session.youtubeTokens) });
});

// Step 3: upload a rendered clip by filename (the file must already exist
// in the python project's LOCAL_OUTPUT_DIR).
router.post("/upload", async (req, res) => {
  const { filename, title, description } = req.body;

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
          title: title || "New Short",
          description: description || "",
          categoryId: "22",
        },
        status: {
          // Uploaded private by default so you can review before publishing —
          // change to "public" here once you're confident in the pipeline.
          privacyStatus: "private",
          selfDeclaredMadeForKids: false,
        },
      },
      media: {
        body: fs.createReadStream(filePath),
      },
    });

    res.json({
      videoId: response.data.id,
      url: `https://youtube.com/watch?v=${response.data.id}`,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
