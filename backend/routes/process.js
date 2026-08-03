const router = require("express").Router();
const path = require("path");
const { runPipeline } = require("../services/pythonRunner");

/* ------------------------------------------------------------------ */
/*  POST /api/generate  →  Server-Sent Events stream                  */
/*  Streams real-time progress from the Python pipeline, then emits   */
/*  the final result JSON.                                            */
/* ------------------------------------------------------------------ */
router.post("/generate", (req, res) => {
  const { videoUrl, numClips = 3 } = req.body;

  if (!videoUrl) {
    return res.status(400).json({ error: "videoUrl is required" });
  }

  // Set up SSE headers
  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
    "X-Accel-Buffering": "no",
  });

  // Flush headers immediately
  res.flushHeaders();

  // Helper to send an SSE event
  function sendEvent(eventName, data) {
    if (!res.writableEnded) {
      res.write(`event: ${eventName}\ndata: ${JSON.stringify(data)}\n\n`);
    }
  }

  // Map Python pipeline [tag] prefixes to user-friendly pipeline steps
  const STEP_MAP = [
    { pattern: /\[download\/local\]/, step: "download", label: "Downloading video" },
    { pattern: /\[download\]/, step: "download", label: "Downloading video" },
    { pattern: /\[transcribe\/local\]/, step: "transcribe", label: "Transcribing audio" },
    { pattern: /\[transcribe\]/, step: "transcribe", label: "Transcribing audio" },
    { pattern: /\[highlights\].*content=/, step: "analyze", label: "Analyzing content type" },
    { pattern: /\[highlights\].*chunk/, step: "highlights", label: "Detecting highlights" },
    { pattern: /\[highlights\]/, step: "highlights", label: "Detecting highlights" },
    { pattern: /\[pipeline.*\] cropping/, step: "crop", label: "Cropping clips" },
    { pattern: /\[clip\/local\]/, step: "crop", label: "Rendering vertical clips" },
    { pattern: /\[clip\]/, step: "crop", label: "Rendering vertical clips" },
  ];

  let currentStep = null;

  function onProgress(line) {
    let detail = null;
    if (line.includes("downloading video:")) {
      const match = line.match(/downloading video:\s*(.*)/i);
      if (match) detail = match[1].trim();
    } else if (line.includes("checking link accessibility")) {
      detail = "verifying link & metadata...";
    } else if (line.includes("reusing cached download")) {
      detail = "100% (cached source)";
    } else if (line.includes("[clip/local]")) {
      const match = line.match(/\[clip\/local\]\s*(\d+\/\d+:\s*.*)/i);
      if (match) detail = match[1].trim();
    }

    // Try to match a pipeline step
    for (const { pattern, step, label } of STEP_MAP) {
      if (pattern.test(line)) {
        currentStep = step;
        sendEvent("step", { step, label, detail });
        break;
      }
    }

    if (detail && currentStep) {
      sendEvent("step", { step: currentStep, detail });
    }

    // Always forward the raw log line for the detail view
    sendEvent("log", { text: line.trim() });
  }

  const startTime = Date.now();

  const pipelinePromise = runPipeline(videoUrl, numClips, onProgress);

  pipelinePromise
    .then((result) => {
      // Normalize shorts for the frontend
      const shorts = (result.shorts || []).map((s) => {
        const filename = s.clip_url ? path.basename(s.clip_url) : null;
        return {
          ...s,
          filename,
          playbackUrl: filename ? `/clips/${filename}` : null,
        };
      });

      const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
      sendEvent("done", { ...result, shorts, elapsed });
      res.end();
    })
    .catch((err) => {
      console.error(err);
      sendEvent("error", { error: err.message });
      res.end();
    });

  // Handle client disconnect
  req.on("close", () => {
    res.end();
  });
});

module.exports = router;
