import {test as base,expect,type Page,type Locator} from '@playwright/test';

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
const mapOf=(page:Page)=>page.locator('[data-system-map]');
const drawingOf=(page:Page)=>page.locator('[data-system-map] .map-drawing:visible');
// Keep centring the map until it runs: its handwriting is measured once the font loads, visibility arrives
// asynchronously (never during a paused-clock run), and the page's smooth anchor scroll can land late.
async function centre(page:Page,state='running'){
  const map=mapOf(page);
  for(let tries=0;tries<50;tries++){
    await map.locator('[data-pathway-canvas]').evaluate(el=>el.scrollIntoView({block:'center',behavior:'instant'}));
    if(await map.getAttribute('data-flow-state')===state)break;
    await page.waitForTimeout(200);
  }
  await expect(map).toHaveAttribute('data-flow-state',state);
}
async function openClocked(page:Page,route='observe'){
  await page.clock.install({time:new Date('2026-09-06T00:00:00Z')});
  await page.clock.pauseAt(new Date('2026-09-06T00:00:01Z'));
  await page.goto('/#architecture');
  if(route!=='observe')await page.locator(`[data-route="${route}"]`).evaluate((button:HTMLButtonElement)=>button.click());
  await centre(page);
  await page.clock.runFor(100);
  await mapOf(page).locator('[data-pathway-replay]').evaluate((button:HTMLButtonElement)=>button.click());
  return drawingOf(page);
}
async function reachStage(page:Page,name:string){
  const map=mapOf(page);
  for(let elapsed=0;elapsed<3000;elapsed+=16){
    if(await map.getAttribute('data-flow-stage')===name)return;
    await page.clock.runFor(16);
  }
  await expect(map).toHaveAttribute('data-flow-stage',name);
}
const trails=(drawing:Locator,route:string)=>drawing.locator(`[data-map-link-group][data-member="${route}"] [data-map-trail]`).evaluateAll(paths=>paths.map(path=>parseFloat(getComputedStyle(path).strokeDashoffset)));
const written=(drawing:Locator,route:string)=>drawing.locator(`[data-map-note][data-member="${route}"] [data-map-note-line]`).evaluateAll(lines=>lines.map(line=>{
  const rect=(line as SVGTextElement).ownerSVGElement!.querySelector(`[data-map-note-reveal="${(line as SVGElement).dataset.mapNoteLine}"]`)!;
  return Number(rect.getAttribute('width'))/Number((rect as SVGElement).dataset.width);
}));
const states=(drawing:Locator)=>drawing.locator('[data-map-part]').evaluateAll(parts=>Object.fromEntries(parts.map(part=>[(part as SVGElement).dataset.mapPart!,(part as SVGElement).dataset.state!])));
// Each drop sits exactly at the inked end of its own stretch.
const heads=(drawing:Locator,ids:string[])=>drawing.evaluate((svg,ids)=>ids.map(id=>{
  const trail=svg.querySelector<SVGPathElement>(`[data-map-trail="${id}"]`)!,drop=svg.querySelector<SVGGElement>(`[data-map-drop="${id}"]`)!;
  const progress=1-parseFloat(getComputedStyle(trail).strokeDashoffset)/1.03,point=trail.getPointAtLength(progress*trail.getTotalLength());
  const [x,y]=drop.getAttribute('transform')!.match(/translate\(([-\d.]+) ([-\d.]+)\)/)!.slice(1).map(Number);
  return{progress,gap:Math.hypot(point.x-x,point.y-y),visibility:getComputedStyle(drop).visibility};
}),ids);

test('Observe inks its stretches on the map, keeps its notes and lets the other paths step back while it plays',async({page},info)=>{
  const drawing=await openClocked(page),map=mapOf(page),wide=info.project.name==='desktop';
  await expect(drawing).toHaveAttribute('data-map-layout',wide?'wide':'narrow-observe');
  await expect(drawing.locator('[data-map-part]')).toHaveCount(wide?15:6);
  expect(Object.values(await states(drawing)).every(state=>state==='pencil')).toBe(true);
  expect((await trails(drawing,'observe')).every(offset=>offset>1)).toBe(true);
  // Both sensor routes end exactly where the merged route to Mosquitto begins.
  const ends=await drawing.locator('[data-map-link="sht31"],[data-map-link="scd41"],[data-map-link="merged"]').evaluateAll(paths=>paths.map((element,index)=>{const path=element as SVGPathElement,point=path.getPointAtLength(index===2?0:path.getTotalLength());return[Math.round(point.x),Math.round(point.y)];}));
  expect(ends[0]).toEqual(ends[2]);expect(ends[1]).toEqual(ends[2]);
  await page.clock.runFor(400);
  expect((await states(drawing)).sht31).toBe('ink');expect((await states(drawing)).mqtt).toBe('pencil');
  if(wide){
    await expect(map).toHaveAttribute('data-map-playing','observe');
    await expect.poll(()=>drawing.locator('[data-map-part="controllers"]').evaluate(part=>Number(getComputedStyle(part).opacity))).toBeLessThan(.5);
  }
  await reachStage(page,'to-mqtt');await page.clock.runFor(250);
  const drops=await heads(drawing,['sht31','scd41']);
  for(const head of drops){expect(head.progress).toBeGreaterThan(.05);expect(head.progress).toBeLessThan(1);expect(head.gap).toBeLessThan(1.5);expect(head.visibility).toBe('visible');}
  expect(drops[0].progress).toBeCloseTo(drops[1].progress,4);
  await reachStage(page,'mqtt');
  expect((await states(drawing)).mqtt).toBe('ink');
  await page.clock.runFor(500);
  expect(Number(await drawing.locator('[data-map-stamp]').evaluate(stamp=>getComputedStyle(stamp).opacity))).toBeGreaterThan(.5);
  for(const part of ['writer','timescale','grafana']){await reachStage(page,part);expect((await states(drawing))[part]).toBe('ink');}
  await reachStage(page,'complete');
  await expect(map).toHaveAttribute('data-flow-state','complete');
  expect((await trails(drawing,'observe')).every(offset=>offset===0)).toBe(true);
  for(const value of await written(drawing,'observe'))expect(value).toBeCloseTo(1,3);
  await expect(drawing.locator('[data-map-part="grafana"] .map-name')).toHaveCSS('fill','rgb(79, 90, 60)');
  expect(await drawing.locator('[data-map-part="grafana"] [data-map-loop]').evaluate(loop=>parseFloat(getComputedStyle(loop).strokeDashoffset))).toBe(0);
  await expect(map.locator('[data-pathway-pause]')).toBeDisabled();
  if(wide){
    // The other paths wait in pencil, back at full strength once Observe is finished.
    expect((await trails(drawing,'respond')).every(offset=>offset>1)).toBe(true);
    expect((await states(drawing)).controllers).toBe('pencil');
    await expect(map).not.toHaveAttribute('data-map-playing');
    await expect.poll(()=>drawing.locator('[data-map-part="controllers"]').evaluate(part=>Number(getComputedStyle(part).opacity))).toBe(1);
  }
  await map.getByRole('button',{name:/These readings also feed the controllers/}).click();
  await expect(page.getByRole('tab',{name:/Respond/})).toHaveAttribute('aria-selected','true');
  await expect(map).toHaveAttribute('data-map-route','respond');
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
});

test('Respond meets at the controllers and Mosquitto, including manual control, and closes the loop through the tent',async({page},info)=>{
  const drawing=await openClocked(page,'respond'),map=mapOf(page),wide=info.project.name==='desktop';
  await expect(drawing).toHaveAttribute('data-map-layout',wide?'wide':'narrow-respond');
  for(const part of ['settings','controllers','ha','actuators','devices'])expect((await states(drawing))[part]).toBe('pencil');
  await page.clock.runFor(400);
  expect((await states(drawing)).settings).toBe('ink');expect((await states(drawing)).mqtt).toBe('ink');
  // Readings and the phase settings travel to the controllers together.
  await reachStage(page,'to-controllers');await page.clock.runFor(250);
  for(const head of await heads(drawing,['feed','settings'])){expect(head.gap).toBeLessThan(1.5);expect(head.visibility).toBe('visible');}
  await reachStage(page,'controllers');expect((await states(drawing)).controllers).toBe('ink');
  // Automatic commands and Home Assistant's manual control both go through Mosquitto.
  await reachStage(page,'to-mqtt');await page.clock.runFor(250);
  expect((await states(drawing)).ha).toBe('ink');
  for(const head of await heads(drawing,['commands','manual'])){expect(head.gap).toBeLessThan(1.5);expect(head.visibility).toBe('visible');}
  for(const part of ['mqtt','actuators','devices',wide?'sht31':'tent'])await reachStage(page,part);
  await reachStage(page,'complete');
  expect((await trails(drawing,'respond')).every(offset=>offset===0)).toBe(true);
  for(const value of await written(drawing,'respond'))expect(value).toBeCloseTo(1,3);
  for(const part of ['settings','controllers','ha','actuators','devices'])expect((await states(drawing))[part]).toBe('ink');
  await expect(map.getByRole('button',{name:/The sensors notice the change/})).toBeVisible();
  await expect(map.getByRole('button',{name:/These readings also feed the controllers/})).toBeHidden();
});

test('paths build up one map: finished paths stay inked, a path left mid-way returns to pencil',async({page},info)=>{
  test.skip(info.project.name!=='desktop','the one map is the desktop drawing; phones show one chain at a time');
  await page.goto('/#architecture');
  await centre(page);
  const map=mapOf(page),drawing=drawingOf(page),tab=(name:string)=>page.getByRole('tab',{name:new RegExp(name)});
  await expect(map).toHaveAttribute('data-flow-state','complete',{timeout:15000});
  // Leave Record half-drawn: it goes back to pencil while Observe keeps its ink.
  await tab('Record').click();await expect.poll(()=>trails(drawing,'record').then(offsets=>offsets.some(offset=>offset<1))).toBe(true);
  await tab('Respond').click();
  expect((await trails(drawing,'record')).every(offset=>offset>1)).toBe(true);
  expect((await states(drawing)).cameras).toBe('pencil');
  expect((await trails(drawing,'observe')).every(offset=>offset===0)).toBe(true);
  await expect(map).toHaveAttribute('data-flow-state','complete',{timeout:15000});
  await tab('Record').click();await expect(map).toHaveAttribute('data-flow-state','complete',{timeout:15000});
  for(const route of ['observe','respond','record'])expect((await trails(drawing,route)).every(offset=>offset===0)).toBe(true);
  expect(Object.values(await states(drawing)).every(state=>state==='ink')).toBe(true);
  // Returning to a finished path replays it; the parts it shares with another finished path keep their ink.
  await tab('Observe').click();
  expect((await states(drawing)).writer).toBe('pencil');expect((await states(drawing)).mqtt).toBe('ink');
});

test('pause, replay, offscreen suspension and keyboard tabs keep the sequence under control',async({page},info)=>{
  const drawing=await openClocked(page),map=mapOf(page);
  const pause=map.locator('[data-pathway-pause]');
  await page.clock.runFor(1300);
  await pause.evaluate((button:HTMLButtonElement)=>button.click());
  await expect(map).toHaveAttribute('data-flow-state','paused');
  const snapshot=()=>drawing.evaluate(svg=>({trail:getComputedStyle(svg.querySelector('[data-map-trail="sht31"]')!).strokeDashoffset,drop:svg.querySelector('[data-map-drop="sht31"]')!.getAttribute('transform'),note:svg.querySelector('[data-map-note-reveal="merged-0"]')!.getAttribute('width')}));
  const before=await snapshot();
  expect(parseFloat(before.trail)).toBeLessThan(1);expect(parseFloat(before.trail)).toBeGreaterThan(0);
  await page.clock.runFor(3000);expect(await snapshot()).toEqual(before);
  await pause.evaluate((button:HTMLButtonElement)=>button.click());
  await page.clock.runFor(400);expect(await snapshot()).not.toEqual(before);
  // Scrolled away (towards the footer, clear of the 3D habitat) the drawing waits where it is.
  await page.evaluate(()=>window.scrollTo({top:document.documentElement.scrollHeight,behavior:'instant'}));await page.clock.runFor(100);
  await expect(map).toHaveAttribute('data-flow-state','paused');
  const stage=await map.getAttribute('data-flow-stage');await page.clock.runFor(3000);
  await expect(map).toHaveAttribute('data-flow-stage',stage!);
  const tabs=page.getByRole('tablist',{name:'Explore a system pathway'}).getByRole('tab');
  await tabs.nth(0).focus();await page.keyboard.press('ArrowRight');
  await expect(page.locator('#architecture-panel-respond')).toBeVisible();await expect(map).toHaveAttribute('data-map-route','respond');
  await page.keyboard.press('End');
  await expect(page.locator('#architecture-panel-record')).toBeVisible();await expect(map).toHaveAttribute('data-map-route','record');
  if(info.project.name==='mobile')await expect(drawingOf(page)).toHaveAttribute('data-map-layout','narrow-record');
  await page.keyboard.press('Home');
  await centre(page);
  await page.clock.runFor(450);
  expect((await states(drawingOf(page))).sht31).toBe('ink');
  expect((await written(drawingOf(page),'observe')).every(value=>value===0)).toBe(true);
  await page.clock.runFor(3000);
  await map.locator('[data-pathway-replay]').evaluate((button:HTMLButtonElement)=>button.click());
  expect((await states(drawingOf(page))).sht31).toBe('pencil');
  await page.clock.runFor(450);
  expect((await states(drawingOf(page))).sht31).toBe('ink');
});

test('reduced motion shows the complete map without travelling drops',async({page},info)=>{
  await page.emulateMedia({reducedMotion:'reduce'});await page.goto('/#architecture');
  const map=mapOf(page),drawing=drawingOf(page);
  await expect(map.locator('[data-pathway-status]')).toHaveText(/shown with motion reduced/);
  await expect(map).toHaveAttribute('data-flow-state','static');
  await expect(map.locator('[data-pathway-controls]')).toBeHidden();
  const routes=info.project.name==='desktop'?['observe','respond','record']:['observe'];
  for(const route of routes){
    expect((await trails(drawing,route)).every(offset=>offset===0)).toBe(true);
    for(const value of await written(drawing,route))expect(value).toBeCloseTo(1,3);
  }
  expect(Object.values(await states(drawing)).every(state=>state==='ink')).toBe(true);
  expect(await drawing.locator('[data-map-drop]').evaluateAll(drops=>drops.every(drop=>getComputedStyle(drop).visibility==='hidden'))).toBe(true);
  await map.getByRole('button',{name:/These readings also feed the controllers/}).click();
  const respondTab=page.getByRole('tab',{name:/Respond/});
  await expect(respondTab).toHaveAttribute('aria-selected','true');await expect(respondTab).toBeFocused();
  await expect(page.locator('#architecture-panel-respond')).toBeVisible();
  expect((await trails(drawingOf(page),'respond')).every(offset=>offset===0)).toBe(true);
  await expect(drawingOf(page).locator('[data-map-part="ha"] .map-name')).toHaveText('Home Assistant');
});

test.describe('without JavaScript',()=>{
  test.use({javaScriptEnabled:false});
  test('every section and the complete map remain readable',async({page},info)=>{
    await page.goto('/#architecture');
    for(const id of ['observe','respond','record'])await expect(page.locator(`#architecture-panel-${id}`)).toBeVisible();
    const drawings=drawingOf(page);
    // Desktop shows the one map; phones show each path's chain in turn.
    await expect(drawings).toHaveCount(info.project.name==='desktop'?1:3);
    for(const text of ['SHT31','Mosquitto','Database writer','Grafana','Controllers','Home Assistant','Capture schedule','Media preparation'])await expect(drawings.locator('.map-name').filter({hasText:text}).first()).toBeVisible();
    for(const note of await drawings.locator('[data-map-note] text').all())await expect(note).toBeVisible();
    await expect(page.locator('[data-pathway-controls]')).toBeHidden();
    for(const link of await page.locator('[data-flow-goto]').all())await expect(link).toBeHidden();
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
  });
});
