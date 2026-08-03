const express = require("express");
const fs = require("fs");
const path = require("path");

const router = express.Router();

const outputDir = path.join(
  process.env.PYTHON_PROJECT_DIR || "",
  process.env.LOCAL_OUTPUT_DIR || "output"
);

// Helper: human-readable file size
function formatSize(bytes) {
  if (bytes >= 1024 * 1024 * 1024) return (bytes / 1024 / 1024 / 1024).toFixed(1) + " GB";
  if (bytes >= 1024 * 1024) return (bytes / 1024 / 1024).toFixed(1) + " MB";
  if (bytes >= 1024) return (bytes / 1024).toFixed(0) + " KB";
  return bytes + " B";
}

// GET /api/videos — list all source/uploaded video files in output dir
router.get("/videos", (req, res) => {
  fs.mkdirSync(outputDir, { recursive: true });
  let files;
  try {
    files = fs.readdirSync(outputDir);
  } catch {
    return res.json({ videos: [] });
  }

  const videoExts = new Set([".mp4", ".mkv", ".mov", ".avi", ".webm", ".m4v"]);

  const videos = files
    .filter((f) => {
      const ext = path.extname(f).toLowerCase();
      if (!videoExts.has(ext)) return false;
      // List source (downloaded), uploaded files AND generated shorts
      const isSource = f.startsWith("source_") || f.startsWith("upload_") || f.startsWith("short_");
      return isSource;
    })
    .map((f) => {
      const fullPath = path.join(outputDir, f);
      let size = 0;
      let mtime = 0;
      try {
        const stat = fs.statSync(fullPath);
        size = stat.size;
        mtime = stat.mtimeMs;
      } catch {}
      return {
        filename: f,
        size,
        sizeLabel: formatSize(size),
        mtime,
        url: `/clips/${encodeURIComponent(f)}`,
        localPath: fullPath,
        type: f.startsWith("upload_") ? "uploaded" : f.startsWith("short_") ? "clip" : "downloaded",
      };
    })
    .sort((a, b) => b.mtime - a.mtime); // newest first

  res.json({ videos });
});

// DELETE /api/videos/:filename — delete a source/uploaded video file
router.delete("/videos/:filename", (req, res) => {
  const { filename } = req.params;

  // Safety: only allow deleting source_ or upload_ files
  if (!filename.startsWith("source_") && !filename.startsWith("upload_")) {
    return res.status(403).json({ error: "Can only delete source or uploaded files." });
  }

  // No path traversal
  if (filename.includes("..") || filename.includes("/") || filename.includes("\\")) {
    return res.status(400).json({ error: "Invalid filename." });
  }

  const fullPath = path.join(outputDir, filename);
  if (!fs.existsSync(fullPath)) {
    return res.status(404).json({ error: "File not found." });
  }

  try {
    fs.unlinkSync(fullPath);
    // Also delete associated .srt transcript if present
    const base = path.basename(filename, path.extname(filename));
    const srtPath = path.join(outputDir, base + ".srt");
    if (fs.existsSync(srtPath)) fs.unlinkSync(srtPath);
    console.log(`[videos] Deleted: ${filename}`);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
