/* Character-only fixtures. Every figure delegates to the canonical renderer. */
(function (root) {
  "use strict";
  const VIEWS = ["front", "left", "right", "side-left", "side-right"];
  const POSES = ["neutral", "walking", "reaching", "crouching"];
  const EXPRESSIONS = [
    "neutral",
    "curious",
    "happy",
    "concerned",
    "surprised",
    "sleepy",
    "focused",
    "sad",
  ];
  const LABELS = {
    front: "Front-ish",
    left: "Three-quarter left",
    right: "Three-quarter right",
    "side-left": "Left profile",
    "side-right": "Right profile",
  };
  const SIZES = {
    views: [1800, 780],
    poses: [1600, 800],
    expressions: [1800, 1360],
    scales: [1600, 1040],
  };
  function api() {
    if (!root.MykoCharacter)
      throw new Error(
        "Load src/characters/myko.js before the character fixtures.",
      );
    return root.MykoCharacter;
  }
  function paper(ctx, W, H) {
    ctx.save();
    ctx.fillStyle = "#f4ecd9";
    ctx.fillRect(0, 0, W, H);
    // Static procedural fibres give the sheet a paper surface; no bitmap texture.
    ctx.strokeStyle = "rgba(97,79,54,0.065)";
    ctx.lineWidth = 0.6;
    ctx.beginPath();
    for (let i = 0; i < 350; i++) {
      const x = (((i * 541) % 1741) / 1741) * W,
        y = (((i * 307) % 1327) / 1327) * H;
      ctx.moveTo(x, y);
      ctx.lineTo(x + 3 + (i % 5), y - 1);
    }
    ctx.stroke();
    ctx.restore();
  }
  function label(
    ctx,
    text,
    x,
    y,
    size = 23,
    color = "#716453",
    align = "center",
  ) {
    ctx.save();
    ctx.font = `${size}px ui-monospace, SFMono-Regular, Menlo, monospace`;
    ctx.textAlign = align;
    ctx.fillStyle = color;
    ctx.fillText(text, x, y);
    ctx.restore();
  }
  function heading(ctx, title, subtitle, W) {
    ctx.save();
    ctx.fillStyle = "#353b30";
    ctx.font = "52px Georgia, serif";
    ctx.fillText(title, 64, 80);
    ctx.font = "20px ui-monospace, monospace";
    ctx.fillStyle = "#7a7263";
    ctx.fillText(subtitle, 67, 117);
    ctx.strokeStyle = "#cec3ad";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(64, 144);
    ctx.lineTo(W - 64, 144);
    ctx.stroke();
    ctx.restore();
  }
  function ground(ctx, x, y, w) {
    ctx.save();
    ctx.beginPath();
    ctx.ellipse(x, y + 5, w * 0.48, 10, 0, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(88,82,60,.085)";
    ctx.fill();
    ctx.restore();
  }
  function fixture(ctx, kind = "views", options = {}) {
    const A = api(),
      [W, H] = SIZES[kind] || SIZES.views;
    ctx.save();
    paper(ctx, W, H);
    const base = {
      eyeExpression: "neutral",
      facing: "left",
      time: 0,
      fps: 12,
      animate: false,
      stopMotion: true,
      imperfections: false,
      ...options,
    };
    if (kind === "views") {
      heading(
        ctx,
        "MYKO / turnaround",
        "One canonical character · five viewing angles",
        W,
      );
      VIEWS.forEach((facing, i) => {
        const x = 180 + i * 360,
          y = 682,
          scale = 405;
        ground(ctx, x, y, 240);
        A.drawMyko(ctx, { ...base, x, y, scale, facing });
        label(ctx, LABELS[facing], x, 735, 20);
      });
    } else if (kind === "poses") {
      heading(
        ctx,
        "MYKO / pose studies",
        "The same hierarchy · four reusable poses",
        W,
      );
      POSES.forEach((pose, i) => {
        const x = 215 + i * 390,
          y = 690,
          scale = 395;
        ground(ctx, x, y, 220);
        A.drawMyko(ctx, {
          ...base,
          ...A.getPose(pose, pose === "walking" ? 1.125 : 0, { fps: base.fps }),
          x,
          y,
          scale,
        });
        label(ctx, pose.charAt(0).toUpperCase() + pose.slice(1), x, 750, 23);
      });
    } else if (kind === "expressions") {
      heading(
        ctx,
        "MYKO / expression studies",
        "Eight expressions · immutable helmet, visor and mushroom placement",
        W,
      );
      EXPRESSIONS.forEach((eyeExpression, i) => {
        const x = 232 + (i % 4) * 446,
          y = 665 + Math.floor(i / 4) * 600,
          scale = 350;
        ground(ctx, x, y, 210);
        A.drawMyko(ctx, { ...base, x, y, scale, eyeExpression });
        label(
          ctx,
          eyeExpression.charAt(0).toUpperCase() + eyeExpression.slice(1),
          x,
          y + 52,
          25,
        );
      });
    } else if (kind === "scales") {
      heading(
        ctx,
        "MYKO / scale studies",
        "Silhouette, amber eyes and mushroom crown at three sizes",
        W,
      );
      [600, 300, 120].forEach((scale, i) => {
        const x = [450, 1020, 1360][i],
          y = 960;
        ground(ctx, x, y, scale * 0.55);
        A.drawMyko(ctx, { ...base, x, y, scale });
        label(ctx, `${scale} px body`, x, 1014, 21);
      });
    } else throw new RangeError(`Unknown character fixture: ${kind}`);
    ctx.restore();
    return { width: W, height: H };
  }
  function hero(ctx, W, H, options = {}) {
    ctx.save();
    paper(ctx, W, H);
    const x = W * 0.5,
      y = H * 0.88,
      scale = Math.min(H * 0.65, W * 0.56);
    ground(ctx, x, y, scale * 0.65);
    api().drawMyko(ctx, { x, y, scale, ...options });
    ctx.restore();
  }
  root.MykoTestScene = Object.freeze({
    draw: fixture,
    hero,
    sizes: SIZES,
    views: VIEWS,
    poses: POSES,
    expressions: EXPRESSIONS,
    labels: LABELS,
  });
  // Optional procedural-film fixture adapter. This does not register a film or timeline.
  if (root.FILM && typeof root.FILM.scene === "function") {
    root.FILM.scene({
      id: "myko-character-sheet",
      draw(ctx, _t, info) {
        const [W, H] = SIZES.views,
          scale = Math.min(info.W / W, info.H / H);
        ctx.save();
        ctx.translate((info.W - W * scale) / 2, (info.H - H * scale) / 2);
        ctx.scale(scale, scale);
        fixture(ctx, "views");
        ctx.restore();
      },
    });
  }
})(globalThis);
