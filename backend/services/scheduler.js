const fs = require("fs");
const path = require("path");

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
    status: "pending", // pending, published, failed
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

function initScheduler() {
  ensureQueueFile();
  // Check queue every 60 seconds for items ready to post
  setInterval(async () => {
    const queue = getQueue();
    const now = new Date();
    let updated = false;

    for (const item of queue) {
      if (item.status === "pending" && new Date(item.scheduledAt) <= now) {
        console.log(`[Scheduler] Video '${item.title}' is ready for automated upload!`);
        // Mark as processing
        item.status = "published"; // Updated state
        item.publishedAt = new Date().toISOString();
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
};
