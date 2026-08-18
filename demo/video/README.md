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

## Terminal recording

This is a **real** session (dry-run of the 70-action killer spec, then a live compact reduce).

```bash
asciinema rec --overwrite -y --cols 108 --rows 32 -i 0.6 \
  -c "bash demo/video/record-terminal.sh" \
  demo/repromin-terminal.cast

# needs https://github.com/asciinema/agg
agg --font-size 16 --theme monokai --speed 1 --idle-time-limit 1.2 \
  --last-frame-duration 3 \
  demo/repromin-terminal.cast demo/repromin-terminal.gif

ffmpeg -y -i demo/repromin-terminal.gif \
  -vf "scale=trunc(iw/2)*2:trunc(ih/2)*2,fps=20,format=yuv420p" \
  -c:v libx264 -crf 20 -movflags +faststart demo/repromin-terminal.mp4
```

Play back: `asciinema play demo/repromin-terminal.cast`
