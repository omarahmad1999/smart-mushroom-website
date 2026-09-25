import { test as base, expect, type Locator, type Page } from '@playwright/test';

const test = base.extend<{ staticArchitectureGuard: void }>({
  staticArchitectureGuard: [async ({ page, baseURL }, use) => {
    const errors: string[] = [];
    const dataRequests: string[] = [];
    const unexpectedSockets: string[] = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('console', message => {
      if (message.type() === 'error') errors.push(message.text());
    });
    page.on('request', request => {
      if (['fetch', 'xhr'].includes(request.resourceType())) {
        dataRequests.push(`${request.resourceType()} ${request.url()}`);
      }
    });
    page.on('websocket', socket => {
      const url = new URL(socket.url());
      const developmentHMR = !process.env.TEST_PRODUCTION
        && url.host === new URL(baseURL!).host
        && url.pathname === '/';
      if (!developmentHMR) unexpectedSockets.push(socket.url());
    });
    await use();
    expect(errors, 'The scene must not introduce browser errors').toEqual([]);
    expect(dataRequests, 'The visual study must not fetch experiment data or use XHR').toEqual([]);
    expect(unexpectedSockets, 'Only local development HMR is permitted').toEqual([]);
  }, { auto: true }],
});

test.use({
  launchOptions: {
    executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium',
    args: ['--no-sandbox', '--enable-unsafe-swiftshader'],
  },
});
// Software WebGL on the ARM test host is slower than a hardware browser,
// especially when tracing multiple camera moves in one accessibility test.
test.setTimeout(90_000);

async function readView(section: Locator) {
  const [azimuth, polar, zoom] = (await section.getAttribute('data-study-view') ?? '')
    .split(',').map(Number);
  return { azimuth, polar, zoom };
}

async function expectNoOverflow(page: Page) {
  const dimensions = await page.evaluate(() => {
    const scene = document.querySelector<HTMLElement>('[data-study-viewport]')!.getBoundingClientRect();
    return {
      viewport: window.innerWidth,
      page: document.documentElement.scrollWidth,
      scene: { left: scene.left, right: scene.right },
    };
  });
  expect(dimensions.page, 'Page width must fit both desktop and mobile').toBeLessThanOrEqual(dimensions.viewport + 1);
  expect(dimensions.scene.left).toBeGreaterThanOrEqual(0);
  expect(dimensions.scene.right).toBeLessThanOrEqual(dimensions.viewport + 1);
}

async function expectSceneReady(page: Page) {
  const section = page.locator('#material-study');
  await expect(section).toHaveAttribute('data-study-state', 'ready', { timeout: 40_000 });
  const viewport = section.locator('[data-study-viewport]');
  await viewport.scrollIntoViewIfNeeded();
  const canvas = viewport.locator('canvas');
  await expect(canvas).toHaveCount(1);
  await expect(canvas).toBeVisible();
  await expect(section.locator('[data-study-fallback]')).toBeHidden();
  const rendering = await canvas.evaluate((element: HTMLCanvasElement) => {
    const gl = element.getContext('webgl2');
    return {
      width: element.width,
      height: element.height,
      drawingWidth: gl?.drawingBufferWidth ?? 0,
      drawingHeight: gl?.drawingBufferHeight ?? 0,
      contextLost: gl?.isContextLost() ?? true,
    };
  });
  expect(rendering.width).toBeGreaterThan(0);
  expect(rendering.height).toBeGreaterThan(0);
  expect(rendering.drawingWidth).toBeGreaterThan(0);
  expect(rendering.drawingHeight).toBeGreaterThan(0);
  expect(rendering.contextLost).toBe(false);
  const view = await readView(section);
  expect(Object.values(view).every(Number.isFinite)).toBe(true);
  return { section, canvas };
}

async function openStudy(page: Page) {
  await page.goto('/#material-study');
  await page.locator('[data-study-viewport]').scrollIntoViewIfNeeded();
  const ready=await expectSceneReady(page);
  await page.locator('.ms-exploration summary').click();
  return ready;
}

test('the opening habitat loads its renderer and keeps the catalogue collapsed', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1 })).toContainText('A small habitat.');
  await expectSceneReady(page);
  await expect(page.locator('.ms-exploration')).not.toHaveAttribute('open');
  await expectNoOverflow(page);
});

test('zoom, reset, component selection, and the mushroom layer change only the illustration', async ({ page }) => {
  const { section } = await openStudy(page);
  const initialView = await readView(section);
  await section.locator('[data-study-zoom="in"]').click();
  await expect.poll(async () => (await readView(section)).zoom).toBeGreaterThan(initialView.zoom);
  await section.locator('[data-study-zoom="out"]').click();
  await expect.poll(async () => (await readView(section)).zoom).toBeCloseTo(initialView.zoom, 2);

  const sensor = section.locator('[data-study-select="sensor"]');
  await sensor.click();
  await expect(section).toHaveAttribute('data-study-selected', 'sensor');
  await expect(sensor).toHaveAttribute('aria-pressed', 'true');
  await expect(section.locator('[data-study-select="bag"]')).toHaveAttribute('aria-pressed', 'false');
  await expect(section.locator('[data-study-detail-title]')).toContainText('A window into the air.');
  await expect(section.locator('[data-study-detail-note]')).toContainText('Each conductor joins its matching colour');
  await section.locator('[data-study-select="pi"]').click();
  await expect(section.locator('[data-study-detail-title]')).toContainText('The small computer behind it all.');
  await expect(section.locator('[data-study-detail-note]')).toBeHidden();
  await expect(section.locator('[data-study-detail]')).not.toContainText('This website does not connect');
  await expect.poll(async () => (await readView(section)).zoom).toBeGreaterThan(initialView.zoom);

  await section.locator('[data-study-menu="layers"] [data-study-menu-toggle]').click();
  const mushrooms = section.locator('[data-study-mushrooms]');
  await mushrooms.click();
  await expect(mushrooms).toHaveAttribute('aria-pressed', 'false');
  await expect(section).toHaveAttribute('data-study-mushrooms', 'false');
  await expect(section.locator('[data-study-status]')).toContainText('substrate bag remains');
  await mushrooms.click();
  await expect(mushrooms).toHaveAttribute('aria-pressed', 'true');
  await expect(section).toHaveAttribute('data-study-mushrooms', 'true');

  await section.locator('[data-study-reset]').click();
  await expect.poll(async () => (await readView(section)).zoom).toBeCloseTo(initialView.zoom, 2);
  await expect.poll(async () => (await readView(section)).azimuth).toBeCloseTo(initialView.azimuth, 2);
  await expect.poll(async () => (await readView(section)).polar).toBeCloseTo(initialView.polar, 2);
  await expectNoOverflow(page);
});

test('the overview names five groups, and a group numbers only its own parts', async ({ page }) => {
  const { section } = await openStudy(page);
  const initialView = await readView(section);
  const groupMarkers = section.locator('.ms-group-marker');
  await expect(groupMarkers.filter({ visible: true })).toHaveCount(5);
  await expect(section.locator('[data-study-hotspot]:visible')).toHaveCount(0);
  await section.locator('[data-study-group="The workbench"]').click();
  await expect(section.locator('[data-study-status]')).toContainText('The workbench: 7 parts.');
  await expect(section.locator('[data-study-hotspot]:visible')).toHaveCount(7);
  for (const id of ['monitor', 'pi', 'ssd']) await expect(section.locator(`[data-study-hotspot="${id}"]`)).toBeVisible();
  await expect(section.locator('[data-study-hotspot="fan"]')).toBeHidden();
  await expect.poll(async () => (await readView(section)).zoom).toBeGreaterThan(initialView.zoom);
  await section.locator('[data-study-reset]').click();
  await expect(groupMarkers.filter({ visible: true })).toHaveCount(5);
  await expect(section.locator('[data-study-hotspot]:visible')).toHaveCount(0);
});

test('pointing at a part highlights and names it, and choosing one fades the rest', async ({ page }, info) => {
  const { section, canvas } = await openStudy(page);
  if (info.project.name === 'desktop') {
    // Read the fan's projected position from its leader, then point at the model itself.
    await section.locator('[data-study-menu="layers"] [data-study-menu-toggle]').click();
    await section.locator('button[data-study-every]').click();
    const point = await section.locator('[data-study-leader="fan"]').evaluate(line => {
      const box = line.closest('[data-study-viewport]')!.getBoundingClientRect();
      return { x: box.x + Number(line.getAttribute('x1')), y: box.y + Number(line.getAttribute('y1')) };
    });
    await section.locator('button[data-study-labels]').click();
    await page.mouse.move(point.x, point.y);
    await page.mouse.move(point.x + 1, point.y + 1);
    await expect(section.locator('.ms-hover-label')).toBeVisible();
    await expect(section.locator('.ms-hover-label')).toHaveText('Low exhaust fan');
    await page.mouse.move(2, 2);
    await expect(section.locator('.ms-hover-label')).toBeHidden();
    // Return the markers to their default: grouped and shown.
    const layers = section.locator('[data-study-menu="layers"] [data-study-menu-toggle]');
    if (await layers.getAttribute('aria-expanded') !== 'true') await layers.click();
    await section.locator('button[data-study-every]').click();
    await section.locator('button[data-study-labels]').click();
  }
  await expect(section).toHaveAttribute('data-study-focus', 'none');
  await section.locator('[data-study-select="pi"]').click();
  await expect(section).toHaveAttribute('data-study-focus', 'pi');
  await section.locator('[data-study-close]').click();
  await expect(section).toHaveAttribute('data-study-focus', 'none');
  await section.locator('[data-study-reset]').click();
  await section.locator('[data-study-group="Observation"]').click();
  await expect(section).toHaveAttribute('data-study-focus', 'camera camera2 sensor sht');
  await expect(canvas).toBeVisible();
});

test.describe('guided tours', () => {
  test.use({ reducedMotion: 'reduce' });

  test('a tour steps through its path with wiring shown, then restores the scene', async ({ page }) => {
    const { section } = await openStudy(page);
    await section.locator('[data-study-menu="play"] [data-study-menu-toggle]').click();
    await section.locator('[data-study-tour="observe"]').click();
    const card = section.locator('[data-study-tour-card]');
    await expect(card).toBeVisible();
    await expect(section).toHaveAttribute('data-study-tour', 'observe');
    await expect(card.locator('[data-study-tour-title]')).toHaveText('Reading the air');
    await expect(card.locator('[data-study-tour-count]')).toHaveText('1 of 5');
    await expect(section).toHaveAttribute('data-study-selected', 'sht');
    await expect(section).toHaveAttribute('data-study-wiring', 'true');
    await expect(section.locator('[data-study-detail]')).toBeHidden();
    await card.locator('[data-study-tour-next]').click();
    await expect(card.locator('[data-study-tour-title]')).toHaveText('Carbon dioxide');
    await expect(section).toHaveAttribute('data-study-selected', 'sensor');
    await card.locator('[data-study-tour-prev]').click();
    await expect(section).toHaveAttribute('data-study-tour-step', '1');
    for (let step = 2; step <= 5; step++) await card.locator('[data-study-tour-next]').click();
    await expect(card.locator('[data-study-tour-title]')).toHaveText('Charted in Grafana');
    await expect(section).toHaveAttribute('data-study-screen', 'on');
    await expect(card.locator('[data-study-tour-next]')).toHaveText('Finish');
    await card.locator('[data-study-tour-next]').click();
    await expect(card).toBeHidden();
    await expect(section).toHaveAttribute('data-study-tour', 'none');
    await expect(section).toHaveAttribute('data-study-wiring', 'false');
    await expect(section.locator('.ms-group-marker').filter({ visible: true })).toHaveCount(5);
  });

  test('the respond tour runs each device, and choosing a part ends the tour', async ({ page }) => {
    const { section } = await openStudy(page);
    await section.locator('[data-study-menu="play"] [data-study-menu-toggle]').click();
    await section.locator('[data-study-tour="respond"]').click();
    const card = section.locator('[data-study-tour-card]');
    for (let step = 1; step < 3; step++) await card.locator('[data-study-tour-next]').click();
    await expect(section).toHaveAttribute('data-study-demo', 'fan');
    await card.locator('[data-study-tour-next]').click();
    await expect(section).toHaveAttribute('data-study-demo', 'mist');
    await card.locator('[data-study-tour-next]').click();
    await expect(section).toHaveAttribute('data-study-lighting', 'tent');
    await section.locator('[data-study-select="pi"]').click();
    await expect(card).toBeHidden();
    await expect(section).toHaveAttribute('data-study-tour', 'none');
    await expect(section).toHaveAttribute('data-study-demo', 'none');
    await expect(section.locator('[data-study-detail]')).toBeVisible();
  });
});

test('growth stages illustrate incubation to harvest and restore the fruiting view', async ({ page }) => {
  const { section } = await openStudy(page);
  await section.locator('[data-study-menu="play"] [data-study-menu-toggle]').click();
  await section.locator('[data-study-growth]').click();
  const panel = section.locator('[data-study-growth-panel]'), range = panel.getByRole('slider', { name: 'Cultivation stage' });
  await expect(panel).toBeVisible();
  await expect(panel).toContainText('Illustrated stages, not measurements');
  await expect(range).toHaveAttribute('aria-valuetext', 'Fruiting');
  await expect(section).toHaveAttribute('data-study-focus', 'bag bag2');
  await expect(section.locator('.ms-group-marker').filter({ visible: true })).toHaveCount(0);
  await panel.getByRole('button', { name: 'Incubation' }).click();
  await expect(section).toHaveAttribute('data-study-growth', 'incubation');
  await range.focus(); await page.keyboard.press('End');
  await expect(range).toHaveAttribute('aria-valuetext', 'Harvest');
  await panel.getByRole('button', { name: 'Close growth stages' }).click();
  await expect(panel).toBeHidden();
  await expect(section).not.toHaveAttribute('data-study-growth');
  await expect(section).toHaveAttribute('data-study-focus', 'none');
});

test('sketch style draws the habitat in ink on paper and switches back', async ({ page }) => {
  const { section } = await openStudy(page);
  const shell = section.locator('.ms-scene-shell');
  const plain = await shell.evaluate(element => getComputedStyle(element).backgroundImage);
  await section.locator('[data-study-menu="layers"] [data-study-menu-toggle]').click();
  const sketch = section.locator('button[data-study-sketch]');
  await sketch.click();
  await expect(sketch).toHaveAttribute('aria-pressed', 'true');
  await expect(section).toHaveAttribute('data-study-sketch', 'true');
  await expect(section.locator('[data-study-layer-count]')).toHaveText('3 on');
  expect(await shell.evaluate(element => getComputedStyle(element).backgroundImage)).not.toBe(plain);
  await sketch.click();
  await expect(section).toHaveAttribute('data-study-sketch', 'false');
  expect(await shell.evaluate(element => getComputedStyle(element).backgroundImage)).toBe(plain);
});

test('each part links to its build story, and a study link opens that part', async ({ page }) => {
  const { section } = await openStudy(page);
  const story = section.locator('[data-study-journey-link]');
  await section.locator('[data-study-select="fan"]').click();
  await expect(story).toBeVisible();
  await expect(story).toHaveAttribute('href', '/documentation/#journey-fan');
  await expect(story).toContainText('Read the build story: Fan');
  await section.locator('[data-study-select="cooler"]').click();
  await expect(story).toBeHidden();
  await page.goto('/#study-humidity');
  await expect(section).toHaveAttribute('data-study-state', 'ready', { timeout: 40_000 });
  await expect(section).toHaveAttribute('data-study-selected', 'humidity');
  await expect(section.locator('[data-study-detail-title]')).toHaveText('Bring moisture into the habitat.');
});

test('keyboard controls turn and zoom the scene while wheel scrolling remains native', async ({ page }) => {
  // This sequence includes several animated camera moves on software WebGL.
  test.setTimeout(150_000);
  const { section, canvas } = await openStudy(page);
  const initialView = await readView(section);
  await canvas.focus();
  await expect(canvas).toBeFocused();
  await canvas.press('ArrowRight');
  await expect.poll(async () => (await readView(section)).azimuth).not.toBe(initialView.azimuth);
  await canvas.press('Equal');
  await expect.poll(async () => (await readView(section)).zoom).toBeGreaterThan(initialView.zoom);
  await canvas.press('Home');
  await expect.poll(async () => (await readView(section)).zoom).toBeCloseTo(initialView.zoom, 2);
  await expect.poll(async () => (await readView(section)).azimuth).toBeCloseTo(initialView.azimuth, 2);

  const rotate = section.locator('[data-study-rotate]');
  await rotate.click();
  await expect(rotate).toHaveAttribute('aria-pressed', 'true');
  await expect.poll(async () => (await readView(section)).azimuth).not.toBe(initialView.azimuth);
  await canvas.focus();
  await canvas.press('Escape');
  await expect(rotate).toHaveAttribute('aria-pressed', 'false');

  // Use a clear area; the central bag hotspot intentionally overlays the canvas.
  await canvas.hover({ position: { x: 16, y: 100 } });
  const scrollBefore = await page.evaluate(() => window.scrollY);
  const zoomBeforeWheel = (await readView(section)).zoom;
  await page.mouse.wheel(0, -220);
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBeLessThan(scrollBefore);
  expect((await readView(section)).zoom).toBe(zoomBeforeWheel);
  await expectNoOverflow(page);
});

test.describe('reduced motion', () => {
  test.use({ reducedMotion: 'reduce' });

  test('starts without automatic rotation and remains operable from the keyboard', async ({ page }) => {
    const { section, canvas } = await openStudy(page);
    const initialView = await readView(section);
    await expect(section.locator('[data-study-rotate]')).toHaveAttribute('aria-pressed', 'false');
    await canvas.focus();
    await canvas.press('ArrowLeft');
    await expect.poll(async () => (await readView(section)).azimuth).not.toBe(initialView.azimuth);
    await canvas.press('Equal');
    await expect.poll(async () => (await readView(section)).zoom).toBeGreaterThan(initialView.zoom);
    await canvas.press('Home');
    await expect.poll(async () => (await readView(section)).zoom).toBeCloseTo(initialView.zoom, 2);
    await expect.poll(async () => (await readView(section)).azimuth).toBeCloseTo(initialView.azimuth, 2);
    await expect(section.locator('[data-study-rotate]')).toHaveAttribute('aria-pressed', 'false');
    await expectNoOverflow(page);
  });
});

test('WebGL unavailability preserves the poster and the rest of the interactive site', async ({ page }) => {
  await page.addInitScript(() => {
    const originalGetContext = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (this: HTMLCanvasElement, contextId: string, ...options: unknown[]) {
      if (contextId === 'webgl2') return null;
      return Reflect.apply(originalGetContext, this, [contextId, ...options]);
    } as typeof originalGetContext;
  });
  await page.goto('/#material-study');
  const section = page.locator('#material-study');
  await section.locator('[data-study-viewport]').scrollIntoViewIfNeeded();
  await expect(section).toHaveAttribute('data-study-state', 'unavailable', { timeout: 25_000 });
  await expect(section.locator('canvas')).toHaveCount(0);
  const fallback = section.locator('[data-study-fallback]');
  await expect(fallback).toBeVisible();
  const poster = fallback.locator('img');
  await expect(poster).toHaveAttribute('src', '/media/full-habitat-poster.webp');
  await expect(poster).toBeVisible();
  await expect.poll(() => poster.evaluate((image: HTMLImageElement) => image.complete && image.naturalWidth > 0)).toBe(true);
  await expect(section.locator('[data-study-status]')).toContainText('still view is available');
  const controls = section.locator('button:not([data-resource-unavailable])');
  expect(await controls.count()).toBeGreaterThan(0);
  for (const button of await controls.all()) await expect(button).toBeDisabled();

  // A graphics failure must not disable the original research interactions.
  const cultivation = page.locator('#cultivation');
  await cultivation.getByRole('tab', { name: /Fruiting & growth/ }).click();
  await expect(page.locator('#rc-panel-fruiting')).toBeVisible();
  await expect(page.locator('#experiment')).toContainText('A bigger question.');
  await expectNoOverflow(page);
});

test.describe('without JavaScript', () => {
  test.use({ javaScriptEnabled: false });

  test('shows a readable poster and preserves the existing research page', async ({ page }) => {
    await page.goto('/#material-study');
    const section = page.locator('#material-study');
    const fallback = section.locator('[data-study-fallback]');
    await expect(fallback).toBeVisible();
    const poster = fallback.locator('img');
    await expect(poster).toHaveAttribute('src', '/media/full-habitat-poster.webp');
    await expect(poster).toBeVisible();
    await expect.poll(() => poster.evaluate((image: HTMLImageElement) => image.complete && image.naturalWidth > 0)).toBe(true);
    await expect(section.locator('canvas')).toHaveCount(0);
    await expect(section.locator('[data-study-detail-copy]')).toContainText('cultivation bag');
    await expect(page.locator('#experiment')).toContainText('A bigger question.');
    await expectNoOverflow(page);
  });
});
