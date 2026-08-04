import { useEffect, useMemo, useState, useRef, useCallback } from "react";

const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:4000";

/* ─── Pipeline step definitions ───────────────────────────────────── */
const PIPELINE_STEPS = [
  { id: "download", label: "Downloading video", icon: "⬇", description: "Fetching source from YouTube via yt-dlp", avgDuration: 15 },
  { id: "transcribe", label: "Transcribing audio", icon: "🎙", description: "Running Whisper speech-to-text locally", avgDuration: 45 },
  { id: "analyze", label: "Analyzing content", icon: "🔍", description: "Detecting content type and density", avgDuration: 10 },
  { id: "highlights", label: "Finding highlights", icon: "✨", description: "AI scanning transcript for viral moments", avgDuration: 30 },
  { id: "crop", label: "Rendering clips", icon: "🎬", description: "Cropping and encoding vertical shorts", avgDuration: 40 },
];

function scoreColor(score) {
  if (score >= 80) return "#10b981";
  if (score >= 60) return "#f59e0b";
  return "#9ca3af";
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

export default function App() {
  const [activeTab, setActiveTab] = useState("clipper"); // clipper, faceless, scheduler, monetization
  const [ytConnected, setYtConnected] = useState(false);

  // Check YouTube connection
  useEffect(() => {
    fetch(`${API_BASE}/api/youtube/status`, { credentials: "include" })
      .then((res) => res.json())
      .then((data) => setYtConnected(!!data.connected))
      .catch(() => setYtConnected(false));
  }, []);

  return (
    <div className="studio-app">
      {/* Navigation Header */}
      <header className="studio-header">
        <div className="studio-brand">
          <span className="studio-logo">⚡</span>
          <div>
            <h1 className="studio-title">YouTube Automation Studio</h1>
            <p className="studio-subtitle">AI Short Generator • Faceless Creator • Auto-Scheduler</p>
          </div>
        </div>

        <nav className="studio-nav">
          <button
            className={`nav-tab ${activeTab === "clipper" ? "nav-tab--active" : ""}`}
            onClick={() => setActiveTab("clipper")}
          >
            ✂️ Video Clipper
          </button>
          <button
            className={`nav-tab ${activeTab === "faceless" ? "nav-tab--active" : ""}`}
            onClick={() => setActiveTab("faceless")}
          >
            🤖 Faceless Short AI (ShortGPT)
          </button>
          <button
            className={`nav-tab ${activeTab === "scheduler" ? "nav-tab--active" : ""}`}
            onClick={() => setActiveTab("scheduler")}
          >
            📅 Auto-Pilot Scheduler
          </button>
          <button
            className={`nav-tab ${activeTab === "monetization" ? "nav-tab--active" : ""}`}
            onClick={() => setActiveTab("monetization")}
          >
            💡 Monetization & Niches
          </button>
          <button
            className={`nav-tab ${activeTab === "storage" ? "nav-tab--active" : ""}`}
            onClick={() => setActiveTab("storage")}
          >
            💾 Storage Manager
          </button>
        </nav>

        <div className="studio-header-right">
          {ytConnected ? (
            <span className="yt-badge yt-badge--connected">✓ YouTube Connected</span>
          ) : (
            <a href={`${API_BASE}/auth/google`} className="yt-connect-btn">
              🔗 Connect YouTube
            </a>
          )}
        </div>
      </header>

      {/* Main Content Area */}
      <main className="studio-main">
        {activeTab === "clipper" && <ClipperTab API_BASE={API_BASE} />}
        {activeTab === "faceless" && <FacelessTab API_BASE={API_BASE} />}
        {activeTab === "scheduler" && <SchedulerTab API_BASE={API_BASE} />}
        {activeTab === "monetization" && <MonetizationTab API_BASE={API_BASE} />}
        {activeTab === "storage" && <StorageTab API_BASE={API_BASE} />}
      </main>
    </div>
  );
}

/* =================================================================== */
/* 1. VIDEO CLIPPER TAB (OPUSCLIP STYLE)                               */
/* =================================================================== */
function ClipperTab({ API_BASE }) {
  const [videoUrl, setVideoUrl] = useState("");
  const [numClips, setNumClips] = useState(3);
  const [isGenerating, setIsGenerating] = useState(false);
  const [currentStep, setCurrentStep] = useState("download");
  const [logs, setLogs] = useState([]);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  const handleGenerate = async (e) => {
    e.preventDefault();
    if (!videoUrl) return;

    setIsGenerating(true);
    setError(null);
    setResult(null);
    setLogs([]);
    setCurrentStep("download");

    try {
      const response = await fetch(`${API_BASE}/api/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ videoUrl, numClips: Number(numClips) }),
      });

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (!line.trim()) continue;
          const eventMatch = line.match(/^event:\s*(.*)$/m);
          const dataMatch = line.match(/^data:\s*(.*)$/m);
          if (eventMatch && dataMatch) {
            const eventName = eventMatch[1].trim();
            const data = JSON.parse(dataMatch[1].trim());

            if (eventName === "step") {
              if (data.step) setCurrentStep(data.step);
            } else if (eventName === "log") {
              setLogs((prev) => [...prev, data.text]);
            } else if (eventName === "complete") {
              setResult(data);
              setIsGenerating(false);
            } else if (eventName === "error") {
              setError(data.error);
              setIsGenerating(false);
            }
          }
        }
      }
    } catch (err) {
      setError(err.message);
      setIsGenerating(false);
    }
  };

  return (
    <div className="tab-container">
      <div className="section-card">
        <h2>✂️ Video Clipper Studio</h2>
        <p className="card-desc">Paste a long YouTube video link to automatically transcribe, extract viral hooks, and render 9:16 vertical Shorts.</p>

        <form onSubmit={handleGenerate} className="clipper-form">
          <div className="form-group">
            <label>YouTube Video URL or Local Video Path</label>
            <input
              type="text"
              placeholder="https://www.youtube.com/watch?v=..."
              value={videoUrl}
              onChange={(e) => setVideoUrl(e.target.value)}
              required
              className="input-field"
            />
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>Number of Shorts to Extract</label>
              <select value={numClips} onChange={(e) => setNumClips(e.target.value)} className="select-field">
                <option value={1}>1 Short</option>
                <option value={3}>3 Shorts (Recommended)</option>
                <option value={5}>5 Shorts</option>
              </select>
            </div>

            <button type="submit" disabled={isGenerating} className="btn btn-primary">
              {isGenerating ? "⚡ Extracting Shorts..." : "🚀 Generate Shorts"}
            </button>
          </div>
        </form>

        {isGenerating && (
          <div className="progress-section">
            <div className="step-indicator">Active Step: <strong>{currentStep}</strong></div>
            <div className="log-box">
              {logs.slice(-6).map((log, i) => (
                <div key={i} className="log-line">{log}</div>
              ))}
            </div>
          </div>
        )}

        {error && <div className="error-badge">❌ {error}</div>}

        {result && result.shorts && (
          <div className="results-grid">
            <h3>🎬 Generated Vertical Shorts</h3>
            <div className="shorts-list">
              {result.shorts.map((short, idx) => (
                <div key={idx} className="short-card">
                  <div className="short-header">
                    <span className="viral-score" style={{ background: scoreColor(short.score || 85) }}>
                      Score: {short.score || 85}/100
                    </span>
                    <span className="short-duration">{formatDuration(short.duration || 30)}</span>
                  </div>
                  <h4>{short.title || `Short #${idx + 1}`}</h4>
                  <p className="short-hook">"{short.hook || short.text}"</p>
                  
                  {short.clipPath && (
                    <video controls className="video-player" src={`${API_BASE}/clips/${short.clipPath.split(/[\/\\]/).pop()}`} />
                  )}

                  <ScheduleBtn API_BASE={API_BASE} videoPath={short.clipPath} title={short.title || `Short #${idx + 1}`} />
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/* =================================================================== */
/* 2. FACELESS SHORT CREATOR TAB (SHORTGPT ENGINE)                     */
/* =================================================================== */
function FacelessTab({ API_BASE }) {
  const [topic, setTopic] = useState("");
  const [niche, setNiche] = useState("Space Facts");
  const [voice, setVoice] = useState("en-US-ChristopherNeural");
  const [isGenerating, setIsGenerating] = useState(false);
  const [logs, setLogs] = useState([]);
  const [currentStep, setCurrentStep] = useState("");
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  const handleCreateFaceless = (e) => {
    e.preventDefault();
    if (!topic) return;

    setIsGenerating(true);
    setError(null);
    setResult(null);
    setLogs([]);
    setCurrentStep("Initializing ShortGPT engine...");

    const params = new URLSearchParams({ topic, niche, voice });
    const es = new EventSource(`${API_BASE}/api/faceless/generate?${params}`);

    es.addEventListener("step", (evt) => {
      const data = JSON.parse(evt.data);
      setCurrentStep(data.label);
    });

    es.addEventListener("log", (evt) => {
      const data = JSON.parse(evt.data);
      setLogs((prev) => [...prev, data.text]);
    });

    es.addEventListener("complete", (evt) => {
      const data = JSON.parse(evt.data);
      setResult(data);
      setIsGenerating(false);
      es.close();
    });

    es.addEventListener("error", (evt) => {
      // EventSource fires error for both SSE errors and connection close
      if (evt.data) {
        try {
          const data = JSON.parse(evt.data);
          setError(data.error || "Generation failed");
        } catch {
          setError("Connection lost during generation");
        }
      }
      setIsGenerating(false);
      es.close();
    });
  };

  return (
    <div className="tab-container">
      <div className="section-card">
        <h2>🤖 Faceless Short Creator (ShortGPT Engine)</h2>
        <p className="card-desc">Type any topic or prompt to generate an automated script, voiceover (EdgeTTS Neural), background visual assets, and vertical video.</p>

        <form onSubmit={handleCreateFaceless} className="faceless-form">
          <div className="form-group">
            <label>Short Topic / Prompt</label>
            <input
              type="text"
              placeholder="e.g. 3 Mind-Blowing Secrets About Black Holes"
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              required
              className="input-field"
            />
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>Channel Niche Style</label>
              <select value={niche} onChange={(e) => setNiche(e.target.value)} className="select-field">
                <option value="Animated Cat Tales">🐱 3D Animated Cat Tales (Manoranjan Style)</option>
                <option value="Smart Animal Pranks">🐵 Smart Monkey & Animal Pranks</option>
                <option value="Hindi Story Shorts">🇮🇳 Hindi Funny Story Shorts</option>
                <option value="Space Facts">🌌 Space & Science Facts</option>
                <option value="Dark History">📜 Dark History & Mysteries</option>
                <option value="Motivation">🔥 Daily Motivation & Wealth</option>
                <option value="Tech Breakdown">💻 Technology & AI News</option>
                <option value="Reddit Stories">💬 Reddit Stories & Confessions</option>
              </select>
            </div>

            <div className="form-group">
              <label>Voiceover Model (Free Neural Storyteller)</label>
              <select value={voice} onChange={(e) => setVoice(e.target.value)} className="select-field">
                <option value="hi-IN-MadhurNeural">🇮🇳 Hindi Male: Madhur (Comic Storyteller)</option>
                <option value="hi-IN-SwaraNeural">🇮🇳 Hindi Female: Swara (Storyteller)</option>
                <option value="en-US-ChristopherNeural">🇺🇸 English Male: Christopher (Deep & Serious)</option>
                <option value="en-US-GuyNeural">🇺🇸 English Male: Guy (Energetic)</option>
                <option value="en-US-JennyNeural">🇺🇸 English Female: Jenny (Clear & Engaging)</option>
                <option value="en-GB-RyanNeural">🇬🇧 English Male: Ryan (British Narrative)</option>
              </select>
            </div>

            <button type="submit" disabled={isGenerating} className="btn btn-accent">
              {isGenerating ? "⏳ Generating Short..." : "✨ Create Faceless Short"}
            </button>
          </div>
        </form>

        {isGenerating && (
          <div className="progress-section">
            <div className="step-indicator">Current Stage: <strong>{currentStep}</strong></div>
            <div className="log-box">
              {logs.slice(-6).map((log, i) => (
                <div key={i} className="log-line">{log}</div>
              ))}
            </div>
          </div>
        )}

        {error && <div className="error-badge">❌ {error}</div>}

        {result && (
          <div className="faceless-result-card">
            <h3>🎉 Short Created Successfully!</h3>

            <div className="faceless-preview-layout">
              <div className="player-column">
                <video
                  controls
                  autoPlay
                  className="video-player"
                  src={`${API_BASE}/shortgpt-videos/${result.filename}`}
                />
                <div className="video-stats-row">
                  {result.duration && <span className="duration-badge">⏱ {result.duration}s</span>}
                  <span className="quality-badge">1080×1920 HD</span>
                </div>
                <ScheduleBtn
                  API_BASE={API_BASE}
                  videoPath={result.videoPath}
                  filename={result.filename}
                  thumbnailPath={result.thumbnailPath}
                  thumbnailFilename={result.thumbnailFilename}
                  title={result.title}
                  description={result.description}
                />
              </div>

              <div className="metadata-column">
                {result.thumbnailFilename && (
                  <div className="meta-box thumbnail-box">
                    <label><strong>Generated Thumbnail:</strong></label>
                    <img
                      src={`${API_BASE}/shortgpt-videos/${result.thumbnailFilename}`}
                      alt="Video thumbnail"
                      className="thumbnail-preview"
                    />
                  </div>
                )}
                <h4>{result.title}</h4>
                <div className="meta-box">
                  <label><strong>AI Generated Script:</strong></label>
                  <p className="script-text">{result.script}</p>
                </div>
                <div className="meta-box">
                  <label><strong>SEO Description:</strong></label>
                  <p className="script-text" style={{fontSize: "0.85rem", opacity: 0.8}}>{result.description}</p>
                </div>
                <div className="meta-box">
                  <label><strong>Viral Hashtags:</strong></label>
                  <p className="hashtags">{result.hashtags ? result.hashtags.join(" ") : "#Shorts #Viral"}</p>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/* =================================================================== */
/* 3. AUTO-PILOT SCHEDULER TAB                                         */
/* =================================================================== */
function SchedulerTab({ API_BASE }) {
  const [queue, setQueue] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchQueue = () => {
    fetch(`${API_BASE}/api/schedule/queue`)
      .then((res) => res.json())
      .then((data) => {
        setQueue(data.queue || []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  };

  useEffect(() => {
    fetchQueue();
    const interval = setInterval(fetchQueue, 5000);
    return () => clearInterval(interval);
  }, []);

  const handleDelete = async (id) => {
    await fetch(`${API_BASE}/api/schedule/${id}`, { method: "DELETE" });
    fetchQueue();
  };

  return (
    <div className="tab-container">
      <div className="section-card">
        <h2>📅 Auto-Pilot Scheduler Queue</h2>
        <p className="card-desc">Manage upcoming automated video posts. The scheduler automatically uploads pending Shorts to YouTube at their designated time.</p>

        {loading ? (
          <p>Loading schedule queue...</p>
        ) : queue.length === 0 ? (
          <div className="empty-state">
            <p>No scheduled videos in the queue yet.</p>
            <p className="subtext">Generate a video in the Clipper or Faceless Creator tab and click "Add to Auto-Scheduler".</p>
          </div>
        ) : (
          <table className="schedule-table">
            <thead>
              <tr>
                <th>Video Title</th>
                <th>Scheduled Time</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {queue.map((item) => (
                <tr key={item.id}>
                  <td>
                    <strong>{item.title}</strong>
                    <div className="table-filename">{item.filename}</div>
                  </td>
                  <td>{new Date(item.scheduledAt).toLocaleString()}</td>
                  <td>
                    <span className={`status-pill status-pill--${item.status}`}>
                      {item.status === "published" ? "✓ Published" : "⏰ Scheduled"}
                    </span>
                  </td>
                  <td>
                    <button onClick={() => handleDelete(item.id)} className="btn-icon-danger">
                      🗑 Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

/* =================================================================== */
/* 4. MONETIZATION & NICHE STUDIO TAB                                 */
/* =================================================================== */
function MonetizationTab() {
  return (
    <div className="tab-container">
      <div className="section-card">
        <h2>💡 YouTube Monetization & Niche Studio</h2>
        <p className="card-desc">Target high-RPM niches and follow YouTube's official Partner Program policies to ensure your automated channel gets approved for monetization.</p>

        <div className="niche-grid">
          <div className="niche-card">
            <h3>💰 Top High-RPM Niches (Est. $4 - $12 RPM)</h3>
            <ul>
              <li><strong>Finance & Money Secrets</strong>: Daily tips on saving, investing, and side hustles.</li>
              <li><strong>Technology & AI News</strong>: Latest tech breakthroughs, AI tools, and future trends.</li>
              <li><strong>Space & Dark Science</strong>: Deep space mysteries, black holes, and physics facts.</li>
              <li><strong>Dark History & Crime</strong>: Historical facts, ancient secrets, and investigative stories.</li>
            </ul>
          </div>

          <div className="niche-card">
            <h3>🛡️ YouTube Monetization Rules Checklist</h3>
            <ul className="checklist">
              <li>✅ <strong>Use Natural Voices</strong>: EdgeTTS neural or human voiceovers pass human quality review.</li>
              <li>✅ <strong>Add Value & Story</strong>: Ensure every Short has a script hook and educational/entertainment value.</li>
              <li>✅ <strong>Avoid Raw Reused Footage</strong>: Combine stock imagery, text overlays, and audio to make content unique.</li>
              <li>✅ <strong>High Retention Hook</strong>: Keep script hooks under 3 seconds to maximize view percentage.</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}

/* Helper Component: Schedule Button */
function ScheduleBtn({ API_BASE, videoPath, filename, title, description }) {
  const [scheduled, setScheduled] = useState(false);

  const handleAdd = async () => {
    try {
      await fetch(`${API_BASE}/api/schedule/add`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          videoPath,
          filename: filename || videoPath,
          title: title || "Automated Short",
          description: description || "#Shorts",
          scheduledAt: new Date(Date.now() + 3600 * 1000).toISOString(),
        }),
      });
      setScheduled(true);
    } catch (e) {
      alert("Failed to schedule video");
    }
  };

  return (
    <div className="btn-group-stacked">
      <button onClick={handleAdd} disabled={scheduled} className="btn btn-secondary btn-block">
        {scheduled ? "✓ Added to Auto-Scheduler" : "📅 Add to Auto-Scheduler"}
      </button>
      <PublishBtn API_BASE={API_BASE} videoPath={videoPath} filename={filename} title={title} description={description} />
    </div>
  );
}

/* Helper Component: YouTube Studio Direct Publisher Button & Modal */
function PublishBtn({ API_BASE, videoPath, filename, thumbnailPath, thumbnailFilename, title, description }) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <button onClick={() => setIsOpen(true)} className="btn btn-accent btn-block" style={{ marginTop: "6px" }}>
        🚀 Publish to YouTube Studio
      </button>
      {isOpen && (
        <PublishModal
          API_BASE={API_BASE}
          videoPath={videoPath}
          filename={filename}
          thumbnailPath={thumbnailPath}
          thumbnailFilename={thumbnailFilename}
          initialTitle={title}
          initialDescription={description}
          onClose={() => setIsOpen(false)}
        />
      )}
    </>
  );
}

function PublishModal({ API_BASE, videoPath, filename, thumbnailPath, thumbnailFilename, initialTitle, initialDescription, onClose }) {
  const [title, setTitle] = useState(initialTitle || "New Short #Shorts");
  const [description, setDescription] = useState(initialDescription || "#Shorts");
  const [privacyStatus, setPrivacyStatus] = useState("public");
  const [categoryId, setCategoryId] = useState("28");
  const [isUploading, setIsUploading] = useState(false);
  const [uploadResult, setUploadResult] = useState(null);
  const [error, setError] = useState(null);

  const handleUpload = async (e) => {
    e.preventDefault();
    setIsUploading(true);
    setError(null);
    setUploadResult(null);

    try {
      const res = await fetch(`${API_BASE}/api/youtube/upload`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          videoPath,
          filename,
          thumbnailPath,
          thumbnailFilename,
          title,
          description,
          privacyStatus,
          categoryId,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Upload failed");
      }

      setUploadResult(data);
      setIsUploading(false);
    } catch (err) {
      setError(err.message);
      setIsUploading(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content yt-studio-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>▶️ YouTube Studio Publisher</h3>
          <button onClick={onClose} className="modal-close-btn">✕</button>
        </div>

        {uploadResult ? (
          <div className="upload-success-card">
            <span className="success-icon">🎉</span>
            <h3>Short Published to YouTube!</h3>
            <p className="success-subtitle">Your video is now live on your YouTube channel.</p>

            <div className="url-box">
              <label>YouTube Short URL:</label>
              <a href={uploadResult.url} target="_blank" rel="noreferrer" className="url-link">
                {uploadResult.url}
              </a>
            </div>

            {uploadResult.thumbnailUploaded && (
              <div className="thumb-success-badge">✓ Custom thumbnail set successfully</div>
            )}

            <div className="modal-action-row" style={{ marginTop: "20px" }}>
              <a href={uploadResult.url} target="_blank" rel="noreferrer" className="btn btn-accent">
                ▶️ Watch Short on YouTube
              </a>
              <a href={uploadResult.studioUrl} target="_blank" rel="noreferrer" className="btn btn-secondary">
                ✏️ Edit in YouTube Studio
              </a>
              <button onClick={onClose} className="btn btn-secondary">Close</button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleUpload} className="yt-upload-form">
            <div className="form-group">
              <label>
                Short Title <span className="char-count">({title.length}/100)</span>
              </label>
              <input
                type="text"
                value={title}
                maxLength={100}
                onChange={(e) => setTitle(e.target.value)}
                required
                className="input-field"
              />
            </div>

            <div className="form-group">
              <label>Description & Hashtags</label>
              <textarea
                value={description}
                rows={4}
                onChange={(e) => setDescription(e.target.value)}
                className="textarea-field"
              />
            </div>

            <div className="form-row">
              <div className="form-group">
                <label>Visibility</label>
                <select value={privacyStatus} onChange={(e) => setPrivacyStatus(e.target.value)} className="select-field">
                  <option value="public">🌐 Public (Immediate Live)</option>
                  <option value="unlisted">🔗 Unlisted (Link Only)</option>
                  <option value="private">🔒 Private (Draft)</option>
                </select>
              </div>

              <div className="form-group">
                <label>YouTube Category</label>
                <select value={categoryId} onChange={(e) => setCategoryId(e.target.value)} className="select-field">
                  <option value="28">💻 Science & Technology</option>
                  <option value="24">🎭 Entertainment</option>
                  <option value="20">🎮 Gaming</option>
                  <option value="27">📚 Education</option>
                  <option value="22">👤 People & Blogs</option>
                </select>
              </div>
            </div>

            {error && (
              <div className="error-badge" style={{ marginTop: "12px" }}>
                ❌ {error}
              </div>
            )}

            <div className="modal-action-row" style={{ marginTop: "20px" }}>
              <button type="submit" disabled={isUploading} className="btn btn-accent">
                {isUploading ? "⏳ Uploading to YouTube..." : "🚀 Upload Video Now"}
              </button>
              <button type="button" onClick={onClose} disabled={isUploading} className="btn btn-secondary">
                Cancel
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

/* =================================================================== */
/* 5. STORAGE MANAGER TAB                                              */
/* =================================================================== */
function StorageTab({ API_BASE }) {
  const [data, setData] = useState({ files: [], totalFiles: 0, totalSizeLabel: "0 B", categoryTotals: {} });
  const [loading, setLoading] = useState(true);
  const [filterCategory, setFilterCategory] = useState("all");
  const [confirmClear, setConfirmClear] = useState(null);

  const fetchStorage = () => {
    fetch(`${API_BASE}/api/storage/all`)
      .then((res) => res.json())
      .then((resData) => {
        setData(resData);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  };

  useEffect(() => {
    fetchStorage();
  }, []);

  const handleDeleteFile = async (file) => {
    try {
      await fetch(`${API_BASE}/api/storage/file?source=${encodeURIComponent(file.source)}&filename=${encodeURIComponent(file.filename)}`, {
        method: "DELETE",
      });
      fetchStorage();
    } catch {
      alert("Failed to delete file");
    }
  };

  const handleClearCategory = async (cat) => {
    try {
      await fetch(`${API_BASE}/api/storage/clear-category`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ category: cat }),
      });
      setConfirmClear(null);
      fetchStorage();
    } catch {
      alert("Failed to clear storage category");
    }
  };

  const filteredFiles = useMemo(() => {
    if (filterCategory === "all") return data.files || [];
    return (data.files || []).filter((f) => f.category === filterCategory);
  }, [data.files, filterCategory]);

  return (
    <div className="tab-container">
      <div className="section-card">
        <h2>💾 Disk Storage Manager</h2>
        <p className="card-desc">Monitor generated videos, audio tracks, thumbnails, and subtitle files. Clear unwanted files to free up disk space.</p>

        {/* Summary Dashboard Header */}
        <div className="storage-summary-grid">
          <div className="storage-stat-card storage-stat-card--total">
            <span className="stat-icon">💽</span>
            <div>
              <div className="stat-value">{data.totalSizeLabel}</div>
              <div className="stat-label">Total Storage Used ({data.totalFiles} Files)</div>
            </div>
          </div>

          <div className="storage-stat-card">
            <span className="stat-icon">🎬</span>
            <div>
              <div className="stat-value">{data.categoryTotals?.video || "0 B"}</div>
              <div className="stat-label">Videos (.mp4)</div>
            </div>
          </div>

          <div className="storage-stat-card">
            <span className="stat-icon">🎵</span>
            <div>
              <div className="stat-value">{data.categoryTotals?.audio || "0 B"}</div>
              <div className="stat-label">Audio (.mp3)</div>
            </div>
          </div>

          <div className="storage-stat-card">
            <span className="stat-icon">🖼️</span>
            <div>
              <div className="stat-value">{data.categoryTotals?.thumbnail || "0 B"}</div>
              <div className="stat-label">Thumbnails (.jpg)</div>
            </div>
          </div>
        </div>

        {/* Quick Action Controls */}
        <div className="storage-actions-bar">
          <div className="filter-pill-group">
            {["all", "video", "audio", "thumbnail", "subtitle"].map((cat) => (
              <button
                key={cat}
                className={`filter-pill ${filterCategory === cat ? "filter-pill--active" : ""}`}
                onClick={() => setFilterCategory(cat)}
              >
                {cat === "all" && "📁 All Files"}
                {cat === "video" && "🎬 Videos"}
                {cat === "audio" && "🎵 Audio"}
                {cat === "thumbnail" && "🖼️ Thumbnails"}
                {cat === "subtitle" && "💬 Subtitles"}
              </button>
            ))}
          </div>

          <div className="clear-btn-group">
            <button className="btn btn-secondary btn-sm" onClick={() => setConfirmClear("audio")}>
              🧹 Clear Audio Files
            </button>
            <button className="btn btn-danger btn-sm" onClick={() => setConfirmClear("all")}>
              🚨 Clear ALL Storage
            </button>
          </div>
        </div>

        {/* Confirmation Modal/Banner */}
        {confirmClear && (
          <div className="confirm-banner">
            <span>⚠️ Are you sure you want to delete <strong>{confirmClear === "all" ? "ALL generated files" : `all ${confirmClear} files`}</strong>?</span>
            <div className="confirm-banner-btns">
              <button className="btn btn-danger btn-sm" onClick={() => handleClearCategory(confirmClear)}>Yes, Delete Now</button>
              <button className="btn btn-secondary btn-sm" onClick={() => setConfirmClear(null)}>Cancel</button>
            </div>
          </div>
        )}

        {/* Storage Files List Table */}
        {loading ? (
          <p>Loading storage details...</p>
        ) : filteredFiles.length === 0 ? (
          <div className="empty-queue">
            <span>✨ No files found in this category. Disk space is clear!</span>
          </div>
        ) : (
          <div className="storage-table-wrapper">
            <table className="storage-table">
              <thead>
                <tr>
                  <th>File Name</th>
                  <th>Source Engine</th>
                  <th>Category</th>
                  <th>Size</th>
                  <th>Date Created</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {filteredFiles.map((file) => (
                  <tr key={file.id}>
                    <td>
                      <a href={`${API_BASE}${file.url}`} target="_blank" rel="noreferrer" className="file-link">
                        {file.filename}
                      </a>
                    </td>
                    <td><span className="source-tag">{file.source}</span></td>
                    <td>
                      <span className={`cat-badge cat-badge--${file.category}`}>
                        {file.category.toUpperCase()}
                      </span>
                    </td>
                    <td><strong>{file.sizeLabel}</strong></td>
                    <td className="date-cell">{file.dateFormatted}</td>
                    <td>
                      <button
                        onClick={() => handleDeleteFile(file)}
                        className="btn btn-danger btn-xs"
                        title="Delete File"
                      >
                        🗑️ Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
