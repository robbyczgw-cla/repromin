# Rebuild the demo video

Slides are HTML so the numbers stay exact. Chromium screenshots them; ffmpeg stitches the MP4.

```bash
npx tsx demo/video/render.ts
# then the concat + ffmpeg lines in this folder, or:

python3 - <<'PY'
from pathlib import Path
files = sorted(Path("demo/video/frames").glob("s*.png"))
lines = []
for f in files:
    lines += [f"file '{f.resolve()}'", "duration 2.8"]
lines.append(f"file '{files[-1].resolve()}'")
Path("demo/video/concat.txt").write_text("\n".join(lines) + "\n")
PY
ffmpeg -y -f concat -safe 0 -i demo/video/concat.txt \
  -vf "fps=30,format=yuv420p" -c:v libx264 -crf 18 \
  -movflags +faststart demo/repromin-demo.mp4
```

Output: `demo/repromin-demo.mp4` (1920×1080, ~22s).
