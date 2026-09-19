import {test,expect} from '@playwright/test';
test('Myko follows the idle and wake sequence without extending reactions',async({page})=>{
  await page.clock.install();await page.clock.pauseAt(new Date(Date.now()+1000));await page.goto('/about/');
  const myko=page.locator('[data-myko]');await myko.scrollIntoViewIfNeeded();await page.getByRole('button',{name:'Say hello to Myko'}).focus();
  await page.mouse.move(180,350);await expect(myko).toHaveAttribute('data-mood','neutral');
  await page.clock.runFor(1999);await expect(myko).toHaveAttribute('data-mood','neutral');await page.clock.runFor(1);await expect(myko).toHaveAttribute('data-mood','melancholic');
  await expect(myko.locator('[data-emotion-symbol]')).toHaveText('…');await page.mouse.move(190,355);await expect(myko).toHaveAttribute('data-mood','curious');await expect(myko).toHaveAttribute('data-tracking','false');
  const gaze=await myko.getAttribute('style');await page.clock.runFor(1000);await page.mouse.move(200,360);expect(await myko.getAttribute('style')).toBe(gaze);await page.clock.runFor(1000);await expect(myko).toHaveAttribute('data-mood','neutral');await expect(myko).toHaveAttribute('data-tracking','true');
  await page.clock.runFor(4000);await expect(myko).toHaveAttribute('data-mood','sleepy');await expect(myko.locator('[data-emotion-symbol]')).toHaveText('Zzz');
  await page.mouse.move(210,365);await expect(myko).toHaveAttribute('data-mood','surprised');await expect(myko.locator('.surprised')).toHaveCSS('color','rgb(180, 247, 255)');await expect(myko.locator('[data-emotion-symbol]')).toHaveText('!!');
  await page.clock.runFor(2000);await expect(myko).toHaveAttribute('data-mood','neutral');await page.getByRole('button',{name:'Say hello to Myko'}).press('Enter');await expect(myko).toHaveAttribute('data-mood','happy');
});
test('photo leads the layout and story tabs remain accessible',async({page})=>{
  const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));await page.goto('/about/');await expect(page.locator('[data-about-page]')).toHaveAttribute('data-about-ready','true');
  const photo=await page.locator('.profile-main').boundingBox(),myko=await page.locator('[data-myko]').boundingBox();expect(photo!.width).toBeGreaterThan(myko!.width*1.7);await expect(page.locator('canvas')).toHaveCount(0);
  const tab=page.getByRole('tab',{name:'What I build',exact:true});await tab.click();await expect(page.getByRole('tabpanel')).toContainText('PVC pipes');await tab.press('ArrowRight');await expect(page.getByRole('tab',{name:'What I’m exploring'})).toBeFocused();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);expect(errors).toEqual([]);
});
test('reduced motion keeps expressions but stops movement',async({page})=>{
  await page.emulateMedia({reducedMotion:'reduce'});await page.goto('/about/');await expect(page.getByRole('button',{name:'Motion off',exact:true})).toHaveAttribute('aria-pressed','false');await page.getByRole('button',{name:'Say hello to Myko'}).click();await expect(page.locator('[data-myko]')).toHaveAttribute('data-mood','happy');await expect(page.locator('[data-myko]')).not.toHaveAttribute('data-animate');
});
