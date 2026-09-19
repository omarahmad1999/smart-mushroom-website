import {test,expect} from '@playwright/test';

test('workspace objects and labels open matching notes, with optional paper audio',async({page})=>{
  await page.addInitScript(()=>{
    const play=HTMLMediaElement.prototype.play;
    Object.assign(window,{paperPlays:0});
    HTMLMediaElement.prototype.play=function(){if(this.src.endsWith('paper-swipe.mp3'))Reflect.set(window,'paperPlays',Reflect.get(window,'paperPlays')+1);return play.call(this);};
  });
  const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto('/about/');
  const workspace=page.locator('[data-about-workspace]');
  await expect(workspace).toHaveAttribute('data-enhanced','true');
  await expect(workspace.locator('.mascot img')).toHaveJSProperty('naturalWidth',1254);
  for(const id of ['mushrooms','software','building','learning','links','maker']){
    await workspace.locator(`.workspace-object[data-note="${id}"]`).click();
    await expect(workspace.locator('[data-workspace-note]:visible')).toHaveCount(1);
    await expect(workspace.locator(`#about-note-${id}`)).toBeVisible();
    await expect(workspace.locator(`.workspace-tabs [data-note="${id}"]`)).toHaveAttribute('aria-pressed','true');
  }
  expect(await page.evaluate(()=>Reflect.get(window,'paperPlays'))).toBe(6);
  await workspace.locator('[data-workspace-sound]').click();
  await workspace.locator('.workspace-tabs [data-note="building"]').focus();
  await page.keyboard.press('Enter');
  await expect(workspace.locator('#about-note-building')).toBeVisible();
  expect(await page.evaluate(()=>Reflect.get(window,'paperPlays'))).toBe(6);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
  await workspace.locator('#about-note-building a').click();
  await expect(page).toHaveURL(/documentation\/#journey-pvc-pipes$/);
  expect(errors).toEqual([]);
});

test('workspace notes remain readable without JavaScript',async({browser},info)=>{
  const context=await browser.newContext({javaScriptEnabled:false,viewport:info.project.use.viewport});
  const page=await context.newPage();await page.goto(`${info.project.use.baseURL}/about/`);
  for(const note of await page.locator('[data-workspace-note]').all())await expect(note).toBeVisible();
  await context.close();
});
