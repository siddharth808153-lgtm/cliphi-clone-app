const router = require("express").Router();
const { getQueue, addScheduledVideo, removeScheduledVideo } = require("../services/scheduler");

router.get("/queue", (req, res) => {
  res.json({ queue: getQueue() });
});

router.post("/add", (req, res) => {
  const { filename, videoPath, title, description, scheduledAt } = req.body;
  if (!filename && !videoPath) {
    return res.status(400).json({ error: "filename or videoPath is required" });
  }

  const newItem = addScheduledVideo({
    filename,
    videoPath,
    title,
    description,
    scheduledAt,
  });

  res.json({ success: true, item: newItem });
});

router.delete("/:id", (req, res) => {
  const { id } = req.params;
  const updatedQueue = removeScheduledVideo(id);
  res.json({ success: true, queue: updatedQueue });
});

module.exports = router;
