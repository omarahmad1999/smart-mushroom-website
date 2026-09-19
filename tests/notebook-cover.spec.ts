import {test,expect} from '@playwright/test';

test('illustrated cover plays, pauses, opens and preserves notebook geometry',async({page},info)=>{
  await page.addInitScript(()=>{
    const Original=window.Audio;const sounds:{audio:HTMLAudioElement;plays:number}[]=[];Object.assign(window,{notebookAudio:sounds});
    window.Audio=function(src?:string){const audio=new Original(src);const record={audio,plays:0};sounds.push(record);audio.addEventListener('playing',()=>record.plays++);return audio;} as unknown as typeof Audio;
  });
  await page.goto('/documentation/');
  const book=page.locator('[data-notebook]'),cover=book.locator('[data-nb-cover]'),video=cover.locator('video');
  await expect(cover).toBeVisible();await cover.scrollIntoViewIfNeeded();
  await expect.poll(()=>video.evaluate(v=>(v as HTMLVideoElement).currentTime)).toBeGreaterThan(.1);
  const geometry=await book.locator('[data-nb-binding]').boundingBox();
  const closed=await cover.boundingBox();
  if(info.project.name==='desktop'){
    expect(closed!.width).toBeCloseTo(geometry!.width/2,1);
    expect(closed!.x+closed!.width/2).toBeCloseTo(geometry!.x+geometry!.width/2,1);
  }
  await expect(book.locator('.nb-tabs')).toBeHidden();
  await cover.getByRole('button',{name:'Pause cover animation'}).click();
  await expect(video).toHaveJSProperty('paused',true);
  await cover.getByRole('button',{name:'Play cover animation'}).click();
  await expect(video).toHaveJSProperty('paused',false);
  await cover.getByRole('button',{name:'Open the notebook'}).click();
  await expect.poll(()=>page.evaluate(()=>Reflect.get(window,'notebookAudio').find((item:any)=>item.audio.src.endsWith('paper-swipe.mp3'))?.plays??0)).toBeGreaterThan(0);
  await expect(cover).toBeHidden();await expect(video).toHaveJSProperty('paused',true);
  const opened=await book.locator('[data-nb-binding]').boundingBox();
  for(const key of ['x','width','height'] as const)expect(opened![key]).toBeCloseTo(geometry![key],1);
  await expect(book.locator('[data-nb-page="0"] .nb-photo img')).toHaveAttribute('src','/media/photo-incubation-2026-08-19.webp');
  await book.getByRole('button',{name:'View cover'}).click();await expect(cover).toBeVisible();
  await book.getByRole('button',{name:'Skip to pages'}).click();
  await book.locator('.nb-tabs').getByRole('link',{name:'02 The Build'}).click();await expect(cover).toBeHidden();
});

test('reduced motion keeps the cover still and deep links open the requested pages',async({page})=>{
  await page.emulateMedia({reducedMotion:'reduce'});await page.goto('/documentation/');
  const cover=page.locator('[data-nb-cover]');await cover.scrollIntoViewIfNeeded();
  await expect(cover.locator('video')).toHaveJSProperty('paused',true);
  await expect(cover.locator('video')).toHaveJSProperty('currentTime',0);
  await expect(cover.locator('[data-nb-cover-pause]')).toBeHidden();
  await page.goto('/documentation/#journey-pvc-pipes');await expect(cover).toBeHidden();
  await expect(page.locator('[data-nb-status]')).toContainText('The Journey');
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
});
