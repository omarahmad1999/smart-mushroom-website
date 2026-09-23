#!/usr/bin/env node
"use strict";
const fs = require("node:fs");
const path = require("node:path");
const assert = require("node:assert/strict");
const { pathToFileURL } = require("node:url");
const { chromium } = require("@playwright/test");
const { build, ROOT, OUT } = require("./build.cjs");
async function check() {
  const html = build(),
    source = fs.readFileSync(path.join(ROOT, "src/characters/myko.js"), "utf8");
  const banned = [
    /\bnew\s+Image\s*\(/,
    /\bdrawImage\s*\(/,
    /\bfetch\s*\(/,
    /\bXMLHttpRequest\b/,
    /\bImageBitmap\b/,
    /\b(?:Date|performance)\s*\./,
    /Math\.random\s*\(/,
    /data:image\//,
    /\b(?:document|window)\s*\./,
    /\batob\s*\(/,
  ];
  for (const re of banned)
    assert(!re.test(source), `Forbidden renderer dependency: ${re}`);
  const browser = await chromium.launch({
    headless: true,
    executablePath: process.env.CHROMIUM || "/usr/bin/chromium",
    args: ["--no-sandbox"],
  });
  const errors = [],
    requests = [];
  try {
    const page = await browser.newPage({
      viewport: { width: 1440, height: 1000 },
    });
    page.on("pageerror", (e) => errors.push(String(e)));
    page.on("request", (r) => {
      if (!r.url().startsWith("file:")) requests.push(r.url());
    });
    await page.goto(pathToFileURL(html).href);
    await page.evaluate(() => {
      const c = document.createElement("canvas");
      c.width = 700;
      c.height = 900;
      const ctx = c.getContext("2d", { willReadFrequently: true });
      const a = MykoCharacter;
      globalThis.rigTest = { c, ctx, a };
      rigTest.render = (t = 0, patch = {}) => {
        ctx.reset();
        ctx.clearRect(0, 0, c.width, c.height);
        a.drawMyko(ctx, {
          x: 330,
          y: 835,
          scale: 570,
          ...a.getPose("walking", t),
          time: t,
          animate: true,
          imperfections: true,
          ...patch,
        });
        const bytes = ctx.getImageData(0, 0, c.width, c.height).data;
        let hash = 2166136261,
          count = 0;
        for (let i = 0; i < bytes.length; i++) {
          hash = Math.imul(hash ^ bytes[i], 16777619);
          if (i % 4 === 3 && bytes[i]) count++;
        }
        return { hash: (hash >>> 0).toString(16), count };
      };
    });
    const results = await page.evaluate(() => {
      const { a, ctx, render } = rigTest,
        checks = [];
      const ok = (condition, msg) => {
        if (!condition) throw new Error(msg);
        checks.push(msg);
      };
      const times = [0, 1 / 24, 2 / 24, 3 / 24, 0.5, 0.875, 1.333, 2.417];
      const cold = times.map((t) => render(t)),
        warm = times.map((t) => render(t));
      const reverse = [...times]
        .reverse()
        .map((t) => render(t))
        .reverse();
      ok(
        cold.every(
          (x, i) => x.hash === warm[i].hash && x.hash === reverse[i].hash,
        ),
        "Identical pixels in cold, warm and reverse render order",
      );
      ok(
        new Set(cold.map((x) => x.hash)).size >= 5,
        "Different held poses produce different drawings",
      );
      ok(
        cold.every((x) => x.count > 40000),
        "Every rendered character has substantial visible geometry",
      );
      const freshHashes = cold.map((x) => x.hash);
      for (const fps of [8, 12]) {
        const f = 24 / fps;
        for (let group = 0; group < 4; group++) {
          const hashes = [];
          for (let i = 0; i < f; i++) {
            const t = (group * f + i) / 24;
            hashes.push(
              render(t, { ...a.getPose("walking", t, { fps }), fps }).hash,
            );
          }
          ok(
            new Set(hashes).size === 1,
            `${fps}fps holds ${f} film frames at group ${group}`,
          );
        }
      }
      ok(
        a.holdPose(2 / 24, 8) === 0 && a.holdPose(3 / 24, 8) === 0.125,
        "Held-clock boundaries match film frames",
      );
      const keys = [
        { time: 0, pose: { leftElbow: 0, eyeExpression: "neutral" } },
        { time: 1, pose: { leftElbow: 1, eyeExpression: "happy" } },
      ];
      ok(
        a.stepPose(keys, 0.99).leftElbow === 0 &&
          a.stepPose(keys, 1).eyeExpression === "happy",
        "Keyframes hold discrete poses and switch expressions on boundaries",
      );
      const mid = a.stepPose(keys, 0.5, { interpolate: true });
      ok(
        mid.leftElbow === 0.5 && mid.eyeExpression === "neutral",
        "Opt-in stepped interpolation changes numeric joints, holds categorical identity",
      );
      ok(
        a.easeStopMotion(0) === 0 &&
          a.easeStopMotion(1) === 1 &&
          a.easeStopMotion(0.5) === 0.5,
        "Stepped easing reaches expected endpoints",
      );
      const frames = [];
      let calls = 0,
        depth = 0;
      const instrumented = new Proxy(ctx, {
        get(target, key) {
          const value = Reflect.get(target, key, target);
          if (typeof value !== "function") return value;
          return (...args) => {
            for (const v of args)
              if (typeof v === "number" && !Number.isFinite(v))
                throw new Error(`Non-finite ${String(key)} argument`);
            if (key === "save") depth++;
            if (key === "restore") depth--;
            if (depth < 0) throw new Error("Unbalanced restore");
            calls++;
            return value.apply(target, args);
          };
        },
        set(target, key, value) {
          if (typeof value === "number" && !Number.isFinite(value))
            throw new Error(`Non-finite ${String(key)} property`);
          return Reflect.set(target, key, value, target);
        },
      });
      for (const facing of a.views)
        for (const eyeExpression of a.expressions)
          for (const pose of a.poses) {
            ctx.reset();
            const started = performance.now();
            a.drawMyko(instrumented, {
              x: 330,
              y: 835,
              scale: 570,
              facing,
              eyeExpression,
              ...a.getPose(pose, 0.375),
              eyeLookX: -1,
              eyeLookY: -1,
            });
            frames.push(performance.now() - started);
          }
      ok(
        depth === 0 && calls > 1000,
        "All 160 view/expression/pose combinations use finite coordinates and balanced transforms",
      );
      // Context state and clipping belong to the caller and must survive drawing.
      ctx.reset();
      ctx.fillStyle = "#bd7b52";
      ctx.strokeStyle = "#72abcc";
      ctx.lineWidth = 7;
      ctx.globalAlpha = 0.43;
      ctx.globalCompositeOperation = "multiply";
      ctx.setLineDash([3, 7]);
      ctx.translate(13, 19);
      ctx.rotate(0.13);
      ctx.scale(0.9, 1.1);
      const state = () =>
        JSON.stringify({
          t: [
            ...["a", "b", "c", "d", "e", "f"].map((k) => ctx.getTransform()[k]),
          ],
          fill: ctx.fillStyle,
          stroke: ctx.strokeStyle,
          line: ctx.lineWidth,
          alpha: ctx.globalAlpha,
          blend: ctx.globalCompositeOperation,
          dash: ctx.getLineDash(),
        });
      const before = state();
      a.drawMyko(ctx, { x: 340, y: 780, scale: 400 });
      ok(
        state() === before,
        "Caller transform, styles, alpha, compositing and dash are preserved",
      );
      for (const bad of [
        { scale: NaN },
        { x: Infinity },
        { leftElbow: NaN },
        { scale: 0 },
        { fps: 0 },
        { eyeExpression: "oops" },
        { facing: "oops" },
      ]) {
        let threw = false;
        try {
          a.drawMyko(ctx, bad);
        } catch (e) {
          threw = e instanceof TypeError || e instanceof RangeError;
        }
        ok(
          threw && state() === before,
          `Invalid option rejected without mutating context: ${Object.keys(bad)[0]}`,
        );
      }
      ctx.reset();
      ctx.beginPath();
      ctx.rect(0, 0, 10, 10);
      ctx.clip();
      a.drawMyko(ctx, { x: 330, y: 835, scale: 500 });
      ctx.fillStyle = "#ff0000";
      ctx.fillRect(0, 0, 700, 900);
      ok(
        ctx.getImageData(5, 5, 1, 1).data[3] === 255 &&
          ctx.getImageData(50, 50, 1, 1).data[3] === 0,
        "Caller clip remains active after drawing",
      );
      ctx.reset();
      const rig = new a.MykoRig({ x: 330, y: 835, scale: 570 });
      rig.pose({ headTilt: 0.12 }).draw(ctx);
      const saved = JSON.stringify(rig.options);
      rig.draw(ctx, { eyeExpression: "happy" });
      ok(
        JSON.stringify(rig.options) === saved,
        "Per-draw overrides do not mutate persistent rig pose",
      );
      rig.reset();
      ok(
        rig.options.headTilt === 0 && rig.options.eyeExpression === "neutral",
        "Reset restores canonical defaults",
      );
      const expressionHashes = a.expressions.map(
        (eyeExpression) => render(0, { eyeExpression }).hash,
      );
      ok(
        new Set(expressionHashes).size === 8,
        "All eight expressions have distinct pixels",
      );
      const yawHashes = [-1, 0, 1].map(
        (headRotation) => render(0, { headRotation }).hash,
      );
      ok(new Set(yawHashes).size === 3, "Head yaw changes the projected face");
      // Local joint movements must not alter pixels belonging to unrelated body parts.
      function cropHash(patch, box) {
        render(0, {
          ...a.getPose("neutral"),
          animate: false,
          imperfections: false,
          ...patch,
        });
        const d = ctx.getImageData(...box).data;
        let n = 0;
        for (const b of d) n = Math.imul(n ^ b, 16777619);
        return n;
      }
      ok(
        cropHash({}, [190, 110, 290, 325]) ===
          cropHash({ leftElbow: 0.8 }, [190, 110, 290, 325]),
        "Moving an elbow preserves the helmet and its surface identity",
      );
      frames.sort((x, y) => x - y);
      const timing = {
        median: frames[Math.floor(frames.length * 0.5)],
        p95: frames[Math.floor(frames.length * 0.95)],
        max: frames.at(-1),
      };
      ok(
        timing.p95 < 150,
        `95th percentile character draw cost ${timing.p95.toFixed(1)}ms stays below 150ms`,
      );
      return { checks, timing, freshHashes, times };
    });
    // Re-create browser JS context, dropping all renderer caches before repeat renders.
    const fresh = await browser.newPage();
    await fresh.goto(pathToFileURL(html).href);
    const freshHashes = await fresh.evaluate((times) => {
      const c = document.createElement("canvas");
      c.width = 700;
      c.height = 900;
      const ctx = c.getContext("2d", { willReadFrequently: true }),
        a = MykoCharacter;
      return times.map((t) => {
        ctx.reset();
        a.drawMyko(ctx, {
          x: 330,
          y: 835,
          scale: 570,
          ...a.getPose("walking", t),
          time: t,
          animate: true,
          imperfections: true,
        });
        let h = 2166136261;
        for (const b of ctx.getImageData(0, 0, c.width, c.height).data)
          h = Math.imul(h ^ b, 16777619);
        return (h >>> 0).toString(16);
      });
    }, results.times);
    assert.deepEqual(
      freshHashes,
      results.freshHashes,
      "Fresh context pixels differ",
    );
    results.checks.push(
      "Pixel determinism survives a new browser context with empty geometry caches",
    );
    // Exercise the actual controls, plus mobile overflow.
    await page.selectOption('select[name="eyeExpression"]', "happy");
    await page.selectOption('select[name="pose"]', "walking");
    await page.locator("#step").click();
    for (const sheet of ["views", "poses", "expressions", "scales", "hero"])
      await page.locator(`[data-sheet="${sheet}"]`).click();
    await page.getByLabel("Show joint hierarchy").check();
    await page.locator("#reset-pose").click();
    await page.setViewportSize({ width: 390, height: 844 });
    assert(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
      "Mobile horizontal overflow",
    );
    assert.deepEqual(errors, [], "Browser errors");
    assert.deepEqual(requests, [], "Unexpected asset or network requests");
    results.checks.push(
      "Interactive controls and narrow screen layout work without runtime errors or asset requests",
    );
    delete results.freshHashes;
    delete results.times;
    fs.writeFileSync(
      path.join(OUT, "checks.json"),
      JSON.stringify(results, null, 2) + "\n",
    );
    console.log(
      `${results.checks.length} checks passed; ${results.timing.p95.toFixed(1)}ms p95 render.\nReport: ${path.join(OUT, "checks.json")}`,
    );
  } finally {
    await browser.close();
  }
}
check().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
