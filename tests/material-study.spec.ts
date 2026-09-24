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
