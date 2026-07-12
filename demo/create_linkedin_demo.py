from __future__ import annotations

import math
import subprocess
import wave
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageFont, ImageOps


ROOT = Path(__file__).resolve().parent
ASSETS = ROOT / "assets"
SLIDES = ROOT / "slides"
OUTPUT = ROOT / "output"
WIDTH, HEIGHT = 1920, 1080
FPS = 30

PAPER = "#f7f4ee"
PAPER_2 = "#fffdf8"
INK = "#1c1b19"
INK_DIM = "#5f5b54"
LINE = "#ded5c5"
VIOLET = "#8b5cf6"
VIOLET_BG = "#f0e9ff"
TEAL = "#0d9488"
TEAL_BG = "#e2f5f2"
AMBER = "#e08a2c"
AMBER_BG = "#fff0d9"
ROSE = "#d1436b"
ROSE_BG = "#fde8ef"
BLUE = "#2563a8"
BLUE_BG = "#e7effb"


def font(size: int, bold: bool = False, mono: bool = False) -> ImageFont.FreeTypeFont:
    if mono:
        names = ["CascadiaMono-SemiBold.ttf" if bold else "CascadiaMono.ttf", "consola.ttf"]
    else:
        names = ["seguisb.ttf" if bold else "segoeui.ttf", "arialbd.ttf" if bold else "arial.ttf"]
    for name in names:
        path = Path("C:/Windows/Fonts") / name
        if path.exists():
            return ImageFont.truetype(str(path), size)
    return ImageFont.load_default()


def canvas() -> Image.Image:
    img = Image.new("RGB", (WIDTH, HEIGHT), PAPER)
    draw = ImageDraw.Draw(img)
    for y in range(18, HEIGHT, 28):
        for x in range(18, WIDTH, 28):
            draw.ellipse((x, y, x + 2, y + 2), fill="#e6dfd3")
    glow = Image.new("RGBA", (WIDTH, HEIGHT), (0, 0, 0, 0))
    g = ImageDraw.Draw(glow)
    g.ellipse((-280, -360, 800, 720), fill=(139, 92, 246, 25))
    g.ellipse((1350, 520, 2250, 1420), fill=(13, 148, 136, 22))
    glow = glow.filter(ImageFilter.GaussianBlur(90))
    img.paste(glow, (0, 0), glow)
    return img


def rounded(draw: ImageDraw.ImageDraw, box, radius=24, fill=PAPER_2, outline=LINE, width=2):
    draw.rounded_rectangle(box, radius=radius, fill=fill, outline=outline, width=width)


def text(draw, xy, value, size, fill=INK, bold=False, mono=False, anchor=None):
    draw.text(xy, value, font=font(size, bold, mono), fill=fill, anchor=anchor)


def wrap(draw, value: str, max_width: int, size: int, bold=False, mono=False):
    words, lines, current = value.split(), [], ""
    f = font(size, bold, mono)
    for word in words:
        candidate = (current + " " + word).strip()
        if draw.textbbox((0, 0), candidate, font=f)[2] <= max_width:
            current = candidate
        else:
            if current:
                lines.append(current)
            current = word
    if current:
        lines.append(current)
    return lines


def pill(draw, x, y, label, fill, color, w=None):
    f = font(26, True, True)
    measured = draw.textbbox((0, 0), label, font=f)[2]
    width = w or measured + 42
    draw.rounded_rectangle((x, y, x + width, y + 48), radius=24, fill=fill, outline=color, width=1)
    draw.text((x + width / 2, y + 24), label, font=f, fill=color, anchor="mm")
    return width


def load(name: str) -> Image.Image:
    return Image.open(ASSETS / name).convert("RGB")


def browser_frame(img: Image.Image, box, crop=False):
    x1, y1, x2, y2 = box
    w, h = x2 - x1, y2 - y1
    frame = Image.new("RGBA", (w, h), (255, 255, 255, 255))
    d = ImageDraw.Draw(frame)
    d.rounded_rectangle((0, 0, w - 1, h - 1), radius=26, fill="#ffffff", outline=LINE, width=3)
    d.rounded_rectangle((0, 0, w - 1, 64), radius=26, fill="#f4efe6", outline=LINE, width=2)
    d.rectangle((0, 38, w - 1, 64), fill="#f4efe6")
    for i, color in enumerate((ROSE, AMBER, TEAL)):
        d.ellipse((24 + i * 32, 22, 40 + i * 32, 38), fill=color)
    content_box = (18, 76, w - 18, h - 18)
    cw, ch = content_box[2] - content_box[0], content_box[3] - content_box[1]
    fitted = ImageOps.fit(img, (cw, ch), method=Image.Resampling.LANCZOS, centering=(0.5, 0.5)) if crop else ImageOps.contain(img, (cw, ch), method=Image.Resampling.LANCZOS)
    content = Image.new("RGB", (cw, ch), "#ffffff")
    content.paste(fitted, ((cw - fitted.width) // 2, (ch - fitted.height) // 2))
    frame.paste(content, (content_box[0], content_box[1]))
    return frame


def phone_frame(img: Image.Image, height=770):
    ratio = img.width / img.height
    inner_h = height - 36
    inner_w = int(inner_h * ratio)
    out = Image.new("RGBA", (inner_w + 28, height), (0, 0, 0, 0))
    d = ImageDraw.Draw(out)
    d.rounded_rectangle((0, 0, out.width - 1, out.height - 1), radius=34, fill="#1c1b19", outline="#514d46", width=2)
    screen = ImageOps.fit(img, (inner_w, inner_h), method=Image.Resampling.LANCZOS)
    mask = Image.new("L", screen.size, 0)
    ImageDraw.Draw(mask).rounded_rectangle((0, 0, screen.width, screen.height), radius=25, fill=255)
    out.paste(screen, (14, 18), mask)
    d.rounded_rectangle((out.width // 2 - 42, 9, out.width // 2 + 42, 18), radius=5, fill="#1c1b19")
    return out


def header(draw, kicker, title_value, subtitle):
    text(draw, (96, 78), kicker.upper(), 27, VIOLET, True, True)
    text(draw, (96, 126), title_value, 66, INK, True)
    for i, line in enumerate(wrap(draw, subtitle, 1500, 30)):
        text(draw, (98, 212 + i * 40), line, 30, INK_DIM)


def save_slide(index: int, img: Image.Image):
    SLIDES.mkdir(parents=True, exist_ok=True)
    path = SLIDES / f"slide-{index:02d}.png"
    img.save(path, quality=95)
    return path


def slide_title():
    img = canvas(); d = ImageDraw.Draw(img)
    pill(d, 96, 82, "INTERACTIVE LEARNING", VIOLET_BG, VIOLET)
    text(d, (96, 200), "SQL Query Explainer", 96, INK, True)
    text(d, (100, 322), "Watch the database think — clause by clause.", 40, INK_DIM)
    nodes = [("FROM", BLUE_BG, BLUE), ("WHERE", AMBER_BG, AMBER), ("GROUP BY", VIOLET_BG, VIOLET), ("SELECT", TEAL_BG, TEAL), ("RESULT", ROSE_BG, ROSE)]
    x, y = 110, 535
    for i, (label, bg, color) in enumerate(nodes):
        w = 260 if label == "GROUP BY" else 220
        rounded(d, (x, y, x + w, y + 126), 26, bg, color, 3)
        text(d, (x + w / 2, y + 63), label, 31, color, True, True, "mm")
        if i < len(nodes) - 1:
            text(d, (x + w + 34, y + 63), "→", 54, INK_DIM, True, anchor="mm")
        x += w + 78
    text(d, (110, 770), "Real SQLite execution", 32, TEAL, True)
    text(d, (110, 824), "Live data • animated stages • performance concepts • mobile-ready", 29, INK_DIM)
    pill(d, 110, 914, "siddarthasiripragada.github.io/Sql-explainer/", TEAL_BG, TEAL, 780)
    return img


def slide_mobile_pair():
    img = canvas(); d = ImageDraw.Draw(img)
    header(d, "THE QUERY JOURNEY", "One query. Every stage.", "Write SQL and swipe through the same visual execution flow on any screen.")
    phone1 = phone_frame(load("20-mobile-opening.png"), 760)
    phone2 = phone_frame(load("24-mobile-pipeline.png"), 760)
    img.paste(phone1, (105, 282), phone1)
    img.paste(phone2, (560, 282), phone2)
    text(d, (1060, 390), "FROM → WHERE → SELECT", 34, INK, True, True)
    for i, (label, body, color) in enumerate([
        ("1", "Choose an example or type your own SQL.", VIOLET),
        ("2", "SQLite runs the query and exposes each real row set.", AMBER),
        ("3", "Swipe the pipeline and inspect what changed.", TEAL),
    ]):
        cy = 500 + i * 145
        d.ellipse((1060, cy, 1120, cy + 60), fill=color)
        text(d, (1090, cy + 30), label, 26, "#ffffff", True, anchor="mm")
        for j, line in enumerate(wrap(d, body, 650, 30)):
            text(d, (1150, cy + 2 + j * 38), line, 30, INK_DIM)
    return img


def slide_desktop(name, kicker, title_value, subtitle, lesson, color, bg):
    img = canvas(); d = ImageDraw.Draw(img)
    header(d, kicker, title_value, subtitle)
    frame = browser_frame(load(name), (78, 300, 1842, 820), crop=False)
    img.paste(frame, (78, 300), frame)
    rounded(d, (170, 862, 1750, 1000), 28, bg, color, 2)
    text(d, (220, 905), "WHAT YOU SEE", 25, color, True, True)
    lines = wrap(d, lesson, 1330, 31)
    for i, line in enumerate(lines[:2]):
        text(d, (490, 892 + i * 42), line, 31, INK_DIM)
    return img


def slide_mobile_lab():
    img = canvas(); d = ImageDraw.Draw(img)
    header(d, "MOBILE PERFORMANCE LAB", "Tap. Compare. Understand.", "The full learning experience stays interactive and legible on a phone.")
    names = ["21-mobile-btree.png", "22-mobile-bitmap.png", "23-mobile-composite.png"]
    labels = [("B-TREE", VIOLET), ("BITMAP", AMBER), ("COMPOSITE", TEAL)]
    xs = [135, 660, 1185]
    for x, name, (label, color) in zip(xs, names, labels):
        phone = phone_frame(load(name), 755)
        img.paste(phone, (x, 270), phone)
        pill(d, x + 48, 980, label, "#ffffff", color, 250)
    return img


def slide_proof():
    img = canvas(); d = ImageDraw.Draw(img)
    header(d, "BUILT FOR LEARNING", "Not a scripted animation.", "Each stage is reconstructed from real SQLite results inside the browser.")
    cards = [
        ("REAL", "SQLite engine", "Actual queries and query plans", TEAL, TEAL_BG),
        ("LIVE", "Clause pipeline", "Rows change as you type", VIOLET, VIOLET_BG),
        ("CLEAR", "Performance lab", "Indexes explained visually", AMBER, AMBER_BG),
    ]
    for i, (tag, title_value, body, color, bg) in enumerate(cards):
        x = 105 + i * 590
        rounded(d, (x, 365, x + 520, 760), 34, "#ffffff", LINE, 2)
        d.ellipse((x + 42, 410, x + 122, 490), fill=bg, outline=color, width=2)
        text(d, (x + 82, 450), tag, 22, color, True, True, "mm")
        text(d, (x + 42, 540), title_value, 40, INK, True)
        for j, line in enumerate(wrap(d, body, 420, 29)):
            text(d, (x + 42, 610 + j * 40), line, 29, INK_DIM)
    text(d, (960, 895), "Svelte-inspired interaction • D3 visuals • sql.js execution", 33, INK_DIM, anchor="mm")
    return img


def slide_outro():
    img = canvas(); d = ImageDraw.Draw(img)
    text(d, (960, 245), "See SQL execute.", 92, INK, True, anchor="mm")
    text(d, (960, 365), "Not just return results.", 92, VIOLET, True, anchor="mm")
    text(d, (960, 505), "Try the interactive demo", 38, INK_DIM, anchor="mm")
    rounded(d, (330, 595, 1590, 715), 36, TEAL_BG, TEAL, 3)
    text(d, (960, 655), "siddarthasiripragada.github.io/Sql-explainer/", 37, TEAL, True, True, "mm")
    for x, label, color, bg in [(520, "TYPE", VIOLET, VIOLET_BG), (820, "PLAY", AMBER, AMBER_BG), (1120, "LEARN", TEAL, TEAL_BG)]:
        pill(d, x, 820, label, bg, color, 250)
    return img


def make_slides():
    return [
        save_slide(1, slide_title()),
        save_slide(2, slide_mobile_pair()),
        save_slide(3, slide_desktop("10-desktop-btree.png", "PERFORMANCE VISUALIZED", "B-tree: follow the shortcut", "Move from the root to the first matching leaf — then read only what matters.", "The database follows sorted branches instead of opening every table row.", VIOLET, VIOLET_BG)),
        save_slide(4, slide_desktop("11-desktop-bitmap.png", "FILTERS AS BITS", "Bitmap: combine yes/no maps", "AND and OR become visible operations over real example rows.", "Low-cardinality filters become compact bitmaps that can be combined quickly.", AMBER, AMBER_BG)),
        save_slide(5, slide_desktop("12-desktop-composite.png", "ORDER MATTERS", "Composite: choose the entrance", "Swap column order and watch the leftmost-prefix rule change the route.", "The first indexed column decides which queries can jump directly to matching keys.", TEAL, TEAL_BG)),
        save_slide(6, slide_mobile_lab()),
        save_slide(7, slide_proof()),
        save_slide(8, slide_outro()),
    ]


def synth_music(seconds: float, path: Path):
    sr = 44100
    n = int(seconds * sr)
    t = np.arange(n, dtype=np.float64) / sr
    left = np.zeros(n, dtype=np.float64)
    right = np.zeros(n, dtype=np.float64)
    rng = np.random.default_rng(42)
    progression = [
        [130.81, 164.81, 196.00, 246.94],
        [110.00, 130.81, 164.81, 196.00],
        [87.31, 130.81, 174.61, 220.00],
        [98.00, 146.83, 196.00, 246.94],
    ]
    chord_len = 4.0
    for start in np.arange(0, seconds, chord_len):
        chord = progression[int(start / chord_len) % len(progression)]
        a, b = int(start * sr), min(n, int((start + chord_len) * sr))
        local = np.arange(b - a) / sr
        env = np.minimum(1, local / 0.7) * np.minimum(1, (chord_len - local) / 0.8)
        for j, freq in enumerate(chord):
            signal = (np.sin(2 * np.pi * freq * local) + 0.22 * np.sin(2 * np.pi * freq * 2 * local)) * env
            pan = -0.35 + j * 0.23
            left[a:b] += signal * (1 - pan) * 0.022
            right[a:b] += signal * (1 + pan) * 0.022
    beat = 60 / 112
    for k, start in enumerate(np.arange(0, seconds, beat / 2)):
        a = int(start * sr)
        length = min(n - a, int(0.24 * sr))
        if length <= 0:
            continue
        local = np.arange(length) / sr
        chord = progression[int(start / chord_len) % len(progression)]
        note = chord[(k * 2) % len(chord)] * 2
        pluck = np.sin(2 * np.pi * note * local) * np.exp(-local * 12)
        pan = -0.28 if k % 2 == 0 else 0.28
        left[a:a+length] += pluck * (1 - pan) * 0.09
        right[a:a+length] += pluck * (1 + pan) * 0.09
    for beat_index, start in enumerate(np.arange(0, seconds, beat)):
        a = int(start * sr)
        length = min(n - a, int(0.32 * sr))
        local = np.arange(length) / sr
        kick = np.sin(2 * np.pi * (68 - 34 * local) * local) * np.exp(-local * 18)
        left[a:a+length] += kick * 0.18
        right[a:a+length] += kick * 0.18
        if beat_index % 2 == 1:
            noise = rng.normal(0, 1, length)
            noise = np.concatenate(([0], np.diff(noise)))
            clap = noise * np.exp(-local * 24) * 0.045
            left[a:a+length] += clap
            right[a:a+length] += clap
    for start in np.arange(beat / 2, seconds, beat / 2):
        a = int(start * sr)
        length = min(n - a, int(0.07 * sr))
        local = np.arange(length) / sr
        hat = np.concatenate(([0], np.diff(rng.normal(0, 1, length)))) * np.exp(-local * 55) * 0.012
        left[a:a+length] += hat
        right[a:a+length] += hat
    fade = int(1.5 * sr)
    left[:fade] *= np.linspace(0, 1, fade); right[:fade] *= np.linspace(0, 1, fade)
    left[-fade:] *= np.linspace(1, 0, fade); right[-fade:] *= np.linspace(1, 0, fade)
    stereo = np.stack([left, right], axis=1)
    stereo /= max(1.0, np.max(np.abs(stereo)) / 0.82)
    pcm = (stereo * 32767).astype(np.int16)
    with wave.open(str(path), "wb") as wav:
        wav.setnchannels(2); wav.setsampwidth(2); wav.setframerate(sr); wav.writeframes(pcm.tobytes())


def render(slides, ffmpeg: str):
    OUTPUT.mkdir(parents=True, exist_ok=True)
    durations = [4.2, 5.2, 5.5, 5.5, 5.5, 6.0, 5.0, 5.0]
    transition = 0.65
    total = sum(durations) - transition * (len(durations) - 1)
    audio = OUTPUT / "sql-explainer-original-track.wav"
    synth_music(total + 0.2, audio)
    command = [ffmpeg, "-y"]
    for slide, duration in zip(slides, durations):
        command += ["-loop", "1", "-framerate", str(FPS), "-t", str(duration), "-i", str(slide)]
    command += ["-i", str(audio)]
    filters = []
    for i in range(len(slides)):
        filters.append(f"[{i}:v]scale={WIDTH}:{HEIGHT},format=yuv420p,setsar=1[v{i}]")
    previous = "v0"
    elapsed = durations[0]
    for i in range(1, len(slides)):
        offset = elapsed - transition
        output = f"x{i}"
        filters.append(f"[{previous}][v{i}]xfade=transition=fade:duration={transition}:offset={offset:.3f}[{output}]")
        previous = output
        elapsed += durations[i] - transition
    filters.append(f"[{previous}]fade=t=in:st=0:d=0.5,fade=t=out:st={total-0.8:.3f}:d=0.8[video]")
    output = OUTPUT / "sql-explainer-linkedin-demo.mp4"
    command += [
        "-filter_complex", ";".join(filters),
        "-map", "[video]", "-map", f"{len(slides)}:a",
        "-c:v", "libx264", "-preset", "medium", "-crf", "18",
        "-pix_fmt", "yuv420p", "-r", str(FPS),
        "-c:a", "aac", "-b:a", "192k", "-shortest",
        "-movflags", "+faststart", str(output),
    ]
    subprocess.run(command, check=True)
    return output


def main():
    import imageio_ffmpeg
    slides = make_slides()
    output = render(slides, imageio_ffmpeg.get_ffmpeg_exe())
    print(output)


if __name__ == "__main__":
    main()
