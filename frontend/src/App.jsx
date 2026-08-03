import { useEffect, useMemo, useState, useRef } from "react";

const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:4000";

/* ─── Pipeline step definitions ───────────────────────────────────── */
const PIPELINE_STEPS = [
  {
    id: "download",
    label: "Downloading video",
    icon: "⬇",
    description: "Fetching source from YouTube via yt-dlp",
    avgDuration: 15,
  },
  {
    id: "transcribe",
    label: "Transcribing audio",
    icon: "🎙",
    description: "Running Whisper speech-to-text locally",
    avgDuration: 45,
  },
  {
    id: "analyze",
    label: "Analyzing content",
    icon: "🔍",
    description: "Detecting content type and density",
    avgDuration: 10,
  },
  {
    id: "highlights",
    label: "Finding highlights",
    icon: "✨",
    description: "AI scanning transcript for viral moments",
    avgDuration: 30,
  },
  {
    id: "crop",
    label: "Rendering clips",
    icon: "🎬",
    description: "Cropping and encoding vertical shorts",
    avgDuration: 40,
  },
];

function scoreColor(score) {
  if (score >= 80) return "var(--accent-2)";
  if (score >= 60) return "#E8C34A";
  return "var(--text-dim)";
}

function formatTime(seconds) {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function formatDuration(seconds) {
  if (seconds < 60) return `${Math.floor(seconds)}s`;
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return s > 0 ? `${m}m ${s}s` : `${m}m`;
}

/* ─── Pipeline Progress Component ─────────────────────────────────── */
function PipelineProgress({ currentStep, logs, startTime, isError, hasEnded }) {
  const logsEndRef = useRef(null);
  const [elapsed, setElapsed] = useState(0);
  const [showLogs, setShowLogs] = useState(false);

  // Auto-expand logs when an error occurs
  useEffect(() => {
    if (isError) {
      setShowLogs(true);
    }
  }, [isError]);

  // Update elapsed timer every second
  useEffect(() => {
    if (hasEnded) return;
    const id = setInterval(() => {
      setElapsed((Date.now() - startTime) / 1000);
    }, 1000);
    return () => clearInterval(id);
  }, [startTime, hasEnded]);

  // Auto-scroll logs
  useEffect(() => {
    if (showLogs && logsEndRef.current) {
      logsEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [logs, showLogs]);

  const currentIndex = PIPELINE_STEPS.findIndex((s) => s.id === currentStep);

  // Calculate ETA
  const remainingSteps = PIPELINE_STEPS.slice(
    Math.max(0, currentIndex + 1)
  );
  const etaSeconds = remainingSteps.reduce(
    (sum, s) => sum + s.avgDuration,
    0
  );

  // Calculate overall progress percentage
  const totalAvg = PIPELINE_STEPS.reduce((sum, s) => sum + s.avgDuration, 0);
  const completedAvg = PIPELINE_STEPS.slice(0, Math.max(0, currentIndex))
    .reduce((sum, s) => sum + s.avgDuration, 0);
  const currentStepAvg = currentIndex >= 0 ? PIPELINE_STEPS[currentIndex].avgDuration : 0;
  const progressPercent = hasEnded && !isError
    ? 100
    : Math.min(
        95,
        ((completedAvg + currentStepAvg * 0.5) / totalAvg) * 100
      );

  return (
    <div className={`pipeline-progress ${isError ? "pipeline-progress--error" : ""}`}>
      {/* Overall progress bar */}
      <div className="pipeline-topbar">
        <div className="pipeline-progress-bar">
          <div
            className="pipeline-progress-fill"
            style={{
              width: `${progressPercent}%`,
              background: isError ? "#ff5a5a" : undefined,
            }}
          />
          {!isError && !hasEnded && (
            <div className="pipeline-progress-glow" style={{ left: `${progressPercent}%` }} />
          )}
        </div>
        <div className="pipeline-stats">
          <span className="pipeline-elapsed">
            ⏱ {formatDuration(elapsed)}
          </span>
          {!hasEnded && etaSeconds > 0 && (
            <span className="pipeline-eta">
              ~{formatDuration(etaSeconds)} remaining
            </span>
          )}
        </div>
      </div>

      {/* Step cards */}
      <div className="pipeline-steps">
        {PIPELINE_STEPS.map((step, i) => {
          let status = "pending";
          if (i < currentIndex) status = "done";
          else if (i === currentIndex) status = isError ? "error" : "active";

          return (
            <div
              key={step.id}
              className={`pipeline-step pipeline-step--${status}`}
            >
              <div className="pipeline-step-indicator">
                {status === "done" && (
                  <span className="pipeline-step-check">✓</span>
                )}
                {status === "active" && (
                  <span className="pipeline-step-spinner" />
                )}
                {status === "error" && (
                  <span className="pipeline-step-error-icon">✕</span>
                )}
                {status === "pending" && (
                  <span className="pipeline-step-dot" />
                )}
              </div>
              <div className="pipeline-step-content">
                <div className="pipeline-step-header">
                  <span className="pipeline-step-icon">{step.icon}</span>
                  <span className="pipeline-step-label">{step.label}</span>
                  {status === "done" && (
                    <span className="pipeline-step-time">✓</span>
                  )}
                  {status === "error" && (
                    <span className="pipeline-step-time" style={{ color: "#ff5a5a" }}>Failed</span>
                  )}
                </div>
                <p className="pipeline-step-desc">{step.description}</p>
              </div>
            </div>
          );
        })}
      </div>

      {/* Log console toggle */}
      <button
        className="pipeline-logs-toggle"
        onClick={() => setShowLogs(!showLogs)}
      >
        {showLogs ? "▾ Hide terminal output" : "▸ Show terminal output"}
        <span className="pipeline-log-count">{logs.length} lines</span>
      </button>

      {showLogs && (
        <div className="pipeline-logs">
          {logs.map((line, i) => {
            const isErr = /error|failed|exception/i.test(line);
            return (
              <div key={i} className={`pipeline-log-line ${isErr ? "pipeline-log-line--error" : ""}`}>
                <span className="pipeline-log-prefix">$</span>
                {line}
              </div>
            );
          })}
          <div ref={logsEndRef} />
        </div>
      )}
    </div>
  );
}

/* ─── Timeline ────────────────────────────────────────────────────── */
function Timeline({ highlights, duration }) {
  if (!duration) return null;
  return (
    <div className="timeline">
      <div className="timeline-track">
        {highlights.map((h, i) => {
          const left = (h.start_time / duration) * 100;
          const width = Math.max(
            0.6,
            ((h.end_time - h.start_time) / duration) * 100
          );
          return (
            <div
              key={i}
              className="timeline-marker"
              style={{ left: `${left}%`, width: `${width}%` }}
              title={`${h.title} (${formatTime(h.start_time)}–${formatTime(
                h.end_time
              )})`}
            />
          );
        })}
      </div>
      <div className="timeline-labels">
        <span>0:00</span>
        <span>{formatTime(duration)}</span>
      </div>
    </div>
  );
}

/* ─── Clip Card ───────────────────────────────────────────────────── */
function ClipCard({ clip, index, youtubeConnected, onConnectYoutube }) {
  const [title, setTitle] = useState(clip.title || `Short ${index + 1}`);
  const [description, setDescription] = useState(clip.virality_reason || "");
  const [status, setStatus] = useState("idle");
  const [resultUrl, setResultUrl] = useState(null);
  const [errorMsg, setErrorMsg] = useState(null);

  async function handleUpload() {
    if (!youtubeConnected) {
      onConnectYoutube();
      return;
    }
    setStatus("uploading");
    setErrorMsg(null);
    try {
      const res = await fetch(`${API_BASE}/api/upload`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ filename: clip.filename, title, description }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Upload failed");
      setResultUrl(data.url);
      setStatus("done");
    } catch (err) {
      setErrorMsg(err.message);
      setStatus("error");
    }
  }

  return (
    <div className="clip-card">
      <div className="clip-preview">
        {clip.playbackUrl ? (
          <video
            src={`${API_BASE}${clip.playbackUrl}`}
            controls
            preload="metadata"
          />
        ) : (
          <div className="clip-preview-error">render failed</div>
        )}
        <span
          className="clip-score"
          style={{ borderColor: scoreColor(clip.score) }}
        >
          {clip.score}
        </span>
      </div>

      <div className="clip-meta">
        <span className="clip-time">
          {formatTime(clip.start_time)}–{formatTime(clip.end_time)}
        </span>

        <input
          className="clip-title-input"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />

        {clip.hook_sentence && (
          <p className="clip-hook">"{clip.hook_sentence}"</p>
        )}

        <textarea
          className="clip-desc-input"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={2}
        />

        <button
          className={`upload-btn upload-btn--${status}`}
          onClick={handleUpload}
          disabled={status === "uploading" || status === "done"}
        >
          {status === "idle" &&
            (youtubeConnected
              ? "Upload to YouTube"
              : "Connect YouTube to upload")}
          {status === "uploading" && "Uploading…"}
          {status === "done" && "Uploaded ✓"}
          {status === "error" && "Retry upload"}
        </button>

        {status === "done" && resultUrl && (
          <a
            className="clip-link"
            href={resultUrl}
            target="_blank"
            rel="noreferrer"
          >
            View on YouTube →
          </a>
        )}
        {status === "error" && <p className="clip-error">{errorMsg}</p>}
      </div>
    </div>
  );
}

/* ─── Main App ────────────────────────────────────────────────────── */
export default function App() {
  const [videoUrl, setVideoUrl] = useState("");
  const [numClips, setNumClips] = useState(3);
  const [loading, setLoading] = useState(false);
  const [currentStep, setCurrentStep] = useState(null);
  const [logs, setLogs] = useState([]);
  const [startTime, setStartTime] = useState(null);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [totalElapsed, setTotalElapsed] = useState(null);
  const [youtubeConnected, setYoutubeConnected] = useState(false);

  useEffect(() => {
    fetch(`${API_BASE}/api/youtube/status`, { credentials: "include" })
      .then((r) => r.json())
      .then((d) => setYoutubeConnected(d.connected))
      .catch(() => {});
  }, []);

  const duration = useMemo(
    () => result?.transcript?.duration || 0,
    [result]
  );

  async function handleGenerate(e) {
    e.preventDefault();
    setError(null);
    setResult(null);
    setLoading(true);
    setCurrentStep(null);
    setLogs([]);
    setTotalElapsed(null);
    const now = Date.now();
    setStartTime(now);

    try {
      const res = await fetch(`${API_BASE}/api/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ videoUrl, numClips: Number(numClips) }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
        throw new Error(errData.error || errData.message || `Server HTTP error ${res.status}`);
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });

        // Parse SSE events from the buffer
        const lines = buffer.split("\n");
        buffer = lines.pop() || ""; // keep incomplete line in buffer

        let eventType = null;
        for (const line of lines) {
          if (line.startsWith("event: ")) {
            eventType = line.slice(7).trim();
          } else if (line.startsWith("data: ") && eventType) {
            try {
              const data = JSON.parse(line.slice(6));
              if (eventType === "step") {
                setCurrentStep(data.step);
              } else if (eventType === "log") {
                setLogs((prev) => [...prev, data.text]);
              } else if (eventType === "done") {
                setTotalElapsed(data.elapsed);
                setResult(data);
                setLoading(false);
              } else if (eventType === "error") {
                throw new Error(data.error);
              }
            } catch (parseErr) {
              if (eventType === "error") throw parseErr;
            }
            eventType = null;
          }
        }
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  function connectYoutube() {
    window.location.href = `${API_BASE}/auth/google`;
  }

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <span className="brand-mark">▮▮▶</span>
          <span className="brand-name">Shortcut</span>
        </div>
        <button
          className={`youtube-btn ${youtubeConnected ? "connected" : ""}`}
          onClick={connectYoutube}
        >
          {youtubeConnected ? "YouTube connected ✓" : "Connect YouTube"}
        </button>
      </header>

      <main>
        <section className="intake">
          <h1>Paste a link. Get your shorts.</h1>
          <p className="subtitle">
            Runs the highlight-detection pipeline on your own machine, no
            subscription, no watermark.
          </p>

          <form onSubmit={handleGenerate} className="intake-form">
            <input
              type="text"
              placeholder="https://www.youtube.com/watch?v=…"
              value={videoUrl}
              onChange={(e) => setVideoUrl(e.target.value)}
              required
            />
            <select
              value={numClips}
              onChange={(e) => setNumClips(e.target.value)}
            >
              {[2, 3, 4, 5].map((n) => (
                <option key={n} value={n}>
                  {n} clips
                </option>
              ))}
            </select>
            <button type="submit" disabled={loading}>
              {loading ? "Working…" : "Generate"}
            </button>
          </form>

          {(loading || logs.length > 0) && startTime && (
            <PipelineProgress
              currentStep={currentStep}
              logs={logs}
              startTime={startTime}
              isError={!!error}
              hasEnded={!loading}
            />
          )}

          {error && <p className="error-banner">❌ {error}</p>}
        </section>

        {result && (
          <section className="results">
            <div className="results-header">
              <span className="content-tag">
                {result.transcript?.content_type || "video"}
              </span>
              <span className="duration-tag">
                {formatTime(duration)} total
              </span>
              {totalElapsed && (
                <span className="duration-tag">
                  ⚡ processed in {totalElapsed}s
                </span>
              )}
            </div>

            <Timeline highlights={result.shorts || []} duration={duration} />

            <div className="clip-grid">
              {(result.shorts || []).map((clip, i) => (
                <ClipCard
                  key={i}
                  clip={clip}
                  index={i}
                  youtubeConnected={youtubeConnected}
                  onConnectYoutube={connectYoutube}
                />
              ))}
            </div>
          </section>
        )}
      </main>
    </div>
  );
}
