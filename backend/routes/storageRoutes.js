const router = require("express").Router();
const fs = require("fs");
const path = require("path");

const shortgptVideosDir = path.join(__dirname, "..", "..", "ShortGPT", "videos");
const clipperOutputDir = path.join(
  process.env.PYTHON_PROJECT_DIR || "",
  process.env.LOCAL_OUTPUT_DIR || "output"
);

function formatSize(bytes) {
  if (bytes >= 1024 * 1024 * 1024) return (bytes / (1024 * 1024 * 1024)).toFixed(2) + " GB";
  if (bytes >= 1024 * 1024) return (bytes / (1024 * 1024)).toFixed(1) + " MB";
  if (bytes >= 1024) return (bytes / 1024).toFixed(0) + " KB";
  return bytes + " B";
}

function classifyFile(filename) {
  const ext = path.extname(filename).toLowerCase();
  if (ext === ".mp4" || ext === ".mkv" || ext === ".mov" || ext === ".webm") return "video";
  if (ext === ".mp3" || ext === ".wav" || ext === ".m4a") return "audio";
  if (ext === ".jpg" || ext === ".png" || ext === ".jpeg" || ext === ".webp") return "thumbnail";
  if (ext === ".srt" || ext === ".ass" || ext === ".vtt" || ext === ".json") return "subtitle";
  return "other";
}

function scanDirectory(dirPath, servePrefix, sourceName) {
  if (!fs.existsSync(dirPath)) return [];
  const files = fs.readdirSync(dirPath);

  return files
    .filter((f) => !f.startsWith(".") && f !== "archive")
    .map((f) => {
      const fullPath = path.join(dirPath, f);
      try {
        const stat = fs.statSync(fullPath);
        if (!stat.isFile()) return null;
        return {
          id: `${sourceName}_${f}`,
          filename: f,
          source: sourceName,
          category: classifyFile(f),
          size: stat.size,
          sizeLabel: formatSize(stat.size),
          mtime: stat.mtimeMs,
          dateFormatted: new Date(stat.mtimeMs).toLocaleString(),
          url: `${servePrefix}/${encodeURIComponent(f)}`,
          fullPath,
        };
      } catch {
        return null;
      }
    })
    .filter(Boolean);
}

/* ------------------------------------------------------------------ */
/*  GET /api/storage/all                                              */
/* ------------------------------------------------------------------ */
router.get("/all", (req, res) => {
  const shortgptFiles = scanDirectory(shortgptVideosDir, "/shortgpt-videos", "ShortGPT Engine");
  const clipperFiles = scanDirectory(clipperOutputDir, "/clips", "Video Clipper Engine");

  const allFiles = [...shortgptFiles, ...clipperFiles].sort((a, b) => b.mtime - a.mtime);

  const totalBytes = allFiles.reduce((acc, f) => acc + f.size, 0);

  const categoryTotals = {
    video: allFiles.filter((f) => f.category === "video").reduce((acc, f) => acc + f.size, 0),
    audio: allFiles.filter((f) => f.category === "audio").reduce((acc, f) => acc + f.size, 0),
    thumbnail: allFiles.filter((f) => f.category === "thumbnail").reduce((acc, f) => acc + f.size, 0),
    subtitle: allFiles.filter((f) => f.category === "subtitle").reduce((acc, f) => acc + f.size, 0),
  };

  res.json({
    files: allFiles,
    totalFiles: allFiles.length,
    totalBytes,
    totalSizeLabel: formatSize(totalBytes),
    categoryTotals: {
      video: formatSize(categoryTotals.video),
      audio: formatSize(categoryTotals.audio),
      thumbnail: formatSize(categoryTotals.thumbnail),
      subtitle: formatSize(categoryTotals.subtitle),
    },
  });
});

/* ------------------------------------------------------------------ */
/*  DELETE /api/storage/file                                          */
/* ------------------------------------------------------------------ */
router.delete("/file", (req, res) => {
  const { source, filename } = req.query;

  if (!filename || filename.includes("..") || filename.includes("/") || filename.includes("\\")) {
    return res.status(400).json({ error: "Invalid filename" });
  }

  const dirPath = source === "ShortGPT Engine" ? shortgptVideosDir : clipperOutputDir;
  const targetPath = path.join(dirPath, filename);

  if (!fs.existsSync(targetPath)) {
    return res.status(404).json({ error: "File not found" });
  }

  try {
    fs.unlinkSync(targetPath);
    console.log(`[storage] Deleted file: ${targetPath}`);
    res.json({ success: true, filename });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/* ------------------------------------------------------------------ */
/*  POST /api/storage/clear-category                                  */
/* ------------------------------------------------------------------ */
router.post("/clear-category", (req, res) => {
  const { category = "all" } = req.body;

  const shortgptFiles = scanDirectory(shortgptVideosDir, "/shortgpt-videos", "ShortGPT Engine");
  const clipperFiles = scanDirectory(clipperOutputDir, "/clips", "Video Clipper Engine");

  const allFiles = [...shortgptFiles, ...clipperFiles];
  let deletedCount = 0;
  let freedBytes = 0;

  for (const f of allFiles) {
    if (category === "all" || f.category === category) {
      try {
        if (fs.existsSync(f.fullPath)) {
          fs.unlinkSync(f.fullPath);
          deletedCount++;
          freedBytes += f.size;
        }
      } catch (err) {
        console.error(`[storage] Failed to delete ${f.fullPath}:`, err);
      }
    }
  }

  res.json({
    success: true,
    deletedCount,
    freedBytes,
    freedSizeLabel: formatSize(freedBytes),
  });
});

module.exports = router;
