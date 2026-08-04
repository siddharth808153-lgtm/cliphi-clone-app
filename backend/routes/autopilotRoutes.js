const router = require("express").Router();
const {
  getAutoPilotStatus,
  toggleAutoPilot,
  updateAutoPilotSettings,
  triggerManualCycle,
} = require("../services/autopilot");

/* ------------------------------------------------------------------ */
/*  AUTO-PILOT CONTROL API                                             */
/* ------------------------------------------------------------------ */

/* GET /api/autopilot/status — current status, settings, and logs */
router.get("/status", (req, res) => {
  res.json(getAutoPilotStatus());
});

/* POST /api/autopilot/toggle — enable or disable auto-pilot */
router.post("/toggle", (req, res) => {
  const { enabled } = req.body;
  const settings = toggleAutoPilot(!!enabled);
  res.json({ success: true, settings });
});

/* POST /api/autopilot/settings — update auto-pilot configuration */
router.post("/settings", (req, res) => {
  const allowed = [
    "dailyUploadLimit",
    "preferredNiche",
    "preferredVoice",
    "uploadTimes",
    "minScoreThreshold",
    "autoGenerateFaceless",
    "autoGenerateClips",
    "affiliateLinkInjection",
  ];

  const updates = {};
  for (const key of allowed) {
    if (req.body[key] !== undefined) {
      updates[key] = req.body[key];
    }
  }

  const settings = updateAutoPilotSettings(updates);
  res.json({ success: true, settings });
});

/* POST /api/autopilot/trigger — manually trigger one auto-pilot cycle */
router.post("/trigger", async (req, res) => {
  try {
    await triggerManualCycle();
    res.json({ success: true, message: "Manual auto-pilot cycle completed." });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
