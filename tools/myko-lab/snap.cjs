#!/usr/bin/env node
"use strict";
const fs = require("node:fs");
const path = require("node:path");
const { pathToFileURL } = require("node:url");
const { chromium } = require("@playwright/test");
const { build, OUT } = require("./build.cjs");
async function snap() {
  const html = build(),
    browser = await chromium.launch({
      headless: true,
      executablePath: process.env.CHROMIUM || "/usr/bin/chromium",
      args: ["--no-sandbox"],
    });
  try {
    const page = await browser.newPage({
      viewport: { width: 1500, height: 1100 },
      deviceScaleFactor: 1,
    });
    page.on("pageerror", (e) => {
      throw e;
    });
    await page.goto(pathToFileURL(html).href);
    for (const sheet of ["hero", "views", "poses", "expressions", "scales"]) {
      await page.evaluate((kind) => {
        const c = document.querySelector("canvas");
        if (kind === "hero") {
          c.width = 1200;
          c.height = 940;
          MykoTestScene.hero(c.getContext("2d"), 1200, 940, { facing: "left" });
        } else {
          [c.width, c.height] = MykoTestScene.sizes[kind];
          MykoTestScene.draw(c.getContext("2d"), kind);
        }
      }, sheet);
      const png = await page.evaluate(
        () =>
          document.querySelector("canvas").toDataURL("image/png").split(",")[1],
      );
      fs.writeFileSync(
        path.join(OUT, `${sheet}.png`),
        Buffer.from(png, "base64"),
      );
    }
    await page.reload();
    await page.screenshot({
      path: path.join(OUT, "workshop.png"),
      fullPage: true,
    });
    console.log(
      `Saved hero, views, poses, expressions, scales, workshop to ${OUT}`,
    );
  } finally {
    await browser.close();
  }
}
snap().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
