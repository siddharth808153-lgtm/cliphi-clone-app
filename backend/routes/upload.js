const express = require("express");
const multer = require("multer");
const path = require("path");
const fs = require("fs");

const router = express.Router();

const outputDir = path.join(
  process.env.PYTHON_PROJECT_DIR || "",
  process.env.LOCAL_OUTPUT_DIR || "output"
);

// Ensure output dir exists
fs.mkdirSync(outputDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, outputDir),
  filename: (_req, file, cb) => {
    // Sanitize filename: strip spaces / special chars
    const base = path.basename(file.originalname, path.extname(file.originalname))
      .replace(/[^a-zA-Z0-9_-]/g, "_")
      .slice(0, 60);
    const ext = path.extname(file.originalname).toLowerCase() || ".mp4";
    cb(null, `upload_${base}_${Date.now()}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 4 * 1024 * 1024 * 1024 }, // 4 GB max
  fileFilter: (_req, file, cb) => {
    const allowed = [".mp4", ".mov", ".avi", ".mkv", ".webm", ".m4v"];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowed.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error(`Unsupported file type: ${ext}. Use mp4, mov, avi, mkv, webm, or m4v.`));
    }
  },
});

router.post("/upload", upload.single("video"), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: "No video file received." });
  }
  const localPath = req.file.path;
  console.log(`[upload] Received file: ${localPath} (${(req.file.size / 1024 / 1024).toFixed(1)} MB)`);
  res.json({ localPath, filename: req.file.filename, size: req.file.size });
});

module.exports = router;
