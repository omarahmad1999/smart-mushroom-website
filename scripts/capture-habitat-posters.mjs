// Refresh the static loading/no-WebGL previews from a running production build.
// Requires Chromium, Playwright and Pillow (also used by prepare_assets.py).
import { chromium } from '@playwright/test';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
const temporary=mkdtempSync(join(tmpdir(),'habitat-posters-'));
const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',args:['--no-sandbox','--enable-unsafe-swiftshader']});
try {
  for(const [name,width,height] of [['full-habitat-poster',1440,1000],['full-habitat-poster-mobile',390,844]]){
    const page=await browser.newPage({viewport:{width,height},deviceScaleFactor:1,reducedMotion:'reduce'});
    await page.goto(`${process.env.BASE_URL||'http://127.0.0.1:4322'}/#material-study`);
    await page.locator('[data-study-state="ready"]').waitFor({timeout:90000});
    await page.evaluate(()=>document.fonts.ready);
    const png=join(temporary,`${name}.png`);
    await page.locator('[data-study-viewport]').screenshot({path:png});
    execFileSync('python3',['-c','from PIL import Image; import sys; Image.open(sys.argv[1]).convert("RGB").save(sys.argv[2],"WEBP",quality=90)',png,`public/media/${name}.webp`]);
    await page.close();
  }
} finally {await browser.close();rmSync(temporary,{recursive:true,force:true});}
