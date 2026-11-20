import { test, expect } from '@playwright/test';

const theme = (page: import('@playwright/test').Page) => page.locator('html').getAttribute('data-theme');
const pageBackground = (page: import('@playwright/test').Page) => page.evaluate(() => getComputedStyle(document.documentElement).backgroundColor);

test.describe('on a device set to dark', () => {
  test.use({ colorScheme: 'dark' });

  test('the site starts dark, and the header button switches to light and remembers it', async ({ page }) => {
    await page.goto('/documentation/');
    expect(await theme(page)).toBe('dark');
    expect(await pageBackground(page)).toBe('rgb(17, 27, 25)');
    const toggle = page.locator('[data-theme-toggle]');
    await expect(toggle).toHaveAccessibleName('Switch to light mode');
    await toggle.click();
    expect(await theme(page)).toBe('light');
    await expect(toggle).toHaveAccessibleName('Switch to dark mode');
    await page.reload();
    expect(await theme(page)).toBe('light');
    expect(await pageBackground(page)).toBe('rgb(246, 243, 235)');
    // Choosing the device's own setting again goes back to following the device.
    await page.locator('[data-theme-toggle]').click();
    expect(await page.evaluate(() => localStorage.getItem('theme'))).toBeNull();
  });

  test('the notebook pages stay paper on the dark page', async ({ page }) => {
    await page.goto('/documentation/#notebook-idea');
    const paper = await page.locator('[data-nb-page][data-active]').first().evaluate(el => getComputedStyle(el).backgroundColor);
    expect(paper).toBe('rgb(251, 247, 236)');
    const ink = await page.locator('[data-nb-page][data-active]').first().evaluate(el => getComputedStyle(el).color);
    expect(ink).toBe('rgb(57, 71, 60)');
  });
});

test.describe('on a device set to light', () => {
  test.use({ colorScheme: 'light' });

  test('the site starts light and the choice of dark carries to other pages', async ({ page }) => {
    // Starts from a light page: the home page's 3D work is slow to leave on the test Pi.
    await page.goto('/documentation/');
    expect(await theme(page)).toBe('light');
    await page.locator('[data-theme-toggle]').first().click();
    expect(await theme(page)).toBe('dark');
    await page.goto('/about/');
    expect(await theme(page)).toBe('dark');
    expect(await pageBackground(page)).toBe('rgb(17, 27, 25)');
  });
});
