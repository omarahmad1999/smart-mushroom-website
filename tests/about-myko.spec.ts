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
test('clicking Myko tells a running sequence and too many clicks make him dizzy',async({page})=>{
  await page.clock.install();await page.clock.pauseAt(new Date(Date.now()+1000));await page.goto('/about/');
  const myko=page.locator('[data-myko]'),hello=page.getByRole('button',{name:'Say hello to Myko'}),hint=page.locator('[data-myko-hint]');
  for(const line of ['Hi! I’m Myko.','Hehe, that tickles!','The mushrooms grew on me.','Small explorer, big world.','Fungi connect worlds.','Hehe, that tickles!']){await hello.press('Enter');await expect(hint).toHaveText(line);await page.clock.runFor(3000);}
  await expect(myko).toHaveAttribute('data-mood','neutral');await expect(myko.locator('[data-myko-say]')).toHaveText('Hehe, that tickles!');
  for(let i=0;i<5;i++)await hello.press('Enter');
  await expect(myko).toHaveAttribute('data-mood','dizzy');await expect(myko.locator('.dizzy')).toBeVisible();await expect(myko.locator('[data-emotion-symbol]')).toHaveText('@');
  await hello.press('Enter');await expect(myko).toHaveAttribute('data-mood','dizzy');
  await page.clock.runFor(2400);await expect(myko).toHaveAttribute('data-mood','melancholic');await expect(hint).toHaveText('Okay, okay…');
  await hello.press('Enter');await expect(hint).toHaveText('Okay, okay…');
  await page.clock.runFor(3000);await expect(myko).toHaveAttribute('data-mood','neutral');await hello.press('Enter');await expect(myko).toHaveAttribute('data-mood','curious');await expect(hint).toHaveText('The mushrooms grew on me.');
});
test('tapping the caps, visor and backpack gets different reactions',async({page})=>{
  await page.goto('/about/');
  const myko=page.locator('[data-myko]'),hint=page.locator('[data-myko-hint]'),box=(await page.locator('.myko-stage').boundingBox())!;
  const tap=(x:number,y:number)=>page.mouse.click(box.x+box.width*x/1254,box.y+box.height*y/1254);
  await tap(616,70);await expect(myko).toHaveAttribute('data-mood','curious');await expect(hint).toHaveText('Ooh, spores!');
  expect(await myko.locator('[data-myko-spores] i').count()).toBeGreaterThan(5);
  await expect.poll(async()=>parseFloat(await myko.evaluate(el=>(el as HTMLElement).style.getPropertyValue('--eye-y')))).toBeLessThan(-20);
  await expect.poll(()=>myko.locator('[data-myko-spores] i').count(),{timeout:5000}).toBe(0);
  await tap(470,420);await expect(myko).toHaveAttribute('data-mood','squint');await expect(hint).toHaveText('Hey! That’s my visor.');await expect(myko.locator('.squint')).toBeVisible();
  await tap(950,560);await expect(myko).toHaveAttribute('data-mood','happy');await expect(hint).toHaveText('My field kit!');
  await tap(560,800);await expect(hint).toHaveText('Hi! I’m Myko.');
});
test('creeping up on sleeping Myko wakes one eye, while a normal move wakes him',async({page})=>{
  await page.clock.install();await page.clock.pauseAt(new Date(Date.now()+1000));await page.goto('/about/');
  const myko=page.locator('[data-myko]'),hint=page.locator('[data-myko-hint]'),box=(await page.locator('.myko-stage').boundingBox())!;
  const visorX=box.x+box.width*502/1254,y=box.y+box.height*442/1254;let x=visorX-80;
  await page.mouse.move(x,y);await page.clock.runFor(4000);await expect(myko).toHaveAttribute('data-mood','sleepy');
  for(let i=0;i<10;i++){x+=2;await page.mouse.move(x,y);await page.clock.runFor(40);}
  await expect(myko).toHaveAttribute('data-mood','sleepy');
  while(x<visorX&&await myko.getAttribute('data-mood')==='sleepy'){x+=2;await page.mouse.move(x,y);await page.clock.runFor(40);}
  await expect(myko).toHaveAttribute('data-mood','peek');await expect(hint).toHaveText('…you’re sneaky.');await expect(myko.locator('.peek')).toBeVisible();
  await page.clock.runFor(2600);await expect(myko).toHaveAttribute('data-mood','neutral');
  await page.clock.runFor(4000);await expect(myko).toHaveAttribute('data-mood','sleepy');
  await page.mouse.move(x+30,y);await expect(myko).toHaveAttribute('data-mood','surprised');
});
test('photo leads the layout and story tabs remain accessible',async({page})=>{
  const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));await page.goto('/about/');await expect(page.locator('[data-about-page]')).toHaveAttribute('data-about-ready','true');
  const photo=await page.locator('.profile-main').boundingBox(),myko=await page.locator('[data-myko]').boundingBox();expect(photo!.width).toBeGreaterThan(myko!.width);await expect(page.locator('canvas')).toHaveCount(0);
  const story=page.getByRole('tabpanel');await expect(story).toContainText('I’m a data analyst with a passion for farming.');await expect(story).toContainText('Riyadh, Saudi Arabia');await expect(story).toContainText('Cairo, Egypt');await expect(story).toContainText('Kuala Lumpur, Malaysia');await expect(story).not.toContainText('It started with mushrooms.');
  const tab=page.getByRole('tab',{name:'What I build',exact:true});await tab.click();await expect(page.getByRole('tabpanel')).toContainText('PVC pipes');await tab.press('ArrowRight');await expect(page.getByRole('tab',{name:'What I’m exploring'})).toBeFocused();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);expect(errors).toEqual([]);
});
test('social notes use the published profiles and Myko offers contact',async({page},info)=>{
  let sent:Record<string,string>|undefined;
  await page.route('**/api/contact',async route=>{sent=route.request().postDataJSON();await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({ok:true})});});
  await page.goto('/about/');
  await expect(page.getByRole('heading',{name:'Find me elsewhere.'})).toBeVisible();await expect(page.getByText('A few more places')).toHaveCount(0);
  const socials=page.getByRole('navigation',{name:'Omar’s social profiles'});
  await expect(socials.getByRole('link',{name:'X: @mycolabz'})).toHaveAttribute('href','https://x.com/mycolabz');
  await expect(socials.getByRole('link',{name:'LinkedIn: Omar Ahmad'})).toHaveAttribute('href','https://www.linkedin.com/in/omar-ahmad-916378186/');
  await expect(socials.getByRole('link',{name:'TikTok: @mycolabs'})).toHaveAttribute('href','https://www.tiktok.com/@mycolabs');
  await expect(socials.locator('.social-logo')).toHaveCount(3);
  const contact=page.locator('[data-myko-contact]');await expect(contact).toBeVisible();await expect(contact).toHaveText('Contact me');
  await expect(contact).toHaveCSS('background-color','rgb(33, 58, 53)');await expect(contact).toHaveCSS('color','rgb(255, 250, 240)');
  const bubble=await contact.boundingBox(),stage=await page.locator('.myko-stage').boundingBox(),visorX=stage!.x+stage!.width*478.8/1254,visorY=stage!.y+stage!.width*449.5/1254;expect(bubble!.x+bubble!.width/2).toBeLessThan(visorX);expect(bubble!.y+bubble!.height).toBeLessThan(visorY);
  await contact.click();const dialog=page.getByRole('dialog',{name:'Say hello to Omar.'});await expect(dialog).toBeVisible();await expect(dialog.getByLabel('Your name')).toBeVisible();await expect(dialog.getByLabel('Your email')).toHaveAttribute('type','email');await expect(dialog.getByLabel('Subject')).toHaveValue('Hello from Smart Mushroom Hub');await expect(dialog.getByLabel('Your message')).toBeVisible();
  await expect(dialog).not.toHaveAttribute('data-contact-email');await expect(dialog).toContainText('Your details are used only to deliver and reply to this message.');expect(await dialog.evaluate(el=>getComputedStyle(el).overflowY)).toBe(info.project.name==='mobile'?'auto':'hidden');const mailMyko=dialog.getByRole('img',{name:'Myko holding a letter for Omar'}),status=dialog.locator('[data-contact-status]');await expect(mailMyko).toBeVisible();await expect(status).toHaveText('Myko is ready when you are.');const mailBox=await mailMyko.boundingBox(),statusBox=await status.boundingBox(),dialogBox=await dialog.boundingBox();expect(mailBox!.x).toBeGreaterThan(dialogBox!.x+dialogBox!.width/2);expect(statusBox!.x).toBeLessThan(mailBox!.x);expect(statusBox!.y).toBeLessThan(mailBox!.y+mailBox!.height/2);
  await dialog.getByLabel('Your name').fill('Test Visitor');await dialog.getByLabel('Your email').fill('visitor@example.com');await dialog.getByLabel('Your message').fill('A test message from the contact form.');
  const submit=dialog.locator('.contact-submit');await expect(submit).toHaveAccessibleName(/Send message/);await expect(submit).toBeEnabled();await submit.click();await expect(status).toHaveText('Myko will make sure your message reaches Omar');expect((await status.boundingBox())!.height).toBeCloseTo(statusBox!.height,0);const deliveredDialog=await dialog.boundingBox();expect(deliveredDialog!.width).toBeCloseTo(dialogBox!.width,0);expect(deliveredDialog!.height).toBeCloseTo(dialogBox!.height,0);await expect(submit).toHaveAccessibleName(/Send another note/);await expect(submit).toBeEnabled();
  expect(sent).toEqual({name:'Test Visitor',email:'visitor@example.com',subject:'Hello from Smart Mushroom Hub',message:'A test message from the contact form.',website:''});
  await dialog.getByRole('button',{name:'Close contact form'}).click();await expect(dialog).toBeHidden();
});
test('reduced motion keeps expressions but stops movement',async({page})=>{
  await page.emulateMedia({reducedMotion:'reduce'});await page.goto('/about/');await expect(page.locator('[data-myko-motion]')).toHaveCount(0);await page.getByRole('button',{name:'Say hello to Myko'}).click();await expect(page.locator('[data-myko]')).toHaveAttribute('data-mood','happy');await expect(page.locator('[data-myko]')).not.toHaveAttribute('data-animate');
  const box=(await page.locator('.myko-stage').boundingBox())!;await page.mouse.click(box.x+box.width*616/1254,box.y+box.height*70/1254);await expect(page.locator('[data-myko-hint]')).toHaveText('Ooh, spores!');await expect(page.locator('[data-myko-spores] i')).toHaveCount(0);
});
