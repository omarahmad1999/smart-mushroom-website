# Film validation

- Foundation smoke, fixture gate and fixture movie render passed before scene work.
- All 14 scene files inspected on six-frame contact sheets; overall film inspected on a 24-frame sheet.
- Corrected floating forearm, reaching pose, fingertip contact, faint hyphae, a stray finger thread on the relaxed hand, microscopic contrast and static-layer performance during visual review.
- Shared hero geometry remains at (880,835), feet near y895, across return → bloom → belong. Eye passage uses centre (960,540), radius240. Different internal filament drawings form an intentional graphic cut inside the shared circular outline.
- Final six-check gate passed: 14 shots cover 36 seconds; 42 first/middle/last frames draw and hash identically in five draw orders; no forbidden media or time dependencies; a 217-frame cost sweep has median 71 ms and maximum 133 ms in headless Chromium at native size. Cold texture-cache construction is slower.
- The source HTML calculates its frames live; performance depends on the viewing device. The exported MP4 contains all 864 frames at 24 fps and is the preferred playback option on slower devices.
- Score: 48 kHz stereo; all 28 cue onsets within 10 ms (worst 6.7 ms at initial playback, remaining cues mostly 0.7 ms). WAV sample peak −5.07 dBFS; 128 kbps AAC true peak −4.8 dBFS, integrated −21.6 LUFS. No clipping.
- Desktop 1440 × 1000 and mobile 390 × 844 player checks: play/pause, mute, seeking, frame stepping, restart and final hold; no browser errors or horizontal overflow.

- Export verification: the 1080p master and preview contain 864 video frames and 36 seconds of stereo audio; the 720p copy preserves all 864 frames. The master decodes end to end with ffmpeg without errors. The lighter 1080p copy plays to completion in Chromium with audio decoded, no media errors and zero dropped frames. A 36-frame contact sheet extracted from the MP4 was visually reviewed.

Generated frames, measurement logs and source captures are under ignored `.frames/` and `.tmp/`. See README for reproduction commands.
