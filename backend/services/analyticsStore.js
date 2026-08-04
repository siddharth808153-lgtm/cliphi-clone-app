const fs = require("fs");
const path = require("path");

const DATA_DIR = path.join(__dirname, "..", "data");

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

function getJsonFile(filename, defaultValue = []) {
  ensureDataDir();
  const filePath = path.join(DATA_DIR, filename);
  if (!fs.existsSync(filePath)) return defaultValue;
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf-8"));
  } catch {
    return defaultValue;
  }
}

function saveJsonFile(filename, data) {
  ensureDataDir();
  const filePath = path.join(DATA_DIR, filename);
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), "utf-8");
}

/* ---------- Video Analytics ---------- */
function getVideoAnalytics() {
  return getJsonFile("video_analytics.json", []);
}

function addVideoAnalytics(entry) {
  const data = getVideoAnalytics();
  const existing = data.find((d) => d.videoId === entry.videoId);
  if (existing) {
    Object.assign(existing, { ...entry, updatedAt: new Date().toISOString() });
  } else {
    data.push({ ...entry, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() });
  }
  saveJsonFile("video_analytics.json", data);
  return entry;
}

function updateVideoAnalytics(videoId, updates) {
  const data = getVideoAnalytics();
  const idx = data.findIndex((d) => d.videoId === videoId);
  if (idx >= 0) {
    data[idx] = { ...data[idx], ...updates, updatedAt: new Date().toISOString() };
    saveJsonFile("video_analytics.json", data);
  }
  return data[idx] || null;
}

/* ---------- Monetization / Revenue ---------- */
function getRevenueRecords() {
  return getJsonFile("revenue_records.json", []);
}

function addRevenueRecord(record) {
  const data = getRevenueRecords();
  data.push({ ...record, id: `rev_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`, createdAt: new Date().toISOString() });
  saveJsonFile("revenue_records.json", data);
  return record;
}

/* ---------- Affiliate Links ---------- */
function getAffiliateLinks() {
  return getJsonFile("affiliate_links.json", []);
}

function addAffiliateLink(link) {
  const data = getAffiliateLinks();
  const newLink = {
    id: `aff_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
    ...link,
    clicks: 0,
    conversions: 0,
    revenue: 0,
    createdAt: new Date().toISOString(),
  };
  data.push(newLink);
  saveJsonFile("affiliate_links.json", data);
  return newLink;
}

function updateAffiliateLink(id, updates) {
  const data = getAffiliateLinks();
  const idx = data.findIndex((d) => d.id === id);
  if (idx >= 0) {
    data[idx] = { ...data[idx], ...updates, updatedAt: new Date().toISOString() };
    saveJsonFile("affiliate_links.json", data);
  }
  return data[idx] || null;
}

function deleteAffiliateLink(id) {
  const data = getAffiliateLinks().filter((d) => d.id !== id);
  saveJsonFile("affiliate_links.json", data);
}

/* ---------- Trending Topics Cache ---------- */
function getTrendingTopics() {
  return getJsonFile("trending_topics.json", { topics: [], lastUpdated: null });
}

function saveTrendingTopics(topics) {
  saveJsonFile("trending_topics.json", { topics, lastUpdated: new Date().toISOString() });
}

/* ---------- Auto-Pilot Settings ---------- */
function getAutoPilotSettings() {
  return getJsonFile("autopilot_settings.json", {
    enabled: false,
    dailyUploadLimit: 3,
    preferredNiche: "Space Facts",
    preferredVoice: "en-US-ChristopherNeural",
    uploadTimes: ["09:00", "15:00", "19:00"],
    minScoreThreshold: 70,
    autoGenerateFaceless: true,
    autoGenerateClips: false,
    affiliateLinkInjection: true,
    lastRun: null,
  });
}

function saveAutoPilotSettings(settings) {
  saveJsonFile("autopilot_settings.json", settings);
}

module.exports = {
  getVideoAnalytics,
  addVideoAnalytics,
  updateVideoAnalytics,
  getRevenueRecords,
  addRevenueRecord,
  getAffiliateLinks,
  addAffiliateLink,
  updateAffiliateLink,
  deleteAffiliateLink,
  getTrendingTopics,
  saveTrendingTopics,
  getAutoPilotSettings,
  saveAutoPilotSettings,
};
