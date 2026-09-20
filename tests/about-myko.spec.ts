import {test,expect} from '@playwright/test';
test('Myko stays planted at the screen edge and tracks every direction',async({page},info)=>{
  await page.clock.install();await page.clock.pauseAt(new Date(Date.now()+1000));
  await page.goto('/about/');await expect(page.getByRole('heading',{level:1})).toHaveText('Omar Ahmad');await expect(page.locator('.about-interests,.about-next')).toHaveCount(0);await expect(page.getByText('HELLO THERE')).toHaveCount(0);await expect(page.getByText('A little about me.')).toHaveCount(0);
  const myko=page.locator('[data-myko]');await expect(myko).toHaveCSS('position','fixed');
  const before=await myko.boundingBox();const width=await page.locator('.myko-stage').evaluate(el=>el.getBoundingClientRect().width);expect(width).toBeCloseTo(info.project.name==='mobile'?285:330,0);
  await page.evaluate(()=>window.scrollTo({top:500,behavior:'instant'}));const after=await myko.boundingBox();expect(after!.y).toBeCloseTo(before!.y,1);expect(after!.x).toBeCloseTo(before!.x,1);
  const stage=page.locator('.myko-stage');await expect(stage).toHaveCSS('transform','none');const floor=page.locator('.myko-floor');await expect(floor).toBeVisible();
  const floorBox=await floor.boundingBox();expect(Math.abs(page.viewportSize()!.height-(floorBox!.y+floorBox!.height))).toBeLessThanOrEqual(1);
  const hint=page.locator('[data-myko-hint]');const hintBox=await hint.boundingBox(),mykoBox=await myko.boundingBox();expect(hintBox!.y).toBeLessThan((await stage.boundingBox())!.y);expect(hintBox!.x+hintBox!.width).toBeGreaterThan(mykoBox!.x+mykoBox!.width-15);
  const rect=await stage.boundingBox();const cx=rect!.x+rect!.width*478.8/1254,cy=rect!.y+rect!.width*449.5/1254;
  for(let i=0;i<8;i++){
    const angle=i*Math.PI/4;
    await page.mouse.move(cx+Math.cos(angle)*70,cy+Math.sin(angle)*70);
    const gaze=await myko.evaluate(el=>({x:parseFloat((el as HTMLElement).style.getPropertyValue('--eye-x'))/26,y:parseFloat((el as HTMLElement).style.getPropertyValue('--eye-y'))/45}));
    const length=Math.hypot(gaze.x,gaze.y);expect(length).toBeGreaterThan(.3);
    expect(gaze.x/length).toBeCloseTo(Math.cos(angle),1);expect(gaze.y/length).toBeCloseTo(Math.sin(angle),1);
  }
  await page.mouse.move(10,20);await page.clock.runFor(250);
  const readOffset=()=>page.locator('.gaze').evaluate(el=>{const m=new DOMMatrix(getComputedStyle(el).transform);const scale=el.closest('svg')!.getBoundingClientRect().width/1254;return{x:m.e*scale,y:m.f*scale};});
  await expect.poll(async()=>(await readOffset()).x).toBeLessThan(-1);await expect.poll(async()=>(await readOffset()).y).toBeLessThan(-4);
  await expect(page.locator('.myko-face [clip-path]')).toHaveAttribute('clip-path','url(#myko-visor)');
  await page.mouse.move(page.viewportSize()!.width-5,20);
  await expect.poll(async()=>(await readOffset()).x).toBeGreaterThan(0);
  await expect.poll(async()=>(await readOffset()).y).toBeLessThan(-4);
  const first=await myko.getAttribute('style');
  await page.mouse.move(10,200);expect(await myko.getAttribute('style')).not.toBe(first);
  expect(await stage.evaluate(el=>el.getAnimations().length)).toBe(0);
});
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
  const photo=await page.locator('.profile-main').boundingBox(),myko=await page.locator('[data-myko]').boundingBox();expect(photo!.width).toBeGreaterThan(myko!.width);await expect(page.locator('canvas')).toHaveCount(0);
  const tab=page.getByRole('tab',{name:'What I build',exact:true});await tab.click();await expect(page.getByRole('tabpanel')).toContainText('PVC pipes');await tab.press('ArrowRight');await expect(page.getByRole('tab',{name:'What I’m exploring'})).toBeFocused();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);expect(errors).toEqual([]);
});
test('social notes use the published profiles and Myko offers contact',async({page})=>{
  await page.goto('/about/');
  const socials=page.getByRole('navigation',{name:'Omar’s social profiles'});
  await expect(socials.getByRole('link',{name:'X: @mycolabz'})).toHaveAttribute('href','https://x.com/mycolabz');
  await expect(socials.getByRole('link',{name:'LinkedIn: Omar Ahmad'})).toHaveAttribute('href','https://www.linkedin.com/in/omar-ahmad-916378186/');
  await expect(socials.getByRole('link',{name:'TikTok: @mycolabs'})).toHaveAttribute('href','https://www.tiktok.com/@mycolabs');
  const contact=page.locator('[data-myko-contact]');await expect(contact).toBeVisible();await expect(contact).toHaveText('Contact me');
  const href=await contact.getAttribute('href');if(href)expect(href).toMatch(/^mailto:.+\?subject=Hello%20from%20Smart%20Mushroom%20Hub$/);else await expect(contact).toHaveAttribute('data-contact-unconfigured','');
});
test('reduced motion keeps expressions but stops movement',async({page})=>{
  await page.emulateMedia({reducedMotion:'reduce'});await page.goto('/about/');await expect(page.locator('[data-myko-motion]')).toHaveCount(0);await page.getByRole('button',{name:'Say hello to Myko'}).click();await expect(page.locator('[data-myko]')).toHaveAttribute('data-mood','happy');await expect(page.locator('[data-myko]')).not.toHaveAttribute('data-animate');
});
