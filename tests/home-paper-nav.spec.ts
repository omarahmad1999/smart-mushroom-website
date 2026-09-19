import {test,expect} from '@playwright/test';
test.setTimeout(120_000);

test('paper contents panel opens, tracks chapters, and leaves the main layout unchanged',async({page})=>{
  await page.goto('/');
  const panel=page.locator('[data-home-paper-nav]');
  const toggle=panel.locator('.paper-index-tab');
  await expect(toggle).toHaveAttribute('aria-expanded','false');
  await expect(panel.locator('.paper-index-sheet')).toBeHidden();
  const widthBefore=await page.locator('#material-study .ms-container').evaluate(el=>el.getBoundingClientRect().width);
  await toggle.click();
  await expect(toggle).toHaveAttribute('aria-expanded','true');
  await expect(panel.locator('.paper-index-sheet')).toBeVisible();
  await expect(panel.locator('[data-home-section]')).toHaveCount(6);
  await expect(panel.locator('.paper-mushroom-doodle')).toHaveCount(2);
  expect(await panel.locator('[data-home-section]').evaluateAll(links=>links.every(link=>getComputedStyle(link).borderBottomStyle==='solid'))).toBe(true);
  await panel.getByRole('link',{name:/Connected System/}).click();
  await expect(page).toHaveURL(/#architecture$/);
  await expect(panel.locator('.paper-index-sheet')).toBeHidden();
  expect(await page.locator('#material-study .ms-container').evaluate(el=>el.getBoundingClientRect().width)).toBe(widthBefore);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
});
