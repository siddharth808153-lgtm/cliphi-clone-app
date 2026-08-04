const router = require("express").Router();
const path = require("path");
const { runFacelessPipeline } = require("../services/shortGptRunner");

/* ------------------------------------------------------------------ */
/*  GET /api/faceless/generate?topic=X&niche=Y&voice=Z                 */
/*  Server-Sent Events stream for Faceless Shorts generation           */
/* ------------------------------------------------------------------ */
router.get("/generate", (req, res) => {
  const { topic, niche = "Facts", voice = "en-US-ChristopherNeural" } = req.query;

  if (!topic) {
    return res.status(400).json({ error: "topic is required" });
  }

  // Set up SSE headers
  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
    "X-Accel-Buffering": "no",
  });

  res.flushHeaders();

  // Send a heartbeat immediately so the client knows the connection is alive
  res.write(":heartbeat\n\n");

  let clientDisconnected = false;

  function sendEvent(eventName, data) {
    if (!clientDisconnected && !res.writableEnded) {
      res.write(`event: ${eventName}\ndata: ${JSON.stringify(data)}\n\n`);
    }
  }

  const STEP_MAP = [
    { pattern: /\[script\]/, step: "script", label: "Writing AI script" },
    { pattern: /\[tts\]/, step: "tts", label: "Synthesizing voiceover" },
    { pattern: /\[render\]/, step: "render", label: "Rendering 9:16 vertical Short" },
    { pattern: /\[done\]/, step: "done", label: "Short completed" },
  ];

  function onProgress(line) {
    for (const { pattern, step, label } of STEP_MAP) {
      if (pattern.test(line)) {
        sendEvent("step", { step, label, detail: line.replace(/\[.*?\]\s*/, "") });
        break;
      }
    }
    sendEvent("log", { text: line.trim() });
  }

  const runnerPromise = runFacelessPipeline({ topic, niche, voice }, onProgress);

  runnerPromise
    .then((result) => {
      sendEvent("complete", result);
      // Small delay before ending to ensure the browser receives the final event
      setTimeout(() => {
        if (!res.writableEnded) res.end();
      }, 500);
    })
    .catch((err) => {
      sendEvent("error", { error: err.message || "Faceless Short generation failed" });
      setTimeout(() => {
        if (!res.writableEnded) res.end();
      }, 500);
    });

  req.on("close", () => {
    clientDisconnected = true;
  });
});

module.exports = router;
