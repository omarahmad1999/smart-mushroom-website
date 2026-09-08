import {test,expect} from '@playwright/test';

test('notebook turns pages, jumps sections, restores history and enlarges photographs',async({page},info)=>{
  const errors:string[]=[];page.on('pageerror',error=>errors.push(error.message));
  await page.goto('/documentation/');
  const book=page.locator('[data-notebook]');
  await expect(book).toHaveAttribute('data-enhanced','true');
  const status=book.locator('[data-nb-status]');
  const mobile=info.project.name==='mobile';
  await expect(status).toContainText(mobile?'Page 1 / 10':'Pages 1–2 / 10');
  await expect(book.getByRole('button',{name:'Previous notebook page',exact:true})).toBeDisabled();
  await book.getByRole('link',{name:/Enlarge photograph/}).first().click();
  const dialog=book.locator('dialog');await expect(dialog).toBeVisible();
  await expect(dialog.locator('img')).toHaveJSProperty('naturalWidth',1600);
  await expect(dialog).toContainText('19 August 2026');
  await page.keyboard.press('Escape');await expect(dialog).not.toBeVisible();
  await expect(book.getByRole('link',{name:/Enlarge photograph/}).first()).toBeFocused();
  await book.getByLabel('Photo note: The Idea',{exact:true}).click();
  await expect(book.locator('#notebook-idea .nb-annotation')).toHaveAttribute('open','');
  await book.getByRole('button',{name:'Next notebook page',exact:true}).click();
  await expect(status).toContainText(mobile?'Page 2 / 10':'Pages 3–4 / 10');
  await expect(book.locator('[data-nb-fold] .nb-leaf')).toHaveCount(1);
  await expect(book.locator('[data-nb-fold] .nb-leaf')).toHaveCount(0);
  await book.locator('.nb-tabs').getByRole('link',{name:'04 Vision Lab'}).click();
  await expect(status).toContainText('Vision Lab');
  await expect(page).toHaveURL(/#notebook-vision$/);
  await page.reload();await expect(status).toContainText('Vision Lab');
  await book.locator('.nb-tabs').getByRole('link',{name:'05 What Went Wrong'}).click();
  if(mobile)await book.getByRole('button',{name:'Next notebook page',exact:true}).click();
  await expect(book.getByRole('button',{name:'Next notebook page',exact:true})).toBeDisabled();
  await page.goBack();await expect(status).toContainText(mobile?'What Went Wrong':'Vision Lab');
  await book.locator('.nb-contents summary').click();
  await book.getByRole('navigation',{name:'Notebook contents'}).getByRole('link',{name:'02 The Build'}).click();
  await expect(status).toContainText('The Build');
  await page.keyboard.press('ArrowRight');await expect(status).toContainText(mobile?'Page 4':'Growing Notes');
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
  expect(errors).toEqual([]);
});

test('reduced motion skips folds and reference anchors remain usable',async({page})=>{
  await page.emulateMedia({reducedMotion:'reduce'});
  await page.goto('/documentation/#notebook-vision--notes');
  const book=page.locator('[data-notebook]');
  await expect(book.locator('[data-nb-status]')).toContainText('Vision Lab');
  await book.getByRole('button',{name:'Previous notebook page',exact:true}).click();
  await expect(book.locator('.nb-leaf')).toHaveCount(0);
  await page.goto('/documentation/#physical-setup');
  await expect(page.locator('#physical-setup')).toBeInViewport();
  await expect(page.getByRole('article',{name:'System documentation'})).toContainText('TimescaleDB');
});

test('all entries and image links remain readable without JavaScript',async({browser},info)=>{
  const context=await browser.newContext({javaScriptEnabled:false,viewport:info.project.use.viewport});
  const page=await context.newPage();await page.goto(`${test.info().project.use.baseURL}/documentation/`);
  const book=page.locator('[data-notebook]');
  await expect(book.locator('.nb-spread')).toHaveCount(5);
  for(const spread of await book.locator('.nb-spread').all())await expect(spread).toBeVisible();
  await expect(book.locator('[data-nb-controls]')).toBeHidden();
  await expect(book.locator('[data-nb-image]').first()).toHaveAttribute('href','/media/photo-incubation-2026-08-19.webp');
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
  await context.close();
});

test('horizontal gestures turn the paper without requiring a page corner',async({page})=>{
  await page.goto('/documentation/');
  const binding=page.locator('[data-nb-binding]');
  await page.getByRole('button',{name:'Turn to next page',exact:true}).click();
  await expect(page.locator('[data-nb-status]')).not.toContainText('Pages 1–2');
  await page.getByRole('button',{name:'Turn to previous page',exact:true}).click();
  await binding.dispatchEvent('pointerdown',{clientX:250,clientY:350,pointerId:1,pointerType:'touch'});
  await binding.dispatchEvent('pointerup',{clientX:110,clientY:355,pointerId:1,pointerType:'touch'});
  await expect(page.locator('[data-nb-status]')).not.toContainText('Page 1 /');
  await expect(page.locator('[data-nb-status]')).not.toContainText('Pages 1–2');
});
