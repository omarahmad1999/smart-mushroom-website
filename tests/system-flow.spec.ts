import {test as base,expect,type Page} from '@playwright/test';

const test=base.extend<{staticBoundary:void}>({
  staticBoundary:[async({page},use)=>{
    const errors:string[]=[],requests:string[]=[],sockets:string[]=[];
    page.on('pageerror',e=>errors.push(e.message));
    page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
    page.on('request',r=>{if(['fetch','xhr'].includes(r.resourceType()))requests.push(r.url());});
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
  // Wait until the drawing is ready and knows it is on screen: the ink drawing measures its handwriting once the
  // font has loaded, and visibility arrives asynchronously, never during a paused-clock run. The page's smooth
  // anchor scroll can land after an instant scroll, so keep centring the drawing until it runs.
  for(let tries=0;tries<50;tries++){
    await flow.locator('[data-pathway-canvas]').evaluate(el=>el.scrollIntoView({block:'center',behavior:'instant'}));
    if(await flow.getAttribute('data-flow-state')==='running')break;
    await page.waitForTimeout(200);
  }
  await expect(flow).toHaveAttribute('data-flow-state','running');
  await page.clock.runFor(100);
  await flow.locator('[data-pathway-replay]').evaluate((button:HTMLButtonElement)=>button.click());
  return flow;
}
async function reachStage(page:Page,name:string,route='observe') {
  const flow=page.locator(`[data-system-flow="${route}"]`);
  // Three frames per step keeps the stage checks precise enough while halving the round trips on a slow machine.
  for(let elapsed=0;elapsed<3000;elapsed+=48) {
    if(await flow.getAttribute('data-flow-stage')===name)return;
    await page.clock.runFor(48);
  }
  await expect(flow).toHaveAttribute('data-flow-stage',name);
}
type Diagram=ReturnType<Page['locator']>;
const trailOffsets=(diagram:Diagram)=>diagram.locator('[data-ink-trail]').evaluateAll(paths=>paths.map(path=>parseFloat(getComputedStyle(path).strokeDashoffset)));
const written=(diagram:Diagram,note='')=>diagram.locator(`[data-ink-note-reveal^="${note}"]`).evaluateAll(rects=>rects.map(rect=>Number(rect.getAttribute('width'))/Number((rect as SVGElement).dataset.width)));
const states=(diagram:Diagram)=>diagram.locator('[data-ink-node]').evaluateAll(nodes=>Object.fromEntries(nodes.map(node=>[(node as SVGElement).dataset.inkNode!,(node as SVGElement).dataset.state!])));
// Each moving drop sits exactly at the inked end of its own route.
const heads=(diagram:Diagram,ids:string[])=>diagram.evaluate((svg,ids)=>ids.map(id=>{
  const trail=svg.querySelector<SVGPathElement>(`[data-ink-trail="${id}"]`)!,drop=svg.querySelector<SVGGElement>(`[data-ink-drop="${id}"]`)!;
  const progress=1-parseFloat(getComputedStyle(trail).strokeDashoffset)/1.03,point=trail.getPointAtLength(progress*trail.getTotalLength());
  const [x,y]=drop.getAttribute('transform')!.match(/translate\(([-\d.]+) ([-\d.]+)\)/)!.slice(1).map(Number);
  return{progress,gap:Math.hypot(point.x-x,point.y-y)};
}),ids);
const moving=(diagram:Diagram)=>diagram.locator('[data-ink-drop]').evaluateAll(drops=>drops.filter(drop=>getComputedStyle(drop).visibility==='visible').map(drop=>(drop as SVGElement).dataset.inkDrop!));

test('the Observe ink drawing carries merged readings through every part and leaves a complete page',async({page})=>{
  const flow=await openClocked(page);
  const started=await page.evaluate(()=>performance.now());
  const diagram=flow.locator('.ink-diagram:visible');
  await expect(flow).toHaveAttribute('data-flow-style','ink');
  await expect(diagram.locator('[data-ink-node]')).toHaveCount(6);
  // Nothing is inked before the readings leave the sensors.
  expect(Object.values(await states(diagram)).every(state=>state==='pencil')).toBe(true);
  expect((await trailOffsets(diagram)).every(offset=>offset>1)).toBe(true);
  expect((await written(diagram)).every(value=>value===0)).toBe(true);
  // Both sensor routes end exactly where the merged route to Mosquitto begins.
  const ends=await diagram.locator('[data-ink-route="sht31"],[data-ink-route="scd41"],[data-ink-route="merged"]').evaluateAll(paths=>paths.map((element,index)=>{const path=element as SVGPathElement,point=path.getPointAtLength(index===2?0:path.getTotalLength());return[Math.round(point.x),Math.round(point.y)];}));
  expect(ends[0]).toEqual(ends[2]);expect(ends[1]).toEqual(ends[2]);
  await page.clock.runFor(400);
  expect((await states(diagram)).sht31).toBe('ink');expect((await states(diagram)).mqtt).toBe('pencil');
  await reachStage(page,'to-mqtt');await page.clock.runFor(250);
  // The two drops travel together, and each route is inked exactly up to its drop.
  const heads=await diagram.evaluate(svg=>['sht31','scd41'].map(id=>{
    const trail=svg.querySelector<SVGPathElement>(`[data-ink-trail="${id}"]`)!,drop=svg.querySelector<SVGGElement>(`[data-ink-drop="${id}"]`)!;
    const progress=1-parseFloat(getComputedStyle(trail).strokeDashoffset)/1.03,point=trail.getPointAtLength(progress*trail.getTotalLength());
    const [x,y]=drop.getAttribute('transform')!.match(/translate\(([-\d.]+) ([-\d.]+)\)/)!.slice(1).map(Number);
    return{progress,gap:Math.hypot(point.x-x,point.y-y),visibility:getComputedStyle(drop).visibility};
  }));
  for(const head of heads){expect(head.progress).toBeGreaterThan(.05);expect(head.progress).toBeLessThan(1);expect(head.gap).toBeLessThan(1.5);expect(head.visibility).toBe('visible');}
  expect(heads[0].progress).toBeCloseTo(heads[1].progress,4);
  const readings=await written(diagram,'readings-');
  expect(readings[0]).toBeGreaterThan(0);expect(readings[0]).toBeLessThan(1);
  await reachStage(page,'mqtt');
  expect((await states(diagram)).mqtt).toBe('ink');
  await page.clock.runFor(500);
  expect(Number(await diagram.locator('[data-ink-stamp]').evaluate(stamp=>getComputedStyle(stamp).opacity))).toBeGreaterThan(.5);
  for(const part of ['writer','timescale','grafana']){await reachStage(page,part);expect((await states(diagram))[part]).toBe('ink');}
  await page.clock.runFor(1600);
  await expect(flow).toHaveAttribute('data-flow-state','complete');
  expect(await page.evaluate(()=>performance.now())-started).toBeLessThan(9000);
  // The finished page keeps every route inked and every note written; the last part is circled in olive.
  expect((await trailOffsets(diagram)).every(offset=>offset===0)).toBe(true);
  for(const value of await written(diagram))expect(value).toBeCloseTo(1,3);
  expect(Object.values(await states(diagram)).every(state=>state==='ink')).toBe(true);
  expect(await diagram.locator('[data-ink-drop]').evaluateAll(drops=>drops.every(drop=>getComputedStyle(drop).visibility==='hidden'))).toBe(true);
  await expect(diagram.locator('[data-ink-node="grafana"] .ink-name')).toHaveCSS('fill','rgb(79, 90, 60)');
  expect(await diagram.locator('[data-ink-loop]').evaluate(loop=>parseFloat(getComputedStyle(loop).strokeDashoffset))).toBe(0);
  await expect(flow.locator('[data-pathway-pause]')).toBeDisabled();
  await page.clock.runFor(5000);
  await expect(flow).toHaveAttribute('data-flow-state','complete');
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
});

test('pause, replay, offscreen suspension and keyboard tabs keep the sequence under control',async({page})=>{
  const flow=await openClocked(page);
  const diagram=flow.locator('.ink-diagram:visible');
  const pause=flow.locator('[data-pathway-pause]');
  await page.clock.runFor(1300);
  await pause.evaluate((button:HTMLButtonElement)=>button.click());
  await expect(flow).toHaveAttribute('data-flow-state','paused');
  const snapshot=()=>diagram.evaluate(svg=>({trail:getComputedStyle(svg.querySelector('[data-ink-trail="sht31"]')!).strokeDashoffset,drop:svg.querySelector('[data-ink-drop="sht31"]')!.getAttribute('transform'),note:svg.querySelector('[data-ink-note-reveal="readings-0"]')!.getAttribute('width')}));
  const before=await snapshot();
  expect(parseFloat(before.trail)).toBeLessThan(1);expect(parseFloat(before.trail)).toBeGreaterThan(0);
  await page.clock.runFor(3000);expect(await snapshot()).toEqual(before);
  await pause.evaluate((button:HTMLButtonElement)=>button.click());
  await page.clock.runFor(400);expect(await snapshot()).not.toEqual(before);
  await page.evaluate(()=>window.scrollTo({top:document.documentElement.scrollHeight,behavior:'instant'}));await page.clock.runFor(100);
  await expect(flow).toHaveAttribute('data-flow-state','paused');
  const stage=await flow.getAttribute('data-flow-stage');await page.clock.runFor(3000);
  await expect(flow).toHaveAttribute('data-flow-stage',stage!);
  const tabs=page.getByRole('tablist',{name:'Explore a system pathway'}).getByRole('tab');
  await tabs.nth(0).focus();await page.keyboard.press('ArrowRight');
  await expect(page.locator('#architecture-panel-respond')).toBeVisible();
  await expect(page.locator('#architecture-panel-respond .ink-diagram:visible [data-ink-node]')).toHaveCount(8);
  await page.keyboard.press('ArrowRight');
  await expect(page.locator('#architecture-panel-record')).toBeVisible();
  await expect(page.locator('#architecture-panel-record .ink-diagram:visible [data-ink-node]')).toHaveCount(4);
  await page.keyboard.press('Home');
  for(let tries=0;tries<50&&await flow.getAttribute('data-flow-state')!=='running';tries++){await flow.locator('[data-pathway-canvas]').evaluate(el=>el.scrollIntoView({block:'center',behavior:'instant'}));await page.waitForTimeout(200);}
  await page.clock.runFor(450);
  await expect(flow).toHaveAttribute('data-flow-stage','sensors');
  expect((await written(diagram,'visualized-')).every(value=>value===0)).toBe(true);
  await page.clock.runFor(3000);
  await flow.locator('[data-pathway-replay]').evaluate((button:HTMLButtonElement)=>button.click());
  expect(Object.values(await states(diagram)).every(state=>state==='pencil')).toBe(true);
  await page.clock.runFor(450);
  await expect(flow).toHaveAttribute('data-flow-stage','sensors');
  expect((await states(diagram)).sht31).toBe('ink');
});

test('reduced motion shows the full explanation without travelling pulses',async({page})=>{
  await page.emulateMedia({reducedMotion:'reduce'});await page.goto('/#architecture');
  const flow=page.locator('[data-system-flow="observe"]');
  await expect(flow.locator('[data-pathway-status]')).toHaveText(/shown with motion reduced/);
  await expect(flow).toHaveAttribute('data-flow-state','static');
  await expect(flow.locator('[data-pathway-controls]')).toBeHidden();
  await expect(flow.getByRole('button',{name:/These readings also feed the controllers/})).toBeVisible();
  const diagram=flow.locator('.ink-diagram:visible');
  expect((await trailOffsets(diagram)).every(offset=>offset===0)).toBe(true);
  for(const value of await written(diagram))expect(value).toBeCloseTo(1,3);
  expect(Object.values(await states(diagram)).every(state=>state==='ink')).toBe(true);
  expect(await diagram.locator('[data-ink-drop]').evaluateAll(drops=>drops.every(drop=>getComputedStyle(drop).visibility==='hidden'))).toBe(true);
  for(const [id,expected] of Object.entries({readings:'send readings',published:'carries published measurements',stored:'stores measurements',visualized:'visualizes stored measurements'})) {
    expect((await diagram.locator(`[data-ink-note="${id}"] text`).allTextContents()).join(' ')).toBe(expected);
  }
  await expect(diagram.locator('[data-ink-node="writer"] .ink-name')).toHaveText('Database writer');
  // The handwritten cross-link hands the reader to the Respond pathway.
  await flow.getByRole('button',{name:/These readings also feed the controllers/}).click();
  const respondTab=page.getByRole('tab',{name:/Respond/});
  await expect(respondTab).toHaveAttribute('aria-selected','true');await expect(respondTab).toBeFocused();
  await expect(page.locator('#architecture-panel-respond')).toBeVisible();
  for(const [route,count,part] of [['respond',8,'Humidifier'],['record',4,'Media preparation']] as const) {
    await page.locator(`[data-route="${route}"]`).click();
    const pathway=page.locator(`[data-system-flow="${route}"]`),drawing=pathway.locator('.ink-diagram:visible');
    await expect(pathway.locator('[data-pathway-status]')).toHaveText(/shown with motion reduced/);
    await expect(pathway).toHaveAttribute('data-flow-state','static');
    await expect(pathway.locator('[data-pathway-controls]')).toBeHidden();
    await expect(drawing.locator('[data-ink-node]')).toHaveCount(count);
    expect((await trailOffsets(drawing)).every(offset=>offset===0)).toBe(true);
    for(const value of await written(drawing))expect(value).toBeCloseTo(1,3);
    expect(Object.values(await states(drawing)).every(state=>state==='ink')).toBe(true);
    await expect(drawing.locator('.ink-name').filter({hasText:part})).toBeVisible();
  }
});

for(const pathway of [
  {id:'respond',start:'inputs',parts:8,hops:[['controllers',['controllers']],['mqtt',['mqtt']],['actuators',['actuators']],['devices',['fan','humidifier','leds']]],finals:['fan','humidifier','leds']},
  {id:'record',start:'schedule',parts:4,hops:[['cameras',['cameras']],['storage',['storage']],['media',['media']]],finals:['media']},
])test(`${pathway.id} inks its path like Observe and suspends when another tab opens`,async({page})=>{
  // The longest simulated run in the suite; the Pi needs more than the default budget to step through it.
  test.setTimeout(90_000);
  const flow=await openClocked(page,pathway.id);
  const diagram=flow.locator('.ink-diagram:visible');
  await expect(diagram.locator('[data-ink-node]')).toHaveCount(pathway.parts);
  expect(Object.values(await states(diagram)).every(state=>state==='pencil')).toBe(true);
  expect((await trailOffsets(diagram)).every(offset=>offset>1)).toBe(true);
  await page.clock.runFor(400);
  expect((await states(diagram))[pathway.start]).toBe('ink');
  for(const [hop,arrivals] of pathway.hops as [string,string[]][]){
    await reachStage(page,`to-${hop}`,pathway.id);await page.clock.runFor(150);
    const drops=await moving(diagram);
    expect(drops.length).toBeGreaterThan(0);
    for(const head of await heads(diagram,drops))expect(head.gap).toBeLessThan(1.5);
    // Commands from the controllers and Home Assistant's manual control reach Mosquitto together.
    if(pathway.id==='respond'&&hop==='mqtt'){expect(drops.sort()).toEqual(['commands','manual']);expect((await states(diagram)).ha).toBe('ink');}
    // The actuator services drive all three devices at once.
    if(hop==='devices')expect(drops.sort()).toEqual(['drive-fan','drive-humidifier','drive-leds']);
    await reachStage(page,hop,pathway.id);
    for(const arrival of arrivals)expect((await states(diagram))[arrival]).toBe('ink');
  }
  // The loop around the three devices is the last stroke, about 1.7 s after they are inked.
  await page.clock.runFor(2000);
  await expect(flow).toHaveAttribute('data-flow-state','complete');
  expect((await trailOffsets(diagram)).every(offset=>offset===0)).toBe(true);
  for(const value of await written(diagram))expect(value).toBeCloseTo(1,3);
  expect(Object.values(await states(diagram)).every(state=>state==='ink')).toBe(true);
  for(const final of pathway.finals)await expect(diagram.locator(`[data-ink-node="${final}"] .ink-name`)).toHaveCSS('fill','rgb(79, 90, 60)');
  // The last parts are circled in olive: one loop around the three devices, or around the single final part.
  const loops=await diagram.locator('[data-ink-loop],[data-ink-group-loop]').evaluateAll(items=>items.map(item=>parseFloat(getComputedStyle(item).strokeDashoffset)));
  expect(loops.length).toBe(1);expect(loops[0]).toBe(0);
  // Another tab takes over: this drawing waits, then replays from pencil when its tab returns.
  const layout=await diagram.getAttribute('data-flow-layout'),drawing=flow.locator(`[data-flow-layout="${layout}"]`);
  await flow.locator('[data-pathway-replay]').evaluate((button:HTMLButtonElement)=>button.click());
  await page.clock.runFor(1200);
  await page.locator('[data-route="observe"]').evaluate((button:HTMLButtonElement)=>button.click());
  await expect(flow).not.toHaveAttribute('data-flow-state','running');
  const before=await trailOffsets(drawing);
  expect(before.some(offset=>offset<1.03)).toBe(true);
  await page.clock.runFor(1000);
  expect(await trailOffsets(drawing)).toEqual(before);
  await page.locator(`[data-route="${pathway.id}"]`).evaluate((button:HTMLButtonElement)=>button.click());
  expect(Object.values(await states(flow.locator('.ink-diagram:visible'))).every(state=>state==='pencil')).toBe(true);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
});

test.describe('without JavaScript',()=>{
  test.use({javaScriptEnabled:false});
  test('all three sections and the complete Observe diagram remain readable',async({page})=>{
    await page.goto('/#architecture');
    for(const id of ['observe','respond','record'])await expect(page.locator(`#architecture-panel-${id}`)).toBeVisible();
    const diagram=page.locator('[data-system-flow="observe"] .ink-diagram:visible');
    await expect(diagram.locator('[data-ink-node]')).toHaveCount(6);
    for(const text of ['SHT31','SCD41','Mosquitto','Database writer','TimescaleDB','Grafana'])await expect(diagram.locator('.ink-name').filter({hasText:text})).toBeVisible();
    for(const note of await diagram.locator('[data-ink-note] text').all())await expect(note).toBeVisible();
    for(const link of await page.locator('[data-flow-goto]').all())await expect(link).toBeHidden();
    for(const [route,count,names] of [['respond',8,['Controllers','Mosquitto','Home Assistant','Actuator services','Fan','Humidifier','LEDs']],['record',4,['Capture schedule','Two cameras','Image storage','Media preparation']]] as const) {
      const drawing=page.locator(`[data-system-flow="${route}"] .ink-diagram:visible`);
      await expect(drawing.locator('[data-ink-node]')).toHaveCount(count);
      for(const text of names)await expect(drawing.locator('.ink-name').filter({hasText:text})).toBeVisible();
      for(const note of await drawing.locator('[data-ink-note] text').all())await expect(note).toBeVisible();
    }
    for(const control of await page.locator('[data-pathway-controls]').all())await expect(control).toBeHidden();
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
  });
});
