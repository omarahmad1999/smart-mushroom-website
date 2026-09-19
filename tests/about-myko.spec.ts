import {test,expect} from '@playwright/test';
test('Myko reacts, tracks the pointer, and the story works with keyboard and touch',async({page})=>{
  const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));await page.goto('/about/');
  await expect(page.locator('[data-about-page]')).toHaveAttribute('data-about-ready','true');
  await expect(page.locator('canvas')).toHaveCount(0);
  expect(await page.locator('.profile img').evaluate((im:HTMLImageElement)=>im.complete&&im.naturalWidth>0)).toBe(true);
  const myko=page.locator('[data-myko]');await myko.scrollIntoViewIfNeeded();
  await page.getByRole('button',{name:'Say hello to Myko'}).click();await expect(myko).toHaveAttribute('data-mood','happy');
  await expect(page.locator('.happy-eyes')).toBeVisible();
  await page.getByRole('button',{name:'Make Myko sleepy'}).click();await expect(myko).toHaveAttribute('data-mood','sleepy');
  await expect(page.locator('.sleepy-eyes')).toBeVisible();
  await page.getByRole('button',{name:'Make Myko curious'}).click();await expect(myko).toHaveAttribute('data-mood','curious');
  const rect=await page.locator('.myko-stage').boundingBox();await page.mouse.move(rect!.x+rect!.width*.8,rect!.y+rect!.height*.4);
  await expect.poll(()=>page.locator('.myko-head-group').evaluate(el=>(el as HTMLElement).style.getPropertyValue('--eye-x'))).not.toBe('0px');
  await page.getByRole('button',{name:'Motion on',exact:true}).click();await expect(myko).not.toHaveAttribute('data-animate');
  const tab=page.getByRole('tab',{name:'What I build',exact:true});await tab.click();await expect(page.getByRole('tabpanel')).toContainText('PVC pipes');
  await tab.press('ArrowRight');await expect(page.getByRole('tab',{name:'What I’m exploring'})).toBeFocused();await expect(page.getByRole('tabpanel')).toContainText('computer vision');
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);expect(errors).toEqual([]);
});
test('reduced motion disables idle movement but keeps expressions available',async({page})=>{
  await page.emulateMedia({reducedMotion:'reduce'});await page.goto('/about/');
  await expect(page.getByRole('button',{name:'Motion off',exact:true})).toHaveAttribute('aria-pressed','false');
  await page.getByRole('button',{name:'Say hello to Myko'}).click();await expect(page.locator('[data-myko]')).toHaveAttribute('data-mood','happy');
  await expect(page.locator('[data-myko]')).not.toHaveAttribute('data-animate');
});
test('all story text remains available without JavaScript',async({browser},info)=>{
  const context=await browser.newContext({javaScriptEnabled:false,viewport:info.project.use.viewport});const page=await context.newPage();await page.goto(`${info.project.use.baseURL}/about/`);
  for(const panel of await page.locator('.story-page').all())await expect(panel).toBeVisible();await expect(page.locator('.story-tabs')).toBeHidden();await context.close();
});
