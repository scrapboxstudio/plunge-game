"""
Crop raw Plunge gameplay screenshots to the game canvas area
and save as Play Store-ready PNGs.

Run from any directory:
  python store-assets/process-screenshots.py
"""

from PIL import Image
import os, glob

# ── Where the raw screenshots were saved by the capture session ──────────────
RAW_DIR = (
    r"C:\Users\Mars\AppData\Roaming\Claude\local-agent-mode-sessions"
    r"\999a53b1-becd-46ba-848b-39d41e583528"
    r"\4d6a7aed-aa9a-4121-a099-fea0e73c5a12"
    r"\agent\local_ditto_4d6a7aed-aa9a-4121-a099-fea0e73c5a12\outputs"
)

# ── Output folder ─────────────────────────────────────────────────────────────
OUT_DIR = os.path.join(os.path.dirname(__file__), "screenshots")
os.makedirs(OUT_DIR, exist_ok=True)

# ── Game canvas crop box (pixels in 1456×816 full-screen capture) ─────────────
# Left, Top, Right, Bottom
CROP = (569, 95, 886, 775)          # 317 × 680 px  (~9:19 portrait)

# ── Pick the best shots by filename ──────────────────────────────────────────
KEEP = [
    # (filename,                    label)
    ("screenshot-1780976810459.jpg",  "01-coral-reef-fish"),
    ("screenshot-1780976921663.jpg",  "02-kelp-forest-new-record"),
    ("screenshot-1780977255390.jpg",  "03-coral-reef-starfish"),
    ("screenshot-1780977319312.jpg",  "04-coral-reef-purple-trail"),
    ("screenshot-1780977368109.jpg",  "05-kelp-forest-starfish"),
    ("screenshot-1780977478669.jpg",  "06-midnight-zone"),
    ("screenshot-1780977499740.jpg",  "07-main-menu"),
]

saved = []
for fname, label in KEEP:
    src = os.path.join(RAW_DIR, fname)
    if not os.path.exists(src):
        print(f"  MISSING  {fname}")
        continue
    img  = Image.open(src).convert("RGB")
    crop = img.crop(CROP)
    out  = os.path.join(OUT_DIR, f"{label}.png")
    crop.save(out, "PNG")
    print(f"  saved  {label}.png  ({crop.width}×{crop.height})")
    saved.append(out)

print(f"\nDone — {len(saved)} screenshots saved to:\n  {OUT_DIR}")
