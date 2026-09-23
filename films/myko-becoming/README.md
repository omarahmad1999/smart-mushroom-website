# Myko — What Decay Becomes

A 36-second hand-drawn procedural film: Myko touches a mushroom, follows its hidden cycle of decomposition and renewal through his eyes, and returns covered in moss and mushrooms.

**1920 × 1080 · 24 fps · 14 shots · 120 BPM · stereo sound.** Character and organic motion is held on twos for a stop-motion feel; camera motion runs at 24 fps. This is an illustrated adaptation of the supplied Myko reference, drawn from paths rather than using the reference PNG as a puppet.

## Watch

- `dist/myko-becoming.html` — self-contained player with play/pause, scrubbing, sound control, restart and frame stepping. Open directly in a browser. Starts paused; click Play film for sound.
- `exports/myko-becoming.mp4` — full-resolution H.264/AAC master.
- `exports/myko-becoming-preview.mp4` — lighter full-resolution copy.
- `exports/myko-becoming-phone.mp4` — 1280 × 720 copy, preserving the landscape composition.
- `exports/myko-becoming-shots.md` — shot list for captions and editing.

The film is separate from the website. No pages, notebook layouts, dashboards or experiment services are involved.

## Rebuild

Requires Node.js, ffmpeg and Chromium. Dependencies are used only by the build tools; the HTML has no external libraries, media files, fonts or network requests.

```bash
cd films/myko-becoming
npm ci --prefix tools
# If using Playwright's bundled browser:
cd tools
npx playwright install chromium
cd ..
# Or select a system browser, for example:
export CHROMIUM_PATH=/usr/bin/chromium

node tools/check.cjs
node tools/build.cjs
node tools/render.cjs --out exports/myko-becoming.mp4
ffmpeg -y -i exports/myko-becoming.mp4 -c:v libx264 -crf 23 -preset medium -c:a copy -movflags +faststart exports/myko-becoming-preview.mp4
ffmpeg -y -i exports/myko-becoming.mp4 -vf scale=1280:720 -c:v libx264 -crf 23 -preset medium -c:a aac -b:a 128k -movflags +faststart exports/myko-becoming-phone.mp4
```

For local LAN viewing, serve this film folder with `python3 -m http.server 4330 --bind 0.0.0.0`, then open `/dist/myko-becoming.html` on that port. The website has its own server.

## Edit

`src/timeline.js` defines cuts and sound cues. Each file in `src/scenes/` owns one shot. `src/myko.js` draws the character; `src/nature.js` supplies botanical forms. `src/music.js` synthesizes the original score and effects. `src/player.js` supplies playback controls.

The illustrated story is fantasy. The inner sequence compresses a decomposer community's natural processes, rather than claiming that one mushroom species performs every fungal role. Extracellular digestion happens outside the hypha; nutrients are absorbed afterward. Spores settle before germinating. Research links and drawing rules are in `docs/art-bible.md`.

```bash
node tools/snap.cjs --shot touch --samples 6 --sheet
node tools/snap.cjs --samples 24 --sheet --scale 0.25
node tools/audio/render-audio.cjs
node tools/audio/analyze.cjs .tmp/audio/score.wav --cues
node tools/audio/peaks.cjs .tmp/audio/score.wav
```

The check gate verifies the timeline, draw errors, deterministic rendering in five seek orders, forbidden media/time dependencies and frame cost. Reproducible source, documentation and tooling are kept in Git; generated videos, HTML, frames, source captures and dependencies remain local ignored outputs.

## Foundation attribution

Built with the MIT-licensed [procedural-film skill](https://github.com/kuhnhomeuk-cell/procedural-film), source revision `ec29e23474860e83ab5b4d0131bd6e6b92e12a48`. The original foundation license is in `LICENSE.procedural-film`. Adaptations include landscape composition, Myko and nature drawings, the ecological storyboard, original score, playback controls and system-Chromium support.
