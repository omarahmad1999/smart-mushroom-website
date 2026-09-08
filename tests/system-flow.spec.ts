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
  await flow.locator('[data-pathway-canvas]').evaluate(el=>el.scrollIntoView({block:'center',behavior:'instant'}));
  await page.clock.runFor(100);
  await flow.locator('[data-pathway-replay]').evaluate((button:HTMLButtonElement)=>button.click());
  return flow;
}
const opacities=(page:Page,id:string)=>page.locator(`.pathway-diagram:visible [data-flow-caption="${id}"] [data-flow-letter]`).evaluateAll(letters=>letters.map(letter=>Number(getComputedStyle(letter).opacity)));
async function reachStage(page:Page,name:string,route='observe') {
  const flow=page.locator(`[data-system-flow="${route}"]`);
  for(let elapsed=0;elapsed<3000;elapsed+=16) {
    if(await flow.getAttribute('data-flow-stage')===name)return;
    await page.clock.runFor(16);
  }
  await expect(flow).toHaveAttribute('data-flow-stage',name);
}
const expectGreyPaths=async(diagram:ReturnType<Page['locator']>)=>{
  const styles=await diagram.locator('[data-flow-path]').evaluateAll(paths=>paths.map(path=>{const style=getComputedStyle(path);return{stroke:style.stroke,opacity:style.opacity,dash:style.strokeDasharray};}));
  expect(styles.length).toBeGreaterThan(0);
  for(const style of styles)expect(style).toEqual({stroke:'rgb(205, 209, 211)',opacity:'1',dash:'none'});
};
const boltDistance=(page:Page,selector:string)=>page.locator(`.pathway-diagram:visible ${selector}`).evaluate(item=>{
  const geometry=item as SVGGeometryElement;
  return -parseFloat(getComputedStyle(item).strokeDashoffset)*geometry.getTotalLength();
});

test('aligned sensors merge together and captions hand over through the complete sequence',async({page})=>{
  const flow=await openClocked(page);
  const started=await page.evaluate(()=>performance.now());
  const diagram=flow.locator('.pathway-diagram:visible');
  await expectGreyPaths(diagram);
  await expect(diagram.locator('[data-flow-node]')).toHaveCount(6);
  await expect(diagram.locator('.pathway-corner-dot')).toHaveCount(24);
  const sensorBoxes=await diagram.locator('[data-flow-node="sht31"]>rect:first-child,[data-flow-node="scd41"]>rect:first-child').evaluateAll(rects=>rects.map(rect=>{const box=rect.getBoundingClientRect();return{x:box.x,y:box.y,width:box.width};}));
  expect(sensorBoxes[0].x).toBeCloseTo(sensorBoxes[1].x,4);
  expect(sensorBoxes[0].y).toBeLessThan(sensorBoxes[1].y);
  const junctions=await diagram.locator('[data-flow-path="sht31"],[data-flow-path="scd41"],[data-flow-path="merged"]').evaluateAll(paths=>paths.map((element,index)=>{const path=element as SVGPathElement;const p=path.getPointAtLength(index===2?0:path.getTotalLength());return{x:p.x,y:p.y};}));
  expect(junctions[0]).toEqual(junctions[1]);expect(junctions[1]).toEqual(junctions[2]);

  const titles=diagram.locator('[data-flow-title]');
  expect(await titles.evaluateAll(items=>items.every(item=>getComputedStyle(item).opacity==='0'))).toBe(true);
  expect(await diagram.locator('.pathway-halo').evaluateAll(items=>items.every(item=>getComputedStyle(item).opacity==='0'))).toBe(true);
  await expect(diagram.locator('[data-flow-node="mqtt"] .pathway-glyph')).toHaveCSS('color','rgb(160, 160, 160)');
  await page.clock.runFor(400);
  for(const id of ['sht31','scd41']) {
    const title=diagram.locator(`[data-flow-node="${id}"] [data-flow-title]`);
    await expect(title).toHaveCSS('opacity','1');
    expect(await title.textContent()).not.toBe(id.toUpperCase());
    await expect(diagram.locator(`[data-flow-node="${id}"] .pathway-halo`)).toHaveCSS('stroke','rgb(255, 139, 38)');
    await expect(diagram.locator(`[data-flow-node="${id}"] .pathway-rim-body`)).toHaveCSS('stroke','rgb(198, 91, 22)');
  }
  await expect(diagram.locator('[data-flow-node="mqtt"] .pathway-halo')).toHaveCSS('opacity','0');
  await expect(diagram.locator('[data-flow-node="mqtt"] [data-flow-title]')).toHaveCSS('opacity','0');
  const rimSelector='[data-flow-node="sht31"] .pathway-rim-body';
  const liquid=diagram.locator('[data-liquid-node="sht31"]');
  const liquidBefore=await liquid.getAttribute('d');
  expect(liquidBefore).toMatch(/^M.+Z$/);
  const rimStart=await boltDistance(page,rimSelector);
  await page.clock.runFor(80);
  const rimDistance=await boltDistance(page,rimSelector)-rimStart;
  expect(await liquid.getAttribute('d')).not.toBe(liquidBefore);
  await reachStage(page,'to-mqtt');
  await page.clock.runFor(80);
  await expect(flow).toHaveAttribute('data-flow-stage','to-mqtt');
  const sensors=await diagram.locator('[data-flow-node="sht31"] .pathway-halo,[data-flow-node="scd41"] .pathway-halo').evaluateAll(items=>items.map(item=>getComputedStyle(item).opacity));
  expect(sensors[0]).toBe(sensors[1]);expect(Number(sensors[0])).toBeGreaterThan(0);
  const branches=await diagram.locator('[data-flow-pulse="sht31"].pathway-pulse-body,[data-flow-pulse="scd41"].pathway-pulse-body').evaluateAll(items=>items.map(item=>item.getAttribute('stroke-dashoffset')));
  expect(branches[0]).toBe(branches[1]);
  const paintedOffset=await diagram.locator('[data-flow-pulse="sht31"].pathway-pulse-body').evaluate(path=>parseFloat(getComputedStyle(path).strokeDashoffset));
  expect(paintedOffset).toBeLessThan(0);
  expect(paintedOffset).toBeCloseTo(Number(branches[0]),4);
  let letters=await opacities(page,'readings');
  expect(letters.some(v=>v>0)).toBe(true);expect(letters.some(v=>v===0)).toBe(true);
  await expect(diagram.locator('[data-flow-node="sht31"] [data-flow-title]')).toHaveText('SHT31');
  await expect(diagram.locator('[data-flow-node="scd41"] [data-flow-title]')).toHaveText('SCD41');
  await reachStage(page,'mqtt');
  expect((await opacities(page,'readings')).every(v=>v===1)).toBe(true);
  await expect(flow).toHaveAttribute('data-flow-stage','mqtt');
  // The full text has breathing room from MQTT and both merging branches.
  const clearance=await diagram.evaluate(svg=>{
    const caption=svg.querySelector('[data-flow-caption="readings"]')!.getBoundingClientRect();
    const mqtt=svg.querySelector('[data-flow-node="mqtt"]>rect')!.getBoundingClientRect();
    const mqttGap=Math.hypot(Math.max(mqtt.left-caption.right,0,caption.left-mqtt.right),Math.max(mqtt.top-caption.bottom,0,caption.top-mqtt.bottom));
    const matrix=(svg as SVGSVGElement).getScreenCTM()!;
    const pointGap=(point:DOMPoint)=>Math.hypot(Math.max(caption.left-point.x,0,point.x-caption.right),Math.max(caption.top-point.y,0,point.y-caption.bottom));
    const branchGaps=Array.from(svg.querySelectorAll('[data-flow-path="sht31"],[data-flow-path="scd41"],[data-flow-path="merged"]'),element=>{
      const path=element as SVGPathElement,length=path.getTotalLength();
      return Math.min(...Array.from({length:101},(_,index)=>pointGap(path.getPointAtLength(length*index/100).matrixTransform(matrix))));
    });
    const levels=Array.from(svg.querySelectorAll('[data-flow-caption] text:first-child'),text=>text.getAttribute('y'));
    return{mqttGap,branchGap:Math.min(...branchGaps),levels,wide:(svg as SVGElement).dataset.flowLayout==='wide'};
  });
  expect(clearance.mqttGap).toBeGreaterThan(clearance.wide?12:8);
  expect(clearance.branchGap).toBeGreaterThan(clearance.wide?12:8);
  if(clearance.wide)expect(new Set(clearance.levels).size).toBeGreaterThan(1);
  expect((await diagram.locator('[data-flow-caption="readings"] text').allTextContents()).join(' ')).toBe('Send Readings');
  await reachStage(page,'to-writer');
  await page.clock.runFor(60);
  letters=await opacities(page,'readings');
  expect(letters.some(v=>v<1)).toBe(true);expect(letters.some(v=>v===1)).toBe(true);
  expect((await opacities(page,'published')).some(v=>v>0)).toBe(true);
  await expect(diagram.locator('[data-flow-node="mqtt"] [data-flow-title]')).toHaveText('MQTT');
  // Compare actual travelled distances over equal time windows, rather than
  // comparing durations: mobile links are longer than their desktop versions.
  const lineSelector='[data-flow-pulse="published"].pathway-pulse-body';
  const lineStart=await boltDistance(page,lineSelector);
  await page.clock.runFor(80);
  const lineDistance=await boltDistance(page,lineSelector)-lineStart;
  expect(lineDistance/rimDistance).toBeGreaterThan(.95);
  expect(lineDistance/rimDistance).toBeLessThan(1.05);
  await reachStage(page,'writer');
  await page.clock.runFor(140);
  expect((await opacities(page,'readings')).every(v=>v===0)).toBe(true);
  expect((await opacities(page,'published')).every(v=>v===1)).toBe(true);
  await reachStage(page,'to-timescale');
  await page.clock.runFor(60);
  expect((await opacities(page,'stored')).some(v=>v>0)).toBe(true);
  expect((await opacities(page,'published')).some(v=>v<1)).toBe(true);
  await reachStage(page,'to-grafana');
  await expect(flow).toHaveAttribute('data-flow-stage','to-grafana');
  await expect(diagram.locator('[data-flow-caption="visualized"]')).toHaveCSS('fill','rgb(152, 87, 39)');
  await expect(diagram.locator('[data-flow-pulse="visualized"].pathway-pulse-body')).toHaveCSS('stroke','rgb(78, 155, 120)');
  await reachStage(page,'grafana');
  await page.clock.runFor(900);
  await expectGreyPaths(diagram);
  expect(await diagram.locator('.pathway-pulse').evaluateAll(items=>items.every(item=>getComputedStyle(item).opacity==='0'))).toBe(true);
  await expect(flow).toHaveAttribute('data-flow-state','complete');
  expect(await page.evaluate(()=>performance.now())-started).toBeLessThan(9000);
  for(const id of ['readings','published','stored'])expect((await opacities(page,id)).every(v=>v===0)).toBe(true);
  expect((await opacities(page,'visualized')).every(v=>v===1)).toBe(true);
  await expect(diagram.locator('[data-flow-node="grafana"] .pathway-glyph')).toHaveCSS('color','rgb(78, 155, 120)');
  expect(await titles.evaluateAll(items=>items.every(item=>item.textContent===(item as SVGElement).dataset.flowTitle&&getComputedStyle(item).opacity==='1'))).toBe(true);
  await expect(flow.locator('[data-pathway-pause]')).toBeDisabled();
  await page.clock.runFor(5000);
  await expect(flow).toHaveAttribute('data-flow-state','complete');
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
});

test('pause, replay, offscreen suspension and keyboard tabs keep the sequence under control',async({page})=>{
  const flow=await openClocked(page);
  const pause=flow.locator('[data-pathway-pause]');
  await page.clock.runFor(400);
  await pause.evaluate((button:HTMLButtonElement)=>button.click());
  await expect(flow).toHaveAttribute('data-flow-state','paused');
  const title=flow.locator('.pathway-diagram:visible [data-flow-node="sht31"] [data-flow-title]');
  const beforeTitle=await title.textContent();
  const droplet=flow.locator('.pathway-diagram:visible [data-liquid-node="sht31"]');
  const pausedDroplet=await droplet.getAttribute('d');
  expect(beforeTitle).not.toBe('SHT31');
  const before=await opacities(page,'readings');
  await page.clock.runFor(6000);expect(await opacities(page,'readings')).toEqual(before);
  expect(await title.textContent()).toBe(beforeTitle);
  expect(await droplet.getAttribute('d')).toBe(pausedDroplet);
  await pause.evaluate((button:HTMLButtonElement)=>button.click());
  await page.clock.runFor(700);expect(await opacities(page,'readings')).not.toEqual(before);
  await expect(title).toHaveText('SHT31');
  await page.evaluate(()=>window.scrollTo({top:0,behavior:'instant'}));await page.clock.runFor(100);
  await expect(flow).toHaveAttribute('data-flow-state','paused');
  const stage=await flow.getAttribute('data-flow-stage');await page.clock.runFor(8000);
  await expect(flow).toHaveAttribute('data-flow-stage',stage!);
  const tabs=page.getByRole('tablist',{name:'Explore a system pathway'}).getByRole('tab');
  await tabs.nth(0).focus();await page.keyboard.press('ArrowRight');
  await expect(page.locator('#architecture-panel-respond')).toBeVisible();
  await expect(page.locator('#architecture-panel-respond .pathway-diagram:visible [data-flow-node]')).toHaveCount(5);
  await page.keyboard.press('ArrowRight');
  await expect(page.locator('#architecture-panel-record')).toBeVisible();
  await expect(page.locator('#architecture-panel-record .pathway-diagram:visible [data-flow-node]')).toHaveCount(4);
  await page.keyboard.press('Home');
  await flow.locator('[data-pathway-canvas]').evaluate(el=>el.scrollIntoView({block:'center',behavior:'instant'}));
  await page.clock.runFor(450);
  await expect(flow).toHaveAttribute('data-flow-stage','sensors');
  expect((await opacities(page,'visualized')).every(v=>v===0)).toBe(true);
  await page.clock.runFor(5000);
  await flow.locator('[data-pathway-replay]').evaluate((button:HTMLButtonElement)=>button.click());
  await expect(title).toHaveCSS('opacity','0');
  await page.clock.runFor(450);
  await expect(flow).toHaveAttribute('data-flow-stage','sensors');
  expect(await title.textContent()).not.toBe('SHT31');
});

test('reduced motion shows the full explanation without travelling pulses',async({page})=>{
  await page.emulateMedia({reducedMotion:'reduce'});await page.goto('/#architecture');
  const flow=page.locator('[data-system-flow="observe"]');
  await expect(flow).toHaveAttribute('data-flow-state','static');
  await expect(flow.locator('[data-pathway-controls]')).toBeHidden();
  for(const id of ['readings','published','stored','visualized'])expect((await opacities(page,id)).every(v=>v===1)).toBe(true);
  const pulses=await flow.locator('.pathway-pulse').evaluateAll(items=>items.map(item=>getComputedStyle(item).opacity));
  expect(pulses.every(value=>value==='0')).toBe(true);
  expect(await flow.locator('[data-flow-title]').evaluateAll(items=>items.every(item=>item.textContent===(item as SVGElement).dataset.flowTitle&&getComputedStyle(item).opacity==='1'))).toBe(true);
  const diagram=flow.locator('.pathway-diagram:visible');
  await expectGreyPaths(diagram);
  for(const [id,expected] of Object.entries({readings:'Send Readings',published:'Carries Published Measurements',stored:'Stores Measurements',visualized:'Visualizes Stored Measurements'})) {
    expect((await diagram.locator(`[data-flow-caption="${id}"] text`).allTextContents()).join(' ')).toBe(expected);
  }
  await expect(diagram.locator('[data-flow-node="writer"] [data-flow-title]')).toHaveText('Database Writer');
  for(const [route,count] of [['respond',5],['record',4]] as const) {
    await page.locator(`[data-route="${route}"]`).click();
    const pathway=page.locator(`[data-system-flow="${route}"]`);
    await expect(pathway).toHaveAttribute('data-flow-state','static');
    await expect(pathway.locator('[data-pathway-controls]')).toBeHidden();
    await expect(pathway.locator('.pathway-diagram:visible [data-flow-node]')).toHaveCount(count);
    expect(await pathway.locator('[data-flow-letter]').evaluateAll(items=>items.every(item=>getComputedStyle(item).opacity==='1'))).toBe(true);
    expect(await pathway.locator('[data-flow-title]').evaluateAll(items=>items.every(item=>item.textContent===(item as SVGElement).dataset.flowTitle&&getComputedStyle(item).opacity==='1'))).toBe(true);
  }
});

for(const pathway of [
  {id:'respond',nodes:['inputs','controllers','mqtt','actuators','devices'],captions:['evaluate','commands','route','drive']},
  {id:'record',nodes:['schedule','cameras','storage','preparation'],captions:['capture','save','prepare']},
])test(`${pathway.id} follows the routed sequence and suspends when another tab opens`,async({page})=>{
  const flow=await openClocked(page,pathway.id);
  const diagram=flow.locator('.pathway-diagram:visible');
  await expectGreyPaths(diagram);
  await expect(diagram.locator('[data-flow-node]')).toHaveCount(pathway.nodes.length);
  expect(await diagram.locator('[data-flow-title]').evaluateAll(items=>items.every(item=>getComputedStyle(item).opacity==='0'))).toBe(true);
  expect(await diagram.locator('.pathway-aura').evaluateAll(items=>items.every(item=>getComputedStyle(item).opacity==='0'))).toBe(true);
  await page.clock.runFor(400);
  expect(await diagram.locator(`[data-flow-node="${pathway.nodes[0]}"] [data-flow-title]`).evaluateAll(items=>items.some(item=>item.textContent!==(item as SVGElement).dataset.flowTitle))).toBe(true);
  for(let index=0;index<pathway.captions.length;index++) {
    const destination=pathway.nodes[index+1],caption=pathway.captions[index];
    await reachStage(page,`to-${destination}`,pathway.id);
    await page.clock.runFor(80);
    await expectGreyPaths(diagram);
    await expect(diagram.locator(`[data-flow-pulse="${caption}"].pathway-pulse-core`)).toHaveCSS('opacity','1');
    await expect(diagram.locator(`[data-flow-pulse="${caption}"].pathway-pulse-glow`)).toHaveCSS('opacity','1');
    expect((await opacities(page,caption)).some(value=>value>0)).toBe(true);
    if(index>0)expect((await opacities(page,pathway.captions[index-1])).some(value=>value<1)).toBe(true);
    await reachStage(page,destination,pathway.id);
    expect((await opacities(page,caption)).every(value=>value===1)).toBe(true);
  }
  await page.clock.runFor(900);
  await expectGreyPaths(diagram);
  expect(await diagram.locator('.pathway-pulse').evaluateAll(items=>items.every(item=>getComputedStyle(item).opacity==='0'))).toBe(true);
  await expect(flow).toHaveAttribute('data-flow-state','complete');
  const finalNode=pathway.nodes.at(-1)!;
  await expect(diagram.locator(`[data-flow-node="${finalNode}"] .pathway-glyph`)).toHaveCSS('color','rgb(78, 155, 120)');
  for(const caption of pathway.captions.slice(0,-1))expect((await opacities(page,caption)).every(value=>value===0)).toBe(true);
  expect(await diagram.locator('[data-flow-title]').evaluateAll(items=>items.every(item=>item.textContent===(item as SVGElement).dataset.flowTitle))).toBe(true);
  if(pathway.id==='record')await expect(flow).not.toContainText('Research Website');
  await flow.locator('[data-pathway-replay]').evaluate((button:HTMLButtonElement)=>button.click());
  await page.clock.runFor(400);
  await page.locator('[data-route="observe"]').evaluate((button:HTMLButtonElement)=>button.click());
  const before=await flow.locator('[data-flow-title]').allTextContents();
  await page.clock.runFor(1000);
  expect(await flow.locator('[data-flow-title]').allTextContents()).toEqual(before);
  await page.locator(`[data-route="${pathway.id}"]`).evaluate((button:HTMLButtonElement)=>button.click());
  expect(await flow.locator('[data-flow-title]').evaluateAll(items=>items.every(item=>getComputedStyle(item).opacity==='0'))).toBe(true);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
});

test.describe('without JavaScript',()=>{
  test.use({javaScriptEnabled:false});
  test('all three sections and the complete Observe diagram remain readable',async({page})=>{
    await page.goto('/#architecture');
    for(const id of ['observe','respond','record'])await expect(page.locator(`#architecture-panel-${id}`)).toBeVisible();
    const diagram=page.locator('[data-system-flow="observe"] .pathway-diagram:visible');
    await expect(diagram.locator('[data-flow-node]')).toHaveCount(6);
    for(const text of ['SHT31','SCD41','MQTT','Database Writer','TimescaleDB','Grafana'])await expect(diagram.locator('.pathway-name').filter({hasText:text})).toBeVisible();
    for(const [route,count] of [['respond',5],['record',4]] as const) {
      const pathway=page.locator(`[data-system-flow="${route}"]`);
      await expect(pathway.locator('.pathway-diagram:visible [data-flow-node]')).toHaveCount(count);
      for(const title of await pathway.locator('.pathway-diagram:visible [data-flow-title]').all())await expect(title).toBeVisible();
    }
    for(const control of await page.locator('[data-pathway-controls]').all())await expect(control).toBeHidden();
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
  });
});
