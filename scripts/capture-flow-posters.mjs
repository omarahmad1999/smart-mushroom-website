// Refresh the still posters for the connected-system dioramas. Each path has two: the finished model, shown
// without JavaScript, where WebGL is unavailable and with motion reduced; and the model at its start, shown
// while the live model loads. Run against a dev or production server.
// Requires Chromium, Playwright and Pillow (also used by prepare_assets.py).
import { chromium } from '@playwright/test';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
const temporary = mkdtempSync(join(tmpdir(), 'flow-posters-'));
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium', args: ['--no-sandbox', '--enable-unsafe-swiftshader'] });
try {
  // PATHWAYS=record captures just one path.
  for (const pathway of (process.env.PATHWAYS || 'observe,respond,record').split(',')) {
    for (const [moment, [suffix, width, height, scale]] of ['done', 'start'].flatMap(moment => [['', 1440, 1000, 1.5], ['-narrow', 390, 844, 2]].map(size => [moment, size]))) {
      // Reduced motion shows the finished model; a stopped clock holds the playing model at its start.
      const page = await browser.newPage({ viewport: { width, height }, deviceScaleFactor: scale, reducedMotion: moment === 'done' ? 'reduce' : 'no-preference' });
      if (moment === 'start') { await page.clock.install(); await page.clock.pauseAt(new Date(Date.now() + 1000)); }
      // Headless Chromium renders WebGL in software, which the dioramas decline by default; allow it here.
      await page.addInitScript(() => {
        const getContext = HTMLCanvasElement.prototype.getContext;
        HTMLCanvasElement.prototype.getContext = function (type, options) { return getContext.call(this, type, options && { ...options, failIfMajorPerformanceCaveat: false }); };
      });
      await page.goto(`${process.env.BASE_URL || 'http://127.0.0.1:4322'}/#architecture`);
      // Each path's diorama loads when its tab opens.
      await page.locator(`[data-route="${pathway}"]`).evaluate(tab => tab.click());
      const flow = page.locator(`[data-system-flow="${pathway}"]`);
      // A plain scroll: Playwright's own waits for stable frames, which never come while the clock is stopped.
      await flow.evaluate(element => element.scrollIntoView({ block: 'center', behavior: 'instant' }));
      await page.locator(`[data-system-flow="${pathway}"][data-diorama-ready]`).waitFor({ timeout: 180000 });
      await page.evaluate(() => document.fonts.ready);
      await page.waitForTimeout(600);
      const name = `${pathway}-diorama${moment === 'start' ? '-start' : ''}${suffix}`, png = join(temporary, `${name}.png`);
      // The page's chapter bar can sit over the model when it is scrolled into view; leave it out of the still.
      await flow.locator('[data-diorama-viewport]').screenshot({ path: png, style: '.home-contents{visibility:hidden}' });
      execFileSync('python3', ['-c', 'from PIL import Image; import sys; Image.open(sys.argv[1]).convert("RGB").save(sys.argv[2],"WEBP",quality=86,method=6)', png, `public/media/flow/${name}.webp`]);
      await page.close();
    }
  }
} finally { await browser.close(); rmSync(temporary, { recursive: true, force: true }); }
