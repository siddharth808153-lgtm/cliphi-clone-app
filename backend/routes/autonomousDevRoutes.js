const router = require("express").Router();
const { getStatus, toggleAgent, executeDevCycle } = require("../services/autonomousDevEngine");

/* GET /api/autonomous-dev/status */
router.get("/status", (req, res) => {
  res.json(getStatus());
});

/* POST /api/autonomous-dev/toggle */
router.post("/toggle", (req, res) => {
  const { enabled } = req.body;
  const newState = toggleAgent(!!enabled);
  res.json({ success: true, state: newState });
});

/* POST /api/autonomous-dev/run-now */
router.post("/run-now", async (req, res) => {
  // Execute cycle asynchronously
  executeDevCycle();
  res.json({ success: true, message: "Autonomous AI Dev Cycle initiated immediately!" });
});

module.exports = router;
