import {test,expect} from '@playwright/test';
test.setTimeout(120_000);

test('each run says what failed and what it carried forward, and its thumbnails switch the stage',async({page})=>{
  await page.goto('/#runs');
  const runs=page.locator('#runs');
  const tabs=runs.getByRole('tab');
  await expect(tabs).toHaveCount(3);
  await expect(tabs.nth(0)).toContainText('Stalled in colonization');
  await expect(tabs.nth(1)).toContainText('Rotted at fruiting');
  await expect(tabs.nth(2)).toContainText('In progress');
  // One run at a time; the first is open.
  await expect(runs.locator('#rr-panel-run-01')).toBeVisible();
  await expect(runs.locator('#rr-panel-run-02')).toBeHidden();
  await expect(runs.locator('#rr-panel-run-01')).toContainText('A desert air cooler');
  // The second run carries in the first run's changes and shows its film first.
  await tabs.nth(1).click();
  const second=runs.locator('#rr-panel-run-02');
  await expect(second).toBeVisible();
  await expect(second.locator('.rr-carried-in')).toContainText('Surgical tape');
  await expect(second.locator('.rr-carried-forward')).toContainText('slits along the sides');
  await expect(second.locator('[data-run-item]:visible video')).toHaveCount(1);
  const thumbs=second.locator('[data-run-thumb]');
  await expect(thumbs).toHaveCount(4);
  await thumbs.nth(2).click();
  await expect(page).toHaveURL(/#runs$/);
  await expect(thumbs.nth(2)).toHaveAttribute('aria-current','true');
  await expect(thumbs.nth(0)).not.toHaveAttribute('aria-current');
  await expect(second.locator('[data-run-item]:visible img')).toHaveAttribute('src','/media/runs/run-02-rot-2026-10-24-a.webp');
  // The current run has no photographs yet and says so.
  await tabs.nth(1).focus();
  await page.keyboard.press('ArrowRight');
  await expect(tabs.nth(2)).toHaveAttribute('aria-selected','true');
  await expect(runs.locator('#rr-panel-run-03 .rr-empty')).toBeVisible();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
});

test.describe('without JavaScript',()=>{
  test.use({javaScriptEnabled:false});
  test('every run is shown in order, and thumbnails link to their files',async({page})=>{
    await page.goto('/');
    const runs=page.locator('#runs');
    await expect(runs.getByRole('tablist')).toBeHidden();
    for(const slug of ['run-01','run-02','run-03'])await expect(runs.locator(`#rr-panel-${slug}`)).toBeVisible();
    await expect(runs.locator('#rr-panel-run-02 [data-run-thumb]').first()).toHaveAttribute('href','/media/runs/run-02-fruiting-ambient-2026-10-28-to-29.mp4');
  });
});
