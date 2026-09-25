import {test,expect} from '@playwright/test';
test.setTimeout(90_000);
test('diagram sound defaults on, unlocks on interaction, and stops with pause and mute',async({page})=>{
  await page.addInitScript(()=>{
    const NativeAudio=window.Audio;
    const state={players:[] as HTMLAudioElement[],played:[] as string[]};
    Object.assign(window,{flowAudioTest:state});
    window.Audio=function(src?:string){
      const audio=new NativeAudio(src);
      if(src?.includes('/media/flow/')){
        state.players.push(audio);
        audio.addEventListener('playing',()=>{if(audio.volume>0)state.played.push(audio.src.split('/').pop()!);});
      }
      return audio;
    } as unknown as typeof Audio;
  });
  await page.goto('/#architecture');
  const button=page.getByRole('button',{name:'Diagram sound effects'});
  await expect(button).toHaveAttribute('aria-pressed','true');
  expect(await page.evaluate(()=>Reflect.get(window,'flowAudioTest').players.length)).toBe(0);
  await page.getByRole('tab',{name:/Observe/}).click();
  await expect(button).toHaveAttribute('aria-pressed','true');
  const observe=page.locator('[data-system-flow="observe"]');
  // The ink drawing waits until most of it is on screen before it plays.
  await observe.locator('[data-pathway-canvas]').scrollIntoViewIfNeeded();
  await expect(observe).toHaveAttribute('data-flow-state','complete',{timeout:20000});
  const played=await page.evaluate(()=>Reflect.get(window,'flowAudioTest').played);
  for(const name of ['node.mp3','travel.mp3','complete.mp3'])expect(played).toContain(name);
  expect(await page.evaluate(()=>Reflect.get(window,'flowAudioTest').players.every((audio:HTMLAudioElement)=>audio.readyState>=2&&audio.error===null))).toBe(true);
  await observe.locator('[data-pathway-replay]').click();
  await observe.locator('[data-pathway-pause]').click();
  await expect(observe).toHaveAttribute('data-flow-state','paused');
  expect(await page.evaluate(()=>Reflect.get(window,'flowAudioTest').players.every((audio:HTMLAudioElement)=>audio.paused))).toBe(true);
  await page.getByRole('tab',{name:/Respond/}).click();
  await expect(button).toHaveAttribute('aria-pressed','true');
  await button.click();
  await expect(button).toHaveAttribute('aria-pressed','false');
  expect(await page.evaluate(()=>Reflect.get(window,'flowAudioTest').players.every((audio:HTMLAudioElement)=>audio.paused))).toBe(true);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
});
test('reduced motion keeps sound disabled and does not load clips',async({page})=>{
  await page.emulateMedia({reducedMotion:'reduce'});
  const requests:string[]=[];page.on('request',request=>{if(request.url().includes('/media/flow/'))requests.push(request.url());});
  await page.goto('/#architecture');
  await expect(page.getByRole('button',{name:'Diagram sound effects'})).toBeDisabled();
  expect(requests).toEqual([]);
});
