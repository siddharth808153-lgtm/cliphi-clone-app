const fs = require("fs");
const path = require("path");
const { google } = require("googleapis");
const { loadTokens } = require("./tokenStore");

const QUEUE_FILE = path.join(__dirname, "..", "data", "schedule_queue.json");

function ensureQueueFile() {
  const dir = path.dirname(QUEUE_FILE);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  if (!fs.existsSync(QUEUE_FILE)) {
    fs.writeFileSync(QUEUE_FILE, JSON.stringify([]), "utf-8");
  }
}

function getQueue() {
  ensureQueueFile();
  try {
    const data = fs.readFileSync(QUEUE_FILE, "utf-8");
    return JSON.parse(data);
  } catch (e) {
    return [];
  }
}

function saveQueue(queue) {
  ensureQueueFile();
  fs.writeFileSync(QUEUE_FILE, JSON.stringify(queue, null, 2), "utf-8");
}

function addScheduledVideo(item) {
  const queue = getQueue();
  const newItem = {
    id: `sched_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
    filename: item.filename || item.videoPath,
    videoPath: item.videoPath,
    title: item.title || "Automated Short",
    description: item.description || "#Shorts",
    scheduledAt: item.scheduledAt || new Date(Date.now() + 3600 * 1000).toISOString(),
    status: "pending", // pending, processing, published, failed
    publishedVideoId: null,
    errorMessage: null,
    createdAt: new Date().toISOString(),
  };
  queue.push(newItem);
  saveQueue(queue);
  return newItem;
}

function removeScheduledVideo(id) {
  const queue = getQueue();
  const filtered = queue.filter((i) => i.id !== id);
  saveQueue(filtered);
  return filtered;
}

function getOAuthClient() {
  return new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI
  );
}

async function uploadToYouTube(item, tokens) {
  return new Promise(async (resolve, reject) => {
    try {
      // Resolve target video file path
      let targetVideoPath = item.videoPath;

      if (!targetVideoPath && item.filename) {
        const shortgptPath = path.join(__dirname, "..", "..", "ShortGPT", "videos", item.filename);
        const clipperOutputDir = path.join(
          process.env.PYTHON_PROJECT_DIR || "",
          process.env.LOCAL_OUTPUT_DIR || "output"
        );
        const clipperPath = path.join(clipperOutputDir, item.filename);

        if (fs.existsSync(shortgptPath)) {
          targetVideoPath = shortgptPath;
        } else if (fs.existsSync(clipperPath)) {
          targetVideoPath = clipperPath;
        }
      }

      if (!targetVideoPath || !fs.existsSync(targetVideoPath)) {
        return reject(new Error(`Video file not found: ${targetVideoPath || item.filename}`));
      }

      const oauth2Client = getOAuthClient();
      oauth2Client.setCredentials(tokens);
      const youtube = google.youtube({ version: "v3", auth: oauth2Client });

      console.log(`[scheduler-upload] Uploading video to YouTube Studio: ${targetVideoPath}`);
      const response = await youtube.videos.insert({
        part: ["snippet", "status"],
        requestBody: {
          snippet: {
            title: (item.title || "New Short #Shorts").slice(0, 100),
            description: item.description || "Uploaded via YouTube Automation Studio #Shorts",
            categoryId: "28",
            tags: ["Shorts", "YouTubeShorts", "Viral"],
          },
          status: {
            privacyStatus: "public",
            selfDeclaredMadeForKids: false,
          },
        },
        media: {
          body: fs.createReadStream(targetVideoPath),
        },
      });

      const videoId = response.data.id;
      console.log(`[scheduler-upload] Successfully uploaded video ${videoId}`);
      resolve({ videoId, url: `https://youtube.com/shorts/${videoId}` });
    } catch (err) {
      console.error("[scheduler-upload] Upload error:", err.message);
      reject(err);
    }
  });
}

function initScheduler() {
  ensureQueueFile();
  console.log("[Scheduler] Auto-pilot scheduler initialized. Checking every 60 seconds.");

  // Check queue every 60 seconds for items ready to post
  setInterval(async () => {
    const queue = getQueue();
    const now = new Date();
    let updated = false;
    const tokens = loadTokens();

    if (!tokens) {
      // Silently skip if no tokens available
      return;
    }

    for (const item of queue) {
      if (item.status === "pending" && new Date(item.scheduledAt) <= now) {
        console.log(`[Scheduler] Video '${item.title}' is ready for automated upload!`);
        item.status = "processing";
        updated = true;
        saveQueue(queue);

        try {
          const result = await uploadToYouTube(item, tokens);
          item.status = "published";
          item.publishedVideoId = result.videoId;
          item.publishedUrl = result.url;
          item.publishedAt = new Date().toISOString();
          console.log(`[Scheduler] ✅ Published: ${result.url}`);
        } catch (err) {
          item.status = "failed";
          item.errorMessage = err.message;
          console.error(`[Scheduler] ❌ Failed to upload '${item.title}': ${err.message}`);
        }
        updated = true;
      }
    }

    if (updated) {
      saveQueue(queue);
    }
  }, 60000);
}

module.exports = {
  getQueue,
  addScheduledVideo,
  removeScheduledVideo,
  initScheduler,
  uploadToYouTube,
};
