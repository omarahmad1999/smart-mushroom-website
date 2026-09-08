import { test as base, expect, type Page } from '@playwright/test';

// Every interaction below also checks the architecture boundary: the application
// must not issue fetch/XHR requests or create experiment-data connections.
const test = base.extend<{ runtimeGuard: void }>({
  runtimeGuard: [async ({ page, baseURL }, use) => {
    const errors: string[] = [];
    const dataRequests: string[] = [];
    const sockets: string[] = [];
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
      const socketURL = new URL(socket.url());
      const isDevelopmentHMR = !process.env.TEST_PRODUCTION
        && socketURL.host === new URL(baseURL!).host
        && socketURL.pathname === '/';
      if (!isDevelopmentHMR) sockets.push(socket.url());
    });
    await use();
    expect(errors, 'Browser console and uncaught JavaScript errors').toEqual([]);
    expect(dataRequests, 'The static site must not request sensor data or use fetch/XHR').toEqual([]);
    expect(sockets, 'Only the local development HMR connection is permitted').toEqual([]);
  }, { auto: true }],
});

test.use({launchOptions:{executablePath:'/usr/bin/chromium',args:['--no-sandbox','--enable-unsafe-swiftshader']}});

async function openHome(page: Page) {
  await page.goto('/');
  await expect(page).toHaveTitle('Smart Mushroom Hub');
  await expect(page.getByRole('heading', { level: 1 })).toContainText('A small habitat.');
}

async function expectNoHorizontalOverflow(page: Page) {
  const width = await page.evaluate(() => ({
    viewport: window.innerWidth,
    document: document.documentElement.scrollWidth,
  }));
  expect(width.document, 'Page content should fit the viewport horizontally').toBeLessThanOrEqual(width.viewport + 1);
}

test('research page and all illustration assets load without a data dashboard', async ({ page }) => {
  await openHome(page);
  for (const id of ['experiment', 'cultivation', 'observations', 'vision', 'architecture']) {
    await expect(page.locator(`#${id}`).getByRole('heading', { level: 2 }).first()).toBeVisible();
  }
  // Decode HTML images and SVG image layers, including initially hidden states.
  const failedImages = await page.evaluate(async () => {
    const urls = new Set([
      ...Array.from(document.querySelectorAll('img')).map(img => img.currentSrc || img.src),
      ...Array.from(document.querySelectorAll('svg image')).map(img => img.getAttribute('href') || ''),
    ]);
    const results = await Promise.all([...urls].filter(Boolean).map(async url => {
      const image = new Image();
      image.src = url;
      try { await image.decode(); return null; } catch { return url; }
    }));
    return results.filter(Boolean);
  });
  expect(failedImages, 'All published media must decode successfully').toEqual([]);
  await expectNoHorizontalOverflow(page);
  // The isolated 3D illustration may render a canvas; experiment charts may not.
  await expect(page.locator('canvas:not([data-study-canvas]), input[type="range"], input[type="date"], input[type="datetime-local"]')).toHaveCount(0);
  await expect(page.getByRole('combobox')).toHaveCount(0);
});

test('cultivation tabs support keyboard navigation and show conceptual phase explanations', async ({ page }) => {
  await openHome(page);
  const tabs = page.getByRole('tablist', { name: 'Conceptual cultivation stages' }).getByRole('tab');
  await tabs.nth(0).focus();
  await page.keyboard.press('ArrowRight');
  await expect(tabs.nth(1)).toBeFocused();
  await expect(tabs.nth(1)).toHaveAttribute('aria-selected', 'true');
  await expect(page.locator('#rc-panel-pinning')).toBeVisible();
  await expect(page.locator('#rc-panel-pinning')).toContainText('The first small signs become visible.');
  await expect(page.locator('#rc-panel-incubation')).toBeHidden();
  await page.keyboard.press('End');
  await expect(tabs.nth(3)).toBeFocused();
  await expect(page.locator('#rc-panel-harvest')).toBeVisible();
  await expect(page.locator('#rc-panel-harvest')).toContainText('does not indicate that a harvest has been completed');
  await page.keyboard.press('ArrowRight');
  await expect(tabs.nth(0)).toBeFocused();
  await tabs.nth(2).click();
  await expect(page.locator('#rc-panel-fruiting')).toContainText('Slow changes start to take shape.');
  await expect(page.locator('#rc-panel-fruiting')).toBeVisible();
});

test('architecture tabs trace the observation, control, and media pathways', async ({ page }) => {
  await openHome(page);
  const tabs = page.getByRole('tablist', { name: 'Explore a system pathway' }).getByRole('tab');
  await tabs.nth(0).focus();
  await page.keyboard.press('ArrowRight');
  await expect(tabs.nth(1)).toBeFocused();
  await expect(tabs.nth(1)).toHaveAttribute('aria-selected', 'true');
  await expect(page.locator('#architecture-panel-respond')).toBeVisible();
  await expect(page.locator('#architecture-panel-respond')).toContainText('Fan, Humidifier & LEDs');
  await expect(page.locator('#architecture-panel-observe')).toBeHidden();
  await page.keyboard.press('End');
  await expect(tabs.nth(2)).toBeFocused();
  await expect(page.locator('#architecture-panel-record')).toContainText('Media Preparation');
  await page.keyboard.press('Home');
  await expect(page.locator('#architecture-panel-observe')).toBeVisible();
  await expect(page.locator('#architecture-panel-observe')).toContainText('Grafana');
  await expectNoHorizontalOverflow(page);
});

test('published photographs keep their dates and can be selected with keyboard controls', async ({ page }) => {
  await openHome(page);
  const gallery = page.locator('[data-photo-viewer]');
  const controls = gallery.getByRole('group', { name: 'Choose a published photograph' });
  await expect(controls).toBeVisible();
  await expect(gallery.locator('[data-capture]:visible')).toHaveCount(1);
  await expect(gallery.locator('#rc-capture-2026-08-19')).toBeVisible();
  const second = controls.getByRole('button', { name: 'Show photograph from 27 August 2026' });
  await second.focus();
  await page.keyboard.press('Enter');
  await expect(second).toHaveAttribute('aria-pressed', 'true');
  await expect(gallery.locator('#rc-capture-2026-08-27')).toBeVisible();
  await expect(gallery.locator('#rc-capture-2026-08-19')).toBeHidden();
  await expect(gallery.getByRole('status')).toContainText('27 August 2026');
  const third = controls.getByRole('button', { name: 'Show photograph from 4 September 2026' });
  await third.click();
  await expect(third).toHaveAttribute('aria-pressed', 'true');
  await expect(second).toHaveAttribute('aria-pressed', 'false');
  const capture = gallery.locator('#rc-capture-2026-09-04');
  await expect(capture).toBeVisible();
  await expect(capture.locator('time')).toHaveAttribute('datetime', '2026-09-04');
  await expect(capture.getByRole('link')).toHaveAttribute('href', '/media/photo-incubation-2026-09-04.webp');
  await expect(capture.getByRole('img')).toHaveAttribute('alt', /Real camera photograph/);
  await expect(gallery).toContainText('Cairo time (UTC+3)');
  await expectNoHorizontalOverflow(page);
});

test('the published timelapse waits for user playback and decodes in the native player', async ({ page }) => {
  await openHome(page);
  const video = page.getByLabel('Silent timelapse of the controlled tent during incubation');
  await video.scrollIntoViewIfNeeded();
  await expect(video).toBeVisible();
  await expect(video).toHaveJSProperty('controls', true);
  await expect(video).toHaveJSProperty('autoplay', false);
  await expect(video).toHaveJSProperty('paused', true);
  await expect(video).toHaveJSProperty('currentTime', 0);
  await expect(video).toHaveAttribute('preload', 'none');
  const bounds = await video.boundingBox();
  expect(bounds).not.toBeNull();
  // The play button sits above Chromium's bottom seek bar, at the left edge.
  await video.click({ position: { x: 24, y: bounds!.height - 48 } });
  await expect.poll(() => video.evaluate((element: HTMLVideoElement) => element.currentTime)).toBeGreaterThan(0);
  const metadata = await video.evaluate((element: HTMLVideoElement) => ({
    paused: element.paused,
    duration: element.duration,
    width: element.videoWidth,
    height: element.videoHeight,
    error: element.error?.message ?? null,
    source: element.currentSrc,
  }));
  expect(metadata.paused).toBe(false);
  expect(metadata.error).toBeNull();
  expect(metadata.duration).toBeGreaterThan(12);
  expect(metadata.duration).toBeLessThan(13);
  expect(metadata.width).toBe(1280);
  expect(metadata.height).toBe(720);
  expect(metadata.source).toContain('/media/incubation-controlled-2026-08-18-to-09-05.mp4');
  await video.evaluate((element: HTMLVideoElement) => element.pause());
  await expect(page.getByRole('link', { name: 'Download the film' })).toHaveAttribute('download', '');
});

test('unconfigured resource links explain their availability in accessible dismissible dialogs', async ({ page }) => {
  await openHome(page);
  const cases = [
    { resource: 'Grafana', title: 'The data lives in Grafana.', message: 'public Grafana dashboard link has not been added' },
    { resource: 'GitHub', title: 'Follow the build.', message: 'GitHub repository link has not been added' },
  ];
  for (const item of cases) {
    const opener = page.locator(`.footer-socials [data-resource-unavailable="${item.resource}"]`);
    if (!await opener.count()) continue; // A configured destination renders as a real link.
    await opener.click();
    const dialog = page.getByRole('dialog', { name: item.title, exact: true });
    await expect(dialog).toBeVisible();
    await expect(dialog).toContainText(item.message);
    const close = dialog.getByRole('button', { name: 'Close', exact: true });
    await expect(close).toBeFocused();
    await page.keyboard.press('Tab');
    await expect(dialog.getByRole('link', { name: 'Read the documentation' })).toBeFocused();
    await page.keyboard.press('Shift+Tab');
    await expect(close).toBeFocused();
    // Native dialogs may include browser chrome in the tab cycle. What matters
    // is that page content behind the modal remains inert and cannot steal focus.
    await opener.evaluate(button => button.focus());
    await expect(close).toBeFocused();
    await page.keyboard.press('Escape');
    await expect(dialog).toBeHidden();
    await expect(opener).toBeFocused();
    await opener.click();
    await close.click();
    await expect(dialog).toBeHidden();
  }
});

test('documentation loads with readable notes and a contained schedule table', async ({ page }) => {
  await page.goto('/documentation/');
  await expect(page.getByRole('heading', { level: 1 })).toContainText('inside the system.');
  await expect(page.getByRole('article', { name: 'System documentation' })).toBeVisible();
  await expect(page.getByRole('table')).toContainText('Every 6 hours');
  await expect(page.locator('#publication')).toContainText('Grafana is responsible for displaying actual experiment measurements and history.');
  await expectNoHorizontalOverflow(page);
  await page.getByRole('link', { name: 'Back to the experiment' }).click();
  await expect(page).toHaveURL(/\/#experiment$/);
  await expect(page).toHaveTitle('Smart Mushroom Hub');
});

test('mobile navigation closes through a link and Escape, restoring its accessible name', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'mobile', 'The mobile menu is only displayed at small widths.');
  await openHome(page);
  const toggle = page.locator('.menu-toggle');
  const navigation = page.getByRole('navigation', { name: 'Mobile navigation' });
  await expect(toggle).toHaveAccessibleName('Open navigation');
  await toggle.click();
  await expect(toggle).toHaveAttribute('aria-expanded', 'true');
  await expect(navigation).toBeVisible();
  await navigation.getByRole('link', { name: 'The cultivation cycle' }).click();
  await expect(navigation).toBeHidden();
  await expect(toggle).toHaveAccessibleName('Open navigation');
  await toggle.click();
  await page.keyboard.press('Escape');
  await expect(navigation).toBeHidden();
  await expect(toggle).toHaveAttribute('aria-expanded', 'false');
  await expect(toggle).toHaveAccessibleName('Open navigation');
  await expect(toggle).toBeFocused();
});

test.describe('without JavaScript', () => {
  test.use({ javaScriptEnabled: false });
  test('all cultivation and architecture explanations remain readable', async ({ page }) => {
    await openHome(page);
    for (const phase of ['incubation', 'pinning', 'fruiting', 'harvest']) {
      await expect(page.locator(`#rc-panel-${phase}`)).toBeVisible();
    }
    for (const route of ['observe', 'respond', 'record']) {
      await expect(page.locator(`#architecture-panel-${route}`)).toBeVisible();
    }
    await expect(page.locator('[data-photo-controls]')).toBeHidden();
    const captures = page.locator('[data-capture]');
    await expect(captures).toHaveCount(3);
    for (let index = 0; index < await captures.count(); index++) {
      const capture = captures.nth(index);
      await capture.scrollIntoViewIfNeeded();
      await expect(capture).toBeVisible();
      await expect.poll(() => capture.locator('img').evaluate((image: HTMLImageElement) => image.naturalWidth)).toBeGreaterThan(0);
    }
    await expect(page.locator('video')).toHaveJSProperty('controls', true);
    await expect(page.locator('video')).toHaveJSProperty('autoplay', false);
    await expect(page.locator('#lessons')).toHaveCount(0);
    await page.goto('/learning-log/');
    await expect(page.locator('main')).toContainText('An incomplete record is still part of the story.');
    await expectNoHorizontalOverflow(page);
    await page.goto('/documentation/');
    await expect(page.locator('#physical-setup')).toContainText('185 cm high');
    await expect(page.locator('#publication')).toBeVisible();
    await expectNoHorizontalOverflow(page);
  });
});
