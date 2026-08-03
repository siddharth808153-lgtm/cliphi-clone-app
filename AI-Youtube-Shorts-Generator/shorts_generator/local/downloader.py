"""Local YouTube download via yt-dlp.

Returns a local mp4 path so the rest of the local pipeline can read it
directly off disk.
"""
import os
import re
from pathlib import Path
from urllib.parse import parse_qs, unquote, urlparse
from typing import Optional

from ..config import LOCAL_OUTPUT_DIR


def _import_ytdlp():
    try:
        import yt_dlp  # type: ignore
    except ImportError as e:
        raise RuntimeError(
            "yt-dlp is required for --mode local. Install it with:\n"
            "    pip install -r requirements-local.txt"
        ) from e
    return yt_dlp


def _format_for(fmt: str) -> str:
    """Map our '720' / '1080' shorthand to a yt-dlp format selector."""
    try:
        height = int(fmt)
    except ValueError:
        height = 720
    return (
        f"best[height<={height}][ext=mp4]/"
        f"bestvideo[height<={height}][ext=mp4]+bestaudio[ext=m4a]/"
        f"bestvideo[height<={height}]+bestaudio/"
        f"best"
    )


def _extract_youtube_video_id(source: str) -> Optional[str]:
    """Best-effort extraction of a YouTube video id from a URL."""
    parsed = urlparse(source)
    host = (parsed.netloc or "").lower()
    if host.startswith("www."):
        host = host[4:]

    if host in ("youtu.be", "www.youtu.be"):
        video_id = parsed.path.lstrip("/").split("/", 1)[0]
        return video_id or None

    if "youtube.com" in host:
        if parsed.path.startswith("/watch"):
            qs = parse_qs(parsed.query)
            video_id = qs.get("v", [""])[0]
            return video_id or None
        match = re.search(r"/(?:shorts|embed|live)/([^/?#&]+)", parsed.path)
        if match:
            return match.group(1)

    return None


def _resolve_local_path(source: str) -> Optional[str]:
    """Return a local filesystem path if the input already points at one."""
    parsed = urlparse(source)
    if parsed.scheme == "file":
        raw_path = unquote(parsed.path)
        if parsed.netloc and parsed.netloc not in ("", "localhost"):
            raw_path = f"//{parsed.netloc}{raw_path}"
        candidate = Path(raw_path).expanduser()
        if candidate.exists() and candidate.is_file():
            return str(candidate.resolve())
        raise RuntimeError(f"Local file URL does not exist: {source}")

    if parsed.scheme in ("http", "https"):
        return None

    # Check relative to working dir, output dir, or parent workspace
    for loc in (Path(source), Path(LOCAL_OUTPUT_DIR) / source, Path("..") / source, Path("..") / ".." / source):
        candidate = loc.expanduser()
        if candidate.exists() and candidate.is_file():
            return str(candidate.resolve())

    if any(sep in source for sep in (os.sep, "/")) or source.startswith("~") or source.startswith("."):
        raise RuntimeError(f"Local file path does not exist: {source}")

    return None


def _existing_download(out_dir: str, video_id: str) -> Optional[str]:
    """Return a cached download path if we already have this YouTube id."""
    for ext in (".mp4", ".mkv", ".webm"):
        candidate = os.path.join(out_dir, f"source_{video_id}{ext}")
        if os.path.exists(candidate) and os.path.getsize(candidate) > 1024:
            return candidate
    return None


def download_youtube_local(video_url: str, fmt: str = "720", out_dir: Optional[str] = None) -> str:
    """Download a remote URL or return a local file path unchanged."""
    local_path = _resolve_local_path(video_url)
    if local_path:
        print(f"[download/local] using local file: {local_path}", flush=True)
        return local_path

    yt_dlp = _import_ytdlp()
    out_dir = out_dir or LOCAL_OUTPUT_DIR
    os.makedirs(out_dir, exist_ok=True)

    video_id = _extract_youtube_video_id(video_url)
    if video_id:
        cached = _existing_download(out_dir, video_id)
        if cached:
            print(f"[download/local] reusing cached download: {cached}", flush=True)
            return cached

    if video_id:
        for part_file in Path(out_dir).glob(f"source_{video_id}*.part"):
            try:
                part_file.unlink(missing_ok=True)
            except Exception:
                pass

    print(f"[download/local] downloading {video_url} @ {fmt}p...", flush=True)

    last_reported = -10

    def _progress_hook(d):
        nonlocal last_reported
        if d.get("status") == "downloading":
            total = d.get("total_bytes") or d.get("total_bytes_estimate") or 0
            downloaded = d.get("downloaded_bytes", 0)
            if total > 0:
                pct = int((downloaded / total) * 100)
                if pct >= last_reported + 10 or pct == 100:
                    last_reported = pct
                    mb_dn = downloaded / (1024 * 1024)
                    mb_tot = total / (1024 * 1024)
                    print(f"[download/local] downloading video: {pct}% ({mb_dn:.1f}MB / {mb_tot:.1f}MB)", flush=True)

    ydl_opts = {
        "format": _format_for(fmt),
        "outtmpl": os.path.join(out_dir, "source_%(id)s.%(ext)s"),
        "merge_output_format": "mp4",
        "overwrites": True,
        "continuedl": False,
        "quiet": True,
        "no_warnings": True,
        "noprogress": True,
        "progress_hooks": [_progress_hook],
    }

    try:
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            info = ydl.extract_info(video_url, download=True)
            path = ydl.prepare_filename(info)
            if not os.path.exists(path):
                stem, _ = os.path.splitext(path)
                for ext in (".mp4", ".mkv", ".webm"):
                    if os.path.exists(stem + ext):
                        path = stem + ext
                        break
    except Exception as e:
        raise RuntimeError(
            f"Failed to download video. Please ensure '{video_url}' is a valid full YouTube URL "
            f"(e.g., https://www.youtube.com/watch?v=...) or valid local file path. Details: {e}"
        ) from e

    print(f"[download/local] ready: {path}", flush=True)
    return path
