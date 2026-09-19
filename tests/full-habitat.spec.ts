import { test as base, expect, type Page } from '@playwright/test';

const test = base.extend<{ staticBoundary: void }>({
  staticBoundary: [async ({ page, baseURL }, use) => {
    const errors: string[] = [];
    const dataRequests: string[] = [];
    const sockets: string[] = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('console', message => {
      if (message.type() === 'error') errors.push(message.text());
    });
    page.on('request', request => {
      if (['fetch', 'xhr'].includes(request.resourceType())) dataRequests.push(request.url());
    });
    page.on('websocket', socket => {
      const url = new URL(socket.url());
      const developmentHMR = !process.env.TEST_PRODUCTION
        && url.host === new URL(baseURL!).host && url.pathname === '/';
      if (!developmentHMR) sockets.push(socket.url());
    });
    await use();
    expect(errors, 'Hardware exploration must not introduce browser errors').toEqual([]);
    expect(dataRequests, 'The habitat remains a static illustration without fetch/XHR').toEqual([]);
    expect(sockets, 'The habitat must not create experiment-data connections').toEqual([]);
  }, { auto: true }],
});

test.use({
  launchOptions: {
    executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium',
    args: ['--no-sandbox', '--enable-unsafe-swiftshader'],
  },
});
test.setTimeout(120_000);

const expectedComponents = [
  ['bag', 'A place for life to take hold.', '#cultivation'],
  ['cooler', 'A cooler path into the tent.', '#architecture'],
  ['frame', 'Simple materials. A useful space.', '/documentation/#physical-setup'],
  ['cover', 'A boundary around the growing space.', '/documentation/#physical-setup'],
  ['fan', 'Make room for fresh air.', '#architecture'],
  ['humidity', 'Bring moisture into the habitat.', '#architecture'],
  ['light', 'Light, when the experiment calls for it.', '#architecture'],
  ['camera', 'Notice what changes slowly.', '#observations'],
  ['sensor', 'A window into the air.', '#architecture'],
  ['sht', 'Temperature and moisture, together.', '#experiment'],
  ['pi', 'The small computer behind it all.', '#architecture'],
  ['ai', 'A place for the next question.', '#vision'],
  ['mosfets', 'From a signal to a switched circuit.', '#architecture'],
  ['ups', 'A little resilience behind the scenes.', '/documentation/#limitations'],
  ['ssd', 'Keep a place for the record.', '#observations'],
  ['bag2', 'A second bag. Its own support.', '#cultivation'],
  ['vent', 'An opening on the other side.', '#architecture'],
  ['duct', 'A path into the growing space.', '#architecture'],
  ['camera2', 'A second angle on the habitat.', '#observations'],
  ['table', 'Room for the whole setup.', '#architecture'],
  ['monitor', 'A screen beside the experiment.', '/documentation/#publication'],
  ['keyboard', 'A way to work at the bench.', '#architecture'],
  ['mouse', 'A small companion to the keyboard.', '#architecture'],
  ['breadboard', 'Bring the connections together.', '#architecture'],
  ['cobbler', 'From the GPIO header to the breadboard.', '#architecture'],
  ['mosfet-led', 'A separate path for the LED.', '#architecture'],
  ['wago-red', 'Two red wires. One junction.', '#architecture'],
  ['wago-black', 'Two black wires. One junction.', '#architecture'],
  ['wago-yellow', 'Two yellow wires. One junction.', '#architecture'],
  ['wago-green', 'Two green wires. One junction.', '#architecture'],
  ['pi-power', 'Power for the computer.', '#architecture'],
  ['power-strip', 'Two adapters, supplied by the UPS.', '#architecture'],
  ['adapter12', 'A supply for the fan circuit.', '#architecture'],
  ['adapter24', 'A supply for the lighting circuit.', '#architecture'],
] as const;

async function openHabitat(page: Page) {
  await page.goto('/#material-study');
  const section = page.locator('#material-study');
  await section.locator('[data-study-viewport]').scrollIntoViewIfNeeded();
  await expect(section).toHaveAttribute('data-study-state', 'ready', { timeout: 40_000 });
  await expect(section.locator('[data-study-viewport] canvas')).toBeVisible();
  await section.locator('.ms-exploration summary').click();
  return section;
}

async function expectNoOverflow(page: Page) {
  const bounds = await page.evaluate(() => ({
    page: document.documentElement.scrollWidth,
    viewport: window.innerWidth,
  }));
  expect(bounds.page, 'The inspector, controls and component list must fit the screen').toBeLessThanOrEqual(bounds.viewport + 1);
}

test.describe('component explanations', () => {
  test.use({ reducedMotion: 'reduce' });

  test('all 34 items have individual indicators and open their own explanation', async ({ page }) => {
    test.setTimeout(300_000);
    const section = await openHabitat(page);
    await expect(section.locator('[data-study-hotspot]')).toHaveCount(34);
    await expect(section.locator('[data-study-hotspot]:visible')).toHaveCount(34);
    await section.locator('[data-study-hotspot="bag"]').click();
    await expect(section.locator('[data-study-detail]')).toBeVisible();
    const selectors = section.locator('button[data-study-select]');
    await expect(selectors).toHaveCount(expectedComponents.length);
    const inspector = section.locator('[data-study-detail]');

    for (const [id, title, href] of expectedComponents) {
      const button = section.locator(`button[data-study-select="${id}"]`);
      const marker=section.locator(`[data-study-hotspot="${id}"]`);
      await expect(marker).toHaveCount(1);
      await expect(marker).toHaveAttribute('aria-controls','study-component-detail');
      await expect(button).toBeEnabled();
      await expect(button).toHaveAttribute('aria-controls', 'study-component-detail');
      if (id === 'ssd') {
        await button.focus();
        await button.press('Enter');
      } else {
        await button.click();
      }
      await expect(section).toHaveAttribute('data-study-selected', id);
      await expect(section).toHaveAttribute('data-study-region', 'component');
      await expect(button).toHaveAttribute('aria-pressed', 'true');
      await expect(section.locator('button[data-study-select][aria-pressed="true"]')).toHaveCount(1);
      await expect(inspector).toBeVisible();
      await expect(inspector.getByRole('heading', { level: 3 })).toHaveText(title);
      await expect(inspector.locator('[data-study-detail-link]')).toHaveAttribute('href', href);
      await expect(inspector.locator('[data-study-detail-copy]')).not.toBeEmpty();
      if (href.startsWith('#')) await expect(page.locator(href)).toHaveCount(1);
      if(id==='mosfets'||id==='mosfet-led') {
        const table=inspector.locator('[data-study-terminals]');await expect(table).toBeVisible();
        await expect(table.locator('[data-study-load-label]')).toHaveText(id==='mosfets'?'Fan':'LED');
        await expect(table.locator('[data-study-supply-label]')).toHaveText(id==='mosfets'?'12 V':'24 V');
        await expect(table.locator('tbody tr').last()).toContainText('Red → T-cobbler');
        await expect(table.locator('tbody tr').last()).toContainText('Black → T-cobbler');
      }

    }

    await section.locator('[data-study-close]').click();
    await expect(inspector).toBeHidden();
    await expect(section).toHaveAttribute('data-study-demo', 'none');
    await section.locator('button[data-study-region="overview"]').click();
    await section.locator('button[data-study-labels]').click();
    const point=await section.locator('[data-study-leader="bag"]').evaluate(line=>{
      const box=line.closest('[data-study-viewport]')!.getBoundingClientRect();
      return {x:box.x+Number(line.getAttribute('x1')),y:box.y+Number(line.getAttribute('y1'))};
    });
    await page.mouse.click(point.x,point.y);
    await expect(section).toHaveAttribute('data-study-selected','bag');
    await expect(inspector).toBeVisible();
    await expectNoOverflow(page);
  });
});

test('layers and region controls consistently update the illustrated view', async ({ page }) => {
  const section = await openHabitat(page);
  for (const key of ['cover', 'wiring'] as const) {
    const button = section.locator(`button[data-study-${key}]`);
    await expect(button).toHaveAttribute('aria-pressed', 'false');
    await button.click();
    await expect(button).toHaveAttribute('aria-pressed', 'true');
    await expect(section).toHaveAttribute(`data-study-${key}`, 'true');
    await button.click();
    await expect(button).toHaveAttribute('aria-pressed', 'false');
    await expect(section).toHaveAttribute(`data-study-${key}`, 'false');
  }

  const labels = section.locator('button[data-study-labels]');
  await labels.click();
  await expect(labels).toHaveAttribute('aria-pressed', 'false');
  await expect(section.locator('[data-study-hotspot]:visible')).toHaveCount(0);
  await labels.click();
  await expect(labels).toHaveAttribute('aria-pressed', 'true');
  await section.locator('[data-study-viewport]').scrollIntoViewIfNeeded();
  await expect.poll(() => section.locator('[data-study-hotspot]:visible').count()).toBeGreaterThan(0);

  for (const region of ['tent', 'workbench', 'overview']) {
    const button = section.locator(`button[data-study-region="${region}"]`);
    await button.click();
    await expect(section).toHaveAttribute('data-study-region', region);
    await expect(button).toHaveAttribute('aria-pressed', 'true');
    await expect(section.locator('button[data-study-region][aria-pressed="true"]')).toHaveCount(1);
    await expect(section.locator('[data-study-detail]')).toBeHidden();
  }
  await expectNoOverflow(page);
});

test('fan, mist, light and camera demonstrations start and stop through the inspector', async ({ page }) => {
  // Keep the demonstration visible while tracing each control on the software
  // GPU. Fan and mist remain on until stopped; reduced motion holds them still.
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const section = await openHabitat(page);
  const demonstrations = [
    ['fan', 'fan'],
    ['humidity', 'mist'],
    ['light', 'light'],
    ['camera', 'camera'],
  ] as const;
  const inspector = section.locator('[data-study-detail]');
  const action = inspector.locator('[data-study-action]');

  for (const [component, demonstration] of demonstrations) {
    await section.locator(`button[data-study-select="${component}"]`).click();
    await expect(inspector).toBeVisible();
    await expect(action).toHaveAttribute('data-study-action', demonstration);
    await expect(action).toHaveAttribute('aria-pressed', 'false');
    await action.click();
    await expect(action).toHaveAttribute('aria-pressed', 'true');
    await expect(section).toHaveAttribute('data-study-demo', demonstration);
    if(component==='light') {
      await expect(section).toHaveAttribute('data-study-lighting','tent');
      await expect(section.locator('.ms-scene-shell')).toHaveCSS('background-color','rgb(23, 36, 42)');
    }
    {
      await action.click();
      await expect(action).toHaveAttribute('aria-pressed', 'false');
      await expect(section).toHaveAttribute('data-study-demo', 'none');
    }
    // Explicit switching stops the device; dismissing the inspector only closes it.
    await section.locator('[data-study-close]').click();
    await expect(inspector).toBeHidden();
    await expect(section).toHaveAttribute('data-study-demo', 'none');
    await expect(section).toHaveAttribute('data-study-lighting','day');
    await expect(action).toHaveAttribute('aria-pressed', 'false');
  }
  await expectNoOverflow(page);
});

test.describe('assembly with reduced motion', () => {
  test.use({ reducedMotion: 'reduce' });

  test('replay completes synchronously and leaves the full habitat usable', async ({ page }) => {
    const section = await openHabitat(page);
    const replay = section.locator('button[data-study-build]');
    await expect(replay).toBeEnabled();
    const immediateState = await replay.evaluate((button: HTMLButtonElement) => {
      button.click();
      const habitat = button.closest<HTMLElement>('[data-material-study]')!;
      return { build: habitat.dataset.studyBuild, state: habitat.dataset.studyState };
    });
    expect(immediateState.build, 'Reduced motion should not leave an assembly animation running').toBe('idle');
    expect(immediateState.state).toBe('ready');
    await expect(replay).toBeEnabled();
    await expect(section.locator('[data-study-rotate]')).toHaveAttribute('aria-pressed', 'false');
    await expect(section.locator('[data-study-status]')).not.toBeEmpty();
    await expect(section.locator('[data-study-viewport] canvas')).toBeVisible();
    await expect(section.locator('[data-study-fallback]')).toBeHidden();
    await expect.poll(() => section.locator('[data-study-hotspot]:visible').count()).toBeGreaterThan(0);
    await section.locator('button[data-study-select="pi"]').click();
    await expect(section).toHaveAttribute('data-study-selected', 'pi');
    await expect(section.locator('[data-study-detail]')).toBeVisible();
    await expect(section.locator('[data-study-detail-title]')).toHaveText('The small computer behind it all.');
    await expectNoOverflow(page);
  });
});

test('screen, sound excerpts and photograph behave as independent visual controls', async ({ page }, testInfo) => {
  test.setTimeout(180_000);
  await page.emulateMedia({reducedMotion:'reduce'});
  await page.addInitScript(() => {
    const Original=window.Audio;
    (window as any).__studyAudio=[];
    window.Audio=function(src?:string) {
      const element=new Original(src);
      const record={element,plays:0};
      element.addEventListener('play',()=>record.plays++);
      (window as any).__studyAudio.push(record);
      return element;
    } as unknown as typeof Audio;
    window.Audio.prototype=Original.prototype;
  });
  const section=await openHabitat(page);
  const viewport=section.locator('[data-study-viewport]');
  const photo=section.locator('.ms-mushroom-photo img');
  await expect(photo).toBeVisible();
  expect(await photo.evaluate((img:HTMLImageElement)=>img.complete&&img.naturalWidth>0)).toBe(true);
  const photoBox=(await photo.boundingBox())!, modelBox=(await viewport.boundingBox())!;
  if(testInfo.project.name==='desktop') expect(photoBox.x+photoBox.width).toBeLessThan(modelBox.x);
  else expect(photoBox.y+photoBox.height).toBeLessThan(modelBox.y);
  expect(await page.evaluate(()=>(window as any).__studyAudio.length)).toBe(0);

  const marker=section.locator('[data-study-hotspot="monitor"]');
  await expect(marker).toHaveCSS('opacity','0.58');
  await marker.focus();await expect(marker).toHaveCSS('opacity','1');
  await section.locator('[data-study-labels]').click();
  await viewport.scrollIntoViewIfNeeded();
  const screenPoint=await section.locator('[data-study-leader="monitor"]').evaluate(line=>{
    const box=line.closest('[data-study-viewport]')!.getBoundingClientRect();
    return {x:box.x+Number(line.getAttribute('x1')),y:box.y+Number(line.getAttribute('y1'))};
  });
  await page.mouse.click(screenPoint.x,screenPoint.y);
  await expect(section).toHaveAttribute('data-study-selected','monitor');
  await expect(section).toHaveAttribute('data-study-screen','on');
  await expect(section).toHaveAttribute('data-study-wiring','false');
  await expect(section.locator('[data-study-screen-preview]')).toBeVisible();
  const screenImage=section.locator('[data-study-screen-preview] img');
  await expect.poll(()=>screenImage.evaluate((img:HTMLImageElement)=>img.complete&&img.naturalWidth>0)).toBe(true);
  const action=section.locator('[data-study-action]');
  await expect(action).toHaveAttribute('data-study-action','screen');
  await expect(action).toContainText('Turn screen off');
  await action.click();
  await expect(section).toHaveAttribute('data-study-screen','off');
  await expect(section.locator('[data-study-screen-preview]')).toBeHidden();
  await expect(section).toHaveAttribute('data-study-wiring','false');

  const audioState=(name:string)=>page.evaluate(name=>{
    const record=(window as any).__studyAudio.find((entry:any)=>entry.element.src.includes(name));
    return record?{duration:record.element.duration,loop:record.element.loop,paused:record.element.paused,plays:record.plays,time:record.element.currentTime}:null;
  },name);
  for(const [id,clip,duration] of [['fan','fan-loop',6],['humidity','humidifier-loop',20]] as const) {
    await section.locator(`[data-study-select="${id}"]`).click();await action.click();
    await expect.poll(async()=>(await audioState(clip))?.paused).toBe(false);
    await expect.poll(async()=>(await audioState(clip))?.duration).toBeCloseTo(duration,2);
    expect((await audioState(clip))?.loop).toBe(true);
    if(id==='fan') {
      await page.waitForTimeout(7200);
      expect((await audioState(clip))?.paused).toBe(false);
      await expect(section).toHaveAttribute('data-study-demo','fan');
      await section.locator('[data-study-sound]').click();
      await expect.poll(async()=>(await audioState(clip))?.paused).toBe(true);
      await section.locator('[data-study-sound]').click();
      await viewport.scrollIntoViewIfNeeded();
      await expect.poll(async()=>(await audioState(clip))?.paused).toBe(false);
    }
    await page.evaluate(()=>window.scrollTo(0,0));
    await expect.poll(async()=>(await audioState(clip))?.paused).toBe(true);
    await viewport.scrollIntoViewIfNeeded();
    await expect.poll(async()=>(await audioState(clip))?.paused).toBe(false);
    await action.click();
    await section.locator('[data-study-close]').click();
    await expect.poll(async()=>(await audioState(clip))?.paused).toBe(true);
  }
  await section.locator('[data-study-select="light"]').click();await action.click();
  await expect.poll(async()=>(await audioState('light-switch'))?.plays).toBeGreaterThan(0);
  await action.click();
  await expect.poll(async()=>(await audioState('light-switch'))?.plays).toBeGreaterThan(1);
  await section.locator('[data-study-select="monitor"]').click();
  await expect.poll(async()=>(await audioState('screen-switch'))?.plays).toBeGreaterThan(0);
  await action.click();
  await expect(section).toHaveAttribute('data-study-screen','off');
  await expectNoOverflow(page);
});
