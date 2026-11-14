import {test,expect} from '@playwright/test';
test.setTimeout(120_000);

const chapters=['Interactive Habitat','Connected System','The Experiment','Cultivation Cycle','Experiment Runs','Camera & Timelapse','Computer Vision'];

test('on a laptop the chapter bar lists every chapter, jumps to one and follows the reader',async({page},testInfo)=>{
  test.skip(testInfo.project.name!=='desktop','The laptop layout.');
  await page.goto('/');
  const contents=page.locator('[data-home-contents]');
  await expect(contents).toHaveAttribute('data-ready','');
  const links=contents.locator('[data-home-section]');
  await expect(links).toHaveCount(7);
  for(const [index,name] of chapters.entries())await expect(links.nth(index)).toContainText(name);
  // Every chapter is one click away: no menu to open on a laptop.
  await expect(contents.locator('[data-contents-toggle]')).toBeHidden();
  await expect(links.first()).toHaveAttribute('aria-current','location');
  await contents.getByRole('link',{name:/The Experiment/}).click();
  await expect(page).toHaveURL(/#experiment$/);
  await expect(links.nth(2)).toHaveAttribute('aria-current','location',{timeout:15000});
  // The chapter lands below the header and the bar, never underneath them.
  const bar=await contents.boundingBox(),label=await page.locator('#experiment .rc-section-label').boundingBox();
  expect(label!.y).toBeGreaterThanOrEqual(bar!.y+bar!.height);
  // The bar stays with the reader, under the header.
  const header=await page.locator('.site-header').boundingBox();
  expect(Math.round(bar!.y)).toBe(Math.round(header!.y+header!.height));
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
});

test('on a phone the bar names the current chapter and opens the full list',async({page},testInfo)=>{
  test.skip(testInfo.project.name!=='mobile','The phone layout.');
  await page.goto('/');
  const contents=page.locator('[data-home-contents]');
  const toggle=contents.locator('[data-contents-toggle]'),list=contents.locator('[data-contents-list]');
  await expect(toggle).toBeVisible();
  await expect(toggle).toContainText('01');
  await expect(toggle).toContainText('Interactive Habitat');
  await expect(list).toBeHidden();
  await toggle.click();
  await expect(toggle).toHaveAttribute('aria-expanded','true');
  await expect(list).toBeVisible();
  // Each chapter is a comfortable tap target, with a line about what it holds.
  const rows=list.locator('[data-home-section]');
  await expect(rows).toHaveCount(7);
  for(const row of await rows.all())expect((await row.boundingBox())!.height).toBeGreaterThanOrEqual(44);
  await expect(list.locator('.hc-summary').first()).toBeVisible();
  // Escape closes it and hands focus back.
  await page.keyboard.press('Escape');
  await expect(list).toBeHidden();
  await expect(toggle).toBeFocused();
  // Choosing a chapter closes the list and jumps there; the bar then names it.
  await toggle.click();
  await list.getByRole('link',{name:/Computer Vision/}).click();
  await expect(list).toBeHidden();
  await expect(page).toHaveURL(/#vision$/);
  await expect(toggle).toContainText('Computer Vision',{timeout:15000});
  await expect(toggle).toContainText('07');
  // Tapping outside the open list closes it too.
  await toggle.click();
  await expect(list).toBeVisible();
  await page.mouse.click(200,700);
  await expect(list).toBeHidden();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
});

test.describe('without JavaScript',()=>{
  test.use({javaScriptEnabled:false});
  test('the chapters remain a row of working links',async({page})=>{
    await page.goto('/');
    const contents=page.locator('[data-home-contents]');
    await expect(contents.locator('[data-contents-toggle]')).toBeHidden();
    const links=contents.locator('[data-home-section]');
    await expect(links).toHaveCount(7);
    await expect(links.first()).toBeVisible();
    for(const [index,name] of chapters.entries())await expect(links.nth(index)).toContainText(name);
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
  });
});
