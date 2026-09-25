import {test,expect} from '@playwright/test';
test.setTimeout(180_000);
test.use({reducedMotion:'reduce',launchOptions:{executablePath:'/usr/bin/chromium',args:['--no-sandbox','--enable-unsafe-swiftshader']}});
test('fan, humidifier and LED stay active together through exploration and play their sounds',async({page})=>{
  await page.addInitScript(()=>{
    const Original=window.Audio;
    const sounds: {audio:HTMLAudioElement;plays:number}[]=[];
    Object.assign(window,{deviceAudio:sounds});
    window.Audio=function(src?:string){const audio=new Original(src);const record={audio,plays:0};sounds.push(record);audio.addEventListener('playing',()=>record.plays++);return audio;} as unknown as typeof Audio;
  });
  await page.goto('/#material-study');
  const section=page.locator('#material-study');
  await expect(section).toHaveAttribute('data-study-state','ready',{timeout:45000});
  await section.locator('.ms-exploration summary').click();
  const action=section.locator('[data-study-action]');
  const choose=async(id:string)=>{await section.locator(`[data-study-select="${id}"]`).click();};
  for(const [id,name] of [['fan','fan'],['humidity','mist'],['light','light']]){
    await choose(id);
    // Activation restores its framing even after the visitor manually zooms.
    await section.locator('[data-study-zoom="in"]').click();
    await action.click();
    const mobile=await section.locator('[data-study-viewport]').evaluate(el=>el.clientWidth<700);
    // The lighting demonstration frames the lit tent rather than the whole setup.
    const zoom=id==='light'?(mobile?1.75:1.3):id==='humidity'?(mobile?1.7:1.35):3.5*(mobile?1.2:1);
    await expect(section).toHaveAttribute('data-study-view',new RegExp(`,${zoom.toFixed(2).replace('.', '\\.')}$`));
    await expect(section).toHaveAttribute(`data-study-${name}-active`,'true');
  }
  await expect(section).toHaveAttribute('data-study-lighting','tent');
  await expect.poll(()=>page.evaluate(()=>Reflect.get(window,'deviceAudio').find((r:any)=>r.audio.src.endsWith('light-switch.mp3'))?.plays??0)).toBeGreaterThan(0);
  await section.locator('[data-study-close]').click();
  await section.locator('[data-study-region="overview"]').click();
  const viewport=section.locator('[data-study-viewport]');await viewport.scrollIntoViewIfNeeded();
  const loops=()=>page.evaluate(()=>Reflect.get(window,'deviceAudio').filter((r:any)=>r.audio.loop).map((r:any)=>({paused:r.audio.paused,duration:r.audio.duration})));
  await expect.poll(async()=>{const state=await loops();return state.length===2&&state.every((r:any)=>!r.paused);}).toBe(true);
  const canvas=viewport.locator('canvas');await canvas.focus();await page.keyboard.press('ArrowLeft');await section.locator('[data-study-zoom="in"]').click();
  await choose('sensor');
  for(const name of ['fan','mist','light'])await expect(section).toHaveAttribute(`data-study-${name}-active`,'true');
  for(const id of ['fan','humidity','light'])await expect(section.locator(`[data-study-hotspot="${id}"]`)).toHaveAttribute('data-device-active','true');
  await choose('fan');await action.click();
  await expect(section).toHaveAttribute('data-study-fan-active','false');
  await expect(section).toHaveAttribute('data-study-mist-active','true');
  await expect(section).toHaveAttribute('data-study-lighting','tent');
  await choose('light');
  const beforeOff=await section.getAttribute('data-study-view');
  await action.click();
  await expect(section).toHaveAttribute('data-study-view',beforeOff!);
  await expect(section).toHaveAttribute('data-study-lighting','day');
  await expect(section).toHaveAttribute('data-study-mist-active','true');
  await expect.poll(()=>page.evaluate(()=>Reflect.get(window,'deviceAudio').find((r:any)=>r.audio.src.endsWith('light-switch.mp3'))?.plays??0)).toBeGreaterThanOrEqual(2);
  await choose('humidity');await action.click();
  await expect(section).toHaveAttribute('data-study-demo','none');
});
