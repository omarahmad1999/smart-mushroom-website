import {test,expect,type Page} from '@playwright/test';
test.setTimeout(90_000);

// The diagrams synthesize their sounds and announce each one, so the tests follow what plays, and the audio
// contexts the page opens, without speakers.
// These machines render WebGL in software, which browsers refuse for the diorama; allow it so the live model is tested.
const allowSoftware3d=()=>{
  const getContext=HTMLCanvasElement.prototype.getContext as (this:HTMLCanvasElement,type:string,options?:object)=>RenderingContext|null;
  HTMLCanvasElement.prototype.getContext=function(this:HTMLCanvasElement,type:string,options?:object){return getContext.call(this,type,options&&{...options,failIfMajorPerformanceCaveat:false});} as typeof HTMLCanvasElement.prototype.getContext;
};
async function listen(page:Page){
  await page.addInitScript(allowSoftware3d);
  await page.addInitScript(()=>{
    const state={contexts:[] as AudioContext[],played:[] as string[],stopped:[] as string[]};
    Object.assign(window,{flowAudioTest:state});
    const NativeContext=window.AudioContext;
    window.AudioContext=class extends NativeContext{constructor(options?:AudioContextOptions){super(options);state.contexts.push(this);}};
    document.addEventListener('flow-sound',event=>state.played.push((event as CustomEvent).detail.voice));
    document.addEventListener('flow-sound-stop',event=>state.stopped.push((event as CustomEvent).detail.owner));
  });
}
const heard=(page:Page)=>page.evaluate(()=>{
  const state=Reflect.get(window,'flowAudioTest');
  return{contexts:state.contexts.map((context:AudioContext)=>context.state) as string[],played:[...state.played] as string[],stopped:[...state.stopped] as string[]};
});
async function until(page:Page,check:()=>Promise<boolean>){
  for(let waited=0;waited<10000;waited+=200){if(await check())return true;await page.waitForTimeout(200);}
  return false;
}

test('diagram sound defaults on, starts on interaction, and stops with pause and mute',async({page})=>{
  await listen(page);
  await page.goto('/#architecture');
  const button=page.getByRole('button',{name:'Diagram sound effects'});
  await expect(button).toHaveAttribute('aria-pressed','true');
  await expect(button).toContainText('Sound on');
  // Nothing starts before the visitor interacts.
  expect((await heard(page)).contexts).toEqual([]);
  await page.getByRole('tab',{name:/Observe/}).click();
  expect(await until(page,async()=>(await heard(page)).contexts[0]==='running')).toBe(true);
  const observe=page.locator('[data-system-flow="observe"]');
  // The ink drawing waits until most of it is on screen before it plays.
  await observe.locator('[data-pathway-canvas]').scrollIntoViewIfNeeded();
  await expect(observe).toHaveAttribute('data-flow-state','complete',{timeout:20000});
  // Light rushes through the tubes, each part answers with a glassy tap, the two readings merge with a gulp,
  // and each part makes the sound of its own action: the sensors filling, the gate, the writer's pencil, the
  // database's chime and Grafana's screen.
  const played=(await heard(page)).played;
  for(const voice of ['pen','tap','gulp','gate','scribble','fill','chime','screen'])expect(played).toContain(voice);
  expect((await heard(page)).contexts).toHaveLength(1);
  await observe.locator('[data-pathway-replay]').click();
  await observe.locator('[data-pathway-pause]').click();
  await expect(observe).toHaveAttribute('data-flow-state','paused');
  expect((await heard(page)).stopped).toContain('observe');
  // Nothing new sounds while the drawing is paused.
  const paused=(await heard(page)).played.length;
  await page.waitForTimeout(1500);
  expect((await heard(page)).played).toHaveLength(paused);
  await page.getByRole('tab',{name:/Respond/}).click();
  await expect(button).toHaveAttribute('aria-pressed','true');
  await button.click();
  await expect(button).toHaveAttribute('aria-pressed','false');
  // Muting fades everything out, then rests the audio altogether.
  expect((await heard(page)).stopped).toContain('all');
  expect(await until(page,async()=>(await heard(page)).contexts[0]==='suspended')).toBe(true);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
});

test('a visitor who mutes the diagrams stays muted on the next visit',async({page})=>{
  await listen(page);
  await page.goto('/#architecture');
  const button=page.getByRole('button',{name:'Diagram sound effects'});
  await button.click();
  await expect(button).toHaveAttribute('aria-pressed','false');
  await page.reload();
  await expect(button).toHaveAttribute('aria-pressed','false');
  await expect(button).toContainText('Sound off');
  await page.getByRole('tab',{name:/Respond/}).click();
  await page.waitForTimeout(500);
  expect((await heard(page)).contexts).toEqual([]);
  // Turning sound back on starts it straight away, and that choice is remembered too.
  await button.click();
  await expect(button).toHaveAttribute('aria-pressed','true');
  expect(await until(page,async()=>(await heard(page)).contexts[0]==='running')).toBe(true);
  await page.reload();
  await expect(button).toHaveAttribute('aria-pressed','true');
});

test('reduced motion keeps sound disabled and never starts audio',async({page})=>{
  await page.emulateMedia({reducedMotion:'reduce'});
  await listen(page);
  await page.goto('/#architecture');
  await expect(page.getByRole('button',{name:'Diagram sound effects'})).toBeDisabled();
  await page.getByRole('tab',{name:/Respond/}).click();
  await page.waitForTimeout(300);
  expect((await heard(page)).contexts).toEqual([]);
});

test('every diagram sound is audible, balanced and never clips',async({page})=>{
  test.skip(!!process.env.TEST_PRODUCTION,'Renders the sound module from the development server.');
  await page.goto('/sound-check');
  const voices=['rush','tap','gulp','gate','fill','chime','scribble','tilt','toggle','screen','spin','mist','glow','tick','shutter','stack','film','click'];
  const levels=await page.evaluate(async voices=>{
    const path='/src/scripts/flow-sounds.ts';
    const {renderSound}=await import(/* @vite-ignore */ path);
    const result:Record<string,{peak:number;heard:number}>={};
    for(const voice of voices){
      const rendered:AudioBuffer=await renderSound(voice);
      const left=rendered.getChannelData(0),right=rendered.getChannelData(1),size=Math.round(rendered.sampleRate*.05);
      // Loudness of the loudest 50 ms, after a 300 Hz high-pass: low thumps sound quieter than their level.
      const a=1/(1+2*Math.PI*300/rendered.sampleRate),weighted=new Float32Array(left.length);
      let peak=0,heard=0;
      for(let i=1;i<left.length;i++){weighted[i]=a*(weighted[i-1]+(left[i]+right[i]-left[i-1]-right[i-1])/2);peak=Math.max(peak,Math.abs(left[i]),Math.abs(right[i]));}
      for(let start=0;start+size<=left.length;start+=Math.floor(size/2)){let sum=0;for(let i=start;i<start+size;i++)sum+=weighted[i]**2;heard=Math.max(heard,Math.sqrt(sum/size));}
      result[voice]={peak,heard};
    }
    return result;
  },voices);
  for(const voice of voices){
    expect(levels[voice].peak,voice).toBeLessThan(.6);
    expect(levels[voice].heard,voice).toBeGreaterThan(.01);
  }
  // The whole palette sits within about 12 dB, so no sound jumps out or disappears.
  const loudness=voices.map(voice=>levels[voice].heard);
  expect(Math.max(...loudness)/Math.min(...loudness)).toBeLessThan(4);
});
