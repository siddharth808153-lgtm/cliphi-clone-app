require("dotenv").config();
const express = require("express");
const cors = require("cors");
const path = require("path");
const fs = require("fs");
const session = require("express-session");

const processRoutes = require("./routes/process");
const youtubeRoutes = require("./routes/youtube");
const uploadRoutes = require("./routes/upload");
const videosRoutes = require("./routes/videos");
const facelessRoutes = require("./routes/faceless");
const scheduleRoutes = require("./routes/scheduleRoutes");
const storageRoutes = require("./routes/storageRoutes");
const trendingRoutes = require("./routes/trendingRoutes");
const autopilotRoutes = require("./routes/autopilotRoutes");
const channelRoutes = require("./routes/channelRoutes");
const autonomousDevRoutes = require("./routes/autonomousDevRoutes");
const nicheScoutRoutes = require("./routes/nicheScoutRoutes");
const { initScheduler } = require("./services/scheduler");
const { initAutoPilot } = require("./services/autopilot");
const { initAutonomousDev } = require("./services/autonomousDevEngine");

const app = express();
const PORT = process.env.PORT || 4000;

app.use(
  cors({
    origin: process.env.FRONTEND_ORIGIN || "http://localhost:5173",
    credentials: true,
  })
);
app.use(express.json());
app.use(
  session({
    secret: process.env.SESSION_SECRET || "dev-secret-change-me",
    resave: false,
    saveUninitialized: false,
  })
);

// Serve the rendered clips from AI-Youtube-Shorts-Generator
const outputDir = path.join(
  process.env.PYTHON_PROJECT_DIR || "",
  process.env.LOCAL_OUTPUT_DIR || "output"
);
app.use("/clips", express.static(outputDir));

// Serve ShortGPT rendered videos
const shortgptVideosDir = path.join(__dirname, "..", "ShortGPT", "videos");
if (!fs.existsSync(shortgptVideosDir)) {
  fs.mkdirSync(shortgptVideosDir, { recursive: true });
}
app.use("/shortgpt-videos", express.static(shortgptVideosDir));

app.use("/api", processRoutes);
app.use("/api", uploadRoutes);
app.use("/api", videosRoutes);
app.use("/api/faceless", facelessRoutes);
app.use("/api/schedule", scheduleRoutes);
app.use("/api/storage", storageRoutes);
app.use("/api/trending", trendingRoutes);
app.use("/api/autopilot", autopilotRoutes);
app.use("/api/channels", channelRoutes);
app.use("/api/autonomous-dev", autonomousDevRoutes);
app.use("/api/niche-scout", nicheScoutRoutes);
app.use("/auth", youtubeRoutes);
app.use("/api", youtubeRoutes);

initScheduler();
initAutoPilot();
initAutonomousDev();

app.get("/", (req, res) => {
  res.send(`
    <div style="font-family: system-ui, sans-serif; background: #0f0f11; color: #fff; height: 100vh; display: flex; flex-direction: column; align-items: center; justify-content: center; margin: 0;">
      <h1 style="margin-bottom: 8px;">Shortcut YouTube Automation API Running ⚡</h1>
      <p style="color: #a1a1aa; margin-bottom: 24px;">The YouTube Automation Studio is running on Vite.</p>
      <a href="http://localhost:5173" style="background: #ff5a36; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: 600;">Open Frontend App (http://localhost:5173) →</a>
    </div>
  `);
});

app.get("/health", (req, res) => res.json({ ok: true }));

app.listen(PORT, () => {
  console.log(`Shortcut backend running on http://localhost:${PORT}`);
  console.log(`Serving clips from: ${outputDir}`);
  console.log(`Serving ShortGPT videos from: ${shortgptVideosDir}`);
});
