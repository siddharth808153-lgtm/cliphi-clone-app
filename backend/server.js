require("dotenv").config();
const express = require("express");
const cors = require("cors");
const path = require("path");
const session = require("express-session");

const processRoutes = require("./routes/process");
const youtubeRoutes = require("./routes/youtube");
const uploadRoutes = require("./routes/upload");
const videosRoutes = require("./routes/videos");

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

// Serve the rendered clips so the frontend can preview them and so
// the YouTube upload route can find them by filename.
const outputDir = path.join(
  process.env.PYTHON_PROJECT_DIR || "",
  process.env.LOCAL_OUTPUT_DIR || "output"
);
app.use("/clips", express.static(outputDir));

app.use("/api", processRoutes);
app.use("/api", uploadRoutes);
app.use("/api", videosRoutes);
app.use("/auth", youtubeRoutes);
app.use("/api", youtubeRoutes);

app.get("/", (req, res) => {
  res.send(`
    <div style="font-family: system-ui, sans-serif; background: #0f0f11; color: #fff; height: 100vh; display: flex; flex-direction: column; align-items: center; justify-content: center; margin: 0;">
      <h1 style="margin-bottom: 8px;">Shortcut Backend API is Running ⚡</h1>
      <p style="color: #a1a1aa; margin-bottom: 24px;">The web application UI is hosted on Vite.</p>
      <a href="http://localhost:5173" style="background: #ff5a36; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: 600;">Open Frontend App (http://localhost:5173) →</a>
    </div>
  `);
});

app.get("/health", (req, res) => res.json({ ok: true }));

app.listen(PORT, () => {
  console.log(`Shortcut backend running on http://localhost:${PORT}`);
  console.log(`Serving clips from: ${outputDir}`);
});
