#!/usr/bin/env python3
"""Prepare the published photographs and film for the Experiment Runs section.

Requires Pillow and ffmpeg. Sources are the experiment's camera folders and the
supplied phone photographs; originals are never altered. Run once, outside the
website build, and commit only the finished files in public/media/runs/.
"""

from pathlib import Path
import json
import subprocess
import tempfile

from PIL import Image, ImageOps

ROOT = Path(__file__).resolve().parents[1]
SUPPLIED = ROOT / "media_for_astro_website"
CAMERAS = Path.home() / "mushroom_media"
DEST = ROOT / "public" / "media" / "runs"
DEST.mkdir(parents=True, exist_ok=True)

EXP01 = CAMERAS / "oyster_2026_exp01"
STILLS = {
    "run-01-2026-09-10-controlled.webp": EXP01 / "phase_1_incubation/controlled_camera/scientific_still/2026/09/10/controlled_camera_scientific_still_20260910T184042+0300.jpg",
    "run-01-2026-09-14-ambient.webp": EXP01 / "phase_3_fruiting/ambient_camera/scientific_still/2026/09/14/ambient_camera_scientific_still_20260914T042738+0300.jpg",
}
# Phone photographs of the rotting bags (EXIF dates 21 and 24 October 2026).
PHONE = {
    "run-02-rot-2026-10-21.webp": SUPPLIED / "rot1.jpg",
    "run-02-rot-2026-10-24-a.webp": SUPPLIED / "rot2.jpg",
    "run-02-rot-2026-10-24-b.webp": SUPPLIED / "rot3.jpg",
}

# The fruiting film: ambient-camera stills 1-19 of 28 October and 11-24 of 29 October,
# counted in filename order within each day folder, then played in capture order.
FRUITING = CAMERAS / "oyster_2026_exp02/phase_5_fruiting/ambient_camera/scientific_still/2026/10"
FRAMES = [(FRUITING / "28", 1, 19), (FRUITING / "29", 11, 24)]
# One crop for every frame, framing the bag in both of its positions (fractions of 4608 x 2592).
CROP = (0.28, 0.42, 0.72, 0.86)
STILLS_PER_SECOND, FPS = 5, 30
FILM = "run-02-fruiting-ambient-2026-10-28-to-29.mp4"


def export(im, filename, max_dimension=1600):
    im = ImageOps.exif_transpose(im).convert("RGB")
    im.thumbnail((max_dimension, max_dimension), Image.Resampling.LANCZOS)
    im.save(DEST / filename, "WEBP", quality=88, method=6)
    return im.size


def fruiting_frames():
    frames = []
    for folder, first, last in FRAMES:
        frames += sorted(folder.glob("*.jpg"))[first - 1:last]
    recorded = lambda path: json.loads(path.with_suffix(".json").read_text())["recorded_at"]
    return sorted(frames, key=recorded)


def crop(path):
    im = Image.open(path)
    w, h = im.size
    box = (round(CROP[0] * w), round(CROP[1] * h), round(CROP[2] * w), round(CROP[3] * h))
    return im.crop(box).resize((1280, 720), Image.Resampling.LANCZOS)


def main():
    report = {}
    for name, source in {**STILLS, **PHONE}.items():
        report[name] = export(Image.open(source), name)

    frames = fruiting_frames()
    with tempfile.TemporaryDirectory() as tmp:
        for index, path in enumerate(frames):
            crop(path).save(Path(tmp) / f"{index:03d}.png")
        subprocess.run([
            "ffmpeg", "-v", "error", "-y", "-framerate", str(STILLS_PER_SECOND), "-i", str(Path(tmp) / "%03d.png"),
            "-r", str(FPS), "-c:v", "libx264", "-preset", "slow", "-crf", "20", "-pix_fmt", "yuv420p",
            "-movflags", "+faststart", "-an", str(DEST / FILM),
        ], check=True)
    crop(frames[-1]).save(DEST / "run-02-fruiting-poster.webp", "WEBP", quality=88, method=6)
    report[FILM] = {"stills": len(frames), "first": frames[0].name, "last": frames[-1].name}
    print(json.dumps(report, indent=2))


if __name__ == "__main__":
    main()
