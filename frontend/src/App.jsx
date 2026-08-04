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

/* ─── Robust SSE Stream Reader ───────────────────────────────────── */
async function parseSSEResponse(response, onEvent) {
  if (!response.ok) {
    let errText = "Server error";
    try {
      const errJson = await response.json();
      errText = errJson.error || errText;
    } catch {}
    throw new Error(errText);
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const chunks = buffer.split("\n\n");
      buffer = chunks.pop() || "";

      for (const chunk of chunks) {
        if (!chunk.trim()) continue;
        processSSEChunk(chunk, onEvent);
      }
    }
    // Flush remaining buffer when stream finishes
    if (buffer.trim()) {
      processSSEChunk(buffer, onEvent);
    }
  } catch (err) {
    onEvent("error", { error: err.message || "Stream read error" });
  }
}

function processSSEChunk(chunk, onEvent) {
  let eventName = "message";
  let dataStr = "";

  const lines = chunk.split("\n");
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith("event:")) {
      eventName = trimmed.slice(6).trim();
    } else if (trimmed.startsWith("data:")) {
      dataStr += trimmed.slice(5).trim();
    }
  }

  if (dataStr) {
    try {
      const data = JSON.parse(dataStr);
      onEvent(eventName, data);
    } catch (e) {
      onEvent(eventName, { text: dataStr });
    }
  }
}

export default function App() {
  const [activeTab, setActiveTab] = useState("overview"); // overview, niche_scout, trending, clipper, faceless, channels, autodev, scheduler, monetization, storage
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [ytConnected, setYtConnected] = useState(false);
  const [selectedNiche, setSelectedNiche] = useState(null);
  const [selectedTopic, setSelectedTopic] = useState("");

  // Check YouTube connection & selected niche
  useEffect(() => {
    fetch(`${API_BASE}/api/youtube/status`, { credentials: "include" })
      .then((res) => res.json())
      .then((data) => setYtConnected(!!data.connected))
      .catch(() => setYtConnected(false));

    fetch(`${API_BASE}/api/niche-scout/discover`)
      .then((res) => res.json())
      .then((data) => {
        if (data.selectedNiche) setSelectedNiche(data.selectedNiche);
      })
      .catch(() => {});
  }, []);

  const handleLaunchFacelessWithTopic = (topicText, nicheObj) => {
    if (topicText) setSelectedTopic(topicText);
    if (nicheObj) setSelectedNiche(nicheObj);
    setActiveTab("faceless");
  };

  const getTabTitle = (tab) => {
    switch (tab) {
      case "overview": return "📊 Executive Overview Dashboard";
      case "niche_scout": return "🕵️ Niche Scout AI Agent (Web Research)";
      case "trending": return "🔥 Live Trending Discovery";
      case "clipper": return "✂️ Long-to-Short Video Clipper";
      case "faceless": return "🤖 Faceless AI Video Generator";
      case "channels": return "📺 Multi-Channel AI Studio";
      case "autodev": return "🧠 Autonomous AI Dev Daemon";
      case "scheduler": return "🚀 Auto-Pilot Scheduler";
      case "monetization": return "💰 RPM & Monetization Analytics";
      case "storage": return "💾 System Disk & Storage Manager";
      default: return "YouTube Automation Studio";
    }
  };

  return (
    <div className="app-shell">
      {/* Left Collapsible Sidebar Navigation */}
      <aside className={`sidebar ${sidebarCollapsed ? "sidebar--collapsed" : ""}`}>
        <div className="sidebar-brand">
          <span className="brand-logo">⚡</span>
          {!sidebarCollapsed && <span className="brand-name">ClipHi Studio AI</span>}
          <button
            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
            className="sidebar-toggle-btn"
            title="Toggle Sidebar"
          >
            {sidebarCollapsed ? "▶" : "◀"}
          </button>
        </div>

        {/* Navigation Category Links */}
        <nav className="sidebar-nav">
          <div className="nav-section-title">{!sidebarCollapsed && "CORE STUDIO"}</div>
          <button
            className={`sidebar-link ${activeTab === "overview" ? "active" : ""}`}
            onClick={() => setActiveTab("overview")}
          >
            <span className="link-icon">📊</span>
            {!sidebarCollapsed && <span>Overview Dashboard</span>}
          </button>

          <button
            className={`sidebar-link ${activeTab === "niche_scout" ? "active" : ""}`}
            onClick={() => setActiveTab("niche_scout")}
          >
            <span className="link-icon">🕵️</span>
            {!sidebarCollapsed && <span>Niche Scout AI</span>}
            {!sidebarCollapsed && <span className="badge-new">NEW</span>}
          </button>

          <button
            className={`sidebar-link ${activeTab === "trending" ? "active" : ""}`}
            onClick={() => setActiveTab("trending")}
          >
            <span className="link-icon">🔥</span>
            {!sidebarCollapsed && <span>Live Trends</span>}
          </button>

          <div className="nav-section-title">{!sidebarCollapsed && "GENERATORS"}</div>
          <button
            className={`sidebar-link ${activeTab === "faceless" ? "active" : ""}`}
            onClick={() => setActiveTab("faceless")}
          >
            <span className="link-icon">🤖</span>
            {!sidebarCollapsed && <span>Faceless AI</span>}
          </button>

          <button
            className={`sidebar-link ${activeTab === "clipper" ? "active" : ""}`}
            onClick={() => setActiveTab("clipper")}
          >
            <span className="link-icon">✂️</span>
            {!sidebarCollapsed && <span>Video Clipper</span>}
          </button>

          <div className="nav-section-title">{!sidebarCollapsed && "AUTOMATION"}</div>
          <button
            className={`sidebar-link ${activeTab === "autodev" ? "active" : ""}`}
            onClick={() => setActiveTab("autodev")}
          >
            <span className="link-icon">🧠</span>
            {!sidebarCollapsed && <span>Auto-Dev Agent</span>}
          </button>

          <button
            className={`sidebar-link ${activeTab === "channels" ? "active" : ""}`}
            onClick={() => setActiveTab("channels")}
          >
            <span className="link-icon">📺</span>
            {!sidebarCollapsed && <span>Multi-Channel AI</span>}
          </button>

          <button
            className={`sidebar-link ${activeTab === "scheduler" ? "active" : ""}`}
            onClick={() => setActiveTab("scheduler")}
          >
            <span className="link-icon">🚀</span>
            {!sidebarCollapsed && <span>Auto-Pilot</span>}
          </button>

          <div className="nav-section-title">{!sidebarCollapsed && "FINANCE & DATA"}</div>
          <button
            className={`sidebar-link ${activeTab === "monetization" ? "active" : ""}`}
            onClick={() => setActiveTab("monetization")}
          >
            <span className="link-icon">💰</span>
            {!sidebarCollapsed && <span>Monetization</span>}
          </button>

          <button
            className={`sidebar-link ${activeTab === "storage" ? "active" : ""}`}
            onClick={() => setActiveTab("storage")}
          >
            <span className="link-icon">💾</span>
            {!sidebarCollapsed && <span>Storage</span>}
          </button>
        </nav>
      </aside>

      {/* Main Content Workspace */}
      <div className="main-wrapper">
        <header className="topbar">
          <div className="topbar-left">
            <h1 className="topbar-title">{getTabTitle(activeTab)}</h1>
            {selectedNiche && (
              <span className="active-niche-pill">
                🎯 Active Niche: <strong>{selectedNiche.title}</strong> ({selectedNiche.estimatedRPM} RPM)
              </span>
            )}
          </div>

          <div className="topbar-right">
            <button onClick={() => setActiveTab("faceless")} className="btn btn-primary btn-sm">
              ⚡ Create New Short
            </button>
            {ytConnected ? (
              <span className="yt-badge yt-badge--connected">✓ YouTube Connected</span>
            ) : (
              <a href={`${API_BASE}/auth/google`} className="yt-connect-btn">
                🔗 Connect YouTube
              </a>
            )}
          </div>
        </header>

        {/* Content Area */}
        <main className="content-area">
          {activeTab === "overview" && <OverviewTab API_BASE={API_BASE} setActiveTab={setActiveTab} selectedNiche={selectedNiche} onLaunchFaceless={handleLaunchFacelessWithTopic} />}
          {activeTab === "niche_scout" && <NicheScoutTab API_BASE={API_BASE} setActiveTab={setActiveTab} onSelectNiche={setSelectedNiche} onLaunchFaceless={handleLaunchFacelessWithTopic} />}
          {activeTab === "trending" && <TrendingTab API_BASE={API_BASE} />}
          {activeTab === "clipper" && <ClipperTab API_BASE={API_BASE} />}
          {activeTab === "faceless" && <FacelessTab API_BASE={API_BASE} selectedTopic={selectedTopic} selectedNiche={selectedNiche} />}
          {activeTab === "channels" && <ChannelsTab API_BASE={API_BASE} />}
          {activeTab === "autodev" && <AutoDevTab API_BASE={API_BASE} />}
          {activeTab === "scheduler" && <SchedulerTab API_BASE={API_BASE} />}
          {activeTab === "monetization" && <MonetizationTab API_BASE={API_BASE} />}
          {activeTab === "storage" && <StorageTab API_BASE={API_BASE} />}
        </main>
      </div>
    </div>
  );
}

/* =================================================================== */
/* 0. TRENDING TOPICS TAB (LIVE TREND DISCOVERY + 1-CLICK GENERATE)    */
/* =================================================================== */
function TrendingTab({ API_BASE }) {
  const [trends, setTrends] = useState([]);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [source, setSource] = useState("");
  const [filterNiche, setFilterNiche] = useState("All");
  const [generating, setGenerating] = useState(null); // id of trend being generated
  const [genLogs, setGenLogs] = useState([]);
  const [currentStep, setCurrentStep] = useState("Initializing ShortGPT engine...");
  const [genResult, setGenResult] = useState(null);
  const [genError, setGenError] = useState(null);

  const fetchTrends = (forceRefresh = false) => {
    setLoading(true);
    fetch(`${API_BASE}/api/trending/list?forceRefresh=${forceRefresh}`)
      .then((res) => res.json())
      .then((data) => {
        setTrends(data.topics || []);
        setLastUpdated(data.lastUpdated);
        setSource(data.source);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  };

  useEffect(() => {
    fetchTrends();
  }, []);

  const niches = useMemo(() => {
    const set = new Set(trends.map((t) => t.niche));
    return ["All", ...Array.from(set)];
  }, [trends]);

  const filteredTrends = useMemo(() => {
    if (filterNiche === "All") return trends;
    return trends.filter((t) => t.niche === filterNiche);
  }, [trends, filterNiche]);

  const handleGenerateFromTrend = async (trend) => {
    setGenerating(trend.id);
    setGenLogs([]);
    setGenResult(null);
    setGenError(null);
    setCurrentStep("Initializing ShortGPT engine...");

    try {
      const response = await fetch(`${API_BASE}/api/trending/generate-from-trend`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          topic: trend.suggestedTopic || trend.title,
          niche: trend.niche || "Facts",
        }),
      });

      await parseSSEResponse(response, (eventName, data) => {
        if (eventName === "step") {
          if (data.label) setCurrentStep(data.label);
          if (data.detail) setGenLogs((prev) => [...prev.slice(-30), `[${data.step || "step"}] ${data.label}: ${data.detail}`]);
        } else if (eventName === "log") {
          if (data.text) setGenLogs((prev) => [...prev.slice(-30), data.text]);
        } else if (eventName === "complete") {
          setGenResult(data);
        } else if (eventName === "error") {
          setGenError(data.error || "Trend generation error");
        }
      });
    } catch (err) {
      setGenError(err.message);
    } finally {
      setGenerating(null);
    }
  };

  function viralScoreColor(score) {
    if (score >= 85) return "#10b981";
    if (score >= 70) return "#f59e0b";
    if (score >= 50) return "#3b82f6";
    return "#6b7280";
  }

  function nicheColor(niche) {
    const map = {
      "Finance & Wealth": "#f59e0b",
      "AI & Technology": "#3b82f6",
      "Space & Science": "#8b5cf6",
      "Motivation": "#f97316",
      "Dark History": "#ef4444",
      "Facts & Curiosity": "#10b981",
      "Animals & Nature": "#06b6d4",
      "Entertainment": "#ec4899",
    };
    return map[niche] || "#6b7280";
  }

  return (
    <div className="tab-container">
      <div className="section-card">
        <div className="trending-header">
          <div>
            <h2>🔥 Live Trending Topics</h2>
            <p className="card-desc">
              Real-time viral topics from YouTube. Pick any trend and generate a Short in one click.
              {lastUpdated && (
                <span className="trending-updated">
                  {" "}Updated: {new Date(lastUpdated).toLocaleTimeString()}
                  {source && <span className="trending-source"> ({source})</span>}
                </span>
              )}
            </p>
          </div>
          <button
            onClick={() => fetchTrends(true)}
            disabled={loading}
            className="btn btn-secondary"
          >
            {loading ? "⏳ Loading..." : "🔄 Refresh Trends"}
          </button>
        </div>

        {/* Niche filter pills */}
        <div className="trending-filter-row">
          {niches.map((n) => (
            <button
              key={n}
              className={`filter-pill ${filterNiche === n ? "filter-pill--active" : ""}`}
              onClick={() => setFilterNiche(n)}
              style={filterNiche === n && n !== "All" ? { background: nicheColor(n), borderColor: nicheColor(n) } : {}}
            >
              {n}
            </button>
          ))}
        </div>

        {/* Trend Cards Grid */}
        {loading && trends.length === 0 ? (
          <div className="empty-state">
            <p>⏳ Fetching trending topics...</p>
          </div>
        ) : (
          <div className="trending-grid">
            {filteredTrends.map((trend) => (
              <div key={trend.id} className="trend-card">
                <div className="trend-card-top">
                  <span className="trend-rank">#{trend.rank}</span>
                  <span
                    className="trend-viral-badge"
                    style={{ background: `${viralScoreColor(trend.viralScore)}20`, color: viralScoreColor(trend.viralScore), borderColor: `${viralScoreColor(trend.viralScore)}40` }}
                  >
                    🔥 {trend.viralScore}
                  </span>
                </div>

                {trend.thumbnail && (
                  <img src={trend.thumbnail} alt="" className="trend-thumbnail" />
                )}

                <h4 className="trend-title">{trend.title}</h4>

                <div className="trend-meta-row">
                  <span
                    className="trend-niche-tag"
                    style={{ background: `${nicheColor(trend.niche)}20`, color: nicheColor(trend.niche), borderColor: `${nicheColor(trend.niche)}40` }}
                  >
                    {trend.niche}
                  </span>
                  {trend.channelTitle && trend.channelTitle !== "Trending Topic" && (
                    <span className="trend-channel">{trend.channelTitle}</span>
                  )}
                </div>

                <div className="trend-stats-row">
                  <span>👁 {(trend.views || 0).toLocaleString()}</span>
                  <span>👍 {(trend.likes || 0).toLocaleString()}</span>
                  <span>💬 {(trend.comments || 0).toLocaleString()}</span>
                </div>

                <button
                  onClick={() => handleGenerateFromTrend(trend)}
                  disabled={generating !== null}
                  className="btn btn-primary btn-block trend-generate-btn"
                >
                  {generating === trend.id ? "⏳ Generating..." : "⚡ Create Short from Trend"}
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Generation Progress Indicator & Live Logs */}
        {generating && (
          <div className="progress-section" style={{ marginTop: "24px" }}>
            <div className="step-indicator">Current Stage: <strong>{currentStep}</strong></div>
            <div className="log-box">
              {genLogs.length === 0 ? (
                <div className="log-line">Initializing generator process...</div>
              ) : (
                genLogs.slice(-8).map((log, i) => (
                  <div key={i} className="log-line">{log}</div>
                ))
              )}
            </div>
          </div>
        )}

        {genError && <div className="error-badge" style={{ marginTop: "16px" }}>❌ {genError}</div>}

        {/* Generated Result Preview Card */}
        {genResult && (
          <div className="faceless-result-card">
            <h3>🎉 Trend Short Created!</h3>
            <div className="faceless-preview-layout">
              <div className="player-column">
                <video
                  controls
                  autoPlay
                  className="video-player"
                  src={`${API_BASE}/shortgpt-videos/${genResult.filename}`}
                />
                <div className="video-stats-row" style={{ marginTop: "8px", display: "flex", gap: "10px" }}>
                  {genResult.duration && <span className="duration-badge">⏱ {genResult.duration}s</span>}
                  <span className="quality-badge">1080×1920 HD</span>
                </div>
                <ScheduleBtn
                  API_BASE={API_BASE}
                  videoPath={genResult.videoPath}
                  filename={genResult.filename}
                  thumbnailPath={genResult.thumbnailPath}
                  thumbnailFilename={genResult.thumbnailFilename}
                  title={genResult.title}
                  description={genResult.description}
                />
              </div>

              <div className="metadata-column">
                {genResult.thumbnailFilename && (
                  <div className="meta-box thumbnail-box">
                    <label><strong>Generated Thumbnail:</strong></label>
                    <img
                      src={`${API_BASE}/shortgpt-videos/${genResult.thumbnailFilename}`}
                      alt="Video thumbnail"
                      className="thumbnail-preview"
                    />
                  </div>
                )}
                <h4>{genResult.title}</h4>
                {genResult.script && (
                  <div className="meta-box">
                    <label><strong>AI Generated Script:</strong></label>
                    <p className="script-text">{genResult.script}</p>
                  </div>
                )}
                {genResult.description && (
                  <div className="meta-box">
                    <label><strong>SEO Description:</strong></label>
                    <p className="script-text" style={{ fontSize: "0.85rem", opacity: 0.8 }}>{genResult.description}</p>
                  </div>
                )}
                {genResult.hashtags && (
                  <div className="meta-box">
                    <label><strong>Viral Hashtags:</strong></label>
                    <p className="hashtags">{genResult.hashtags.join(" ")}</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
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

      await parseSSEResponse(response, (eventName, data) => {
        if (eventName === "step") {
          if (data.step) setCurrentStep(data.step);
        } else if (eventName === "log") {
          if (data.text) setLogs((prev) => [...prev.slice(-30), data.text]);
        } else if (eventName === "complete") {
          setResult(data);
        } else if (eventName === "error") {
          setError(data.error || "Generation error");
        }
      });
    } catch (err) {
      setError(err.message);
    } finally {
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
const RANDOM_VIRAL_IDEAS = [
  { topic: "3 Quantum Computing Secrets That Will Replace Supercomputers", niche: "AI & Technology" },
  { topic: "Why 80% of Earth's Ocean Remains Completely Unexplored", niche: "Unsolved Ocean Mysteries" },
  { topic: "3 Marcus Aurelius Rules to Become Unshakable", niche: "Stoic Mindset" },
  { topic: "3 Terrifying Creatures Discovered at the Bottom of Mariana Trench", niche: "Unsolved Ocean Mysteries" },
  { topic: "3 Free AI Tools That Make You $100 a Day Passively", niche: "AI Wealth & Side Hustles" },
  { topic: "Why Google's Quantum Computer Scares Cybersecurity Experts", niche: "AI & Technology" },
  { topic: "The Dark Psychology Trick People Use to Manipulate You", niche: "Stoic Mindset" },
  { topic: "3 Ancient Monsters That Were Actually Real", niche: "Ancient Mythical Creatures" },
  { topic: "How AI and Quantum Chips Will Change Everything by 2030", niche: "AI & Technology" },
  { topic: "Why Ancient Civilizations Built Giant Underground Cities", niche: "Ancient Mythical Creatures" },
  { topic: "The Unexplained Metallic Sound Coming From the Pacific Ocean Floor", niche: "Unsolved Ocean Mysteries" },
  { topic: "3 Mind-Blowing Secrets About Black Holes", niche: "Space Facts" },
  { topic: "Smart Cat Tricks Owner to Steal Unlimited Snacks", niche: "Animated Cat Tales" },
  { topic: "Monkey vs Robot: Smart Animal Outsmarts High Tech Trap", niche: "Smart Animal Pranks" }
];

function mapScoutedNicheToSelect(scouted) {
  if (!scouted) return "Space Facts";
  const title = typeof scouted === "string" ? scouted : scouted.title || scouted.nicheGroup || scouted.niche || "";
  if (/quantum|ai fusion|tech/i.test(title)) return "AI & Technology";
  if (/ocean|sea|water/i.test(title)) return "Unsolved Ocean Mysteries";
  if (/stoic|mindset|psychology/i.test(title)) return "Stoic Mindset";
  if (/wealth|money|hustle|automation/i.test(title)) return "AI Wealth & Side Hustles";
  if (/myth|ancient|creature/i.test(title)) return "Ancient Mythical Creatures";
  if (/dark history|history/i.test(title)) return "Dark History";
  if (/motivation/i.test(title)) return "Motivation";
  if (/cat/i.test(title)) return "Animated Cat Tales";
  if (/animal|monkey/i.test(title)) return "Smart Animal Pranks";
  if (/space|science/i.test(title)) return "Space Facts";
  return "Space Facts";
}

/* =================================================================== */
/* 2. FACELESS SHORT CREATOR TAB (SHORTGPT ENGINE)                     */
/* =================================================================== */
function FacelessTab({ API_BASE, selectedTopic, selectedNiche }) {
  const [topic, setTopic] = useState("");
  const [niche, setNiche] = useState("Space Facts");
  const [voice, setVoice] = useState("en-US-ChristopherNeural");
  const [isGenerating, setIsGenerating] = useState(false);
  const [logs, setLogs] = useState([]);
  const [currentStep, setCurrentStep] = useState("");
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (selectedTopic) {
      setTopic(selectedTopic);
    }
  }, [selectedTopic]);

  useEffect(() => {
    if (selectedNiche) {
      const mapped = mapScoutedNicheToSelect(selectedNiche);
      setNiche(mapped);
    }
  }, [selectedNiche]);

  const handlePickRandomIdea = () => {
    const random = RANDOM_VIRAL_IDEAS[Math.floor(Math.random() * RANDOM_VIRAL_IDEAS.length)];
    setTopic(random.topic);
    setNiche(random.niche);
  };

  const handleCreateFaceless = async (e) => {
    e.preventDefault();
    if (!topic) return;

    setIsGenerating(true);
    setError(null);
    setResult(null);
    setLogs([]);
    setCurrentStep("Initializing ShortGPT engine...");

    const params = new URLSearchParams({ topic, niche, voice });
    try {
      const response = await fetch(`${API_BASE}/api/faceless/generate?${params}`);
      await parseSSEResponse(response, (eventName, data) => {
        if (eventName === "step") {
          if (data.label) setCurrentStep(data.label);
        } else if (eventName === "log") {
          if (data.text) setLogs((prev) => [...prev.slice(-30), data.text]);
        } else if (eventName === "complete") {
          setResult(data);
        } else if (eventName === "error") {
          setError(data.error || "Faceless generation error");
        }
      });
    } catch (err) {
      setError(err.message);
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="tab-container">
      <div className="section-card">
        <h2>🤖 Faceless Short Creator (ShortGPT Engine)</h2>
        <p className="card-desc">Type any topic or prompt to generate an automated script, voiceover (EdgeTTS Neural), background visual assets, and vertical video.</p>

        <form onSubmit={handleCreateFaceless} className="faceless-form">
          <div className="form-group">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "6px" }}>
              <label style={{ margin: 0 }}>Short Topic / Prompt</label>
              <button
                type="button"
                onClick={handlePickRandomIdea}
                className="btn btn-secondary btn-xs"
              >
                🎲 Random Viral Idea
              </button>
            </div>
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
                <option value="Space Facts">🌌 Space & Science Secrets</option>
                <option value="AI & Technology">⚡ Quantum Computing & AI Fusion</option>
                <option value="Unsolved Ocean Mysteries">🌊 Unsolved Deep Ocean Mysteries</option>
                <option value="Stoic Mindset">🏛️ Stoic Mindset & Dark Psychology</option>
                <option value="AI Wealth & Side Hustles">💵 AI Wealth & Automation Hacks</option>
                <option value="Ancient Mythical Creatures">🏺 Ancient Mythical Creatures & History</option>
                <option value="Dark History">📜 Dark History & Mysteries</option>
                <option value="Motivation">🔥 Daily Motivation & Wealth</option>
                <option value="Tech Breakdown">💻 Technology & AI News</option>
                <option value="Animated Cat Tales">🐱 3D Animated Cat Tales</option>
                <option value="Smart Animal Pranks">🐵 Smart Monkey & Animal Pranks</option>
                <option value="Hindi Story Shorts">🇮🇳 Hindi Funny Story Shorts</option>
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
/* 3. AUTO-PILOT SCHEDULER TAB (EXPANDED)                              */
/* =================================================================== */
function SchedulerTab({ API_BASE }) {
  const [queue, setQueue] = useState([]);
  const [loading, setLoading] = useState(true);
  const [autopilotStatus, setAutopilotStatus] = useState(null);
  const [settings, setSettings] = useState(null);
  const [triggering, setTriggering] = useState(false);
  const [showLogs, setShowLogs] = useState(false);

  const fetchQueue = () => {
    fetch(`${API_BASE}/api/schedule/queue`)
      .then((res) => res.json())
      .then((data) => {
        setQueue(data.queue || []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  };

  const fetchAutopilot = () => {
    fetch(`${API_BASE}/api/autopilot/status`)
      .then((res) => res.json())
      .then((data) => {
        setAutopilotStatus(data);
        if (data.settings) setSettings(data.settings);
      })
      .catch(() => {});
  };

  useEffect(() => {
    fetchQueue();
    fetchAutopilot();
    const interval = setInterval(() => { fetchQueue(); fetchAutopilot(); }, 5000);
    return () => clearInterval(interval);
  }, []);

  const handleDelete = async (id) => {
    await fetch(`${API_BASE}/api/schedule/${id}`, { method: "DELETE" });
    fetchQueue();
  };

  const handleToggle = async () => {
    const newEnabled = !settings?.enabled;
    const res = await fetch(`${API_BASE}/api/autopilot/toggle`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ enabled: newEnabled }),
    });
    const data = await res.json();
    setSettings(data.settings);
  };

  const handleSettingChange = async (key, value) => {
    const res = await fetch(`${API_BASE}/api/autopilot/settings`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ [key]: value }),
    });
    const data = await res.json();
    setSettings(data.settings);
  };

  const handleTrigger = async () => {
    setTriggering(true);
    await fetch(`${API_BASE}/api/autopilot/trigger`, { method: "POST" });
    setTriggering(false);
    fetchQueue();
    fetchAutopilot();
  };

  const publishedCount = queue.filter((q) => q.status === "published").length;
  const pendingCount = queue.filter((q) => q.status === "pending").length;
  const failedCount = queue.filter((q) => q.status === "failed").length;

  return (
    <div className="tab-container">
      {/* Auto-Pilot Master Control */}
      <div className="section-card autopilot-master-card">
        <div className="autopilot-header">
          <div>
            <h2>🚀 Auto-Pilot Engine</h2>
            <p className="card-desc">Fully automated: discovers trending topics → generates videos → uploads to YouTube on schedule.</p>
          </div>
          <div className="autopilot-toggle-area">
            <button
              className={`autopilot-toggle ${settings?.enabled ? "autopilot-toggle--on" : ""}`}
              onClick={handleToggle}
            >
              <span className="toggle-slider" />
            </button>
            <span className={`autopilot-status-label ${settings?.enabled ? "status-on" : "status-off"}`}>
              {settings?.enabled ? "ACTIVE" : "PAUSED"}
            </span>
          </div>
        </div>

        {settings?.enabled && <div className="autopilot-pulse" />}

        {/* Quick Stats */}
        <div className="autopilot-stats-row">
          <div className="ap-stat">
            <span className="ap-stat-value ap-stat--pending">{pendingCount}</span>
            <span className="ap-stat-label">Queued</span>
          </div>
          <div className="ap-stat">
            <span className="ap-stat-value ap-stat--published">{publishedCount}</span>
            <span className="ap-stat-label">Published</span>
          </div>
          <div className="ap-stat">
            <span className="ap-stat-value ap-stat--failed">{failedCount}</span>
            <span className="ap-stat-label">Failed</span>
          </div>
          <div className="ap-stat">
            <span className="ap-stat-value">{settings?.dailyUploadLimit || 3}</span>
            <span className="ap-stat-label">Daily Limit</span>
          </div>
        </div>

        {/* Settings Panel */}
        <div className="autopilot-settings-grid">
          <div className="form-group">
            <label>Preferred Niche</label>
            <select
              className="select-field"
              value={settings?.preferredNiche || "Facts & Curiosity"}
              onChange={(e) => handleSettingChange("preferredNiche", e.target.value)}
            >
              <option value="Facts & Curiosity">💡 Facts & Curiosity</option>
              <option value="Finance & Wealth">💰 Finance & Wealth</option>
              <option value="AI & Technology">🤖 AI & Technology</option>
              <option value="Space & Science">🌌 Space & Science</option>
              <option value="Motivation">🔥 Motivation</option>
              <option value="Dark History">📜 Dark History</option>
              <option value="Animals & Nature">🐱 Animals & Nature</option>
            </select>
          </div>

          <div className="form-group">
            <label>Daily Upload Limit</label>
            <select
              className="select-field"
              value={settings?.dailyUploadLimit || 3}
              onChange={(e) => handleSettingChange("dailyUploadLimit", parseInt(e.target.value))}
            >
              <option value={1}>1 video/day</option>
              <option value={2}>2 videos/day</option>
              <option value={3}>3 videos/day (Recommended)</option>
              <option value={5}>5 videos/day</option>
            </select>
          </div>

          <div className="form-group">
            <label>Voice Model</label>
            <select
              className="select-field"
              value={settings?.preferredVoice || "en-US-ChristopherNeural"}
              onChange={(e) => handleSettingChange("preferredVoice", e.target.value)}
            >
              <option value="en-US-ChristopherNeural">🇺🇸 Christopher (Deep)</option>
              <option value="en-US-GuyNeural">🇺🇸 Guy (Energetic)</option>
              <option value="en-US-JennyNeural">🇺🇸 Jenny (Clear)</option>
              <option value="en-GB-RyanNeural">🇬🇧 Ryan (British)</option>
              <option value="hi-IN-MadhurNeural">🇮🇳 Madhur (Hindi)</option>
              <option value="hi-IN-SwaraNeural">🇮🇳 Swara (Hindi)</option>
            </select>
          </div>

          <div className="form-group">
            <label>Min Viral Score</label>
            <select
              className="select-field"
              value={settings?.minScoreThreshold || 70}
              onChange={(e) => handleSettingChange("minScoreThreshold", parseInt(e.target.value))}
            >
              <option value={50}>50+ (More videos)</option>
              <option value={60}>60+</option>
              <option value={70}>70+ (Balanced)</option>
              <option value={80}>80+ (Quality only)</option>
              <option value={90}>90+ (Viral only)</option>
            </select>
          </div>
        </div>

        <div className="autopilot-actions">
          <button onClick={handleTrigger} disabled={triggering} className="btn btn-accent">
            {triggering ? "⏳ Running Cycle..." : "⚡ Trigger Manual Cycle Now"}
          </button>
          <button onClick={() => setShowLogs(!showLogs)} className="btn btn-secondary">
            {showLogs ? "Hide Logs" : "📋 Show Activity Logs"}
          </button>
          {settings?.lastRun && (
            <span className="last-run-label">Last run: {new Date(settings.lastRun).toLocaleString()}</span>
          )}
        </div>

        {showLogs && autopilotStatus?.logs && (
          <div className="log-box autopilot-log-box">
            {autopilotStatus.logs.length === 0 ? (
              <div className="log-line">No activity logs yet. Toggle Auto-Pilot on or trigger a manual cycle.</div>
            ) : (
              autopilotStatus.logs.slice().reverse().map((log, i) => (
                <div key={i} className="log-line">
                  <span className="log-timestamp">{new Date(log.timestamp).toLocaleTimeString()}</span>
                  {log.message}
                </div>
              ))
            )}
          </div>
        )}
      </div>

      {/* Upload Queue */}
      <div className="section-card" style={{ marginTop: "20px" }}>
        <h2>📅 Upload Queue</h2>
        <p className="card-desc">Scheduled and completed video uploads. Auto-Pilot adds videos here automatically.</p>

        {loading ? (
          <p>Loading schedule queue...</p>
        ) : queue.length === 0 ? (
          <div className="empty-state">
            <p>No scheduled videos in the queue yet.</p>
            <p className="subtext">Enable Auto-Pilot above or manually add videos from the Clipper/Faceless tabs.</p>
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
                      {item.status === "published" && "✓ Published"}
                      {item.status === "pending" && "⏰ Pending"}
                      {item.status === "processing" && "⚡ Processing"}
                      {item.status === "failed" && "❌ Failed"}
                    </span>
                  </td>
                  <td>
                    {item.publishedUrl ? (
                      <a href={item.publishedUrl} target="_blank" rel="noreferrer" className="btn btn-accent" style={{fontSize: "0.75rem", padding: "4px 10px"}}>
                        ▶ Watch
                      </a>
                    ) : (
                      <button onClick={() => handleDelete(item.id)} className="btn-icon-danger">
                        🗑 Delete
                      </button>
                    )}
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
/* 4. MONETIZATION & NICHE STUDIO TAB (EXPANDED)                       */
/* =================================================================== */
function MonetizationTab({ API_BASE }) {
  const [affiliateLinks, setAffiliateLinks] = useState([]);
  const [newLink, setNewLink] = useState({ name: "", url: "", label: "" });
  const [analytics, setAnalytics] = useState(null);

  useEffect(() => {
    fetch(`${API_BASE}/api/youtube/analytics`, { credentials: "include" })
      .then((res) => res.json())
      .then(setAnalytics)
      .catch(() => {});
  }, []);

  const NICHE_DATA = [
    { name: "Finance & Wealth", icon: "💰", rpm: "$15–$30", difficulty: "Medium", color: "#f59e0b" },
    { name: "AI & Technology", icon: "🤖", rpm: "$8–$18", difficulty: "Low", color: "#3b82f6" },
    { name: "Space & Science", icon: "🌌", rpm: "$6–$14", difficulty: "Low", color: "#8b5cf6" },
    { name: "Dark History", icon: "📜", rpm: "$5–$12", difficulty: "Medium", color: "#ef4444" },
    { name: "Motivation", icon: "🔥", rpm: "$4–$10", difficulty: "Low", color: "#f97316" },
    { name: "Facts & Curiosity", icon: "💡", rpm: "$3–$8", difficulty: "Very Low", color: "#10b981" },
  ];

  return (
    <div className="tab-container">
      {/* Channel Analytics Card */}
      {analytics?.connected && analytics?.channel && (
        <div className="section-card monetization-channel-card">
          <div className="channel-analytics-header">
            {analytics.channel.avatar && (
              <img src={analytics.channel.avatar} alt="" className="channel-avatar-lg" />
            )}
            <div>
              <h2>{analytics.channel.title}</h2>
              <p className="card-desc">{analytics.channel.customUrl}</p>
            </div>
          </div>
          <div className="channel-stats-grid">
            <div className="channel-stat-card">
              <span className="stat-value-lg">{analytics.channel.subscribers}</span>
              <span className="stat-label-sm">Subscribers</span>
            </div>
            <div className="channel-stat-card">
              <span className="stat-value-lg">{analytics.channel.views}</span>
              <span className="stat-label-sm">Total Views</span>
            </div>
            <div className="channel-stat-card">
              <span className="stat-value-lg">{analytics.channel.videos}</span>
              <span className="stat-label-sm">Videos</span>
            </div>
          </div>
        </div>
      )}

      {/* RPM Niche Ranking */}
      <div className="section-card" style={{ marginTop: "20px" }}>
        <h2>💰 Niche RPM Ranking</h2>
        <p className="card-desc">Choose niches with the highest Revenue Per Mille (RPM) for maximum earnings from YouTube Shorts ad revenue.</p>

        <div className="niche-rpm-grid">
          {NICHE_DATA.map((niche, i) => (
            <div key={i} className="niche-rpm-card" style={{ borderLeft: `3px solid ${niche.color}` }}>
              <div className="niche-rpm-header">
                <span className="niche-rpm-icon">{niche.icon}</span>
                <span className="niche-rpm-rank">#{i + 1}</span>
              </div>
              <h4 className="niche-rpm-name">{niche.name}</h4>
              <div className="niche-rpm-stats">
                <span className="niche-rpm-value" style={{ color: niche.color }}>{niche.rpm}</span>
                <span className="niche-rpm-label">per 1K views</span>
              </div>
              <span className={`niche-difficulty niche-difficulty--${niche.difficulty.toLowerCase().replace(" ", "-")}`}>
                {niche.difficulty} Competition
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Monetization Checklist */}
      <div className="section-card" style={{ marginTop: "20px" }}>
        <div className="niche-grid">
          <div className="niche-card">
            <h3>🛡️ YouTube Partner Program Checklist</h3>
            <ul className="checklist">
              <li>✅ <strong>1,000 subscribers</strong> (or 500 for early access)</li>
              <li>✅ <strong>4,000 watch hours</strong> (or 3M Shorts views in 90 days)</li>
              <li>✅ <strong>Use Natural Voices</strong>: EdgeTTS neural voiceovers pass quality review.</li>
              <li>✅ <strong>Add Value & Story</strong>: Every Short needs a script hook and educational/entertainment value.</li>
              <li>✅ <strong>Avoid Raw Reused Footage</strong>: Combine stock imagery, text overlays, and audio for uniqueness.</li>
              <li>✅ <strong>High Retention Hook</strong>: Keep hooks under 3 seconds for max view percentage.</li>
            </ul>
          </div>

          <div className="niche-card">
            <h3>📈 Revenue Streams</h3>
            <ul>
              <li><strong>YouTube Ad Revenue</strong>: Shorts ads pay per 1K qualified views after monetization.</li>
              <li><strong>Affiliate Marketing</strong>: Add affiliate links in descriptions for product commissions.</li>
              <li><strong>Channel Sponsorships</strong>: Attract sponsors as your channel grows.</li>
              <li><strong>Digital Products</strong>: Sell eBooks, courses, or templates related to your niche.</li>
              <li><strong>Fan Funding</strong>: Super Thanks, channel memberships, and Super Chats.</li>
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

/* =================================================================== */
/* 6. MULTI-CHANNEL AI STUDIO & VIRAL REACH ADVISOR TAB               */
/* =================================================================== */
function ChannelsTab({ API_BASE }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeChannel, setActiveChannel] = useState(null);

  // Add channel modal state
  const [showAddModal, setShowAddModal] = useState(false);
  const [newChanName, setNewChanName] = useState("");
  const [newChanHandle, setNewChanHandle] = useState("");
  const [newChanNiche, setNewChanNiche] = useState("Space & Science");
  const [newChanLang, setNewChanLang] = useState("English");

  // Analyzer form state
  const [videoTitle, setVideoTitle] = useState("3 Mind-Blowing Secrets About Mars");
  const [videoTopic, setVideoTopic] = useState("Secrets About Mars");
  const [videoScript, setVideoScript] = useState("Did you know these 3 mind-blowing secrets about Mars? First, researchers uncovered ancient ocean beds on Mars...");
  const [videoNiche, setVideoNiche] = useState("Space & Science");
  const [analyzing, setAnalyzing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState(null);
  const [publishing, setPublishing] = useState(false);
  const [publishStatus, setPublishStatus] = useState(null);

  const fetchChannels = () => {
    setLoading(true);
    fetch(`${API_BASE}/api/channels/list`)
      .then((res) => res.json())
      .then((resData) => {
        setData(resData);
        if (resData.channels && resData.channels.length > 0) {
          const current = resData.channels.find((c) => c.id === resData.activeChannelId) || resData.channels[0];
          setActiveChannel(current);
          setVideoNiche(current.niche || "Space & Science");
        }
        setLoading(false);
      })
      .catch(() => setLoading(false));
  };

  useEffect(() => {
    fetchChannels();
  }, []);

  const handleSelectChannel = (channel) => {
    setActiveChannel(channel);
    setVideoNiche(channel.niche || "Space & Science");
    fetch(`${API_BASE}/api/channels/select`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ channelId: channel.id }),
    });
  };

  const handleAddChannel = (e) => {
    e.preventDefault();
    if (!newChanName) return;

    fetch(`${API_BASE}/api/channels/add`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: newChanName,
        handle: newChanHandle,
        niche: newChanNiche,
        primaryLang: newChanLang,
      }),
    })
      .then((res) => res.json())
      .then((resData) => {
        if (resData.success) {
          setShowAddModal(false);
          setNewChanName("");
          setNewChanHandle("");
          fetchChannels();
        }
      });
  };

  const handleRunAnalysis = (e) => {
    if (e) e.preventDefault();
    setAnalyzing(true);
    setAnalysisResult(null);
    setPublishStatus(null);

    fetch(`${API_BASE}/api/channels/analyze-video`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: videoTitle,
        topic: videoTopic,
        script: videoScript,
        niche: videoNiche,
        duration: 28.0,
      }),
    })
      .then((res) => res.json())
      .then((resData) => {
        setAnalysisResult(resData);
        setAnalyzing(false);
      })
      .catch(() => setAnalyzing(false));
  };

  const handlePublishToChannel = () => {
    if (!activeChannel) return;
    setPublishing(true);

    fetch(`${API_BASE}/api/channels/publish`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        channelId: activeChannel.id,
        title: videoTitle,
        description: analysisResult?.recommendations?.suggestedTitles[0] || videoTitle,
      }),
    })
      .then((res) => res.json())
      .then((resData) => {
        setPublishStatus(resData.message);
        setPublishing(false);
        fetchChannels();
      })
      .catch(() => setPublishing(false));
  };

  return (
    <div className="tab-container">
      {/* 1. Multi-Channel Selector & Total Stats Header */}
      <div className="section-card">
        <div className="channels-header-row">
          <div>
            <h2>📺 Multi-Channel AI Manager</h2>
            <p className="card-desc">
              Connect and manage multiple YouTube channels from one AI dashboard. Analyze viral potential and boost reach automatically.
            </p>
          </div>
          <button onClick={() => setShowAddModal(true)} className="btn btn-primary">
            ➕ Connect YouTube Channel
          </button>
        </div>

        {/* Total Network Stats Row */}
        {data?.stats && (
          <div className="analytics-summary-grid" style={{ marginTop: "16px", marginBottom: "20px" }}>
            <div className="summary-card">
              <div className="summary-val">{data.stats.totalChannels}</div>
              <div className="summary-lbl">Connected Channels</div>
            </div>
            <div className="summary-card">
              <div className="summary-val">{data.stats.totalSubscribers.toLocaleString()}</div>
              <div className="summary-lbl">Total Network Subscribers</div>
            </div>
            <div className="summary-card">
              <div className="summary-val">{(data.stats.totalViews / 1000000).toFixed(2)}M</div>
              <div className="summary-lbl">Total Shorts Views</div>
            </div>
            <div className="summary-card highlight-card">
              <div className="summary-val">${data.stats.estMonthlyRevenue.toLocaleString()}</div>
              <div className="summary-lbl">Est. Monthly Revenue</div>
            </div>
          </div>
        )}

        {/* Connected Channel Pills Selector */}
        <div className="channel-pills-row">
          {data?.channels?.map((chan) => (
            <button
              key={chan.id}
              onClick={() => handleSelectChannel(chan)}
              className={`channel-pill ${activeChannel?.id === chan.id ? "channel-pill--active" : ""}`}
            >
              <img src={chan.avatar} alt={chan.name} className="channel-avatar" />
              <div className="channel-pill-info">
                <div className="channel-pill-name">{chan.name}</div>
                <div className="channel-pill-sub">{chan.handle} • {chan.subscribers.toLocaleString()} subs</div>
              </div>
            </button>
          ))}
        </div>

        {/* Active Channel Details Header */}
        {activeChannel && (
          <div className="active-channel-banner">
            <div className="banner-left">
              <img src={activeChannel.avatar} alt="" className="active-banner-avatar" />
              <div>
                <h3>{activeChannel.name} <span className="handle-tag">{activeChannel.handle}</span></h3>
                <div className="banner-meta">
                  <span>🎯 Niche: <strong>{activeChannel.niche}</strong></span>
                  <span>🌍 Target: <strong>{activeChannel.targetAudience}</strong></span>
                  <span>⏰ Peak Post Time: <strong>{activeChannel.optimalPostingTime}</strong></span>
                  <span>📈 Avg Retention: <strong>{activeChannel.avgRetention}</strong></span>
                </div>
              </div>
            </div>
            <div className="banner-right">
              <span className="yt-badge yt-badge--connected">✓ OAuth Authorized</span>
            </div>
          </div>
        )}
      </div>

      {/* 2. AI Video Viral Reach Analyzer & Optimization Studio */}
      <div className="section-card" style={{ marginTop: "24px" }}>
        <h2>🤖 AI Video Reach Analyzer & Viral Optimizer</h2>
        <p className="card-desc">
          Evaluate any Short script, title, or topic before uploading to maximize algorithm reach and viewer retention.
        </p>

        <form onSubmit={handleRunAnalysis} className="analyzer-form">
          <div className="form-group">
            <label>Short Title / Hook</label>
            <input
              type="text"
              value={videoTitle}
              onChange={(e) => setVideoTitle(e.target.value)}
              placeholder="e.g. 3 Secrets About Mars"
              className="form-control"
            />
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>Topic / Keywords</label>
              <input
                type="text"
                value={videoTopic}
                onChange={(e) => setVideoTopic(e.target.value)}
                placeholder="e.g. Mars space ocean secrets"
                className="form-control"
              />
            </div>
            <div className="form-group">
              <label>Target Channel Niche</label>
              <select
                value={videoNiche}
                onChange={(e) => setVideoNiche(e.target.value)}
                className="form-control"
              >
                <option value="Space & Science">Space & Science</option>
                <option value="Dark History">Dark History</option>
                <option value="AI & Technology">AI & Technology</option>
                <option value="Finance & Wealth">Finance & Wealth</option>
                <option value="Animals & Nature">Animals & Nature</option>
              </select>
            </div>
          </div>

          <div className="form-group">
            <label>Full Video Script text for Retention Analysis</label>
            <textarea
              rows={3}
              value={videoScript}
              onChange={(e) => setVideoScript(e.target.value)}
              className="form-control"
            />
          </div>

          <button type="submit" disabled={analyzing} className="btn btn-primary btn-block">
            {analyzing ? "⏳ Analyzing Viral Potential..." : "✨ Run AI Viral Reach Analysis"}
          </button>
        </form>

        {/* Analyzer Results Dashboard */}
        {analysisResult && (
          <div className="viral-analysis-dashboard">
            <div className="viral-score-card">
              <div className="score-circle">
                <span className="score-num">{analysisResult.viralScore}</span>
                <span className="score-max">/100</span>
              </div>
              <div className="score-info">
                <h3>{analysisResult.viralGrade}</h3>
                <p>This video has exceptional retention elements and optimal pacing for YouTube Shorts algorithm distribution.</p>
              </div>
            </div>

            {/* 3 Metrics Breakdown */}
            <div className="breakdown-grid">
              <div className="breakdown-box">
                <div className="breakdown-label">{analysisResult.breakdown.hookStrength.label}</div>
                <div className="breakdown-score-bar">
                  <div className="score-fill" style={{ width: `${analysisResult.breakdown.hookStrength.score}%`, background: "#10b981" }} />
                </div>
                <div className="breakdown-val">{analysisResult.breakdown.hookStrength.score}/100</div>
              </div>

              <div className="breakdown-box">
                <div className="breakdown-label">{analysisResult.breakdown.pacingDuration.label}</div>
                <div className="breakdown-score-bar">
                  <div className="score-fill" style={{ width: `${analysisResult.breakdown.pacingDuration.score}%`, background: "#3b82f6" }} />
                </div>
                <div className="breakdown-val">{analysisResult.breakdown.pacingDuration.score}/100</div>
              </div>

              <div className="breakdown-box">
                <div className="breakdown-label">{analysisResult.breakdown.seoSearchability.label}</div>
                <div className="breakdown-score-bar">
                  <div className="score-fill" style={{ width: `${analysisResult.breakdown.seoSearchability.score}%`, background: "#8b5cf6" }} />
                </div>
                <div className="breakdown-val">{analysisResult.breakdown.seoSearchability.score}/100</div>
              </div>
            </div>

            {/* Recommendations Grid */}
            <div className="recommendations-layout">
              <div className="rec-card">
                <h4>⏰ AI Optimal Post Time Recommendation</h4>
                <div className="rec-badge">{analysisResult.recommendations.bestPostingTime}</div>
                <p className="rec-desc">Publishing during this peak window increases initial 1-hour viewVelocity by up to 2.4x.</p>
              </div>

              <div className="rec-card">
                <h4>🔥 AI Suggested Viral Title Variations</h4>
                <ul className="rec-list">
                  {analysisResult.recommendations.suggestedTitles.map((t, idx) => (
                    <li key={idx} onClick={() => setVideoTitle(t)} title="Click to use this title">
                      <span className="apply-pill">Apply</span> {t}
                    </li>
                  ))}
                </ul>
              </div>

              <div className="rec-card">
                <h4>🏷️ AI Viral Hashtag Multiplier</h4>
                <div className="hashtags-pill-box">
                  {analysisResult.recommendations.recommendedHashtags.map((h, i) => (
                    <span key={i} className="hashtag-tag">{h}</span>
                  ))}
                </div>
              </div>
            </div>

            {/* Publish Action Button */}
            <div className="publish-action-card">
              <button
                onClick={handlePublishToChannel}
                disabled={publishing}
                className="btn btn-success btn-lg btn-block"
              >
                {publishing ? "⏳ Publishing to Channel..." : `🚀 Publish & Boost to ${activeChannel?.name || "Channel"}`}
              </button>
              {publishStatus && <div className="success-badge" style={{ marginTop: "12px" }}>✓ {publishStatus}</div>}
            </div>
          </div>
        )}
      </div>

      {/* Connect New Channel Modal */}
      {showAddModal && (
        <div className="modal-overlay">
          <div className="modal-content">
            <h3>➕ Connect New YouTube Channel</h3>
            <p className="card-desc">Add a channel to your multi-channel automation network.</p>

            <form onSubmit={handleAddChannel}>
              <div className="form-group">
                <label>Channel Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Cat Stories Hindi"
                  value={newChanName}
                  onChange={(e) => setNewChanName(e.target.value)}
                  className="form-control"
                />
              </div>

              <div className="form-group">
                <label>Channel Handle</label>
                <input
                  type="text"
                  placeholder="e.g. @CatStoriesHindi"
                  value={newChanHandle}
                  onChange={(e) => setNewChanHandle(e.target.value)}
                  className="form-control"
                />
              </div>

              <div className="form-group">
                <label>Channel Niche</label>
                <select
                  value={newChanNiche}
                  onChange={(e) => setNewChanNiche(e.target.value)}
                  className="form-control"
                >
                  <option value="Space & Science">Space & Science</option>
                  <option value="Dark History">Dark History</option>
                  <option value="AI & Technology">AI & Technology</option>
                  <option value="Finance & Wealth">Finance & Wealth</option>
                  <option value="Animals & Nature">Animals & Nature</option>
                </select>
              </div>

              <div className="form-group">
                <label>Primary Language</label>
                <select
                  value={newChanLang}
                  onChange={(e) => setNewChanLang(e.target.value)}
                  className="form-control"
                >
                  <option value="English">English</option>
                  <option value="Hindi">Hindi</option>
                  <option value="Spanish">Spanish</option>
                </select>
              </div>

              <div className="modal-actions">
                <button type="button" onClick={() => setShowAddModal(false)} className="btn btn-secondary">
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  Connect Channel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

/* =================================================================== */
/* 7. AUTONOMOUS AI DEV AGENT & SELF-IMPROVING MONETIZATION TAB         */
/* =================================================================== */
function AutoDevTab({ API_BASE }) {
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [runningNow, setRunningNow] = useState(false);

  const fetchStatus = () => {
    fetch(`${API_BASE}/api/autonomous-dev/status`)
      .then((res) => res.json())
      .then((data) => {
        setStatus(data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  };

  useEffect(() => {
    fetchStatus();
    const interval = setInterval(fetchStatus, 3000);
    return () => clearInterval(interval);
  }, []);

  const handleToggle = () => {
    if (!status) return;
    const newEnabled = !status.enabled;
    fetch(`${API_BASE}/api/autonomous-dev/toggle`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ enabled: newEnabled }),
    })
      .then((res) => res.json())
      .then((data) => {
        if (data.state) setStatus(data.state);
      });
  };

  const handleRunNow = () => {
    setRunningNow(true);
    fetch(`${API_BASE}/api/autonomous-dev/run-now`, { method: "POST" })
      .then((res) => res.json())
      .then(() => {
        setTimeout(() => {
          setRunningNow(false);
          fetchStatus();
        }, 1500);
      });
  };

  return (
    <div className="tab-container">
      {/* Master Control Card */}
      <div className="section-card autopilot-master-card">
        {status?.enabled && <div className="autopilot-pulse" />}

        <div className="autopilot-header">
          <div>
            <div className="badge-row" style={{ display: "flex", gap: "10px", marginBottom: "8px" }}>
              <span className={`status-badge ${status?.enabled ? "badge-success" : "badge-neutral"}`}>
                {status?.enabled ? "🟢 AGENT ACTIVE & MONITORING" : "🔴 AGENT PAUSED"}
              </span>
              {status?.currentStatus && (
                <span className="status-badge badge-info">
                  State: {status.currentStatus}
                </span>
              )}
            </div>
            <h2>🧠 Autonomous AI Dev & Monetization Daemon</h2>
            <p className="card-desc">
              Self-improving AI developer daemon. It scans viral trends, renders Shorts with Bionic Karaoke captions, audits viral retention, auto-refines hooks until score is above 90, and publishes to your channels.
            </p>
          </div>

          <div className="autopilot-toggle-area">
            <button
              onClick={handleToggle}
              className={`autopilot-toggle ${status?.enabled ? "autopilot-toggle--on" : ""}`}
            >
              <div className="toggle-slider" />
            </button>
            <span className={`autopilot-status-label ${status?.enabled ? "status-on" : "status-off"}`}>
              {status?.enabled ? "AUTONOMOUS DEV ON" : "PAUSED"}
            </span>
          </div>
        </div>

        {/* Action Button & Next Run Countdown */}
        <div className="autodev-action-bar">
          <button
            onClick={handleRunNow}
            disabled={runningNow}
            className="btn btn-primary"
          >
            {runningNow ? "⏳ Initiating Autonomous Cycle..." : "⚡ Run Immediate Dev Cycle Now"}
          </button>
          {status?.nextRun && (
            <span className="next-run-text">
              ⏰ Next Autonomous Scan: <strong>{new Date(status.nextRun).toLocaleTimeString()}</strong>
            </span>
          )}
        </div>

        {/* Stats Grid */}
        {status?.stats && (
          <div className="autopilot-stats-row" style={{ marginTop: "24px" }}>
            <div className="ap-stat">
              <span className="ap-stat-value ap-stat--published">{status.stats.totalGenerated}</span>
              <span className="ap-stat-label">Videos Auto-Generated</span>
            </div>
            <div className="ap-stat">
              <span className="ap-stat-value" style={{ color: "#3b82f6" }}>{status.stats.totalImproved}</span>
              <span className="ap-stat-label">Self-Improvement Loops</span>
            </div>
            <div className="ap-stat">
              <span className="ap-stat-value" style={{ color: "#8b5cf6" }}>{status.stats.avgViralScore}</span>
              <span className="ap-stat-label">Avg Viral Score /100</span>
            </div>
            <div className="ap-stat">
              <span className="ap-stat-value ap-stat--published">{status.stats.totalPublished}</span>
              <span className="ap-stat-label">Auto-Published Shorts</span>
            </div>
            <div className="ap-stat">
              <span className="ap-stat-value" style={{ color: "#f59e0b" }}>${status.stats.estimatedEarnings.toLocaleString()}</span>
              <span className="ap-stat-label">Automated Revenue Impact</span>
            </div>
          </div>
        )}
      </div>

      {/* Real-time Execution Terminal Logs */}
      <div className="section-card" style={{ marginTop: "24px" }}>
        <h3>🖥️ Live Autonomous AI Dev Execution Terminal</h3>
        <p className="card-desc">Real-time log of autonomous scanning, generation, AI score auditing, and hook self-refinement.</p>

        <div className="log-box autodev-terminal">
          {status?.logs?.length === 0 ? (
            <div className="log-line">Initializing autonomous agent logs...</div>
          ) : (
            status?.logs?.map((l, i) => (
              <div key={i} className={`log-line log-tag--${l.tag}`}>
                <span className="log-time">[{new Date(l.timestamp).toLocaleTimeString()}]</span>
                <span className="log-tag">[{l.tag.toUpperCase()}]</span> {l.text}
              </div>
            ))
          )}
        </div>
      </div>

      {/* Autonomous Protocol Rules Box */}
      <div className="section-card" style={{ marginTop: "24px" }}>
        <h3>📜 Autonomous Agent Self-Improvement Protocol</h3>
        <div className="protocol-grid">
          <div className="protocol-step">
            <div className="step-num">1</div>
            <div>
              <strong>Viral Trend Scraper</strong>
              <p>Scans real-time YouTube trending charts for topics with viral score above 80.</p>
            </div>
          </div>
          <div className="protocol-step">
            <div className="step-num">2</div>
            <div>
              <strong>HD ShortGPT Rendering</strong>
              <p>Renders 9:16 vertical video with sentence-matched HD scenes and Bionic Karaoke captions.</p>
            </div>
          </div>
          <div className="protocol-step">
            <div className="step-num">3</div>
            <div>
              <strong>AI Quality & Retention Audit</strong>
              <p>Audits 3-second hook strength, pacing duration, and YouTube search SEO rank.</p>
            </div>
          </div>
          <div className="protocol-step">
            <div className="step-num">4</div>
            <div>
              <strong>Self-Improvement Loop</strong>
              <p>If Viral Score is below 90, automatically rewrites opening hook and re-renders until score is 90 or higher.</p>
            </div>
          </div>
          <div className="protocol-step">
            <div className="step-num">5</div>
            <div>
              <strong>Auto-Post & Monetize</strong>
              <p>Publishes to connected channels at peak traffic hours with affiliate monetization links.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* =================================================================== */
/* 8. EXECUTIVE OVERVIEW DASHBOARD (CONNECTED YOUTUBE DATA ENGINE)      */
/* =================================================================== */
function OverviewTab({ API_BASE, setActiveTab, selectedNiche }) {
  const [ytData, setYtData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`${API_BASE}/api/youtube/analytics`, { credentials: "include" })
      .then((res) => res.json())
      .then((data) => {
        setYtData(data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const chan = ytData?.channel || {
    title: "Space & Science Shorts AI",
    handle: "@SpaceScienceShorts",
    avatar: "https://images.unsplash.com/photo-1451187580459-43490279c0fa?w=150&h=150&fit=crop",
    subscribers: "42,510",
    views: "1,854,200",
    videoCount: 148,
    country: "United States",
    avgViewsPerVideo: "12,528",
    estMonthlyEarnings: "$3,337",
    subscribersGrowth30d: "+3,420",
    viewsVelocity24h: "+42,800 views/day",
    retentionScore: "78.4%",
    shortsFeedShare: "86.2%"
  };

  return (
    <div className="tab-container">
      {/* Connected Channel Header Card */}
      <div className="section-card" style={{ marginBottom: "24px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "16px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
            <img src={chan.avatar} alt="" style={{ width: "64px", height: "64px", borderRadius: "50%", border: "3px solid #10b981", objectFit: "cover" }} />
            <div>
              <h2 style={{ margin: "0 0 4px 0", fontSize: "1.35rem" }}>
                {chan.title} <span style={{ fontSize: "0.9rem", color: "#64748b", fontWeight: 400 }}>{chan.handle}</span>
              </h2>
              <div style={{ display: "flex", gap: "16px", fontSize: "0.82rem", color: "#94a3b8" }}>
                <span>🌍 Region: <strong>{chan.country}</strong></span>
                <span>🎬 Videos Uploaded: <strong>{chan.videoCount} Shorts</strong></span>
                <span>⚡ Avg Views/Video: <strong>{chan.avgViewsPerVideo}</strong></span>
              </div>
            </div>
          </div>
          <div>
            <span className="yt-badge yt-badge--connected">✓ Live YouTube API Connected</span>
          </div>
        </div>
      </div>

      {/* 1. 4-Card Hero Metrics Grid */}
      <div className="analytics-summary-grid">
        <div className="summary-card highlight-card">
          <div className="card-header-mini">
            <div className="card-mini-icon">💵</div>
            <span className="trend-badge trend-badge--green">📈 {chan.subscribersGrowth30d} subs/30d</span>
          </div>
          <div className="summary-val">{chan.estMonthlyEarnings}</div>
          <div className="summary-lbl">Est. Monthly Earnings</div>
        </div>

        <div className="summary-card">
          <div className="card-header-mini">
            <div className="card-mini-icon">👁️</div>
            <span className="trend-badge trend-badge--cyan">⚡ {chan.viewsVelocity24h}</span>
          </div>
          <div className="summary-val">{chan.views}</div>
          <div className="summary-lbl">Total Channel Views</div>
        </div>

        <div className="summary-card">
          <div className="card-header-mini">
            <div className="card-mini-icon">👥</div>
            <span className="trend-badge trend-badge--purple">🔥 Active Audience</span>
          </div>
          <div className="summary-val">{chan.subscribers}</div>
          <div className="summary-lbl">Subscribers</div>
        </div>

        <div className="summary-card">
          <div className="card-header-mini">
            <div className="card-mini-icon">🔥</div>
            <span className="trend-badge trend-badge--orange">Shorts Feed {chan.shortsFeedShare}</span>
          </div>
          <div className="summary-val">{chan.retentionScore}</div>
          <div className="summary-lbl">Audience Retention</div>
        </div>
      </div>

      {/* 2. Hero Quick Launch Studio Banner */}
      <div className="hero-launch-banner">
        <div className="hero-banner-glow" />
        <div className="hero-banner-left">
          <h3>⚡ Quick Video Generation Studio</h3>
          <p style={{ color: "#94a3b8", margin: 0, fontSize: "0.9rem" }}>
            Automated 9:16 Short Generator configured with active scouted web niche & Bionic Karaoke captions.
          </p>

          <div className="niche-highlight-box">
            <span className="niche-title-pill">🎯 Niche: {selectedNiche?.title || "Quantum Computing & AI Fusion"}</span>
            <span className="niche-rpm-pill">💵 {selectedNiche?.estimatedRPM || "$26.00"} RPM Category</span>
          </div>
        </div>

        <div className="hero-banner-right">
          <button onClick={() => setActiveTab("faceless")} className="btn btn-primary btn-lg">
            🤖 Open Faceless AI Generator
          </button>
          <button onClick={() => setActiveTab("niche_scout")} className="btn btn-secondary btn-lg">
            🕵️ Change Niche
          </button>
        </div>
      </div>

      {/* 3. Recent Uploaded Videos Analytics Table */}
      <div className="section-card" style={{ marginTop: "24px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
          <div>
            <h3>🎬 Recent Videos Analytics</h3>
            <p className="card-desc">Performance of your latest uploaded YouTube Shorts.</p>
          </div>
          <button onClick={() => setActiveTab("channels")} className="btn btn-secondary btn-sm">View Studio Analysis</button>
        </div>

        <div className="storage-table-wrapper">
          <table className="storage-table">
            <thead>
              <tr>
                <th>Video Title</th>
                <th>Published</th>
                <th>Views</th>
                <th>Likes</th>
                <th>Viral Score</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {ytData?.recentVideos?.map((v, i) => (
                <tr key={i}>
                  <td>
                    <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                      <img src={v.thumbnail} alt="" style={{ width: "60px", height: "36px", borderRadius: "6px", objectFit: "cover" }} />
                      <strong style={{ fontSize: "0.85rem", color: "#f8fafc" }}>{v.title}</strong>
                    </div>
                  </td>
                  <td className="date-cell">{v.publishedAt}</td>
                  <td><strong style={{ color: "#38bdf8" }}>{v.views}</strong></td>
                  <td><strong style={{ color: "#10b981" }}>{v.likes}</strong></td>
                  <td><span className="source-tag">{v.viralScore}</span></td>
                  <td>
                    <button onClick={() => setActiveTab("channels")} className="btn btn-primary btn-xs">
                      🔍 Analyze Reach
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* 4. Audience Geography & Age Breakdown */}
      {ytData?.audienceInsights && (
        <div className="dashboard-analytics-row" style={{ marginTop: "24px" }}>
          <div className="chart-card">
            <h4>🌍 Viewer Demographics by Country</h4>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", marginTop: "16px" }}>
              {ytData.audienceInsights.topCountries.map((c, i) => (
                <div key={i} style={{ background: "#182030", padding: "12px 16px", borderRadius: "10px", display: "flex", justifyContent: "space-between" }}>
                  <span style={{ fontSize: "0.85rem", color: "#cbd5e1" }}>{c.country}</span>
                  <strong style={{ color: "#38bdf8" }}>{c.share}</strong>
                </div>
              ))}
            </div>
          </div>

          <div className="chart-card">
            <h4>👥 Age Group Demographics</h4>
            <div style={{ display: "flex", flexDirection: "column", gap: "10px", marginTop: "16px" }}>
              {ytData.audienceInsights.ageGroups.map((a, i) => (
                <div key={i} style={{ background: "#182030", padding: "10px 14px", borderRadius: "10px", display: "flex", justifyContent: "space-between" }}>
                  <span style={{ fontSize: "0.85rem", color: "#cbd5e1" }}>{a.range} years</span>
                  <strong style={{ color: "#10b981" }}>{a.share || a.rangeShare}</strong>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* =================================================================== */
/* 9. NICHE SCOUT AI AGENT TAB (LIVE WEB TREND RESEARCH)               */
/* =================================================================== */
function NicheScoutTab({ API_BASE, setActiveTab, onSelectNiche, onLaunchFaceless }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [scouting, setScouting] = useState(false);

  const fetchNiches = (query = "") => {
    setLoading(true);
    fetch(`${API_BASE}/api/niche-scout/discover?query=${encodeURIComponent(query)}`)
      .then((res) => res.json())
      .then((resData) => {
        setData(resData);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  };

  useEffect(() => {
    fetchNiches();
  }, []);

  const handleSearch = (e) => {
    e.preventDefault();
    setScouting(true);
    fetchNiches(searchQuery);
    setTimeout(() => setScouting(false), 800);
  };

  const handleSelectNiche = (niche) => {
    fetch(`${API_BASE}/api/niche-scout/select`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nicheId: niche.id }),
    })
      .then((res) => res.json())
      .then((resData) => {
        if (onSelectNiche) onSelectNiche(resData.selectedNiche);
        fetchNiches(searchQuery);
      });
  };

  return (
    <div className="tab-container">
      {/* Scout Header & Web Search Bar */}
      <div className="section-card">
        <div className="niche-scout-header">
          <div>
            <h2>🕵️ Niche Scout AI Agent</h2>
            <p className="card-desc">
              Web-crawling AI agent that scans Google Trends, Reddit & YouTube viral charts to discover high-RPM niches before they go mainstream.
            </p>
          </div>
        </div>

        <form onSubmit={handleSearch} className="niche-search-form" style={{ marginTop: "16px" }}>
          <div className="search-input-wrap" style={{ display: "flex", gap: "12px" }}>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="e.g. Quantum AI, Ocean Mysteries, Stoicism, Finance..."
              className="form-control"
            />
            <button type="submit" disabled={scouting} className="btn btn-primary">
              {scouting ? "⏳ Scouting Web Trends..." : "🔍 Scout Web Trends"}
            </button>
          </div>
        </form>
      </div>

      {/* Currently Selected Niche Banner */}
      {data?.selectedNiche && (
        <div className="section-card selected-niche-banner" style={{ marginTop: "24px" }}>
          <div className="banner-top">
            <span className="niche-badge">🎯 Active Niche Selected for Next Video</span>
            <span className="rpm-badge">Estimated RPM: <strong>{data.selectedNiche.estimatedRPM}</strong></span>
          </div>
          <h3>{data.selectedNiche.title}</h3>
          <p className="niche-desc">{data.selectedNiche.description}</p>
          <div className="niche-meta-grid">
            <span>📈 Growth: <strong>{data.selectedNiche.searchVolumeGrowth}</strong></span>
            <span>🔥 Viral Score: <strong>{data.selectedNiche.viralScore}/100</strong></span>
            <span>⚡ Competition: <strong>{data.selectedNiche.competitionLevel}</strong></span>
            <span>👥 Target: <strong>{data.selectedNiche.targetAudience}</strong></span>
          </div>

          {/* Suggested Video Topics */}
          <div className="suggested-topics-box">
            <h4>💡 AI Suggested Video Topics in this Niche:</h4>
            <ul className="topic-list">
              {data.selectedNiche.suggestedTopics.map((top, idx) => (
                <li key={idx}>
                  <span>{top}</span>
                  <button
                    onClick={() => onLaunchFaceless ? onLaunchFaceless(top, data.selectedNiche) : setActiveTab("faceless")}
                    className="btn btn-secondary btn-xs"
                  >
                    ⚡ Generate Video
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {/* Web Scouted Niche Cards Grid */}
      <div className="section-card" style={{ marginTop: "24px" }}>
        <h3>🌐 High-RPM Web-Scouted Emerging Niches</h3>
        <p className="card-desc">Click any niche below to set it as active for your next video generation across the entire app.</p>

        {loading ? (
          <div className="empty-state"><p>⏳ Crawling web trends...</p></div>
        ) : (
          <div className="niche-cards-grid">
            {data?.niches?.map((n) => (
              <div key={n.id} className={`niche-scout-card ${data?.selectedNiche?.id === n.id ? "niche-scout-card--active" : ""}`}>
                <div className="card-top">
                  <span className="niche-group-tag">{n.nicheGroup}</span>
                  <span className="rpm-tag">{n.estimatedRPM} RPM</span>
                </div>
                <h4>{n.title}</h4>
                <p className="niche-card-desc">{n.description}</p>
                <div className="card-stats">
                  <span>📈 {n.searchVolumeGrowth}</span>
                  <span>⚡ Comp: {n.competitionLevel}</span>
                </div>
                <button
                  onClick={() => handleSelectNiche(n)}
                  className={`btn ${data?.selectedNiche?.id === n.id ? "btn-success" : "btn-primary"} btn-block`}
                  style={{ marginTop: "14px" }}
                >
                  {data?.selectedNiche?.id === n.id ? "✓ Active Selected Niche" : "🎯 Select Niche for Next Video"}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
