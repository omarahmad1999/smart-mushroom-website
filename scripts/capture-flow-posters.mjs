// Refresh the still posters for the connected-system dioramas (shown while the 3D model loads,
// without JavaScript, and where WebGL is unavailable). Run against a dev or production server.
// Requires Chromium, Playwright and Pillow (also used by prepare_assets.py).
import { chromium } from '@playwright/test';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
const temporary = mkdtempSync(join(tmpdir(), 'flow-posters-'));
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium', args: ['--no-sandbox', '--enable-unsafe-swiftshader'] });
try {
  for (const pathway of ['observe']) {
    for (const [suffix, width, height, scale] of [['', 1440, 1000, 1.5], ['-narrow', 390, 844, 2]]) {
      const page = await browser.newPage({ viewport: { width, height }, deviceScaleFactor: scale, reducedMotion: 'reduce' });
      // Headless Chromium renders WebGL in software, which the dioramas decline by default; allow it here.
      await page.addInitScript(() => {
        const getContext = HTMLCanvasElement.prototype.getContext;
        HTMLCanvasElement.prototype.getContext = function (type, options) { return getContext.call(this, type, options && { ...options, failIfMajorPerformanceCaveat: false }); };
      });
      await page.goto(`${process.env.BASE_URL || 'http://127.0.0.1:4322'}/#architecture`);
      const flow = page.locator(`[data-system-flow="${pathway}"]`);
      await flow.scrollIntoViewIfNeeded();
      await page.locator(`[data-system-flow="${pathway}"][data-diorama-ready]`).waitFor({ timeout: 90000 });
      await page.evaluate(() => document.fonts.ready);
      await page.waitForTimeout(600);
      const png = join(temporary, `${pathway}${suffix}.png`);
      await flow.locator('[data-diorama-viewport]').screenshot({ path: png });
      execFileSync('python3', ['-c', 'from PIL import Image; import sys; Image.open(sys.argv[1]).convert("RGB").save(sys.argv[2],"WEBP",quality=86,method=6)', png, `public/media/flow/${pathway}-diorama${suffix}.webp`]);
      await page.close();
    }
  }
} finally { await browser.close(); rmSync(temporary, { recursive: true, force: true }); }
