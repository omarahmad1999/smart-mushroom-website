/* Myko — canonical procedural Canvas 2D character.
 * Coordinates are normalized to helmet-to-sole height (1 unit).
 * No media, browser clock, DOM, reference tracing, or frame-history dependency.
 * Load before film scenes; public API is globalThis.MykoCharacter.
 */
(function (root) {
  "use strict";
  const TAU = Math.PI * 2;
  const palette = Object.freeze({
    referenceDark: "#473B34",
    referenceBronze: "#8D6547",
    referenceMoss: "#7F7142",
    referenceShade: "#BCB1A5",
    referenceCream: "#E6DACB",
    referenceCyan: "#98E3EB",
    shellHighlight: "#FFF0DA",
    shellWarm: "#E7C9AC",
    shellShadow: "#A78E74",
    visorDeep: "#211B18",
    visorWarm: "#49362A",
    metalHighlight: "#AA8465",
    metalShadow: "#332B25",
    mossDeep: "#3C4025",
    mossLight: "#A7944A",
    capPeach: "#EFAE7A",
    capLight: "#FFDFB8",
    capShadow: "#B87549",
    gillLight: "#DDFCFA",
    gillShade: "#9BCFD0",
    eyeCore: "#FFF2C5",
    eyeAmber: "#FFB65D",
    myceliumCore: "#D6FFFF",
    weathering: "#AA7149",
  });
  const expressions = Object.freeze([
    "neutral",
    "curious",
    "happy",
    "concerned",
    "surprised",
    "sleepy",
    "focused",
    "sad",
  ]);
  const poses = Object.freeze(["neutral", "walking", "reaching", "crouching"]);
  const views = Object.freeze([
    "front",
    "left",
    "right",
    "side-left",
    "side-right",
  ]);
  const jointNames = Object.freeze([
    "bodyLean",
    "headRotation",
    "headTilt",
    "leftShoulder",
    "leftElbow",
    "leftWrist",
    "rightShoulder",
    "rightElbow",
    "rightWrist",
    "leftHip",
    "leftKnee",
    "leftFoot",
    "rightHip",
    "rightKnee",
    "rightFoot",
  ]);
  const defaults = Object.freeze({
    x: 0,
    y: 0,
    scale: 500,
    rotation: 0,
    bodyLean: 0,
    headRotation: 0,
    headTilt: 0,
    leftShoulder: -0.12,
    leftElbow: 0.07,
    leftWrist: 0.03,
    rightShoulder: 0.17,
    rightElbow: -0.12,
    rightWrist: -0.06,
    leftHip: -0.05,
    leftKnee: 0.05,
    leftFoot: 0,
    rightHip: 0.05,
    rightKnee: -0.05,
    rightFoot: 0,
    eyeExpression: "neutral",
    eyeLookX: 0,
    eyeLookY: 0,
    breathing: 0,
    mushroomSway: 0,
    myceliumGlow: 0.7,
    facing: "left",
    time: 0,
    fps: 12,
    animate: false,
    stopMotion: true,
    imperfections: false,
    seed: 73,
    debug: false,
    bodyOffsetY: 0,
  });
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  function finite(v, name) {
    if (typeof v !== "number" || !Number.isFinite(v))
      throw new TypeError(`${name} must be finite`);
    return v;
  }
  function holdPose(t, fps = 12) {
    finite(t, "time");
    finite(fps, "fps");
    if (fps <= 0) throw new RangeError("fps must be positive");
    return Math.floor(t * fps + 1e-9) / fps;
  }
  // Eases progress sampled on the character's held-pose clock, not the display clock.
  function easeStopMotion(t, duration = 1, fps = 12) {
    finite(duration, "duration");
    if (duration <= 0) throw new RangeError("duration must be positive");
    const p = clamp(holdPose(t, fps) / duration, 0, 1);
    return p * p * (3 - 2 * p);
  }
  function stepPose(keyframes, t, { fps = 12, interpolate = false } = {}) {
    if (!Array.isArray(keyframes) || !keyframes.length)
      throw new TypeError("keyframes must be non-empty");
    keyframes.forEach((k, i) => {
      finite(k.time, "keyframe time");
      if (!k.pose || (i && k.time <= keyframes[i - 1].time))
        throw new RangeError(
          "Keyframes need poses and strictly ascending times",
        );
    });
    const T = holdPose(t, fps);
    let i = 0;
    while (i + 1 < keyframes.length && keyframes[i + 1].time <= T) i++;
    const a = keyframes[i],
      b = keyframes[i + 1];
    if (!interpolate || !b || T <= a.time) return { ...a.pose };
    const p = clamp((T - a.time) / (b.time - a.time), 0, 1),
      e = p * p * (3 - 2 * p),
      result = { ...a.pose };
    for (const key of Object.keys(b.pose))
      if (typeof a.pose[key] === "number" && typeof b.pose[key] === "number")
        result[key] = lerp(a.pose[key], b.pose[key], e);
    return result;
  }
  function getPose(name = "neutral", t = 0, { fps = 12 } = {}) {
    if (!poses.includes(name)) throw new RangeError(`Unknown pose: ${name}`);
    const T = holdPose(t, fps),
      phase = (T * TAU) / 1.5,
      s = Math.sin(phase),
      c = Math.cos(phase);
    const p = Object.fromEntries(jointNames.map((k) => [k, defaults[k]]));
    p.bodyOffsetY = 0;
    p.eyeLookX = 0;
    p.eyeLookY = 0;
    if (name === "walking")
      Object.assign(p, {
        bodyLean: -0.055,
        leftHip: 0.33 * s,
        rightHip: -0.33 * s,
        leftKnee: -0.28 * Math.max(0, -s),
        rightKnee: -0.28 * Math.max(0, s),
        leftFoot: -0.15 * s,
        rightFoot: 0.15 * s,
        leftShoulder: -0.12 - 0.22 * s,
        rightShoulder: 0.17 + 0.22 * s,
        bodyOffsetY: -0.008 * Math.abs(c),
        headTilt: 0.02 * s,
      });
    if (name === "reaching")
      Object.assign(p, {
        bodyLean: -0.1,
        leftShoulder: -0.08,
        leftElbow: 0.2,
        leftWrist: -0.06,
        rightShoulder: 1.1,
        rightElbow: 0.35,
        rightWrist: -0.2,
        headTilt: -0.13,
        eyeLookX: -0.55,
        eyeLookY: -0.2,
      });
    if (name === "crouching")
      Object.assign(p, {
        bodyLean: -0.17,
        leftHip: 1.18,
        rightHip: 1.13,
        leftKnee: -1.8,
        rightKnee: -1.75,
        leftFoot: 0.62,
        rightFoot: 0.62,
        leftShoulder: 0.5,
        rightShoulder: 0.58,
        leftElbow: -0.5,
        rightElbow: -0.6,
        bodyOffsetY: 0.09,
        headTilt: 0.12,
      });
    return p;
  }
  // Deterministic component-local randomness. Surface noise never depends on time.
  function hash(n) {
    let v = Math.imul(n ^ 0x6c8e9cf5, 0x45d9f3b);
    v = Math.imul(v ^ (v >>> 16), 0x45d9f3b);
    return ((v ^ (v >>> 16)) >>> 0) / 4294967296;
  }
  function rng(seed) {
    let n = seed;
    return () => hash(n++);
  }
  const pathCache = new Map();
  function path(d) {
    if (!pathCache.has(d)) pathCache.set(d, new Path2D(d));
    return pathCache.get(d);
  }
  function scope(ctx, x, y, angle, fn, sx = 1, sy = sx) {
    ctx.save();
    try {
      ctx.translate(x, y);
      ctx.rotate(angle);
      ctx.scale(sx, sy);
      fn();
    } finally {
      ctx.restore();
    }
  }
  function ellipse(ctx, x, y, rx, ry, fill, stroke, width = 0.0015) {
    ctx.beginPath();
    ctx.ellipse(x, y, rx, ry, 0, 0, TAU);
    if (fill) {
      ctx.fillStyle = fill;
      ctx.fill();
    }
    if (stroke) {
      ctx.strokeStyle = stroke;
      ctx.lineWidth = width;
      ctx.stroke();
    }
  }
  function stroke(ctx, d, color, width = 0.0015) {
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.stroke(path(d));
  }
  function linear(ctx, x0, y0, x1, y1, stops) {
    const g = ctx.createLinearGradient(x0, y0, x1, y1);
    stops.forEach(([s, c]) => g.addColorStop(s, c));
    return g;
  }
  function radial(ctx, x, y, r, colors, ox = x - r * 0.24, oy = y - r * 0.3) {
    const g = ctx.createRadialGradient(ox, oy, 0, x, y, r);
    colors.forEach(([s, c]) => g.addColorStop(s, c));
    return g;
  }
  function fillPath(
    ctx,
    d,
    fill,
    outline = palette.referenceDark,
    width = 0.0018,
  ) {
    const p = path(d);
    ctx.fillStyle = fill;
    ctx.fill(p);
    if (outline) {
      ctx.strokeStyle = outline;
      ctx.lineWidth = width;
      ctx.stroke(p);
    }
    return p;
  }
  const textureCache = new Map();
  // Fixed jittered lattice + chips: a local ceramic surface, not a screen-space overlay.
  function textureGeometry(seed, bounds) {
    const key = `${seed}:${bounds.join(",")}`;
    if (textureCache.has(key)) return textureCache.get(key);
    const r = rng(seed),
      [x, y, w, h] = bounds,
      chips = [];
    const cracks = new Path2D(),
      bright = new Path2D();
    const cols = Math.max(4, Math.ceil(w / 0.029)),
      rows = Math.max(4, Math.ceil(h / 0.027)),
      grid = [];
    for (let j = 0; j <= rows; j++) {
      const row = [];
      for (let i = 0; i <= cols; i++)
        row.push([
          x + ((i + (r() - 0.5) * 0.6) * w) / cols,
          y + ((j + (r() - 0.5) * 0.6) * h) / rows,
        ]);
      grid.push(row);
    }
    for (let j = 0; j < rows; j++)
      for (let i = 0; i < cols; i++) {
        const a = grid[j][i],
          b = grid[j][i + 1],
          c = grid[j + 1][i];
        if (r() > 0.2) {
          cracks.moveTo(...a);
          cracks.lineTo(...b);
          bright.moveTo(a[0], a[1] - 0.0008);
          bright.lineTo(b[0], b[1] - 0.0008);
        }
        if (r() > 0.38) {
          cracks.moveTo(...a);
          cracks.lineTo(...c);
        }
        if (r() > 0.68) {
          cracks.moveTo(...a);
          cracks.lineTo(...grid[j + 1][i + 1]);
        }
      }
    for (let i = 0; i < Math.ceil(w * h * 1900); i++)
      chips.push([
        x + r() * w,
        y + r() * h,
        0.0006 + r() ** 3 * 0.0047,
        r() * TAU,
        r(),
      ]);
    const result = { cracks, bright, chips };
    textureCache.set(key, result);
    return result;
  }
  function drawWeathering(
    ctx,
    shape,
    bounds,
    seed,
    material = "shell",
    detail = true,
  ) {
    const data = textureGeometry(seed, bounds);
    ctx.save();
    ctx.clip(shape);
    ctx.lineWidth = 0.00065;
    ctx.strokeStyle =
      material === "shell"
        ? "rgba(153,102,65,.23)"
        : material === "glass"
          ? "rgba(207,168,109,.06)"
          : "rgba(207,168,109,.16)";
    ctx.stroke(data.cracks);
    ctx.strokeStyle =
      material === "shell"
        ? "rgba(255,251,231,.45)"
        : material === "glass"
          ? "rgba(231,196,142,.035)"
          : "rgba(231,196,142,.12)";
    ctx.lineWidth = 0.00055;
    ctx.stroke(data.bright);
    if (detail)
      for (const [x, y, r, a, v] of data.chips) {
        ctx.fillStyle =
          material === "shell"
            ? v > 0.3
              ? "rgba(163,91,43,.57)"
              : "rgba(119,88,52,.48)"
            : "rgba(197,153,81,.24)";
        ctx.beginPath();
        ctx.moveTo(x - r, y);
        ctx.lineTo(x + Math.cos(a) * r, y - r * 0.8);
        ctx.lineTo(x + r, y + r * 0.4);
        ctx.lineTo(x - r * 0.3, y + r);
        ctx.closePath();
        ctx.fill();
      }
    ctx.restore();
  }
  function ceramic(ctx, d, bounds, seed, o) {
    const [x, y, w, h] = bounds;
    const g = radial(
      ctx,
      x + w * 0.42,
      y + h * 0.42,
      Math.max(w, h) * 0.57,
      [
        [0, palette.shellHighlight],
        [0.4, palette.referenceCream],
        [0.7, palette.shellWarm],
        [1, palette.shellShadow],
      ],
      x + w * 0.22,
      y + h * 0.12,
    );
    const p = fillPath(ctx, d, g, palette.referenceDark, 0.0017);
    drawWeathering(ctx, p, bounds, seed, "shell", o.detail);
    return p;
  }
  function bolt(ctx, x, y, r = 0.009) {
    ellipse(
      ctx,
      x,
      y,
      r,
      r * 0.95,
      radial(ctx, x, y, r, [
        [0, palette.metalHighlight],
        [0.6, palette.referenceBronze],
        [1, palette.metalShadow],
      ]),
      palette.metalShadow,
      0.0015,
    );
    ellipse(
      ctx,
      x - r * 0.1,
      y - r * 0.12,
      r * 0.31,
      r * 0.34,
      palette.metalShadow,
    );
    stroke(
      ctx,
      `M ${x - r * 0.23} ${y - r * 0.62} L ${x + r * 0.38} ${y - r * 0.55}`,
      "#c7a78b",
      0.0007,
    );
  }
  function joint(ctx, x, y, r, tilt = 0) {
    scope(ctx, x, y, tilt, () => {
      ellipse(
        ctx,
        0,
        0,
        r,
        r * 0.95,
        palette.metalShadow,
        palette.visorDeep,
        0.002,
      );
      ellipse(
        ctx,
        -r * 0.07,
        -r * 0.02,
        r * 0.81,
        r * 0.81,
        radial(ctx, 0, 0, r, [
          [0, palette.metalHighlight],
          [0.5, palette.referenceBronze],
          [1, palette.referenceDark],
        ]),
        palette.referenceDark,
        0.002,
      );
      for (let i = 0; i < 12; i++) {
        const a = (i * TAU) / 12;
        stroke(
          ctx,
          `M ${Math.cos(a) * r * 0.69} ${Math.sin(a) * r * 0.69} L ${Math.cos(a) * r * 0.89} ${Math.sin(a) * r * 0.89}`,
          palette.metalShadow,
          0.0023,
        );
      }
      ellipse(
        ctx,
        -r * 0.08,
        -r * 0.03,
        r * 0.47,
        r * 0.49,
        palette.referenceDark,
        palette.metalShadow,
        0.002,
      );
      bolt(ctx, -r * 0.09, -r * 0.04, r * 0.3);
    });
  }
  function drawMoss(ctx, x, y, w, h, seed, o) {
    const r = rng(seed),
      lumps = [];
    // Rounded mounds make a porous silhouette; leaves sit on their lit upper surfaces.
    for (let i = 0; i < 7; i++) {
      const px = x + (i / 6 - 0.5) * w * 0.88,
        py =
          y - Math.sin((i / 6) * Math.PI) * h * 0.19 + (r() - 0.5) * h * 0.22;
      const rx = w * (0.1 + r() * 0.07),
        ry = h * (0.3 + r() * 0.16);
      lumps.push([px, py, rx, ry]);
      ellipse(ctx, px, py + 0.004, rx * 1.08, ry * 1.08, "rgba(35,37,20,.30)");
      ellipse(
        ctx,
        px,
        py,
        rx,
        ry,
        radial(
          ctx,
          px,
          py,
          Math.max(rx, ry) * 1.2,
          [
            [0, "#a2974d"],
            [0.45, palette.referenceMoss],
            [1, palette.mossDeep],
          ],
          px - rx * 0.2,
          py - ry * 0.5,
        ),
      );
    }
    const count = o.detail ? 150 : 40;
    for (let i = 0; i < count; i++) {
      const [cx, cy, rx, ry] = lumps[i % lumps.length],
        a = r() * TAU,
        d = Math.sqrt(r());
      const px = cx + Math.cos(a) * d * rx,
        py = cy + Math.sin(a) * d * ry,
        size = 0.0012 + r() * 0.0035;
      const shade = r(),
        color =
          shade < 0.18
            ? palette.mossDeep
            : shade < 0.65
              ? palette.referenceMoss
              : shade < 0.9
                ? palette.mossLight
                : "#c7ad60";
      ctx.beginPath();
      ctx.moveTo(px - size, py);
      ctx.quadraticCurveTo(
        px - size * 0.7,
        py - size * 1.5,
        px,
        py - size * 0.76,
      );
      ctx.quadraticCurveTo(px + size * 0.8, py - size, px + size, py);
      ctx.lineTo(px + size * 0.2, py + size * 0.7);
      ctx.lineTo(px - size * 0.7, py + size * 0.4);
      ctx.closePath();
      ctx.fillStyle = color;
      ctx.fill();
      if (shade > 0.82) {
        stroke(
          ctx,
          `M ${px - size * 0.5} ${py - size * 0.38} L ${px + size * 0.18} ${py - size * 0.52}`,
          "#d4bf79",
          0.0007,
        );
      }
    }
    if (o.detail)
      for (let i = 0; i < 25; i++) {
        const px = x + (r() - 0.5) * w * 1.2,
          py = y + (r() - 0.5) * h * 1.6;
        ellipse(
          ctx,
          px,
          py,
          0.0006 + r() * 0.0013,
          0.0007 + r() * 0.0014,
          i % 4 === 0 ? "#dfbd70" : palette.referenceMoss,
        );
      }
  }
  function drawMycelium(ctx, d, o, width = 0.0019) {
    const amount = clamp(o.myceliumGlow, 0, 1);
    stroke(ctx, d, `rgba(94,205,216,${0.11 + amount * 0.09})`, width * 6);
    stroke(ctx, d, `rgba(126,229,237,${0.35 + amount * 0.4})`, width * 2.1);
    stroke(
      ctx,
      d,
      amount > 0.3 ? palette.myceliumCore : palette.referenceCyan,
      width * 0.72,
    );
  }
  // Each mushroom has a fixed attachment. Its entire stem/cap rotates about that point.
  function drawMushroom(ctx, x, y, size, angle, seed, o) {
    scope(
      ctx,
      x,
      y,
      angle + o.mushroomSway * 0.11,
      () => {
        const stem =
          "M -.079 0 C -.025 -.13 -.034 -.24 -.038 -.40 L .113 -.41 C .073 -.24 .059 -.10 .104 .004 Q .013 .038 -.079 0 Z";
        const stemShape = fillPath(
          ctx,
          stem,
          linear(ctx, -0.08, 0, 0.11, 0, [
            [0, "#b99474"],
            [0.38, palette.gillLight],
            [0.65, palette.shellHighlight],
            [1, palette.capPeach],
          ]),
          palette.capShadow,
          0.005,
        );
        drawWeathering(
          ctx,
          stemShape,
          [-0.05, -0.43, 0.14, 0.45],
          seed,
          "shell",
          false,
        );
        const underside =
          "M -.45 -.41 C -.49 -.52 -.28 -.61 .02 -.61 C .3 -.61 .52 -.47 .46 -.37 C .3 -.28 -.27 -.26 -.45 -.41 Z";
        const gills = fillPath(
          ctx,
          underside,
          linear(ctx, 0, -0.61, 0, -0.29, [
            [0, palette.gillShade],
            [0.6, palette.gillLight],
            [1, "#d3eeea"],
          ]),
          palette.capShadow,
          0.007,
        );
        ctx.save();
        ctx.clip(gills);
        for (let i = 0; i < 29; i++) {
          const a = (i / 28) * Math.PI,
            px = Math.cos(a) * 0.455,
            py = -0.385 - Math.sin(a) * 0.018;
          ctx.beginPath();
          ctx.moveTo(0.021, -0.317);
          ctx.quadraticCurveTo(px * 0.53, -0.29 - Math.sin(a) * 0.1, px, py);
          ctx.lineWidth = i % 3 ? 0.003 : 0.005;
          ctx.strokeStyle = i % 3 ? palette.gillShade : "#ecffff";
          ctx.stroke();
        }
        ctx.restore();
        const cap =
          "M -.465 -.398 C -.519 -.429 -.442 -.579 -.315 -.682 C -.213 -.762 -.071 -.807 .023 -.778 C .183 -.752 .319 -.641 .437 -.489 Q .507 -.405 .457 -.384 Q .419 -.357 .358 -.384 Q .29 -.355 .228 -.389 Q .154 -.37 .091 -.409 Q .005 -.422 -.07 -.401 Q -.142 -.369 -.209 -.372 Q -.31 -.33 -.381 -.369 Q -.44 -.36 -.465 -.398 Z";
        const cp = fillPath(
          ctx,
          cap,
          radial(
            ctx,
            -0.03,
            -0.64,
            0.53,
            [
              [0, palette.capLight],
              [0.55, palette.capPeach],
              [0.94, palette.capShadow],
              [1, "#8b533d"],
            ],
            -0.12,
            -0.8,
          ),
          palette.capShadow,
          0.007,
        );
        ctx.save();
        ctx.clip(cp);
        const r = rng(seed);
        for (let i = 0; i < 40; i++) {
          const px = -0.47 + r() * 0.96,
            py = -0.86 + r() * 0.48,
            s = 0.014 + r() * 0.025;
          ctx.beginPath();
          ctx.moveTo(px - s, py);
          ctx.quadraticCurveTo(px, py - s * 0.8, px + s, py + 0.007);
          ctx.lineTo(px + s * 0.3, py + s * 0.45);
          ctx.closePath();
          ctx.fillStyle =
            i % 3 ? "rgba(255,235,199,.5)" : "rgba(174,94,47,.19)";
          ctx.fill();
        }
        for (let i = 0; i < 14; i++) {
          const u = i / 13,
            px = -0.46 + u * 0.9,
            top = -0.72 + Math.abs(u - 0.5) * 0.24 + r() * 0.06;
          stroke(
            ctx,
            `M ${px * 0.53} ${top} Q ${px * 0.72} ${top + 0.055} ${px * 0.76} ${top + 0.09}`,
            "rgba(255,229,194,.55)",
            0.004,
          );
        }
        ctx.restore();
        stroke(
          ctx,
          "M -.459 -.397 Q -.34 -.327 -.178 -.389 Q .003 -.427 .11 -.4 Q .35 -.344 .441 -.388",
          palette.capLight,
          0.009,
        );
        stroke(
          ctx,
          "M -.37 -.609 Q -.14 -.845 .053 -.808",
          palette.shellHighlight,
          0.007,
        );
      },
      size,
    );
  }
  function drawBackpack(ctx, o, v) {
    if (!v.front) {
      // Padded back plate and shoulder yoke physically join pack to torso, including raised-arm poses.
      const rear = v.side ? 0.17 : 0.24;
      fillPath(
        ctx,
        `M .075 -.30 Q .12 -.347 ${rear} -.313 L ${rear + 0.035} -.035 Q .17 -.012 .107 -.066 Z`,
        linear(ctx, 0.09, -0.3, rear + 0.03, -0.06, [
          [0, palette.metalShadow],
          [0.55, "#6b5539"],
          [1, palette.referenceDark],
        ]),
        palette.metalShadow,
        0.003,
      );
      stroke(
        ctx,
        `M .085 -.308 Q .19 -.351 ${rear + 0.035} -.285`,
        "#9f7c53",
        0.012,
      );
      stroke(
        ctx,
        `M .085 -.311 Q .19 -.354 ${rear + 0.035} -.287`,
        "#c0a078",
        0.002,
      );
    }
    scope(
      ctx,
      v.front ? 0 : v.side ? 0.205 : 0.29,
      -0.13,
      -0.025,
      () => {
        const body =
          "M -.067 -.16 Q -.078 -.203 -.027 -.21 L .091 -.194 Q .139 -.182 .143 -.112 L .142 .146 Q .135 .188 .089 .191 L -.045 .16 Q -.077 .152 -.074 .104 Z";
        stroke(
          ctx,
          "M -.042 -.191 C -.055 -.263 .101 -.25 .118 -.181",
          palette.metalShadow,
          0.018,
        );
        stroke(
          ctx,
          "M -.042 -.192 C -.055 -.263 .101 -.25 .118 -.181",
          palette.referenceBronze,
          0.007,
        );
        const p = fillPath(
          ctx,
          body,
          linear(ctx, -0.075, -0.15, 0.14, 0.17, [
            [0, "#ac8158"],
            [0.3, "#886044"],
            [0.72, "#64432e"],
            [1, "#3b3027"],
          ]),
          palette.metalShadow,
          0.004,
        );
        drawWeathering(
          ctx,
          p,
          [-0.08, -0.21, 0.23, 0.41],
          922,
          "metal",
          o.detail,
        );
        fillPath(
          ctx,
          "M -.052 -.175 Q .017 -.188 .124 -.14 L .126 -.075 Q .043 -.056 -.047 -.096 Z",
          linear(ctx, 0, -0.18, 0, -0.07, [
            [0, "#b18b65"],
            [1, "#6a4832"],
          ]),
          palette.referenceDark,
          0.003,
        );
        stroke(ctx, "M -.039 -.164 Q .027 -.17 .108 -.135", "#c5a17a", 0.001);
        for (const x of [-0.033, 0.09]) {
          fillPath(
            ctx,
            `M ${x} -.174 L ${x + 0.025} -.17 L ${x + 0.021} .166 L ${x - 0.003} .16 Z`,
            "#866346",
            palette.referenceDark,
            0.002,
          );
          for (const y of [-0.02, 0.097]) {
            fillPath(
              ctx,
              `M ${x - 0.004} ${y} L ${x + 0.03} ${y + 0.004} L ${x + 0.03} ${y + 0.042} L ${x - 0.006} ${y + 0.038} Z`,
              "#302820",
              "#b58c61",
              0.004,
            );
            stroke(
              ctx,
              `M ${x + 0.01} ${y + 0.003} L ${x + 0.01} ${y + 0.032}`,
              "#cda478",
              0.002,
            );
          }
        }
        const pocket =
          "M .07 -.1 Q .119 -.11 .153 -.075 L .155 .035 Q .144 .057 .085 .042 Z";
        fillPath(
          ctx,
          pocket,
          linear(ctx, 0.06, -0.08, 0.16, 0.03, [
            [0, "#b28661"],
            [1, "#715039"],
          ]),
          "#473b30",
          0.003,
        );
        stroke(
          ctx,
          "M .085 -.083 Q .114 -.071 .14 -.075 L .14 .025 L .095 .023 Z",
          "#c3966d",
          0.001,
        );
        bolt(ctx, 0.106, 0.022, 0.006);
        bolt(ctx, 0.138, 0.025, 0.006);
        drawMoss(ctx, -0.016, -0.179, 0.104, 0.037, 351, o);
        drawMoss(ctx, 0.099, 0.121, 0.065, 0.036, 354, o);
        drawMushroom(ctx, 0.021, -0.187, 0.071, -0.15, 456, o);
      },
      v.front ? 1.7 : 0.83,
      v.front ? 0.83 : 1,
    );
  }
  function drawHand(ctx) {
    ellipse(
      ctx,
      0,
      0,
      0.034,
      0.019,
      palette.metalShadow,
      palette.visorDeep,
      0.002,
    );
    for (let i = 0; i < 3; i++) {
      scope(
        ctx,
        -0.022 + i * 0.022,
        0.023 + (i === 1 ? 0.006 : 0),
        0.15 - i * 0.1,
        () => {
          fillPath(
            ctx,
            "M -.014 -.017 Q 0 -.025 .014 -.015 L .015 .012 Q .007 .025 -.009 .02 Q -.019 .014 -.014 -.017 Z",
            linear(ctx, -0.014, -0.018, 0.016, 0.025, [
              [0, palette.metalHighlight],
              [0.45, palette.referenceBronze],
              [1, palette.referenceDark],
            ]),
            palette.metalShadow,
            0.002,
          );
          stroke(
            ctx,
            "M -.012 -.002 Q 0 -.006 .013 -.003",
            palette.metalShadow,
            0.002,
          );
        },
      );
    }
    scope(ctx, -0.036, 0.003, -0.45, () => {
      fillPath(
        ctx,
        "M -.01 -.011 Q .009 -.021 .017 -.002 L .016 .016 Q .001 .027 -.011 .016 Z",
        palette.referenceBronze,
        palette.metalShadow,
        0.002,
      );
    });
  }
  function drawArm(ctx, o, side, v) {
    const near = side === "left",
      sx = near
        ? v.front
          ? 0.174
          : v.side
            ? 0.1
            : 0.215
        : v.front
          ? -0.174
          : v.side
            ? 0.03
            : -0.177,
      sy = near ? -0.281 : -0.3;
    const shrink = near ? 1 : v.front ? 1 : 0.85,
      name = side;
    scope(
      ctx,
      sx,
      sy,
      o[name + "Shoulder"],
      () => {
        joint(ctx, 0, 0.015, 0.075);
        debugJoint(ctx, o, "shoulder", 0, 0, 0, 0.144);
        const shell =
          "M -.055 -.014 C -.039 -.046 .024 -.043 .052 -.018 C .076 .006 .085 .057 .079 .092 C .04 .069 -.036 .087 -.065 .105 C -.078 .061 -.077 .014 -.055 -.014 Z";
        ceramic(ctx, shell, [-0.077, -0.039, 0.16, 0.145], near ? 513 : 514, o);
        fillPath(
          ctx,
          "M -.066 .097 Q .003 .061 .079 .092 Q .075 .118 .058 .129 Q .005 .103 -.05 .132 Z",
          palette.metalShadow,
          palette.referenceDark,
          0.002,
        );
        stroke(
          ctx,
          "M -.055 .007 Q -.057 -.02 -.021 -.025",
          palette.shellHighlight,
          0.003,
        );
        drawMoss(ctx, -0.018, -0.022, 0.12, 0.044, near ? 417 : 418, o);
        if (near)
          drawMycelium(
            ctx,
            "M -.071 -.019 Q -.067 .01 -.06 .023 L -.071 .044 M -.06 .023 L -.045 .032 M -.071 .044 L -.059 .069",
            o,
          );
        scope(ctx, 0, 0.144, o[name + "Elbow"], () => {
          joint(ctx, 0, 0, 0.039);
          debugJoint(ctx, o, "elbow", 0, 0, 0, 0.148);
          const fore =
            "M -.058 .023 Q -.019 -.002 .034 .019 C .084 .037 .088 .104 .056 .154 Q .008 .131 -.052 .157 C -.085 .117 -.088 .066 -.058 .023 Z";
          ceramic(ctx, fore, [-0.08, 0.009, 0.16, 0.148], near ? 526 : 527, o);
          stroke(
            ctx,
            "M -.058 .075 Q -.064 .045 -.031 .034",
            palette.shellHighlight,
            0.003,
          );
          ellipse(
            ctx,
            0.003,
            0.146,
            0.046,
            0.021,
            palette.referenceDark,
            palette.metalShadow,
            0.002,
          );
          drawMoss(ctx, 0.02, 0.028, 0.092, 0.039, near ? 451 : 452, o);
          if (near) {
            drawMushroom(ctx, 0.047, 0.035, 0.087, 0.16, 574, o);
            drawMushroom(ctx, 0.035, 0.099, 0.066, -0.17, 575, o);
            drawMushroom(ctx, -0.009, 0.103, 0.029, -0.18, 576, o);
          } else drawMushroom(ctx, -0.049, 0.047, 0.059, -0.32, 580, o);
          drawMycelium(
            ctx,
            "M -.063 .049 Q -.071 .081 -.065 .103 L -.058 .125 M -.066 .085 L -.055 .089",
            o,
            0.0013,
          );
          scope(ctx, 0.004, 0.153, o[name + "Wrist"], () => {
            drawHand(ctx);
            debugJoint(ctx, o, "wrist", 0, 0, 0, 0.04);
          });
        });
      },
      shrink,
    );
  }
  function drawBoot(ctx, o, seed) {
    const boot =
      "M -.049 -.028 C -.078 -.018 -.12 .022 -.13 .064 Q -.09 .078 -.014 .075 L .072 .071 C .081 .046 .065 .013 .039 -.005 Z";
    ceramic(ctx, boot, [-0.13, -0.02, 0.21, 0.102], seed, o);
    fillPath(
      ctx,
      "M -.125 .055 Q -.087 .029 -.054 .046 Q -.032 .055 -.023 .075 L -.095 .078 L -.129 .072 Z",
      linear(ctx, 0, 0.035, 0, 0.08, [
        [0, palette.metalHighlight],
        [1, palette.referenceDark],
      ]),
      palette.metalShadow,
      0.002,
    );
    stroke(
      ctx,
      "M -.129 .073 Q -.066 .087 .072 .073",
      palette.metalShadow,
      0.006,
    );
    drawMoss(ctx, 0.043, 0.035, 0.052, 0.056, seed + 1, o);
    stroke(
      ctx,
      "M -.079 .009 Q -.044 -.014 .018 .006",
      palette.shellHighlight,
      0.002,
    );
  }
  function drawLeg(ctx, o, side, v) {
    const near = side === "left",
      x = near
        ? v.front
          ? 0.098
          : v.side
            ? 0.028
            : 0.165
        : v.front
          ? -0.098
          : v.side
            ? -0.005
            : -0.09,
      shrink = near ? 1 : v.front ? 1 : 0.94;
    scope(
      ctx,
      x,
      near ? 0 : -0.012,
      o[side + "Hip"],
      () => {
        joint(ctx, 0, 0, 0.049);
        debugJoint(ctx, o, "hip", 0, 0, 0, 0.108);
        // Lower leg is behind the thigh's overlapping kneecap armor.
        scope(ctx, 0, 0.108, o[side + "Knee"], () => {
          joint(ctx, 0, 0.003, 0.046);
          debugJoint(ctx, o, "knee", 0, 0, 0, 0.1);
          const shin =
            "M -.053 .025 Q -.005 .015 .05 .03 Q .076 .066 .065 .11 Q .004 .128 -.061 .108 Q -.071 .068 -.053 .025 Z";
          ceramic(ctx, shin, [-0.076, 0.019, 0.152, 0.11], near ? 649 : 650, o);
          drawMoss(ctx, 0.052, 0.081, 0.034, 0.06, 651 + (near ? 0 : 1), o);
          scope(ctx, 0, 0.101, o[side + "Foot"], () => {
            drawBoot(ctx, o, near ? 671 : 672);
            debugJoint(ctx, o, "ankle", 0, 0, -0.08, 0.06);
          });
        });
        const thigh =
          "M -.06 .015 Q 0 -.003 .055 .019 C .086 .049 .08 .10 .044 .143 Q .004 .11 -.059 .139 C -.084 .091 -.086 .05 -.06 .015 Z";
        ceramic(ctx, thigh, [-0.087, 0.005, 0.176, 0.143], near ? 625 : 626, o);
        drawMoss(ctx, -0.006, 0.023, 0.136, 0.044, 636 + (near ? 0 : 1), o);
        stroke(
          ctx,
          "M -.062 .14 Q -.004 .11 .044 .145",
          palette.referenceDark,
          0.003,
        );
        if (near) {
          drawMushroom(ctx, -0.017, 0.087, 0.059, -0.21, 641, o);
          drawMushroom(ctx, -0.048, 0.101, 0.028, -0.08, 642, o);
        }
      },
      shrink,
    );
  }
  function drawTorso(ctx, o) {
    const chest =
      "M -.096 -.329 C -.061 -.351 .051 -.353 .091 -.32 C .126 -.281 .162 -.198 .138 -.125 C .108 -.048 -.053 -.04 -.118 -.087 C -.179 -.13 -.154 -.275 -.096 -.329 Z";
    // Under-shell mechanisms remain visibly separate from the belly plate.
    ellipse(
      ctx,
      0.025,
      -0.108,
      0.173,
      0.087,
      linear(ctx, -0.14, -0.2, 0.18, 0, [
        [0, "#756243"],
        [0.7, "#69553b"],
        [1, palette.metalShadow],
      ]),
      palette.referenceDark,
      0.003,
    );
    drawMoss(ctx, 0.12, -0.092, 0.089, 0.09, 226, o);
    ceramic(ctx, chest, [-0.162, -0.352, 0.323, 0.32], 211, o);
    stroke(
      ctx,
      "M -.128 -.253 Q -.04 -.275 .114 -.228",
      palette.referenceDark,
      0.0028,
    );
    stroke(
      ctx,
      "M -.122 -.255 Q -.04 -.277 .11 -.231",
      palette.shellHighlight,
      0.0013,
    );
    stroke(
      ctx,
      "M .061 -.235 Q .11 -.174 .059 -.074 M -.124 -.118 Q -.006 -.067 .117 -.119",
      "rgba(141,97,63,.65)",
      0.0014,
    );
    scope(ctx, -0.039, -0.255, -0.03, () => {
      fillPath(
        ctx,
        "M -.041 -.009 Q -.046 -.002 -.041 .009 L .038 .01 Q .049 .003 .04 -.009 Z",
        palette.referenceBronze,
        palette.capShadow,
        0.002,
      );
      fillPath(
        ctx,
        "M -.034 -.005 L .034 -.005 Q .04 0 .034 .006 L -.034 .006 Z",
        palette.eyeCore,
        palette.eyeAmber,
        0.002,
      );
      stroke(ctx, "M -.026 .002 L .026 .002", "#fffbe0", 0.003);
    });
    scope(ctx, -0.11, -0.139, -0.17, () => {
      ellipse(
        ctx,
        0,
        0,
        0.017,
        0.041,
        palette.referenceDark,
        palette.shellHighlight,
        0.001,
      );
      stroke(
        ctx,
        "M 0 .02 Q .008 .01 -.003 -.009 M .001 .013 Q -.012 .003 -.01 -.012 M .001 .013 Q .01 .007 .009 -.006",
        palette.metalHighlight,
        0.0028,
      );
    });
    drawMoss(ctx, -0.079, -0.322, 0.089, 0.039, 221, o);
    drawMoss(ctx, 0.087, -0.314, 0.077, 0.046, 225, o);
    drawMushroom(ctx, -0.099, -0.309, 0.048, -0.3, 231, o);
    drawMushroom(ctx, 0.089, -0.297, 0.061, 0.22, 232, o);
    drawMycelium(
      ctx,
      "M .103 -.306 Q .143 -.267 .137 -.234 L .119 -.205 M .137 -.251 L .15 -.248 M .135 -.263 L .126 -.271",
      o,
      0.0017,
    );
    stroke(
      ctx,
      "M -.086 -.326 Q -.03 -.342 .031 -.329",
      palette.shellHighlight,
      0.003,
    );
  }
  function drawEyes(ctx, o, v) {
    const positions = v.front
      ? [
          [-0.095, 0.026, 1],
          [0.095, 0.026, 1],
        ]
      : v.side
        ? [[-0.025, 0.026, 1]]
        : [
            [-0.086, 0.033, 0.66],
            [0.078, 0.02, 1],
          ];
    for (let i = 0; i < positions.length; i++) {
      const [x, y, compression] = positions[i],
        lookX = o.eyeLookX * 0.022,
        lookY = o.eyeLookY * 0.027;
      scope(
        ctx,
        x + lookX,
        y +
          lookY +
          (o.eyeExpression === "concerned"
            ? i === 0
              ? -0.01
              : 0.005
            : o.eyeExpression === "sad"
              ? 0.018
              : o.eyeExpression === "curious"
                ? i === 0
                  ? 0.008
                  : -0.009
                : 0),
        0,
        () => {
          let rx = 0.025 * compression,
            ry = 0.046,
            tilt = 0;
          const e = o.eyeExpression;
          if (e === "curious") {
            ry *= i === 0 ? 0.58 : 1.13;
            rx *= i === 0 ? 0.82 : 1.1;
            tilt = i === 0 ? -0.1 : 0.05;
          }
          if (e === "surprised") {
            rx *= 1.45;
            ry *= 1.25;
          }
          if (e === "focused") ry *= 0.45;
          if (e === "concerned") ry *= i === 0 ? 0.67 : 0.9;
          if (e === "sad") {
            ry *= 0.57;
            rx *= 0.9;
          }
          ctx.rotate(tilt);
          ellipse(
            ctx,
            0,
            0,
            rx * 2.3,
            Math.max(ry, 0.023) * 1.5,
            radial(ctx, 0, 0, Math.max(ry, rx) * 1.8, [
              [0, "rgba(255,155,67,.26)"],
              [0.6, "rgba(247,138,50,.08)"],
              [1, "rgba(247,138,50,0)"],
            ]),
          );
          if (e === "happy" || e === "sleepy") {
            const d =
              e === "happy"
                ? `M ${-rx} .008 Q 0 ${-0.035} ${rx} .008`
                : `M ${-rx} .003 Q 0 .019 ${rx} .003`;
            stroke(ctx, d, palette.eyeAmber, 0.012);
            stroke(ctx, d, palette.eyeCore, 0.006);
            return;
          }
          ellipse(
            ctx,
            0,
            0,
            rx,
            ry,
            radial(ctx, 0, 0, ry * 1.2, [
              [0, "#fffae4"],
              [0.6, palette.eyeCore],
              [1, palette.eyeAmber],
            ]),
            palette.eyeAmber,
            0.002,
          );
          if (["concerned", "sad", "focused"].includes(e)) {
            const left = i === 0,
              top = -ry * 0.4,
              direction = e === "focused" ? 1 : -1;
            ctx.save();
            ctx.beginPath();
            ctx.ellipse(0, 0, rx + 0.001, ry + 0.001, 0, 0, TAU);
            ctx.clip();
            fillPath(
              ctx,
              `M ${-rx - 0.004} ${-ry - 0.004} L ${rx + 0.004} ${-ry - 0.004} L ${rx + 0.004} ${top + (left ? 1 : -1) * direction * ry * 0.44} L ${-rx - 0.004} ${top - (left ? 1 : -1) * direction * ry * 0.44} Z`,
              palette.visorWarm,
              null,
            );
            ctx.restore();
          }
        },
      );
    }
  }
  function drawVisor(ctx, o, v) {
    // Same oval/squircle family, projected in the face plane for each named view.
    const yaw = o.headRotation,
      baseX = v.front ? 0 : v.side ? -0.156 : -0.089;
    const faceX = baseX + (v.front ? 0.072 : yaw > 0 ? 0.089 : 0.067) * yaw;
    const width =
      (v.front ? 1.25 : v.side ? 0.54 : 1) +
      (v.front ? -0.25 * Math.abs(yaw) : yaw * (yaw > 0 ? 0.25 : 0.46));
    scope(ctx, faceX, 0.006, v.front ? 0 : -0.085, () => {
      scope(
        ctx,
        0,
        0,
        0,
        () => {
          const glass =
            "M -.133 -.084 C -.109 -.133 -.034 -.145 .022 -.13 C .098 -.124 .145 -.065 .146 .005 C .149 .079 .096 .13 .022 .137 C -.055 .146 -.115 .126 -.139 .062 C -.157 .009 -.158 -.033 -.133 -.084 Z";
          fillPath(ctx, glass, palette.visorDeep, palette.shellShadow, 0.01);
          const gp = fillPath(
            ctx,
            glass,
            radial(
              ctx,
              -0.015,
              -0.005,
              0.192,
              [
                [0, "#59473b"],
                [0.39, palette.visorWarm],
                [0.8, "#302722"],
                [1, palette.visorDeep],
              ],
              -0.057,
              -0.074,
            ),
            palette.visorDeep,
            0.003,
          );
          ctx.save();
          ctx.clip(gp);
          drawWeathering(
            ctx,
            gp,
            [-0.16, -0.14, 0.32, 0.29],
            177,
            "glass",
            false,
          );
          ctx.globalAlpha *= 0.28;
          fillPath(
            ctx,
            "M -.147 -.053 Q -.132 -.147 .002 -.13 Q .094 -.113 .102 -.049 Q .032 -.068 -.027 -.03 Q -.112 .017 -.147 -.053 Z",
            linear(ctx, -0.02, -0.15, 0.02, 0.03, [
              [0, "#c6b5a0"],
              [1, "rgba(127,96,75,0)"],
            ]),
            null,
          );
          ctx.globalAlpha /= 0.28;
          drawEyes(ctx, o, v);
          ellipse(
            ctx,
            v.front ? 0 : -0.017,
            0.106,
            0.006,
            0.006,
            radial(ctx, -0.017, 0.106, 0.018, [
              [0, palette.myceliumCore],
              [1, palette.referenceCyan],
            ]),
          );
          scope(ctx, 0.098, -0.071, -0.38, () => {
            ellipse(ctx, 0, 0, 0.011, 0.025, "rgba(255,227,189,.53)");
            ellipse(ctx, -0.003, -0.008, 0.0035, 0.009, "rgba(255,245,221,.7)");
          });
          ellipse(ctx, -0.126, -0.056, 0.004, 0.01, "rgba(227,219,206,.35)");
          ctx.restore();
          stroke(
            ctx,
            "M -.144 .035 C -.123 .123 -.066 .144 .027 .135 Q .111 .123 .135 .076",
            "rgba(255,228,194,.51)",
            0.0016,
          );
        },
        width,
        1,
      );
    });
  }
  function drawHead(ctx, o, v) {
    // Neck pivot is below the shell. Rotation carries visor, crown and filaments together.
    scope(ctx, v.front ? 0 : 0.04, -0.334, o.headTilt, () => {
      ctx.translate(0, -0.187);
      // Head yaw changes projected face geometry; shell volume stays constant.
      const shell =
        "M -.221 -.096 C -.178 -.192 -.051 -.219 .071 -.185 C .186 -.151 .249 -.071 .233 .028 C .223 .127 .135 .189 .019 .193 C -.073 .194 -.18 .157 -.216 .079 C -.247 .015 -.25 -.03 -.221 -.096 Z";
      ceramic(ctx, shell, [-0.25, -0.206, 0.5, 0.41], 119, o);
      // Rear shell region is darker, rounding the helmet behind its pale front rim.
      ctx.save();
      ctx.clip(path(shell));
      fillPath(
        ctx,
        "M .029 -.207 C .218 -.167 .275 -.032 .233 .095 Q .155 .201 .027 .19 C .119 .118 .151 .016 .098 -.092 Z",
        linear(ctx, 0.03, -0.1, 0.25, 0.06, [
          [0, "rgba(119,110,84,.06)"],
          [0.52, "rgba(107,103,79,.25)"],
          [1, "rgba(55,56,42,.53)"],
        ]),
        null,
      );
      ctx.restore();
      stroke(
        ctx,
        "M .081 -.177 C .158 -.073 .169 .093 .047 .185",
        "rgba(105,82,59,.75)",
        0.0022,
      );
      stroke(
        ctx,
        "M -.15 -.165 Q -.082 -.137 -.064 -.127 M .012 .147 Q .009 .174 -.004 .189",
        "rgba(141,110,84,.54)",
        0.0015,
      );
      drawMycelium(
        ctx,
        "M .102 -.153 Q .117 -.116 .131 -.095 L .125 -.058 Q .153 -.035 .148 -.003 L .123 .028 Q .13 .048 .112 .071 L .093 .084 L .086 .119 L .064 .145 M .131 -.095 L .155 -.11 L .17 -.098 M .125 -.058 L .102 -.048 L .105 -.019 M .148 -.003 L .183 -.031 L .195 -.059 M .183 -.031 L .204 -.02 M .112 .071 L .154 .075 L .171 .056 M .086 .119 L .116 .133",
        o,
        0.0022,
      );
      drawVisor(ctx, o, v);
      stroke(
        ctx,
        "M -.204 -.11 C -.165 -.161 -.091 -.191 -.026 -.183",
        "rgba(255,246,226,.9)",
        0.0035,
      );
      // Crown ridge: fixed clumps overlap the shell, none depend on frame time.
      drawMoss(ctx, -0.045, -0.192, 0.153, 0.071, 129, o);
      drawMoss(ctx, 0.063, -0.184, 0.136, 0.076, 130, o);
      drawMoss(ctx, 0.025, -0.173, 0.303, 0.061, 131, o);
      drawMoss(ctx, 0.16, -0.117, 0.102, 0.075, 132, o);
      drawMoss(ctx, 0.195, -0.045, 0.045, 0.067, 133, o);
      drawMoss(ctx, v.front ? 0.229 : 0.155, 0.077, 0.066, 0.046, 134, o);
      drawMushroom(ctx, 0.012, -0.179, 0.3, -0.05, 151, o);
      drawMushroom(ctx, -0.133, -0.158, 0.106, -0.32, 153, o);
      drawMushroom(ctx, 0.15, -0.113, 0.142, 0.24, 155, o);
      drawMushroom(ctx, 0.22, -0.018, 0.104, 0.4, 157, o);
      drawMushroom(ctx, 0.091, -0.144, 0.061, 0.05, 158, o);
      drawMushroom(ctx, -0.072, -0.185, 0.04, -0.13, 159, o);
      drawMushroom(ctx, v.front ? 0.24 : 0.149, 0.091, 0.086, 0.24, 160, o);
      drawMushroom(ctx, v.front ? 0.203 : 0.112, 0.096, 0.028, 0.1, 161, o);
      debugJoint(ctx, o, "head", 0, 0.187, 0, 0);
    });
  }
  function debugJoint(ctx, o, _name, x, y, ex, ey) {
    if (!o.debug) return;
    stroke(ctx, `M ${x} ${y} L ${ex} ${ey}`, "#dd3275", 0.0018);
    ellipse(ctx, x, y, 0.007, 0.007, "#fff1de", "#dd3275", 0.002);
  }
  function normalize(input) {
    const o = { ...defaults, ...input };
    for (const [k, v] of Object.entries(defaults))
      if (typeof v === "number") finite(o[k], k);
    if (o.scale <= 0 || o.scale > 100000)
      throw new RangeError("scale must be > 0 and <= 100000");
    if (o.fps <= 0 || o.fps > 240)
      throw new RangeError("fps must be > 0 and <= 240");
    if (!views.includes(o.facing))
      throw new RangeError(`Unknown facing: ${o.facing}`);
    if (!expressions.includes(o.eyeExpression))
      throw new RangeError(`Unknown expression: ${o.eyeExpression}`);
    for (const key of jointNames) o[key] = clamp(o[key], -Math.PI, Math.PI);
    o.headRotation = clamp(o.headRotation, -1, 1);
    o.headTilt = clamp(o.headTilt, -0.6, 0.6);
    o.eyeLookX = clamp(o.eyeLookX, -1, 1);
    o.eyeLookY = clamp(o.eyeLookY, -1, 1);
    o.breathing = clamp(o.breathing, 0, 1);
    o.mushroomSway = clamp(o.mushroomSway, -1, 1);
    o.myceliumGlow = clamp(o.myceliumGlow, 0, 1);
    o.detail = o.scale >= 220;
    o.time = o.stopMotion ? holdPose(o.time, o.fps) : o.time;
    return o;
  }
  function drawMyko(ctx, input = {}) {
    const o = normalize(input);
    if (!ctx || typeof ctx.save !== "function")
      throw new TypeError("A Canvas 2D context is required");
    const v = {
      front: o.facing === "front",
      side: o.facing.startsWith("side"),
      mirror: o.facing.endsWith("right"),
    };
    // Named anatomical joints do not swap when mirroring: the entire projected rig turns.
    const frame = Math.floor(o.time * o.fps + 1e-9),
      t = o.time;
    if (o.animate) {
      o.headTilt += Math.sin(t * 1.7) * 0.012;
      o.mushroomSway += Math.sin(t * 1.5) * 0.09;
      o.breathing = Math.max(o.breathing, 0.4);
    }
    const jitter = o.imperfections
      ? [
          (hash(frame * 7 + o.seed) - 0.5) * 2,
          (hash(frame * 7 + o.seed + 1) - 0.5) * 2,
        ]
      : [0, 0];
    if (o.imperfections) {
      o.headTilt += (hash(frame * 7 + o.seed + 2) - 0.5) * 0.009;
      o.mushroomSway += (hash(frame * 7 + o.seed + 3) - 0.5) * 0.03;
    }
    ctx.save();
    try {
      ctx.translate(o.x + jitter[0], o.y + jitter[1]);
      ctx.rotate(o.rotation);
      ctx.scale(o.scale * (v.mirror ? -1 : 1), o.scale);
      ctx.lineJoin = "round";
      ctx.lineCap = "round";
      ctx.setLineDash([]);
      // Body/pelvis root; legs inherit it, upper body additionally inherits body lean.
      scope(ctx, 0, -0.285 + o.bodyOffsetY, 0, () => {
        drawLeg(ctx, o, "right", v);
        drawLeg(ctx, o, "left", v);
        scope(ctx, 0, 0, o.bodyLean, () => {
          const breath = Math.sin(t * 2.25) * o.breathing * 0.003;
          ctx.translate(0, -breath);
          drawBackpack(ctx, o, v);
          drawArm(ctx, o, "right", v);
          joint(ctx, -0.05, -0.017, 0.043);
          joint(ctx, 0.033, -0.003, 0.042);
          scope(ctx, 0, 0, 0, () => drawTorso(ctx, o), v.side ? 0.67 : 1, 1);
          drawArm(ctx, o, "left", v);
          ellipse(ctx, 0, -0.342, 0.07, 0.034, palette.metalShadow);
          drawHead(ctx, o, v);
          debugJoint(ctx, o, "pelvis", 0, 0, 0, -0.334);
        });
      });
    } finally {
      ctx.restore();
    }
  }
  class MykoRig {
    constructor(options = {}) {
      this.options = normalize(options);
    }
    pose(patch = {}) {
      this.options = normalize({ ...this.options, ...patch });
      return this;
    }
    reset(patch = {}) {
      this.options = normalize(patch);
      return this;
    }
    draw(ctx, overrides = {}) {
      drawMyko(ctx, { ...this.options, ...overrides });
      return this;
    }
  }
  root.MykoCharacter = Object.freeze({
    drawMyko,
    MykoRig,
    poses,
    expressions,
    views,
    palette,
    defaults,
    jointNames,
    holdPose,
    stepPose,
    easeStopMotion,
    getPose,
  });
})(globalThis);
