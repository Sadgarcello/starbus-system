from PIL import Image
from pathlib import Path

pub = Path(__file__).resolve().parents[1] / "public"
src = Image.open(pub / "khawaja-club-logo.png").convert("RGBA")
w, h = src.size
side = min(w, h)
left = (w - side) // 2
top = (h - side) // 2
square = src.crop((left, top, left + side, top + side))

sizes = {
    "favicon-32x32.png": 32,
    "favicon-16x16.png": 16,
    "apple-touch-icon.png": 180,
    "icon-192.png": 192,
    "icon-512.png": 512,
    "favicon.png": 48,
}
for name, size in sizes.items():
    out = square.resize((size, size), Image.Resampling.LANCZOS)
    out.save(pub / name, optimize=True)

ico_sizes = [(16, 16), (32, 32), (48, 48)]
imgs = [square.resize(s, Image.Resampling.LANCZOS) for s in ico_sizes]
imgs[0].save(pub / "favicon.ico", format="ICO", sizes=ico_sizes)
print("generated:", ", ".join(sizes) + ", favicon.ico")
