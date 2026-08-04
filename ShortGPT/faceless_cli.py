import os
import sys
import json
import argparse
import asyncio
import re
import subprocess
import time
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
# 1. SCRIPT GENERATION
# ─────────────────────────────────────────────────────────────────────
def generate_script_llm(topic, niche):
    log_step("script", f"Writing script for topic: '{topic}' in niche '{niche}'...")

    gemini_key = os.getenv("GEMINI_API_KEY")
    openai_key = os.getenv("OPENAI_API_KEY")

    is_animated = "Animated" in niche or "Cat" in niche or "Story" in niche or "Hindi" in niche

    if is_animated:
        prompt = f"""Write a hilarious 35-45 second animated cartoon story script for YouTube Shorts about: '{topic}'.
Style/Niche: {niche}.
Characters: Funny 3D animals (e.g. Fat Orange Cat, Clever Monkey, Greedy Pig).
Language: If niche contains 'Hindi', write in natural conversational Hindi script (Devanagari or Hinglish). Otherwise English.
Rules:
1. Start with an entertaining hook line.
2. Deliver a fast-paced comedic story with a funny twist or lesson.
3. End with a Call To Action to Subscribe.
4. Keep each sentence on a separate line.
"""
    else:
        prompt = f"""Write an engaging, high-retention 30-45 second YouTube Short script about: '{topic}'.
Style/Niche: {niche}.
Rules:
1. Start with an irresistible hook in the first line.
2. Deliver 3 short, fascinating points or facts.
3. End with a subtle Call To Action.
4. Keep spoken language natural and fast-paced. Do NOT include camera directions or speaker tags.
5. Each sentence should be on its own line.
"""

    if gemini_key:
        try:
            log_step("script", "Generating script with Gemini API...")
            import google.generativeai as genai
            genai.configure(api_key=gemini_key)
            model = genai.GenerativeModel('gemini-1.5-flash')
            res = model.generate_content(prompt)
            if res.text:
                return res.text.strip()
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
                    {"role": "system", "content": "You are an expert viral YouTube Shorts scriptwriter for animated stories."},
                    {"role": "user", "content": prompt}
                ]
            )
            return completion.choices[0].message.content.strip()
        except Exception as e:
            log_step("script", f"OpenAI API warning: {e}. Falling back...")

    log_step("script", "Using intelligent template engine for script creation...")
    t = topic.strip()
    if "Hindi" in niche or "Cat" in niche:
        return (
            f"एक बार की बात है, {t} में एक बहुत ही चालाक मोटा बिल्ला रहता था!\n"
            f"वह रोज जंगल के दूसरे जानवरों को अपनी चतुराई से बेवकूफ बनाता था।\n"
            f"लेकिन एक दिन बंदर गोलू ने बिल्ले को सबक सिखाने की एक जबरदस्त योजना बनाई!\n"
            f"जब बिल्ला मलाई खाने पहुंचा, तो गोलू ने डिब्बे का ढक्कन बंद कर दिया और बिल्ला फंस गया!\n"
            f"यह देखकर सब जानवर जोर-जोर से हंसने लगे!\n"
            f"अगर आपको यह मजेदार कहानी पसंद आई तो वीडियो को लाइक करें और चैनल को सब्सक्राइब करें!"
        )
    return (
        f"Once upon a time, in a world of {t}, there lived a super smart 3D Fat Cat!\n"
        f"Every single day, he pulled the funniest pranks on his animal best friends.\n"
        f"First, he tricked the greedy pig into hiding all his snacks in a secret tree hole.\n"
        f"Second, when the clever monkey found out, they teamed up for the ultimate payback!\n"
        f"And third, the lesson learned completely turned the entire forest upside down!\n"
        f"Which character was your favorite?\n"
        f"Drop a comment below and hit subscribe for more daily animated short stories!"
    )


# ─────────────────────────────────────────────────────────────────────
# 2. TTS WITH WORD-LEVEL TIMESTAMPS
# ─────────────────────────────────────────────────────────────────────
async def generate_tts_with_subs(text, voice, audio_path, srt_path):
    log_step("tts", f"Synthesizing voiceover with EdgeTTS ({voice})...")
    import edge_tts

    # Use boundary="WordBoundary" to get word-level timing
    communicate = edge_tts.Communicate(text, voice, boundary="WordBoundary")
    submaker = edge_tts.SubMaker()

    with open(audio_path, "wb") as audio_file:
        async for chunk in communicate.stream():
            if chunk["type"] == "audio":
                audio_file.write(chunk["data"])
            elif chunk["type"] == "WordBoundary":
                submaker.feed(chunk)

    # Get SRT content from SubMaker
    srt_content = submaker.get_srt()

    if not srt_content.strip():
        # Fallback: generate sentence-level SRT if word boundaries unavailable
        log_step("tts", "Word boundaries unavailable, generating sentence-level subtitles...")
        srt_content = generate_fallback_srt(text, audio_path)

    with open(srt_path, "w", encoding="utf-8") as f:
        f.write(srt_content)

    log_step("tts", f"Voiceover + subtitles generated ({len(srt_content)} bytes)")
    return srt_content


def generate_fallback_srt(text, audio_path):
    """Generate sentence-level SRT based on estimated timing."""
    duration = get_audio_duration(audio_path)
    sentences = [s.strip() for s in re.split(r'[.\n]+', text) if s.strip()]
    if not sentences:
        return ""

    total_chars = sum(len(s) for s in sentences)
    srt_lines = []
    current_time = 0.3  # small offset

    for idx, sentence in enumerate(sentences, 1):
        sent_duration = (len(sentence) / total_chars) * (duration - 0.5)
        start = current_time
        end = current_time + sent_duration

        start_str = format_srt_time(start)
        end_str = format_srt_time(end)

        srt_lines.append(f"{idx}\n{start_str} --> {end_str}\n{sentence}\n")
        current_time = end + 0.05

    return "\n".join(srt_lines)


def format_srt_time(seconds):
    h = int(seconds // 3600)
    m = int((seconds % 3600) // 60)
    s = int(seconds % 60)
    ms = int((seconds % 1) * 1000)
    return f"{h:02d}:{m:02d}:{s:02d},{ms:03d}"


# ─────────────────────────────────────────────────────────────────────
# 3. GROUP WORD-LEVEL SRT INTO READABLE SUBTITLE CHUNKS + ASS
# ─────────────────────────────────────────────────────────────────────
def srt_to_ass(srt_path, ass_path):
    """Convert word-level SRT to grouped, styled ASS subtitle file."""
    log_step("subtitles", "Creating styled animated captions...")

    ass_header = r"""[Script Info]
Title: Faceless Short Subtitles
ScriptType: v4.00+
PlayResX: 1080
PlayResY: 1920
WrapStyle: 0

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Default,Arial,80,&H00FFFFFF,&H000088FF,&H00000000,&H96000000,-1,0,0,0,100,100,3,0,1,5,2,2,80,80,350,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
"""

    # Parse SRT
    with open(srt_path, "r", encoding="utf-8") as f:
        srt_text = f.read()

    # Parse all SRT cues
    cues = []
    blocks = re.split(r'\r?\n\r?\n+', srt_text.strip())
    for block in blocks:
        lines = block.strip().split('\n')
        # Handle \r in lines
        lines = [l.strip() for l in lines]
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
        log_step("subtitles", "No cues found in SRT, writing empty ASS")
        with open(ass_path, "w", encoding="utf-8") as f:
            f.write(ass_header)
        return ass_path

    # Group word-level cues into 3-5 word subtitle chunks for readability
    WORDS_PER_GROUP = 4
    grouped = []
    for i in range(0, len(cues), WORDS_PER_GROUP):
        chunk = cues[i:i + WORDS_PER_GROUP]
        group_text = " ".join(c["text"] for c in chunk).upper()
        group_start = chunk[0]["start"]
        group_end = chunk[-1]["end"]
        grouped.append({"start": group_start, "end": group_end, "text": group_text})

    # Convert to ASS dialogue lines
    events = []
    for g in grouped:
        start_str = ms_to_ass_time(g["start"])
        end_str = ms_to_ass_time(g["end"])
        clean = g["text"].replace('\n', ' ')
        events.append(f"Dialogue: 0,{start_str},{end_str},Default,,0,0,0,,{clean}")

    with open(ass_path, "w", encoding="utf-8") as f:
        f.write(ass_header)
        f.write('\n'.join(events) + '\n')

    log_step("subtitles", f"Styled ASS subtitles created with {len(events)} caption groups")
    return ass_path


def ms_to_ass_time(ms):
    h = ms // 3600000
    m = (ms % 3600000) // 60000
    s = (ms % 60000) // 1000
    cs = (ms % 1000) // 10
    return f"{h}:{m:02d}:{s:02d}.{cs:02d}"


# ─────────────────────────────────────────────────────────────────────
# 4. RENDER VIDEO WITH GRADIENT BG + AUDIO + SUBTITLES (FFmpeg)
# ─────────────────────────────────────────────────────────────────────
def get_audio_duration(audio_path):
    result = subprocess.run(
        ["ffprobe", "-v", "quiet", "-print_format", "json", "-show_format", audio_path],
        capture_output=True, text=True
    )
    info = json.loads(result.stdout)
    return float(info["format"]["duration"])


def render_video(audio_path, srt_path, output_video, topic, duration):
    log_step("render", "Rendering 9:16 vertical Short with gradient background + subtitles...")

    # Compute relative posix path for SRT subtitle file
    rel_srt_path = Path(srt_path).relative_to(CURRENT_DIR).as_posix()

    clean_topic = re.sub(r"[^a-zA-Z0-9 ]", "", topic)[:40]

    # Build FFmpeg filter_complex for a stylish background and bold centered subtitles
    sub_style = "Fontname=Arial,Fontsize=22,PrimaryColour=&H0000FFFF,OutlineColour=&H00000000,BorderStyle=1,Outline=3,Shadow=2,Alignment=2,MarginV=300"

    filter_complex = (
        # Dark gradient background (navy to deep purple)
        f"color=c=0x0a0a2e:s=1080x1920:d={duration}:r=30[bg1];"
        f"color=c=0x1a0533:s=1080x960:d={duration}:r=30[grad];"
        f"[bg1][grad]overlay=0:960:format=auto[bgblend];"

        # Animated glow orb
        f"color=c=0x6366f1@0.15:s=400x400:d={duration}:r=30,"
        f"format=yuva420p,"
        f"geq=lum='lum(X,Y)':a='if(lt(hypot(X-200,Y-200),180),80,0)'[glow];"
        f"[bgblend][glow]overlay='340+20*sin(t)':'700+30*cos(t*0.7)':format=auto[bgfx];"

        # Topic title at top
        f"[bgfx]drawtext="
        f"fontfile='C\\:/Windows/Fonts/arialbd.ttf':"
        f"text='{clean_topic}':"
        f"fontsize=48:fontcolor=white@0.85:"
        f"x=(w-text_w)/2:y=180:"
        f"borderw=3:bordercolor=black@0.5[titled];"

        # Accent underline
        f"[titled]drawbox=x=340:y=260:w=400:h=4:color=0x818cf8@0.8:t=fill[lined];"

        # Burn subtitles using SRT filter with custom yellow force_style
        f"[lined]subtitles='{rel_srt_path}':force_style='{sub_style}'[out]"
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
        "-crf", "23",
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
# 5. GENERATE THUMBNAIL
# ─────────────────────────────────────────────────────────────────────
def generate_thumbnail(output_video, thumbnail_path, topic):
    log_step("thumbnail", "Generating video thumbnail...")

    clean_topic = re.sub(r"[^a-zA-Z0-9 ]", "", topic)[:30]

    # Extract a frame from the video and add styled text overlay
    # Use a frame at ~2 seconds into the video
    vf_filter = (
        f"select=eq(n\\,60),"
        f"drawtext="
        f"fontfile='C\\:/Windows/Fonts/arialbd.ttf':"
        f"text='{clean_topic}':"
        f"fontsize=72:fontcolor=white:"
        f"x=(w-text_w)/2:y=(h-text_h)/2-80:"
        f"borderw=5:bordercolor=black,"
        f"drawtext="
        f"fontfile='C\\:/Windows/Fonts/arialbd.ttf':"
        f"text='MUST WATCH':"
        f"fontsize=56:fontcolor=yellow:"
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
# 6. SEO METADATA
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

        # 2. Generate TTS audio + word-level SRT subtitles
        asyncio.run(generate_tts_with_subs(script, args.voice, audio_path, srt_path))

        # 3. Convert SRT to styled ASS subtitles
        srt_to_ass(srt_path, ass_path)

        # 4. Get audio duration
        duration = get_audio_duration(audio_path)
        log_step("render", f"Audio duration: {duration:.1f}s")

        # 5. Render video with gradient bg + audio + subtitles
        render_video(audio_path, srt_path, video_path, args.topic, duration)

        # 6. Generate thumbnail
        generate_thumbnail(video_path, thumb_path, args.topic)

        # 7. SEO metadata
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
