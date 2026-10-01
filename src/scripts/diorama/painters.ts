import * as THREE from 'three';

// Pictures the dioramas draw for themselves on small canvases: Grafana's chart, the timelapse being prepared,
// and the photographs that arrive in image storage. Every picture is authored; none shows real data.

export type Painter = { texture: THREE.CanvasTexture; draw(progress: number, light: number): void };

function canvas(width: number, height: number) {
  const element = document.createElement('canvas'); element.width = width; element.height = height;
  const texture = new THREE.CanvasTexture(element); texture.colorSpace = THREE.SRGBColorSpace; texture.anisotropy = 4;
  // The model's UVs count rows the other way up.
  texture.flipY = false;
  return { context: element.getContext('2d')!, texture, width, height };
}

/** Oyster mushrooms on a substrate block, `growth` from bare (0) to full caps (1), drawn in the given box. A print
 *  is lighter than a frame on a dark screen. */
function mushrooms(context: CanvasRenderingContext2D, x: number, y: number, width: number, height: number, growth: number, backdrop = '#3a3328') {
  context.fillStyle = backdrop; context.fillRect(x, y, width, height);
  const blockW = width * .34, blockH = height * .34, blockX = x + (width - blockW) / 2, blockY = y + height - blockH;
  context.fillStyle = '#d8c39a'; context.fillRect(blockX, blockY, blockW, blockH);
  // Three caps, each starting a little later than the last.
  [[.3, .0, 1], [.62, .18, .85], [.47, .34, .7]].forEach(([across, delay, reach]) => {
    const grown = Math.max(0, Math.min(1, (growth - delay) / (1 - delay))) * reach;
    if (grown <= 0) return;
    const cx = blockX + blockW * across, base = blockY + 2, r = height * .2 * grown;
    context.fillStyle = '#efe6d6'; context.fillRect(cx - r * .14, base - r * .9, r * .28, r * .9);
    context.fillStyle = '#c8763a'; context.beginPath(); context.ellipse(cx, base - r * .9, r, r * .5, 0, Math.PI, 0); context.fill();
  });
}

/** Grafana's screen: a small dashboard whose line draws as the stored measurements arrive. */
export function chartPainter(accent: string): Painter {
  const { context, texture, width: w, height: h } = canvas(480, 296);
  const points = [.62, .55, .6, .44, .5, .36, .41, .28, .33, .24];
  function draw(progress: number, light: number) {
    context.fillStyle = light > 0 ? '#1e2a26' : '#141a18'; context.fillRect(0, 0, w, h);
    context.globalAlpha = .2 + .8 * light;
    context.fillStyle = '#2b3834'; for (const [x, width] of [[24, 130], [170, 80]]) context.fillRect(x, 22, width, 14);
    context.strokeStyle = '#33423d'; context.lineWidth = 1.5;
    for (let y = 84; y < h - 10; y += 46) { context.beginPath(); context.moveTo(24, y); context.lineTo(w - 24, y); context.stroke(); }
    if (progress > 0) {
      context.strokeStyle = accent; context.lineWidth = 7; context.lineJoin = context.lineCap = 'round';
      context.beginPath();
      const total = (points.length - 1) * progress, step = (w - 60) / (points.length - 1);
      points.forEach((value, i) => {
        if (i > Math.ceil(total)) return;
        const t = Math.min(1, total - (i - 1)), x = 30 + i * step, y = 56 + value * 300;
        if (i === 0) context.moveTo(x, y);
        else { const px = 30 + (i - 1) * step, py = 56 + points[i - 1] * 300; context.lineTo(px + (x - px) * t, py + (y - py) * t); }
      });
      context.stroke();
    }
    context.globalAlpha = 1; texture.needsUpdate = true;
  }
  draw(0, 0);
  return { texture, draw };
}

/** Media preparation's screen: the selected photographs play as a timelapse of the mushrooms growing, with the
 *  chosen frames collecting in a strip below and a bar showing how much of it is prepared. */
export function timelapsePainter(accent: string): Painter {
  const { context, texture, width: w, height: h } = canvas(480, 296);
  const frames = 12, thumbs = 7;
  function draw(progress: number, light: number) {
    context.fillStyle = light > 0 ? '#1e2a26' : '#141a18'; context.fillRect(0, 0, w, h);
    context.globalAlpha = .2 + .8 * light;
    // The timelapse steps frame by frame, as a sequence of photographs does.
    const frame = Math.min(frames - 1, Math.floor(progress * frames));
    mushrooms(context, 24, 20, w - 48, 170, progress > 0 ? frame / (frames - 1) : 0);
    // The frames chosen so far, in a strip.
    const shown = Math.ceil(progress * thumbs), size = (w - 48 - (thumbs - 1) * 8) / thumbs;
    for (let i = 0; i < thumbs; i++) {
      const x = 24 + i * (size + 8);
      if (i < shown) mushrooms(context, x, 206, size, 44, i / (thumbs - 1));
      else { context.fillStyle = '#26302c'; context.fillRect(x, 206, size, 44); }
    }
    context.fillStyle = '#26302c'; context.fillRect(24, 266, w - 48, 8);
    if (progress > 0) { context.fillStyle = accent; context.fillRect(24, 266, (w - 48) * progress, 8); }
    context.globalAlpha = 1; texture.needsUpdate = true;
  }
  draw(0, 0);
  return { texture, draw };
}

/** A photograph arriving in image storage: the mushrooms at one of several moments of their growth. */
export function printTexture(index: number) {
  const { context, texture } = canvas(256, 180);
  mushrooms(context, 0, 0, 256, 180, [.35, .7, 1][index % 3], '#8a7b60');
  texture.needsUpdate = true;
  return texture;
}
