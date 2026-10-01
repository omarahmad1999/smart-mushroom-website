import {test as base,expect,type Page} from '@playwright/test';

// These machines render WebGL in software, which browsers refuse for the diorama; the tests of the live model allow it.
// Elsewhere Observe stays a poster, so other tests do not pay for the model.
const allowSoftware3d=()=>{
  const getContext=HTMLCanvasElement.prototype.getContext as (this:HTMLCanvasElement,type:string,options?:object)=>RenderingContext|null;
  HTMLCanvasElement.prototype.getContext=function(this:HTMLCanvasElement,type:string,options?:object){return getContext.call(this,type,options&&{...options,failIfMajorPerformanceCaveat:false});} as typeof HTMLCanvasElement.prototype.getContext;
};
const test=base.extend<{staticBoundary:void}>({
  staticBoundary:[async({page},use)=>{
    const errors:string[]=[],requests:string[]=[],sockets:string[]=[];
    page.on('pageerror',e=>errors.push(e.message));
    page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
    // No data calls: the only files fetched are the site's own media, such as the diorama's model.
    page.on('request',r=>{if(['fetch','xhr'].includes(r.resourceType())&&!new URL(r.url()).pathname.startsWith('/media/'))requests.push(r.url());});
    page.on('websocket',s=>{if(process.env.TEST_PRODUCTION)sockets.push(s.url());});
    await use();
    expect(errors).toEqual([]);expect(requests).toEqual([]);expect(sockets).toEqual([]);
  },{auto:true}],
});

test.setTimeout(60_000);
async function openClocked(page:Page,route='observe'){
  await page.clock.install({time:new Date('2026-09-06T00:00:00Z')});
  await page.clock.pauseAt(new Date('2026-09-06T00:00:01Z'));
  await page.goto('/#architecture');
  if(route!=='observe')await page.locator(`[data-route="${route}"]`).evaluate((button:HTMLButtonElement)=>button.click());
  const flow=page.locator(`[data-system-flow="${route}"]`);
  // Wait until the model is ready and knows it is on screen: it takes several seconds to set up with software
  // WebGL, and visibility arrives asynchronously, never during a paused-clock run. The page's smooth anchor scroll
  // can land after an instant scroll, so keep centring the model until it runs.
  for(let tries=0;tries<300;tries++){
    await flow.locator('[data-pathway-canvas]').evaluate(el=>el.scrollIntoView({block:'center',behavior:'instant'}));
    if(await flow.getAttribute('data-flow-state')==='running')break;
    await page.waitForTimeout(200);
  }
  await expect(flow).toHaveAttribute('data-flow-state','running');
  await page.clock.runFor(100);
  await flow.locator('[data-pathway-replay]').evaluate((button:HTMLButtonElement)=>button.click());
  return flow;
}
// The 3D diorama renders every simulated frame, which is slow without a GPU: jump the clock in
// 300 ms strides instead (one frame each, under GSAP's 500 ms lag threshold, so time still flows).
async function jump(page:Page,ms:number){for(let left=ms;left>0;left-=300)await page.clock.fastForward(Math.min(300,left));}
async function jumpToStage(page:Page,name:string,route='observe'){
  const flow=page.locator(`[data-system-flow="${route}"]`);
  for(let elapsed=0;elapsed<3000;elapsed+=300){if(await flow.getAttribute('data-flow-stage')===name)return;await page.clock.fastForward(300);}
  await expect(flow).toHaveAttribute('data-flow-stage',name);
}
// Each path is a 3D diorama: its labels, stages and caption are what a reader follows.
const litLabels=(flow:Diorama)=>flow.locator('[data-diorama-label]').evaluateAll(labels=>labels.filter(label=>(label as HTMLElement).dataset.state==='lit').map(label=>(label as HTMLElement).dataset.dioramaLabel!));
type Diorama=ReturnType<Page['locator']>;

test('the Observe diorama carries merged readings through every part and leaves a lit model',async({page})=>{
  test.setTimeout(120_000);
  await page.addInitScript(allowSoftware3d);
  const flow=await openClocked(page);
  await expect(flow).toHaveAttribute('data-flow-style','diorama');
  // The live model replaces the poster; the canvas is decorative and the steps stay in the text.
  await expect(flow.locator('canvas.diorama-canvas')).toHaveCount(1);
  await expect(flow.locator('canvas.diorama-canvas')).toHaveAttribute('aria-hidden','true');
  await expect(flow.locator('.diorama-poster')).toBeHidden();
  await expect(flow.locator('[data-diorama-label]')).toHaveCount(6);
  for(const name of ['SHT31','SCD41','Mosquitto','Database Writer','TimescaleDB','Grafana'])await expect(flow.locator('[data-diorama-label]').filter({hasText:name})).toBeVisible();
  expect(await litLabels(flow)).toEqual([]);
  await jump(page,400);
  expect((await litLabels(flow)).sort()).toEqual(['scd41','sht31']);
  await jumpToStage(page,'to-mqtt');
  await expect(flow.locator('[data-diorama-caption]')).toContainText('merge before Mosquitto');
  expect(await litLabels(flow)).not.toContain('mqtt');
  await jumpToStage(page,'mqtt');
  expect(await litLabels(flow)).toContain('mqtt');
  for(const part of ['writer','timescale','grafana']){await jumpToStage(page,part);expect(await litLabels(flow)).toContain(part);}
  // Grafana's chart draws before the path counts as complete.
  await jump(page,2400);
  await expect(flow).toHaveAttribute('data-flow-state','complete');
  expect((await litLabels(flow)).length).toBe(6);
  await expect(flow.locator('[data-diorama-caption]')).toHaveText('Grafana displays the stored measurements.');
  await expect(flow.locator('[data-pathway-status]')).toContainText('The Observe path is complete.');
  await expect(flow.locator('[data-pathway-pause]')).toBeDisabled();
  await jump(page,5000);
  await expect(flow).toHaveAttribute('data-flow-state','complete');
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
});

test('pause, replay, offscreen suspension and keyboard tabs keep the sequence under control',async({page})=>{
  test.setTimeout(120_000);
  await page.addInitScript(allowSoftware3d);
  const flow=await openClocked(page);
  const pause=flow.locator('[data-pathway-pause]');
  // Past the sensors filling, while both readings travel.
  await jump(page,2100);
  await pause.evaluate((button:HTMLButtonElement)=>button.click());
  await expect(flow).toHaveAttribute('data-flow-state','paused');
  const snapshot=async()=>({stage:await flow.getAttribute('data-flow-stage'),lit:await litLabels(flow),caption:await flow.locator('[data-diorama-caption]').textContent()});
  const before=await snapshot();
  expect(before.stage).toBe('to-mqtt');
  await jump(page,3000);expect(await snapshot()).toEqual(before);
  await pause.evaluate((button:HTMLButtonElement)=>button.click());
  await jump(page,2500);expect((await snapshot()).stage).not.toBe(before.stage);
  await page.evaluate(()=>window.scrollTo({top:document.documentElement.scrollHeight,behavior:'instant'}));await jump(page,100);
  await expect(flow).toHaveAttribute('data-flow-state','paused');
  const stage=await flow.getAttribute('data-flow-stage');await jump(page,3000);
  await expect(flow).toHaveAttribute('data-flow-stage',stage!);
  const tabs=page.getByRole('tablist',{name:'Explore a system pathway'}).getByRole('tab');
  await tabs.nth(0).focus();await page.keyboard.press('ArrowRight');
  await expect(page.locator('#architecture-panel-respond')).toBeVisible();
  await expect(page.locator('#architecture-panel-respond [data-diorama-label]')).toHaveCount(8);
  await page.keyboard.press('ArrowRight');
  await expect(page.locator('#architecture-panel-record')).toBeVisible();
  await expect(page.locator('#architecture-panel-record [data-diorama-label]')).toHaveCount(4);
  await page.keyboard.press('Home');
  for(let tries=0;tries<50&&await flow.getAttribute('data-flow-state')!=='running';tries++){await flow.locator('[data-pathway-canvas]').evaluate(el=>el.scrollIntoView({block:'center',behavior:'instant'}));await page.waitForTimeout(200);}
  await jump(page,450);
  // Returning to the tab replays the path from the start.
  await expect(flow).toHaveAttribute('data-flow-stage','sensors');
  expect(await litLabels(flow)).not.toContain('grafana');
  await jump(page,3000);
  await flow.locator('[data-pathway-replay]').evaluate((button:HTMLButtonElement)=>button.click());
  expect(await litLabels(flow)).toEqual([]);
  await jump(page,450);
  await expect(flow).toHaveAttribute('data-flow-stage','sensors');
  expect(await litLabels(flow)).toContain('sht31');
});

test('reduced motion shows the full explanation without travelling pulses',async({page})=>{
  test.setTimeout(120_000);
  await page.addInitScript(allowSoftware3d);
  await page.emulateMedia({reducedMotion:'reduce'});await page.goto('/#architecture');
  const flow=page.locator('[data-system-flow="observe"]');
  await flow.scrollIntoViewIfNeeded();
  // The baked model takes a while to set up with software WebGL.
  await expect(flow.locator('[data-pathway-status]')).toHaveText(/shown with motion reduced/,{timeout:60000});
  await expect(flow).toHaveAttribute('data-flow-state','static');
  await expect(flow.locator('[data-pathway-controls]')).toBeHidden();
  await expect(flow.getByRole('button',{name:/These readings also feed the controllers/})).toBeVisible();
  // The model is shown finished: every part lit and the completion in the caption.
  expect((await litLabels(flow)).length).toBe(6);
  await expect(flow.locator('[data-diorama-caption]')).toHaveText('Grafana displays the stored measurements.');
  await expect(flow.locator('[data-diorama-label="writer"]')).toContainText('Database Writer');
  // The handwritten cross-link hands the reader to the Respond pathway.
  await flow.getByRole('button',{name:/These readings also feed the controllers/}).click();
  const respondTab=page.getByRole('tab',{name:/Respond/});
  await expect(respondTab).toHaveAttribute('aria-selected','true');await expect(respondTab).toBeFocused();
  await expect(page.locator('#architecture-panel-respond')).toBeVisible();
  for(const [route,count,completion] of [['respond',8,'The actuator services drive ventilation, moisture and lighting in the tent.'],['record',4,'Selected photographs and completed timelapses form the visual record.']] as const) {
    await page.locator(`[data-route="${route}"]`).click();
    const pathway=page.locator(`[data-system-flow="${route}"]`);
    await expect(pathway.locator('[data-pathway-status]')).toHaveText(/shown with motion reduced/,{timeout:60000});
    await expect(pathway).toHaveAttribute('data-flow-state','static');
    await expect(pathway.locator('[data-pathway-controls]')).toBeHidden();
    expect((await litLabels(pathway)).length).toBe(count);
    await expect(pathway.locator('[data-diorama-caption]')).toHaveText(completion);
  }
});

for(const pathway of [
  {id:'respond',start:'inputs',parts:8,hops:[['controllers',['controllers']],['mqtt',['mqtt']],['actuators',['actuators']],['devices',['fan','humidifier','leds']]],completion:'The actuator services drive ventilation, moisture and lighting in the tent.'},
  {id:'record',start:'schedule',parts:4,hops:[['cameras',['cameras']],['storage',['storage']],['media',['media']]],completion:'Selected photographs and completed timelapses form the visual record.'},
])test(`${pathway.id} plays its diorama like Observe and suspends when another tab opens`,async({page})=>{
  test.setTimeout(150_000);
  await page.addInitScript(allowSoftware3d);
  const flow=await openClocked(page,pathway.id);
  await expect(flow).toHaveAttribute('data-flow-style','diorama');
  await expect(flow.locator('canvas.diorama-canvas')).toHaveCount(1);
  await expect(flow.locator('.diorama-poster')).toBeHidden();
  await expect(flow.locator('[data-diorama-label]')).toHaveCount(pathway.parts);
  expect(await litLabels(flow)).toEqual([]);
  await jump(page,400);
  expect(await litLabels(flow)).toContain(pathway.start);
  for(const [hop,arrivals] of pathway.hops as [string,string[]][]){
    await jumpToStage(page,`to-${hop}`,pathway.id);
    for(const arrival of arrivals)expect(await litLabels(flow)).not.toContain(arrival);
    // Home Assistant wakes just before its manual command sets off with the controllers' commands.
    if(hop==='mqtt')expect(await litLabels(flow)).toContain('ha');
    await jumpToStage(page,hop,pathway.id);
    // The actuator services drive all three devices at once.
    for(const arrival of arrivals)expect(await litLabels(flow)).toContain(arrival);
  }
  // The last parts finish their own motion (the mist, the timelapse) before the path is complete.
  await jump(page,3600);
  await expect(flow).toHaveAttribute('data-flow-state','complete');
  expect((await litLabels(flow)).length).toBe(pathway.parts);
  await expect(flow.locator('[data-diorama-caption]')).toHaveText(pathway.completion);
  // Another tab takes over: this path waits, then replays from the start when its tab returns.
  await flow.locator('[data-pathway-replay]').evaluate((button:HTMLButtonElement)=>button.click());
  await jump(page,1200);
  await page.locator('[data-route="observe"]').evaluate((button:HTMLButtonElement)=>button.click());
  await expect(flow).not.toHaveAttribute('data-flow-state','running');
  const stage=await flow.getAttribute('data-flow-stage');
  await jump(page,1500);
  await expect(flow).toHaveAttribute('data-flow-stage',stage!);
  await page.locator(`[data-route="${pathway.id}"]`).evaluate((button:HTMLButtonElement)=>button.click());
  await expect(flow).toHaveAttribute('data-flow-stage',pathway.start);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
});

test.describe('without JavaScript',()=>{
  test.use({javaScriptEnabled:false});
  test('all three sections and their posters remain readable',async({page})=>{
    await page.goto('/#architecture');
    for(const id of ['observe','respond','record'])await expect(page.locator(`#architecture-panel-${id}`)).toBeVisible();
    // Without JavaScript each model is its finished poster, with its steps in the text.
    const poster=page.locator('[data-system-flow="observe"] .diorama-poster img');
    // The page's own anchor scroll brings the section into view, which also loads the lazy poster.
    await expect(poster).toBeVisible();
    await expect(poster).toHaveAttribute('alt',/Mosquitto.*Grafana/);
    await expect.poll(()=>poster.evaluate((image:HTMLImageElement)=>image.naturalWidth)).toBeGreaterThan(0);
    await expect(page.locator('[data-system-flow="observe"] ol')).toContainText('Grafana visualizes the stored measurements');
    for(const link of await page.locator('[data-flow-goto]').all())await expect(link).toBeHidden();
    for(const [route,names,step] of [['respond',['Controllers','Mosquitto','Home Assistant','Actuator Services','Fan','Humidifier','LEDs'],'drive the fan, humidifier and LEDs'],['record',['Capture Schedule','Two Cameras','Image Storage','Media Preparation'],'produces completed timelapses']] as const) {
      const image=page.locator(`[data-system-flow="${route}"] .diorama-poster img`);
      await image.scrollIntoViewIfNeeded();
      await expect(image).toBeVisible();
      for(const name of names)expect(await image.getAttribute('alt')).toContain(name);
      await expect.poll(()=>image.evaluate((element:HTMLImageElement)=>element.naturalWidth)).toBeGreaterThan(0);
      await expect(page.locator(`[data-system-flow="${route}"] ol`)).toContainText(step);
    }
    for(const control of await page.locator('[data-pathway-controls]').all())await expect(control).toBeHidden();
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
  });
});
