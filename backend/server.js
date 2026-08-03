require("dotenv").config();
const express = require("express");
const cors = require("cors");
const path = require("path");
const session = require("express-session");

const processRoutes = require("./routes/process");
const youtubeRoutes = require("./routes/youtube");

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
app.use("/auth", youtubeRoutes);
app.use("/api", youtubeRoutes);

app.get("/health", (req, res) => res.json({ ok: true }));

app.listen(PORT, () => {
  console.log(`Shortcut backend running on http://localhost:${PORT}`);
  console.log(`Serving clips from: ${outputDir}`);
});
