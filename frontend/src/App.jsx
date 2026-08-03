import { useEffect, useMemo, useState, useRef, useCallback } from "react";

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
function PipelineProgress({ currentStep, stepDetails = {}, stepLabels = {}, isLocalInput = false, logs, startTime, isError, hasEnded }) {
  const logsEndRef = useRef(null);
  const [elapsed, setElapsed] = useState(0);
  const [showLogs, setShowLogs] = useState(true);

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
          if (hasEnded && !isError) status = "done";
          else if (i < currentIndex) status = "done";
          else if (i === currentIndex) status = isError ? "error" : "active";

          const isDownloadStep = step.id === "download";
          const currentLabel = stepLabels[step.id] || "";
          const isLocal = isDownloadStep && (
            isLocalInput ||
            currentLabel.toLowerCase().includes("local") ||
            currentLabel.toLowerCase().includes("upload")
          );

          const displayIcon = isLocal ? "📁" : step.icon;
          const displayLabel = isLocal
            ? (stepLabels[step.id] || "Using local video")
            : (stepLabels[step.id] || step.label);
          const displayDesc = isLocal
            ? "Processing video directly from disk (no download needed)"
            : step.description;

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
                  <span className="pipeline-step-icon">{displayIcon}</span>
                  <span className="pipeline-step-label">{displayLabel}</span>
                  {stepDetails[step.id] && (status === "active" || status === "done") && (
                    <span className={`pipeline-step-badge ${status === "done" ? "pipeline-step-badge--done" : ""}`}>
                      {stepDetails[step.id]}
                    </span>
                  )}
                  {status === "done" && (
                    <span className="pipeline-step-time">✓</span>
                  )}
                  {status === "error" && (
                    <span className="pipeline-step-time" style={{ color: "#ff5a5a" }}>Failed</span>
                  )}
                </div>
                <p className="pipeline-step-desc">{displayDesc}</p>
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
  const [isGeneratingSeo, setIsGeneratingSeo] = useState(false);

  async function handleGenerateSeo() {
    setIsGeneratingSeo(true);
    try {
      const res = await fetch(`${API_BASE}/api/youtube/generate-seo`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: clip.title,
          hook: clip.hook_sentence,
          text: clip.transcript_text,
        }),
      });
      const data = await res.json();
      if (data.title) setTitle(data.title);
      if (data.description) setDescription(data.description);
    } catch (err) {
      console.error("SEO generation failed:", err);
    } finally {
      setIsGeneratingSeo(false);
    }
  }

  async function handleUpload() {
    if (!youtubeConnected) {
      onConnectYoutube();
      return;
    }
    setStatus("uploading");
    setErrorMsg(null);
    try {
      const res = await fetch(`${API_BASE}/api/youtube/upload`, {
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

        <button
          type="button"
          className="ai-seo-btn"
          onClick={handleGenerateSeo}
          disabled={isGeneratingSeo}
        >
          {isGeneratingSeo ? "Generating SEO Title & Tags…" : "✨ AI Auto-SEO (Title, Description & Tags)"}
        </button>

        <textarea
          className="clip-desc-input"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={3}
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

/* ─── Video Library Sidebar ─────────────────────────────── */
function VideoLibrary({ refreshTrigger, onUse }) {
  const [videos, setVideos] = useState([]);
  const [deleting, setDeleting] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [selectedFilename, setSelectedFilename] = useState(null);

  const fetchVideos = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/api/videos`);
      const data = await res.json();
      setVideos(data.videos || []);
    } catch {
      setVideos([]);
    }
  }, []);

  useEffect(() => { fetchVideos(); }, [fetchVideos, refreshTrigger]);

  async function handleDelete(filename) {
    if (confirmDelete !== filename) {
      setConfirmDelete(filename);
      setTimeout(() => setConfirmDelete(null), 3000);
      return;
    }
    setDeleting(filename);
    setConfirmDelete(null);
    try {
      await fetch(`${API_BASE}/api/videos/${encodeURIComponent(filename)}`, { method: "DELETE" });
      setVideos((prev) => prev.filter((v) => v.filename !== filename));
    } catch (err) {
      console.error("Delete failed:", err);
    } finally {
      setDeleting(null);
    }
  }

  const totalSize = videos.reduce((acc, v) => acc + v.size, 0);
  function fmtTotal(bytes) {
    if (bytes >= 1024 * 1024 * 1024) return (bytes / 1024 / 1024 / 1024).toFixed(1) + " GB";
    if (bytes >= 1024 * 1024) return (bytes / 1024 / 1024).toFixed(0) + " MB";
    return (bytes / 1024).toFixed(0) + " KB";
  }

  return (
    <aside className="video-library">
      <div className="vlib-header">
        <span className="vlib-title">📂 Video Library</span>
        <span className="vlib-meta">
          {videos.length} file{videos.length !== 1 ? "s" : ""} &middot; {fmtTotal(totalSize)}
        </span>
        <button className="vlib-refresh" onClick={fetchVideos} title="Refresh">↺</button>
      </div>

      {videos.length === 0 ? (
        <div className="vlib-empty">
          <span className="vlib-empty-icon">📼</span>
          <p>No source videos yet.<br />Download a YouTube video or upload one!</p>
        </div>
      ) : (
        <div className="vlib-list">
          {videos.map((v) => (
            <div key={v.filename} className="vlib-item">
              <video
                className="vlib-thumb"
                src={`${API_BASE}${v.url}`}
                muted
                preload="metadata"
                onMouseOver={(e) => e.currentTarget.play()}
                onMouseOut={(e) => { e.currentTarget.pause(); e.currentTarget.currentTime = 0; }}
              />
              <div className="vlib-info">
                <div className="vlib-filename" title={v.filename}>
                  {v.filename.replace(/^(source_|upload_|short_)/, "").replace(/_\d{13}/, "")}
                </div>
                <div className="vlib-badges">
                  <span className={`vlib-type vlib-type--${v.type}`}>
                    {v.type === "uploaded" ? "⬆ uploaded"
                      : v.type === "clip" ? "✂️ clip"
                      : "⬇ downloaded"}
                  </span>
                  <span className="vlib-size">{v.sizeLabel}</span>
                </div>
              </div>
              <div className="vlib-actions">
                <button
                  className={`vlib-use ${selectedFilename === v.filename ? "vlib-use--selected" : ""}`}
                  onClick={() => {
                    setSelectedFilename(v.filename);
                    onUse && onUse(v.localPath, v.filename);
                  }}
                  title="Use this video as input for clip generation"
                >
                  {selectedFilename === v.filename ? "✓ Ready" : "▶ Use"}
                </button>
                <button
                  className={`vlib-delete ${
                    confirmDelete === v.filename ? "vlib-delete--confirm" : ""
                  }`}
                  disabled={deleting === v.filename}
                  onClick={() => handleDelete(v.filename)}
                  title={confirmDelete === v.filename ? "Click again to confirm delete" : "Delete file"}
                >
                  {deleting === v.filename
                    ? "⏳"
                    : confirmDelete === v.filename
                    ? "⚠️ Sure?"
                    : "🗑️"}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </aside>
  );
}

/* ─── Main App ────────────────────────────────────────────────────── */
export default function App() {
  const [videoUrl, setVideoUrl] = useState("");
  const [numClips, setNumClips] = useState(3);
  const [loading, setLoading] = useState(false);
  const [currentStep, setCurrentStep] = useState(null);
  const [stepDetails, setStepDetails] = useState({});
  const [stepLabels, setStepLabels] = useState({});
  const [logs, setLogs] = useState([]);
  const [startTime, setStartTime] = useState(null);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [totalElapsed, setTotalElapsed] = useState(null);
  const [youtubeConnected, setYoutubeConnected] = useState(false);
  const [uploadState, setUploadState] = useState(null); // null | 'uploading' | 'done' | 'error'
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadFilename, setUploadFilename] = useState("");
  const [dragOver, setDragOver] = useState(false);
  const [libRefresh, setLibRefresh] = useState(0);
  const [channelAnalytics, setChannelAnalytics] = useState(null);
  const fileInputRef = useRef(null);
  const uploadedPathRef = useRef(null);
  const intakeRef = useRef(null);

  useEffect(() => {
    fetch(`${API_BASE}/api/youtube/status`, { credentials: "include" })
      .then((r) => r.json())
      .then((d) => {
        setYoutubeConnected(d.connected);
        if (d.connected) {
          fetch(`${API_BASE}/api/youtube/analytics`, { credentials: "include" })
            .then((r) => r.json())
            .then((ad) => { if (ad.channel) setChannelAnalytics(ad.channel); })
            .catch(() => {});
        }
      })
      .catch(() => {});
  }, []);

  const isLocalInput = useMemo(() => {
    const url = (videoUrl || "").trim();
    if (!url) return false;
    return !url.startsWith("http://") && !url.startsWith("https://");
  }, [videoUrl]);

  const duration = useMemo(
    () => result?.transcript?.duration || 0,
    [result]
  );

  async function handleUpload(file) {
    if (!file) return;
    setUploadState("uploading");
    setUploadProgress(0);
    setUploadFilename(file.name);
    setError(null);
    uploadedPathRef.current = null;

    const formData = new FormData();
    formData.append("video", file);

    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open("POST", `${API_BASE}/api/upload`);
      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable) {
          setUploadProgress(Math.round((e.loaded / e.total) * 100));
        }
      };
      xhr.onload = () => {
        if (xhr.status === 200) {
          const data = JSON.parse(xhr.responseText);
          uploadedPathRef.current = data.localPath;
          setUploadState("done");
          setVideoUrl(data.localPath);
          setLibRefresh((n) => n + 1); // refresh library
          resolve(data.localPath);
        } else {
          const err = JSON.parse(xhr.responseText || "{}").error || "Upload failed";
          setUploadState("error");
          setError(err);
          reject(new Error(err));
        }
      };
      xhr.onerror = () => {
        setUploadState("error");
        setError("Upload failed — check that the backend is running.");
        reject(new Error("Upload failed"));
      };
      xhr.send(formData);
    });
  }

  function handleDropZoneClick() {
    fileInputRef.current?.click();
  }

  function handleFileChange(e) {
    const file = e.target.files?.[0];
    if (file) handleUpload(file);
  }

  function handleDrop(e) {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) handleUpload(file);
  }

  async function handleGenerate(e) {
    e.preventDefault();
    const urlToUse = videoUrl.trim();
    if (!urlToUse) {
      setError("Please paste a YouTube URL or upload a video file first.");
      return;
    }

    setError(null);
    setResult(null);
    setLoading(true);
    setCurrentStep("download");
    setStepDetails(isLocalInput ? { download: "Reading from disk..." } : {});
    setStepLabels(isLocalInput ? { download: "Using local video" } : {});
    setLogs(["🚀 Initializing video generation pipeline..."]);
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

        // Parse SSE event blocks (events in SSE spec are separated by double newline \n\n)
        const blocks = buffer.split("\n\n");
        buffer = blocks.pop() || ""; // Keep incomplete block in buffer

        for (const block of blocks) {
          const lines = block.split("\n");
          let eventType = null;
          let eventData = null;

          for (const line of lines) {
            if (line.startsWith("event: ")) {
              eventType = line.slice(7).trim();
            } else if (line.startsWith("data: ")) {
              try {
                eventData = JSON.parse(line.slice(6));
              } catch (e) {
                // Ignore parse errors for partial chunks
              }
            }
          }

          if (eventType && eventData) {
            if (eventType === "step") {
              if (eventData.step) setCurrentStep(eventData.step);
              if (eventData.label) {
                setStepLabels((prev) => ({
                  ...prev,
                  [eventData.step]: eventData.label,
                }));
              }
              if (eventData.detail) {
                setStepDetails((prev) => ({
                  ...prev,
                  [eventData.step]: eventData.detail,
                }));
              }
            } else if (eventType === "log") {
              setLogs((prev) => [...prev, eventData.text]);
            } else if (eventType === "done") {
              setTotalElapsed(eventData.elapsed);
              setResult(eventData);
              setError(null);
            } else if (eventType === "error") {
              throw new Error(eventData.error || eventData.message || "Generation failed");
            }
          }
        }
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
      setLibRefresh((n) => n + 1); // refresh library to show new downloads
    }
  }

  function connectYoutube() {
    window.location.href = `${API_BASE}/auth/google`;
  }

  function handleUseVideo(localPath, filename) {
    const pathToUse = localPath || filename;
    const cleanName = filename ? filename.replace(/^(source_|upload_|short_)/, "").replace(/_\d{13}/, "") : pathToUse;
    setVideoUrl(pathToUse);
    setUploadState("done");
    setUploadFilename(cleanName);
    setResult(null);
    setError(null);
    // Scroll intake form smoothly into view
    setTimeout(() => {
      intakeRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 50);
  }

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <span className="brand-mark">▮▮▶</span>
          <span className="brand-name">Shortcut</span>
        </div>

        <div className="topbar-right">
          {channelAnalytics && (
            <div className="channel-stats-badge" title="Connected YouTube Channel Analytics">
              {channelAnalytics.avatar && (
                <img src={channelAnalytics.avatar} alt="Channel" className="channel-avatar" />
              )}
              <div className="channel-info">
                <span className="channel-name">{channelAnalytics.title}</span>
                <span className="channel-subscribers">
                  👥 {channelAnalytics.subscribers} subs &middot; 👁️ {channelAnalytics.views} views
                </span>
              </div>
            </div>
          )}
          <button
            className={`youtube-btn ${youtubeConnected ? "connected" : ""}`}
            onClick={connectYoutube}
          >
            {youtubeConnected ? "YouTube connected ✓" : "Connect YouTube"}
          </button>
        </div>
      </header>

      <main className="app-main">
        <div className="app-content">
          <section className="intake" ref={intakeRef}>

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
              onChange={(e) => { setVideoUrl(e.target.value); setUploadState(null); }}
              disabled={loading}
            />
            <select
              value={numClips}
              onChange={(e) => setNumClips(e.target.value)}
              disabled={loading}
            >
              {[2, 3, 4, 5].map((n) => (
                <option key={n} value={n}>
                  {n} clips
                </option>
              ))}
            </select>
            <button type="submit" disabled={loading || uploadState === "uploading"}>
              {loading ? "Working…" : "Generate"}
            </button>
          </form>

          {/* ─── Upload Drop Zone ─────────────────────────────── */}
          <div className="upload-divider"><span>or upload a local video</span></div>

          <input
            ref={fileInputRef}
            type="file"
            accept="video/mp4,video/quicktime,video/x-msvideo,video/x-matroska,video/webm,video/x-m4v,.mp4,.mov,.avi,.mkv,.webm,.m4v"
            style={{ display: "none" }}
            onChange={handleFileChange}
          />

          <div
            id="upload-drop-zone"
            className={`upload-dropzone ${
              dragOver ? "upload-dropzone--drag" : ""
            } ${
              uploadState === "done" ? "upload-dropzone--done" : ""
            } ${
              uploadState === "uploading" ? "upload-dropzone--uploading" : ""
            }`}
            onClick={uploadState !== "uploading" ? handleDropZoneClick : undefined}
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
          >
            {uploadState === "uploading" && (
              <div className="upload-dropzone-content">
                <div className="upload-spinner" />
                <div className="upload-dropzone-label">Uploading {uploadFilename}…</div>
                <div className="upload-progress-bar-wrap">
                  <div className="upload-progress-bar-fill" style={{ width: `${uploadProgress}%` }} />
                </div>
                <div className="upload-progress-pct">{uploadProgress}%</div>
              </div>
            )}
            {uploadState === "done" && (
              <div className="upload-dropzone-content">
                <span className="upload-done-icon">✓</span>
                <div className="upload-dropzone-label">{uploadFilename}</div>
                <div className="upload-dropzone-sublabel">Ready — click Generate above!</div>
              </div>
            )}
            {uploadState === "error" && (
              <div className="upload-dropzone-content">
                <span className="upload-error-icon">✕</span>
                <div className="upload-dropzone-label">Upload failed. Click to retry.</div>
              </div>
            )}
            {(!uploadState) && (
              <div className="upload-dropzone-content">
                <svg className="upload-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
                </svg>
                <div className="upload-dropzone-label">Drop a video or <span className="upload-link">click to browse</span></div>
                <div className="upload-dropzone-sublabel">MP4, MOV, AVI, MKV, WebM · up to 4 GB</div>
              </div>
            )}
          </div>

          {(loading || logs.length > 0) && startTime && (
            <PipelineProgress
              currentStep={currentStep}
              stepDetails={stepDetails}
              stepLabels={stepLabels}
              isLocalInput={isLocalInput}
              logs={logs}
              startTime={startTime}
              isError={!!error}
              hasEnded={!!result}
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
        </div>
        <VideoLibrary refreshTrigger={libRefresh} onUse={handleUseVideo} />
      </main>
    </div>
  );
}
