#!/usr/bin/env python3
"""Build README media (GIF, social preview) and the static GitHub Pages demo.

Usage (after `node scripts/capture.js`):
    python scripts/build-media.py
"""

import json
import subprocess
import sys
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parent.parent
ASSETS = ROOT / "docs" / "assets"
FRAMES = ASSETS / "frames"
FONT_BOLD = "C:/Windows/Fonts/msyhbd.ttc"
FONT_REG = "C:/Windows/Fonts/msyh.ttc"

CREAM = (240, 234, 220)
PANEL = (255, 253, 247)
INK = (58, 47, 34)
MUTED = (120, 106, 86)
GOLD = (184, 134, 11)
GOLD_2 = (212, 175, 55)


def font(size, bold=True):
    return ImageFont.truetype(FONT_BOLD if bold else FONT_REG, size)


def rounded(img, radius=18):
    mask = Image.new("L", img.size, 0)
    ImageDraw.Draw(mask).rounded_rectangle([0, 0, img.size[0] - 1, img.size[1] - 1], radius=radius, fill=255)
    out = Image.new("RGBA", img.size, (0, 0, 0, 0))
    out.paste(img.convert("RGBA"), (0, 0), mask)
    return out


def build_gif():
    meta = json.loads((FRAMES / "frames.json").read_text(encoding="utf-8"))
    images, durations = [], []
    prev_t = None
    for frame in meta:
        path = FRAMES / frame["file"]
        if not path.exists():
            continue
        img = Image.open(path).convert("RGB").resize((960, 600), Image.LANCZOS)
        images.append(img.convert("P", palette=Image.ADAPTIVE, colors=128))
        if prev_t is None:
            durations.append(250)
        else:
            durations.append(max(60, min(400, frame["t"] - prev_t)))
        prev_t = frame["t"]
    if not images:
        raise SystemExit("no frames found; run scripts/capture.js first")
    durations[-1] = 1500
    out = ASSETS / "demo.gif"
    images[0].save(
        out,
        save_all=True,
        append_images=images[1:],
        duration=durations,
        loop=0,
        optimize=True,
        disposal=2,
    )
    print(f"demo.gif: {len(images)} frames, {out.stat().st_size / 1024:.0f} KB")


def wrap(draw, text, fnt, max_width):
    words = text.split(" ")
    lines, line = [], ""
    for word in words:
        probe = f"{line} {word}".strip()
        if draw.textlength(probe, font=fnt) <= max_width:
            line = probe
        else:
            lines.append(line)
            line = word
    if line:
        lines.append(line)
    return lines


def build_social():
    W, H = 1280, 640
    card = Image.new("RGB", (W, H), CREAM)

    glow = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    gdraw = ImageDraw.Draw(glow)
    for i in range(60):
        alpha = max(0, 24 - i // 3)
        gdraw.ellipse([W - 380 - i * 6, -240 - i * 6, W + 240 + i * 6, 380 + i * 6], fill=(212, 175, 55, alpha))
    card = Image.alpha_composite(card.convert("RGBA"), glow)
    draw = ImageDraw.Draw(card)

    pad = 56
    draw.text((pad, 44), "职优简历 · AI Resume Optimizer", font=font(38), fill=INK)
    draw.text((pad, 104), "A resume that matches the posting — streamed from any chat-completions endpoint.", font=font(22, False), fill=INK)
    draw.text((pad, 146), "Tencent Hunyuan by default · zero frameworks · bilingual UI · MIT", font=font(18, False), fill=MUTED)

    bullets = [
        "Instant match diagnosis with per-dimension scores",
        "Rewritten resume with quantified impact, not buzzwords",
        "Live SSE streaming · stop / copy / export Markdown",
        "One Node process, Docker ready, no database",
    ]
    y = 226
    fnt = font(19, False)
    for text in bullets:
        draw.ellipse([pad, y + 7, pad + 9, y + 16], fill=GOLD)
        draw.text((pad + 20, y), text, font=fnt, fill=INK)
        y += 40

    draw.text((pad, H - 66), "github.com/echo33550336/Resume-optimization", font=font(21), fill=GOLD)
    draw.text((W - pad - 170, H - 62), "MIT · Node ≥ 18", font=font(18, False), fill=MUTED)

    shot = Image.open(ASSETS / "screenshot-result.png").convert("RGB").resize((620, 388), Image.LANCZOS)
    shot = rounded(shot, 14)
    shadow = Image.new("RGBA", (660, 428), (0, 0, 0, 0))
    ImageDraw.Draw(shadow).rounded_rectangle([0, 0, 619, 387], radius=14, fill=(0, 0, 0, 70))
    shadow = shadow.filter(__import__("PIL.ImageFilter").ImageFilter.GaussianBlur(16))
    card.alpha_composite(shadow, (W - 620 - pad - 18, 190))
    card.alpha_composite(shot, (W - 620 - pad, 180))

    out = ASSETS / "social-preview.png"
    card.convert("RGB").save(out, optimize=True)
    print(f"social-preview.png: {W}x{H}, {out.stat().st_size / 1024:.0f} KB")


def build_demo_data():
    script = (
        "const r=require('./demo-report');"
        "process.stdout.write(JSON.stringify({zh:r.buildDemoReport({lang:'zh'}),en:r.buildDemoReport({lang:'en'})}))"
    )
    out = subprocess.run(["node", "-e", script], cwd=ROOT, capture_output=True, check=True)
    target = ASSETS / "demo-report.json"
    target.write_bytes(out.stdout)
    print(f"demo-report.json: {target.stat().st_size} bytes")


def main():
    build_gif()
    build_social()
    build_demo_data()


if __name__ == "__main__":
    sys.exit(main())
