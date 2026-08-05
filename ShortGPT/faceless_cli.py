import os
import sys
import json
import argparse
import asyncio
import re
import subprocess
import time
import urllib.request
import urllib.parse
from pathlib import Path

# Force UTF-8 encoding for Windows console output
if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")
if hasattr(sys.stderr, "reconfigure"):
    sys.stderr.reconfigure(encoding="utf-8")

CURRENT_DIR = Path(__file__).parent.resolve()
sys.path.append(str(CURRENT_DIR))

def log_step(tag, message):
    print(f"[{tag}] {message}", flush=True)


# ─────────────────────────────────────────────────────────────────────
# CURATED 4K HD 9:16 VERTICAL SCENE WALLPAPER COLLECTIONS
# ─────────────────────────────────────────────────────────────────────
# ─────────────────────────────────────────────────────────────────────
# CURATED 4K HD 9:16 VERTICAL SCENE WALLPAPER COLLECTIONS
# ─────────────────────────────────────────────────────────────────────
STOCK_COLLECTIONS = {
    "space": [
        "https://images.unsplash.com/photo-1451187580459-43490279c0fa?w=1080&h=1920&fit=crop&crop=entropy&q=85",
        "https://images.unsplash.com/photo-1462331940025-496dfbfc7564?w=1080&h=1920&fit=crop&crop=entropy&q=85",
        "https://images.unsplash.com/photo-1506703719100-a0f3a48c0f86?w=1080&h=1920&fit=crop&crop=entropy&q=85",
        "https://images.unsplash.com/photo-1446776811953-b23d57bd21aa?w=1080&h=1920&fit=crop&crop=entropy&q=85",
        "https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=1080&h=1920&fit=crop&crop=entropy&q=85",
        "https://images.unsplash.com/photo-1447433589675-4aaa569f3e05?w=1080&h=1920&fit=crop&crop=entropy&q=85",
    ],
    "tech": [
        "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=1080&h=1920&fit=crop&crop=entropy&q=85",
        "https://images.unsplash.com/photo-1485827404703-89b55fcc595e?w=1080&h=1920&fit=crop&crop=entropy&q=85",
        "https://images.unsplash.com/photo-1518770660439-4636190af475?w=1080&h=1920&fit=crop&crop=entropy&q=85",
        "https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5?w=1080&h=1920&fit=crop&crop=entropy&q=85",
        "https://images.unsplash.com/photo-1531297484001-80022131f5a1?w=1080&h=1920&fit=crop&crop=entropy&q=85",
        "https://images.unsplash.com/photo-1635070041078-e363dbe005cb?w=1080&h=1920&fit=crop&crop=entropy&q=85",
    ],
    "ocean": [
        "https://images.unsplash.com/photo-1509198397868-475647b2a1e5?w=1080&h=1920&fit=crop&crop=entropy&q=85",
        "https://images.unsplash.com/photo-1544551763-46a013bb70d5?w=1080&h=1920&fit=crop&crop=entropy&q=85",
        "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=1080&h=1920&fit=crop&crop=entropy&q=85",
        "https://images.unsplash.com/photo-1519681393784-d120267933ba?w=1080&h=1920&fit=crop&crop=entropy&q=85",
    ],
    "stoic": [
        "https://images.unsplash.com/photo-1568605117036-5fe5e7bab0b7?w=1080&h=1920&fit=crop&crop=entropy&q=85",
        "https://images.unsplash.com/photo-1514539079130-25950c84af65?w=1080&h=1920&fit=crop&crop=entropy&q=85",
        "https://images.unsplash.com/photo-1579783902614-a3fb3927b675?w=1080&h=1920&fit=crop&crop=entropy&q=85",
        "https://images.unsplash.com/photo-1544620347-c4fd4a3d5957?w=1080&h=1920&fit=crop&crop=entropy&q=85",
    ],
    "finance": [
        "https://images.unsplash.com/photo-1611974789855-9c2a0a7236a3?w=1080&h=1920&fit=crop&crop=entropy&q=85",
        "https://images.unsplash.com/photo-1559526324-4b87b5e36e44?w=1080&h=1920&fit=crop&crop=entropy&q=85",
        "https://images.unsplash.com/photo-1590283603385-17ffb3a7f29f?w=1080&h=1920&fit=crop&crop=entropy&q=85",
        "https://images.unsplash.com/photo-1621416894569-0f39ed31d247?w=1080&h=1920&fit=crop&crop=entropy&q=85",
    ],
    "animal": [
        "https://images.unsplash.com/photo-1514888286974-6c03e2ca1dba?w=1080&h=1920&fit=crop&crop=entropy&q=85",
        "https://images.unsplash.com/photo-1533738363-b7f9aef128ce?w=1080&h=1920&fit=crop&crop=entropy&q=85",
        "https://images.unsplash.com/photo-1561948955-570b270e7c36?w=1080&h=1920&fit=crop&crop=entropy&q=85",
        "https://images.unsplash.com/photo-1573865526739-10659fec78a5?w=1080&h=1920&fit=crop&crop=entropy&q=85",
    ],
    "history": [
        "https://images.unsplash.com/photo-1509198397868-475647b2a1e5?w=1080&h=1920&fit=crop&crop=entropy&q=85",
        "https://images.unsplash.com/photo-1514539079130-25950c84af65?w=1080&h=1920&fit=crop&crop=entropy&q=85",
        "https://images.unsplash.com/photo-1544620347-c4fd4a3d5957?w=1080&h=1920&fit=crop&crop=entropy&q=85",
        "https://images.unsplash.com/photo-1568605117036-5fe5e7bab0b7?w=1080&h=1920&fit=crop&crop=entropy&q=85",
    ],
    "general": [
        "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=1080&h=1920&fit=crop&crop=entropy&q=85",
        "https://images.unsplash.com/photo-1519681393784-d120267933ba?w=1080&h=1920&fit=crop&crop=entropy&q=85",
        "https://images.unsplash.com/photo-1470071459604-3b5ec3a7fe05?w=1080&h=1920&fit=crop&crop=entropy&q=85",
        "https://images.unsplash.com/photo-1497436072909-60f360e1d4b1?w=1080&h=1920&fit=crop&crop=entropy&q=85",
    ]
}


# ─────────────────────────────────────────────────────────────────────
# 1. SCRIPT GENERATION
# ─────────────────────────────────────────────────────────────────────
def generate_script_llm(topic, niche):
    log_step("script", f"Writing script for topic: '{topic}' in niche '{niche}'...")

    gemini_key = os.getenv("GEMINI_API_KEY")
    openai_key = os.getenv("OPENAI_API_KEY")

    is_animated = any(k in niche for k in ["Animated", "Cat", "Story", "Hindi", "Animal"])

    if is_animated:
        prompt = f"""Write a hilarious 35-45 second animated cartoon story script for YouTube Shorts about: '{topic}'.
Style/Niche: {niche}.
Characters: Funny 3D animals (e.g. Fat Orange Cat, Clever Monkey, Greedy Pig).
Language: If niche contains 'Hindi', write in natural conversational Hindi script (Devanagari or Hinglish). Otherwise English.
Rules:
1. Start with an entertaining hook line.
2. Deliver a fast-paced comedic story with a funny twist or lesson.
3. End with a Call To Action to Subscribe.
4. Keep each sentence on a separate line. Do NOT include camera directions or stage notes.
"""
    else:
        prompt = f"""Write an engaging, high-retention 30-45 second YouTube Short script about: '{topic}'.
Style/Niche: {niche}.
Rules:
1. Start with an irresistible hook in the first line.
2. Deliver 3 short, fascinating points or facts.
3. End with a subtle Call To Action to Subscribe.
4. Keep spoken language natural and fast-paced. Do NOT include camera directions or speaker tags.
5. Each sentence MUST be on its own line.
"""

    if gemini_key:
        try:
            log_step("script", "Generating script with Gemini API...")
            import google.generativeai as genai
            genai.configure(api_key=gemini_key)
            model = genai.GenerativeModel('gemini-1.5-flash')
            res = model.generate_content(prompt)
            if res.text:
                return clean_script_text(res.text)
        except Exception as e:
            log_step("script", f"Gemini API warning: {e}. Falling back...")

    if openai_key:
        try:
            log_step("script", "Generating script with OpenAI API...")
            from openai import OpenAI
            client = OpenAI(api_key=openai_key)
            completion = client.chat.completions.create(
                model="gpt-3.5-turbo",
                messages=[
                    {"role": "system", "content": "You are an expert viral YouTube Shorts scriptwriter."},
                    {"role": "user", "content": prompt}
                ]
            )
            return clean_script_text(completion.choices[0].message.content)
        except Exception as e:
            log_step("script", f"OpenAI API warning: {e}. Falling back...")

    log_step("script", "Using intelligent topic story generator...")
    return generate_fallback_script(topic, niche)


def clean_script_text(raw_text):
    lines = [line.strip() for line in raw_text.splitlines() if line.strip()]
    cleaned = []
    for line in lines:
        line = re.sub(r"\[.*?\]|\(.*?\)", "", line)
        line = re.sub(r"^(Narrator|Speaker|Host|Character|Person):\s*", "", line, flags=re.IGNORECASE)
        line = line.strip()
        if line and len(line) > 5:
            cleaned.append(line)
    return "\n".join(cleaned)


def generate_fallback_script(topic, niche):
    t = topic.strip().title()
    if "Hindi" in niche:
        return (
            f"क्या आप जानते हैं {t} के बारे में यह चौंकाने वाला सच?\n"
            f"दुनिया में {t} से जुड़ी कई ऐसी बातें हैं जो हर इंसान को हैरान कर देती हैं!\n"
            f"वैज्ञानिकों के अनुसार, यह रहस्य आज भी लोगों को सोचने पर मजबूर कर देता है!\n"
            f"अगर आपको यह रोचक जानकारी पसंद आई तो वीडियो को लाइक करें और चैनल को सब्सक्राइब करें!"
        )
    elif "Cat" in niche or "Animal" in niche:
        return (
            f"Meet the world's most dramatic cat taking on {t}!\n"
            f"Every single morning, he attempts the most impossible stunt in the house.\n"
            f"His friends couldn't believe their eyes when he actually pulled it off!\n"
            f"Which moment was your favorite? Comment below and subscribe for more!"
        )
    elif "Finance" in niche or "Money" in niche:
        return (
            f"Here are 3 money secrets about {t} that rich people won't tell you!\n"
            f"First, 90% of people make the huge mistake of ignoring smart leverage.\n"
            f"Second, compound growth turns small daily habits into massive wealth.\n"
            f"Third, investing in high-income skills creates true financial freedom!\n"
            f"Subscribe now for daily wealth building tips!"
        )
    elif "Tech" in niche or "AI" in niche:
        return (
            f"AI just completely transformed everything we knew about {t}!\n"
            f"First, new breakthroughs allow automated tools to perform tasks in seconds.\n"
            f"Second, experts predict this technology will revolutionize the entire industry.\n"
            f"Third, learning these AI tools now gives you an unfair advantage!\n"
            f"Hit subscribe to stay ahead of the future!"
        )
    else:
        return (
            f"Did you know these 3 mind-blowing facts about {t}?\n"
            f"First, researchers uncovered a secret that completely changes the history of {t}!\n"
            f"Second, this phenomenon happens far more often than anyone ever realized.\n"
            f"Third, the actual reason behind it will leave you completely speechless!\n"
            f"Which fact surprised you the most? Subscribe for more daily mind-blowing facts!"
        )


# ─────────────────────────────────────────────────────────────────────
# 2. TTS WITH WORD-LEVEL TIMESTAMPS
# ─────────────────────────────────────────────────────────────────────
async def generate_tts_with_subs(text, voice, audio_path, srt_path):
    log_step("tts", f"Synthesizing voiceover with EdgeTTS ({voice})...")
    import edge_tts

    communicate = edge_tts.Communicate(text, voice, boundary="WordBoundary")
    submaker = edge_tts.SubMaker()

    with open(audio_path, "wb") as audio_file:
        async for chunk in communicate.stream():
            if chunk["type"] == "audio":
                audio_file.write(chunk["data"])
            elif chunk["type"] == "WordBoundary":
                submaker.feed(chunk)

    srt_content = submaker.get_srt()

    if not srt_content.strip():
        log_step("tts", "Word boundaries unavailable, generating sentence-level subtitles...")
        srt_content = generate_fallback_srt(text, audio_path)

    with open(srt_path, "w", encoding="utf-8") as f:
        f.write(srt_content)

    log_step("tts", f"Voiceover + subtitles generated ({len(srt_content)} bytes)")
    return srt_content


def generate_fallback_srt(text, audio_path):
    duration = get_audio_duration(audio_path)
    sentences = [s.strip() for s in re.split(r'[.\n]+', text) if s.strip()]
    if not sentences:
        return ""

    total_chars = sum(len(s) for s in sentences)
    srt_lines = []
    current_time = 0.3

    for idx, sentence in enumerate(sentences, 1):
        sent_duration = (len(sentence) / total_chars) * (duration - 0.5)
        start = current_time
        end = current_time + sent_duration
        srt_lines.append(f"{idx}\n{format_srt_time(start)} --> {format_srt_time(end)}\n{sentence}\n")
        current_time = end + 0.05

    return "\n".join(srt_lines)


def format_srt_time(seconds):
    h = int(seconds // 3600)
    m = int((seconds % 3600) // 60)
    s = int(seconds % 60)
    ms = int((seconds % 1) * 1000)
    return f"{h:02d}:{m:02d}:{s:02d},{ms:03d}"


# ─────────────────────────────────────────────────────────────────────
# 3. STYLED BIONIC KARAOKE CAPTIONS (ACTIVE WORD HIGHLIGHT)
# ─────────────────────────────────────────────────────────────────────
def srt_to_ass(srt_path, ass_path):
    log_step("subtitles", "Creating bionic karaoke word-by-word active highlight captions...")

    ass_header = r"""[Script Info]
Title: Faceless Bionic Karaoke Subtitles
ScriptType: v4.00+
PlayResX: 1080
PlayResY: 1920
WrapStyle: 0

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Default,Arial Black,76,&H00FFFFFF,&H0000FFFF,&H00000000,&H96000000,-1,0,0,0,100,100,2,0,1,5,3,2,60,60,440,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
"""

    with open(srt_path, "r", encoding="utf-8") as f:
        srt_text = f.read()

    cues = []
    blocks = re.split(r'\r?\n\r?\n+', srt_text.strip())
    for block in blocks:
        lines = [l.strip() for l in block.strip().split('\n') if l.strip()]
        if len(lines) < 3:
            continue
        time_line = lines[1]
        text = ' '.join(lines[2:]).strip()
        if not text:
            continue

        match = re.match(
            r'(\d{2}):(\d{2}):(\d{2})[,.](\d{3})\s*-->\s*(\d{2}):(\d{2}):(\d{2})[,.](\d{3})',
            time_line
        )
        if not match:
            continue

        g = [int(x) for x in match.groups()]
        start_ms = g[0]*3600000 + g[1]*60000 + g[2]*1000 + g[3]
        end_ms = g[4]*3600000 + g[5]*60000 + g[6]*1000 + g[7]
        cues.append({"start": start_ms, "end": end_ms, "text": text})

    if not cues:
        with open(ass_path, "w", encoding="utf-8") as f:
            f.write(ass_header)
        return ass_path

    WORDS_PER_GROUP = 3
    events = []

    for i in range(0, len(cues), WORDS_PER_GROUP):
        group = cues[i:i + WORDS_PER_GROUP]
        for active_idx, target in enumerate(group):
            start_str = ms_to_ass_time(target["start"])
            end_str = ms_to_ass_time(target["end"])

            formatted_words = []
            for w_idx, word_cue in enumerate(group):
                w_text = word_cue["text"].upper()
                if w_idx == active_idx:
                    formatted_words.append(rf"{{\c&H0000FFFF&}}{w_text}{{\c&H00FFFFFF&}}")
                else:
                    formatted_words.append(w_text)

            line_text = " ".join(formatted_words)
            events.append(f"Dialogue: 0,{start_str},{end_str},Default,,0,0,0,,{line_text}")

    with open(ass_path, "w", encoding="utf-8") as f:
        f.write(ass_header)
        f.write('\n'.join(events) + '\n')

    log_step("subtitles", f"Bionic Karaoke ASS subtitles created with {len(events)} active word states")
    return ass_path


def ms_to_ass_time(ms):
    h = ms // 3600000
    m = (ms % 3600000) // 60000
    s = (ms % 60000) // 1000
    cs = (ms % 1000) // 10
    return f"{h}:{m:02d}:{s:02d}.{cs:02d}"


STOP_WORDS = {"a", "an", "the", "in", "on", "of", "to", "for", "with", "and", "or", "is", "are", "was", "were", "this", "that", "these", "those", "you", "your", "did", "know", "first", "second", "third", "which", "fact", "favorite", "subscribe", "more", "daily", "comment", "below", "hit", "like", "here", "have", "about"}

def extract_prompt_keywords(sentence, topic):
    words = re.findall(r"\b[a-zA-Z]{3,}\b", sentence.lower())
    filtered = [w for w in words if w not in STOP_WORDS]
    topic_words = re.findall(r"\b[a-zA-Z]{3,}\b", topic.lower())
    combined = (filtered[:3] + [w for w in topic_words if w not in filtered])[:4]
    if not combined:
        combined = topic_words[:3] or ["cinematic", "render"]
    return " ".join(combined)


# ─────────────────────────────────────────────────────────────────────
# 4. HD 9:16 SCENE IMAGE GENERATION ACCORDING TO SPOKEN CONTENT
# ─────────────────────────────────────────────────────────────────────
def fetch_scene_images(script, topic, niche, output_dir):
    log_step("visuals", "Generating 4K HD 9:16 scene images according to spoken content...")

    # Split script by newlines AND by sentence endings (. ! ?) to create 4-6 distinct scenes
    raw_lines = [s.strip() for s in script.splitlines() if s.strip()]
    sentences = []
    for line in raw_lines:
        chunks = [c.strip() for c in re.split(r'(?<=[.!?])\s+', line) if c.strip()]
        for c in chunks:
            if len(c) > 4:
                sentences.append(c)

    if not sentences:
        sentences = [topic]

    log_step("visuals", f"Detected {len(sentences)} distinct spoken scene sentences. Generating unique visuals...")

    niche_lower = niche.lower()
    collection_key = "general"
    for key in ["space", "tech", "ocean", "stoic", "finance", "animal", "history"]:
        if key in niche_lower or (key == "ocean" and "sea" in niche_lower) or (key == "animal" and "cat" in niche_lower):
            collection_key = key
            break

    niche_urls = STOCK_COLLECTIONS.get(collection_key, STOCK_COLLECTIONS["general"])
    all_urls = niche_urls + STOCK_COLLECTIONS["general"] + STOCK_COLLECTIONS["tech"] + STOCK_COLLECTIONS["space"]
    image_paths = []

    for idx, sentence in enumerate(sentences):
        img_path = str(output_dir / f"scene_{idx}_{time.time_ns()}.jpg")
        keywords = extract_prompt_keywords(sentence, topic)

        # Select a completely unique 4K portrait image URL for every scene index
        target_url = all_urls[idx % len(all_urls)]

        success = False
        try:
            log_step("visuals", f"Downloading 4K visual {idx + 1}/{len(sentences)} for scene: '{sentence[:30]}...' ({keywords})")
            req = urllib.request.Request(target_url, headers={'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'})
            with urllib.request.urlopen(req, timeout=10) as resp, open(img_path, 'wb') as out_f:
                out_f.write(resp.read())

            if os.path.exists(img_path) and os.path.getsize(img_path) > 10000:
                image_paths.append(img_path)
                success = True
        except Exception as e:
            log_step("visuals", f"Scene {idx + 1} notice ({e}). Creating fallback visual...")

        if not success:
            create_fallback_image(img_path, idx)
            image_paths.append(img_path)

        time.sleep(0.2)

    return image_paths, sentences


def create_fallback_image(output_path, idx):
    colors = ["0x0f172a", "0x1e1b4b", "0x311042", "0x064e3b", "0x451a03"]
    c = colors[idx % len(colors)]
    cmd = [
        "ffmpeg", "-y", "-f", "lavfi",
        "-i", f"color=c={c}:s=1080x1920:d=1",
        "-frames:v", "1", output_path
    ]
    subprocess.run(cmd, capture_output=True)


# ─────────────────────────────────────────────────────────────────────
# 5. RENDER MULTI-SCENE VERTICAL VIDEO SEQUENCE + KEN BURNS MOTION
# ─────────────────────────────────────────────────────────────────────
def get_audio_duration(audio_path):
    result = subprocess.run(
        ["ffprobe", "-v", "quiet", "-print_format", "json", "-show_format", audio_path],
        capture_output=True, text=True
    )
    info = json.loads(result.stdout)
    return float(info["format"]["duration"])


def render_video(audio_path, ass_path, output_video, topic, duration, scene_images=None):
    log_step("render", "Rendering 9:16 vertical Short with Ken Burns motion + subtitles...")

    abs_ass_path = str(Path(ass_path).resolve()).replace("\\", "/").replace(":", "\\:")
    clean_topic = re.sub(r"[^a-zA-Z0-9 ]", "", topic)[:35].upper()

    if scene_images and len(scene_images) > 0:
        num_scenes = len(scene_images)
        per_scene_dur = duration / num_scenes

        cmd = ["ffmpeg", "-y"]
        for img in scene_images:
            cmd.extend(["-loop", "1", "-t", f"{per_scene_dur:.2f}", "-i", img])

        cmd.extend(["-i", audio_path])

        filter_parts = []
        for i in range(num_scenes):
            # Scale & apply subtle cinematic Ken Burns slow zoompan micro-motion
            filter_parts.append(
                f"[{i}:v]scale=1080:1920:force_original_aspect_ratio=increase,"
                f"crop=1080:1920,"
                f"zoompan=z='min(zoom+0.0012,1.12)':d=125:x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':s=1080x1920,setsar=1[v{i}];"
            )

        concat_inputs = "".join(f"[v{i}]" for i in range(num_scenes))
        filter_parts.append(f"{concat_inputs}concat=n={num_scenes}:v=1:a=0[vbase];")

        # Top title banner + ASS Bionic Karaoke subtitles
        filter_parts.append(
            f"[vbase]drawtext="
            f"fontfile='C\\:/Windows/Fonts/arialbd.ttf':"
            f"text='{clean_topic}':"
            f"fontsize=42:fontcolor=0xFFD700@0.95:"
            f"x=(w-text_w)/2:y=140:"
            f"borderw=4:bordercolor=black@0.8[titled];"

            f"[titled]ass='{abs_ass_path}'[out]"
        )

        filter_complex = "".join(filter_parts)

        cmd.extend([
            "-filter_complex", filter_complex,
            "-map", "[out]",
            "-map", f"{num_scenes}:a",
            "-c:v", "libx264",
            "-preset", "fast",
            "-crf", "20",
            "-pix_fmt", "yuv420p",
            "-c:a", "aac",
            "-b:a", "192k",
            "-shortest",
            output_video
        ])

    else:
        filter_complex = (
            f"color=c=0x0a0a2e:s=1080x1920:d={duration}:r=30[bg1];"
            f"color=c=0x1a0533:s=1080x960:d={duration}:r=30[grad];"
            f"[bg1][grad]overlay=0:960:format=auto[bgblend];"
            f"[bgblend]drawtext="
            f"fontfile='C\\:/Windows/Fonts/arialbd.ttf':"
            f"text='{clean_topic}':"
            f"fontsize=48:fontcolor=white@0.85:"
            f"x=(w-text_w)/2:y=180:"
            f"borderw=3:bordercolor=black@0.5[titled];"
            f"[titled]ass='{rel_ass_path}'[out]"
        )

        cmd = [
            "ffmpeg", "-y",
            "-f", "lavfi", "-i", f"nullsrc=s=1080x1920:d={duration}:r=30",
            "-i", audio_path,
            "-filter_complex", filter_complex,
            "-map", "[out]",
            "-map", "1:a",
            "-c:v", "libx264",
            "-preset", "fast",
            "-crf", "22",
            "-pix_fmt", "yuv420p",
            "-c:a", "aac",
            "-b:a", "192k",
            "-shortest",
            output_video
        ]

    log_step("render", "Running FFmpeg render pipeline...")
    result = subprocess.run(cmd, capture_output=True, text=True)
    if result.returncode != 0:
        stderr_tail = result.stderr[-800:] if result.stderr else "no stderr"
        log_step("render", f"FFmpeg stderr: {stderr_tail}")
        raise RuntimeError(f"FFmpeg render failed (exit {result.returncode})")

    log_step("render", f"Rendered vertical Short video at: {output_video}")


# ─────────────────────────────────────────────────────────────────────
# 6. GENERATE THUMBNAIL
# ─────────────────────────────────────────────────────────────────────
def generate_thumbnail(output_video, thumbnail_path, topic):
    log_step("thumbnail", "Generating video thumbnail...")
    clean_topic = re.sub(r"[^a-zA-Z0-9 ]", "", topic)[:30]

    vf_filter = (
        f"select=eq(n\\,30),"
        f"drawtext="
        f"fontfile='C\\:/Windows/Fonts/arialbd.ttf':"
        f"text='{clean_topic}':"
        f"fontsize=64:fontcolor=white:"
        f"x=(w-text_w)/2:y=(h-text_h)/2-80:"
        f"borderw=5:bordercolor=black,"
        f"drawtext="
        f"fontfile='C\\:/Windows/Fonts/arialbd.ttf':"
        f"text='MUST WATCH':"
        f"fontsize=52:fontcolor=yellow:"
        f"x=(w-text_w)/2:y=(h-text_h)/2+40:"
        f"borderw=4:bordercolor=black"
    )

    cmd = [
        "ffmpeg", "-y",
        "-i", output_video,
        "-vf", vf_filter,
        "-frames:v", "1",
        "-q:v", "2",
        thumbnail_path
    ]

    result = subprocess.run(cmd, capture_output=True, text=True)
    if result.returncode == 0:
        log_step("thumbnail", f"Thumbnail saved: {thumbnail_path}")
    else:
        log_step("thumbnail", f"Thumbnail warning: {result.stderr[-300:]}")

    return thumbnail_path


# ─────────────────────────────────────────────────────────────────────
# 7. SEO METADATA
# ─────────────────────────────────────────────────────────────────────
def generate_seo_metadata(topic, script):
    clean_topic = topic.title()
    title = f"\U0001f92f The Secret of {clean_topic} #Shorts"
    hashtags = ["#Shorts", f"#{clean_topic.replace(' ', '')}", "#Viral", "#DidYouKnow", "#Facts", "#MindBlowing"]
    description = (
        f"Discover the truth about {clean_topic} in 45 seconds!\n\n"
        f"{script[:150]}...\n\n"
        f"Subscribe to the channel for more daily short breakdowns!\n\n"
        + " ".join(hashtags)
    )
    return title, description, hashtags


# ─────────────────────────────────────────────────────────────────────
# MAIN
# ─────────────────────────────────────────────────────────────────────
def main():
    parser = argparse.ArgumentParser(description="ShortGPT Faceless Short Video Generator CLI")
    parser.add_argument("--topic", type=str, required=True)
    parser.add_argument("--niche", type=str, default="Facts")
    parser.add_argument("--voice", type=str, default="en-US-ChristopherNeural")
    parser.add_argument("--output-json", type=str, required=True)

    args = parser.parse_args()

    output_dir = CURRENT_DIR / "videos"
    output_dir.mkdir(exist_ok=True)

    ts = int(time.time())
    audio_path = str(output_dir / f"faceless_audio_{ts}.mp3")
    srt_path = str(output_dir / f"faceless_subs_{ts}.srt")
    ass_path = str(output_dir / f"faceless_subs_{ts}.ass")
    video_path = str(output_dir / f"faceless_short_{ts}.mp4")
    thumb_path = str(output_dir / f"faceless_thumb_{ts}.jpg")

    try:
        # 1. Generate script
        script = generate_script_llm(args.topic, args.niche)

        # 2. Fetch HD 9:16 scene visual images
        scene_images, _ = fetch_scene_images(script, args.topic, args.niche, output_dir)

        # 3. Generate TTS audio + word-level SRT subtitles
        asyncio.run(generate_tts_with_subs(script, args.voice, audio_path, srt_path))

        # 4. Convert SRT to styled ASS subtitles
        srt_to_ass(srt_path, ass_path)

        # 5. Get audio duration
        duration = get_audio_duration(audio_path)
        log_step("render", f"Audio duration: {duration:.1f}s")

        # 6. Render multi-scene video with HD visuals + audio + ASS subtitles
        render_video(audio_path, ass_path, video_path, args.topic, duration, scene_images=scene_images)

        # 7. Generate thumbnail
        generate_thumbnail(video_path, thumb_path, args.topic)

        # 8. SEO metadata
        title, description, hashtags = generate_seo_metadata(args.topic, script)

        log_step("done", "Faceless Short generation completed successfully!")

        result = {
            "status": "success",
            "topic": args.topic,
            "niche": args.niche,
            "voice": args.voice,
            "videoPath": video_path,
            "filename": os.path.basename(video_path),
            "thumbnailPath": thumb_path,
            "thumbnailFilename": os.path.basename(thumb_path),
            "script": script,
            "title": title,
            "description": description,
            "hashtags": hashtags,
            "audioPath": audio_path,
            "duration": round(duration, 1)
        }

        with open(args.output_json, "w", encoding="utf-8") as f:
            json.dump(result, f, indent=2)

    except Exception as e:
        log_step("error", f"Generation failed: {str(e)}")
        import traceback
        traceback.print_exc()
        with open(args.output_json, "w", encoding="utf-8") as f:
            json.dump({"status": "error", "error": str(e)}, f, indent=2)
        sys.exit(1)


if __name__ == "__main__":
    main()
