# Myko — generated 2D animation assets, v1

Generated with the built-in image-generation tool using the user's Myko portrait and reference sheet. The underlying image model was not selectable or verified as “Images 2.5”. Exact prompts are in `prompts.json`.

## Files

- `myko-complete.png`: assembled front-facing master.
- `myko-body.png`: torso, backpack, arms and legs, with reconstructed neck connector.
- `myko-head.png`: isolated head with an empty visor; cyan face dot and glass reflection retained.
- `myko-eyes.png`: two amber eyes with transparent glow.
- `preview.html`: standalone CSS/JavaScript head-tilt and eye-follow preview; includes a master comparison button and reduced-motion support.

All four images are 1254 × 1254 RGBA PNGs with actual transparency. The generator did not honor the requested 2048 resolution or exact layer placement. Images are preserved as generated; no raster resizing, cutting or compositing was performed afterward.

## Placement

Use a square stage. The body fills it. A shared full-stage head group pivots at `51% 44%` and contains:

| Layer | Width | Left | Top |
| --- | --- | --- | --- |
| Head | 72% | 13.55% | -0.3% |
| Eyes | 83.3% | 8.15% | -0.72% |

The eyes sit inside a separate full-stage translation wrapper. Limit head tilt to ±3 degrees, eye translation to ±0.9% of stage width horizontally and ±0.6% vertically. These values are a visually calibrated starting point, not a pixel-exact reconstruction. The head isolation introduced small artwork differences and retained some small mushrooms near the neck; final art cleanup may still improve the seam.

Open `preview.html` directly, or serve this directory with a local static server. No dependencies or Three.js are required. The preview was inspected on a cream background, eye/head transforms and master toggle were exercised in Chromium, and the layout was checked at 390px width.

This package does not replace the current website mascot. Source reference uploads remain untouched.
