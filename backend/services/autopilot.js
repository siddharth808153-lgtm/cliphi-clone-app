const { runFacelessPipeline } = require("./shortGptRunner");
const { loadTokens } = require("./tokenStore");
const {
  getTrendingTopics,
  saveTrendingTopics,
  getAutoPilotSettings,
  saveAutoPilotSettings,
  getAffiliateLinks,
} = require("./analyticsStore");
const { addScheduledVideo, getQueue } = require("./scheduler");

/* ------------------------------------------------------------------ */
/*  AUTO-PILOT ENGINE                                                  */
/*  Background daemon that:                                            */
/*  1. Periodically scans trending topics                              */
/*  2. Picks the best viral topic matching configured niche            */
/*  3. Triggers ShortGPT faceless video generation                     */
/*  4. Injects SEO metadata + affiliate links                          */
/*  5. Queues the finished video for automatic YouTube upload          */
/* ------------------------------------------------------------------ */

let autopilotInterval = null;
let isRunning = false;
const autopilotLogs = [];

function addLog(message) {
  const entry = {
    timestamp: new Date().toISOString(),
    message,
  };
  autopilotLogs.push(entry);
  // Keep only last 200 log entries
  if (autopilotLogs.length > 200) {
    autopilotLogs.splice(0, autopilotLogs.length - 200);
  }
  console.log(`[AutoPilot] ${message}`);
}

function getAutoPilotLogs() {
  return autopilotLogs.slice(-50);
}

function getAutoPilotStatus() {
  const settings = getAutoPilotSettings();
  return {
    enabled: settings.enabled,
    isRunning,
    lastRun: settings.lastRun,
    settings,
    logs: getAutoPilotLogs(),
  };
}

/* ---------- Pick the best trending topic for the configured niche ---------- */
function pickBestTopic(settings) {
  const cached = getTrendingTopics();
  const topics = cached.topics || [];

  if (topics.length === 0) {
    return null;
  }

  const preferredNiche = settings.preferredNiche || "Facts & Curiosity";

  // Try to find a topic matching the preferred niche
  let candidates = topics.filter((t) => {
    const nicheMatch =
      t.niche === preferredNiche ||
      t.niche?.toLowerCase().includes(preferredNiche.toLowerCase()) ||
      preferredNiche.toLowerCase().includes(t.niche?.toLowerCase() || "");
    return nicheMatch && t.viralScore >= (settings.minScoreThreshold || 70);
  });

  // Fall back to highest viral score topics if no niche match
  if (candidates.length === 0) {
    candidates = topics
      .filter((t) => t.viralScore >= (settings.minScoreThreshold || 60))
      .sort((a, b) => b.viralScore - a.viralScore);
  }

  if (candidates.length === 0) {
    return topics[0]; // absolute fallback
  }

  // Pick a random one from top 5 to add variety
  const topCandidates = candidates.slice(0, 5);
  return topCandidates[Math.floor(Math.random() * topCandidates.length)];
}

/* ---------- Map niche name to ShortGPT niche param ---------- */
function nicheToShortGPTParam(niche) {
  const map = {
    "Finance & Wealth": "Motivation",
    "AI & Technology": "Tech Breakdown",
    "Space & Science": "Space Facts",
    "Motivation": "Motivation",
    "Dark History": "Dark History",
    "Facts & Curiosity": "Facts",
    "Animals & Nature": "Animated Cat Tales",
    "Entertainment": "Reddit Stories",
  };
  return map[niche] || "Facts";
}

/* ---------- Build SEO-optimized description with affiliate links ---------- */
function buildSEODescription(topic, affiliateLinks = []) {
  const hashtags = [
    "#Shorts", "#YouTubeShorts", "#Viral", "#Trending",
    "#FYP", "#MustWatch", "#MindBlowing", "#Facts",
  ];

  const lines = [
    `🔥 ${topic.title || topic.suggestedTopic || "Amazing Facts"}`,
    "",
    `This will blow your mind! Watch until the end...`,
    "",
    "👍 Like & Subscribe for more!",
    "🔔 Turn on notifications!",
    "",
  ];

  // Inject affiliate links if configured
  if (affiliateLinks.length > 0) {
    lines.push("📌 Links mentioned in this video:");
    for (const link of affiliateLinks.slice(0, 3)) {
      lines.push(`➡️ ${link.label || link.name}: ${link.url}`);
    }
    lines.push("");
  }

  lines.push(hashtags.join(" "));

  return lines.join("\n");
}

/* ---------- Core auto-pilot cycle ---------- */
async function runAutoPilotCycle() {
  if (isRunning) {
    addLog("⏭ Skipping cycle — previous cycle still running.");
    return;
  }

  const settings = getAutoPilotSettings();

  if (!settings.enabled) {
    return;
  }

  // Check daily upload limit
  const queue = getQueue();
  const today = new Date().toISOString().slice(0, 10);
  const todayCount = queue.filter(
    (item) =>
      item.createdAt &&
      item.createdAt.slice(0, 10) === today &&
      item.status !== "failed"
  ).length;

  if (todayCount >= (settings.dailyUploadLimit || 3)) {
    addLog(`📊 Daily limit reached (${todayCount}/${settings.dailyUploadLimit}). Skipping.`);
    return;
  }

  // Check if we should run based on upload times
  const now = new Date();
  const currentTime = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
  const uploadTimes = settings.uploadTimes || ["09:00", "15:00", "19:00"];

  // Only run within a 10-minute window of scheduled times
  const isScheduledTime = uploadTimes.some((time) => {
    const [h, m] = time.split(":").map(Number);
    const scheduledMinutes = h * 60 + m;
    const currentMinutes = now.getHours() * 60 + now.getMinutes();
    return Math.abs(currentMinutes - scheduledMinutes) <= 5;
  });

  if (!isScheduledTime) {
    return; // Silently skip — not a scheduled time
  }

  isRunning = true;
  addLog("🚀 Auto-Pilot cycle started.");

  try {
    // Step 1: Pick best trending topic
    const topic = pickBestTopic(settings);
    if (!topic) {
      addLog("❌ No suitable trending topic found. Cycle ended.");
      isRunning = false;
      return;
    }
    addLog(`📈 Selected trending topic: "${topic.suggestedTopic || topic.title}" (Score: ${topic.viralScore})`);

    // Step 2: Generate faceless video
    const shortGPTNiche = nicheToShortGPTParam(topic.niche);
    const voice = settings.preferredVoice || "en-US-ChristopherNeural";

    addLog(`🤖 Generating video — Niche: ${shortGPTNiche}, Voice: ${voice}`);

    const result = await runFacelessPipeline(
      {
        topic: topic.suggestedTopic || topic.title,
        niche: shortGPTNiche,
        voice,
      },
      (line) => {
        // Log ShortGPT progress
        if (line.includes("[script]") || line.includes("[tts]") || line.includes("[render]") || line.includes("[done]")) {
          addLog(`  ↳ ${line.trim()}`);
        }
      }
    );

    addLog(`✅ Video generated: ${result.filename || "output.mp4"}`);

    // Step 3: Build SEO metadata & affiliate injection
    const affiliateLinks = settings.affiliateLinkInjection ? getAffiliateLinks() : [];
    const seoDescription = buildSEODescription(topic, affiliateLinks);
    const seoTitle = `🔥 ${(topic.suggestedTopic || topic.title).slice(0, 85)} #Shorts`;

    // Step 4: Queue for scheduled upload
    const scheduledAt = new Date(Date.now() + 5 * 60 * 1000).toISOString(); // 5 min from now

    const scheduledItem = addScheduledVideo({
      filename: result.filename,
      videoPath: result.videoPath,
      title: seoTitle,
      description: seoDescription,
      scheduledAt,
    });

    addLog(`📅 Queued for upload at ${new Date(scheduledAt).toLocaleTimeString()}: "${seoTitle}"`);
    addLog(`🆔 Schedule ID: ${scheduledItem.id}`);

    // Update last run timestamp
    settings.lastRun = new Date().toISOString();
    saveAutoPilotSettings(settings);

    addLog("✨ Auto-Pilot cycle completed successfully!");
  } catch (err) {
    addLog(`❌ Auto-Pilot error: ${err.message}`);
  } finally {
    isRunning = false;
  }
}

/* ---------- Initialize the Auto-Pilot daemon ---------- */
function initAutoPilot() {
  addLog("🔧 Auto-Pilot engine initialized. Checking every 60 seconds.");

  // Check every 60 seconds if it's time to run
  autopilotInterval = setInterval(() => {
    runAutoPilotCycle().catch((err) => {
      addLog(`❌ Unhandled error in auto-pilot cycle: ${err.message}`);
    });
  }, 60 * 1000);
}

/* ---------- Toggle auto-pilot on/off ---------- */
function toggleAutoPilot(enabled) {
  const settings = getAutoPilotSettings();
  settings.enabled = enabled;
  saveAutoPilotSettings(settings);
  addLog(enabled ? "✅ Auto-Pilot ENABLED" : "⏸ Auto-Pilot PAUSED");
  return settings;
}

/* ---------- Update auto-pilot settings ---------- */
function updateAutoPilotSettings(updates) {
  const settings = getAutoPilotSettings();
  Object.assign(settings, updates);
  saveAutoPilotSettings(settings);
  addLog(`⚙️ Settings updated: ${JSON.stringify(updates)}`);
  return settings;
}

/* ---------- Manually trigger a cycle (for testing/UI) ---------- */
async function triggerManualCycle() {
  const settings = getAutoPilotSettings();
  // Temporarily force-enable for manual trigger
  const wasEnabled = settings.enabled;
  settings.enabled = true;
  saveAutoPilotSettings(settings);

  addLog("🔧 Manual cycle triggered by user.");
  await runAutoPilotCycle();

  if (!wasEnabled) {
    settings.enabled = false;
    saveAutoPilotSettings(settings);
  }
}

module.exports = {
  initAutoPilot,
  getAutoPilotStatus,
  getAutoPilotLogs,
  toggleAutoPilot,
  updateAutoPilotSettings,
  triggerManualCycle,
  runAutoPilotCycle,
};
