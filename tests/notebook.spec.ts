import {test,expect} from '@playwright/test';

test('notebook turns pages, jumps sections, restores history and enlarges photographs',async({page},info)=>{
  await page.addInitScript(()=>{
    const Original=window.Audio;const sounds:{audio:HTMLAudioElement;plays:number}[]=[];Object.assign(window,{notebookAudio:sounds});
    window.Audio=function(src?:string){const audio=new Original(src);const record={audio,plays:0};sounds.push(record);audio.addEventListener('playing',()=>record.plays++);return audio;} as unknown as typeof Audio;
  });
  const errors:string[]=[];page.on('pageerror',error=>errors.push(error.message));
  await page.goto('/documentation/#notebook-idea');
  const book=page.locator('[data-notebook]');
  await expect(book).toHaveAttribute('data-enhanced','true');
  const status=book.locator('[data-nb-status]');
  const mobile=info.project.name==='mobile';
  await expect(status).toContainText(mobile?'Page 1 / 14':'Pages 1–2 / 14');
  await expect(book.getByRole('button',{name:'Previous notebook page',exact:true})).toBeDisabled();
  await book.getByRole('link',{name:/Enlarge photograph/}).first().click();
  const dialog=book.locator('.nb-lightbox');await expect(dialog).toBeVisible();
  await expect(dialog.locator('img')).toHaveJSProperty('naturalWidth',1600);
  await expect(dialog).toContainText('19 August 2026');
  await page.keyboard.press('Escape');await expect(dialog).not.toBeVisible();
  await expect(book.getByRole('link',{name:/Enlarge photograph/}).first()).toBeFocused();
  await book.getByLabel('Photo note: The Idea',{exact:true}).click();
  await expect(book.locator('#notebook-idea .nb-annotation')).toHaveAttribute('open','');
  // The leaf only lives for the length of the turn, so it is noted as it appears rather than raced against.
  await book.locator('[data-nb-fold]').evaluate(fold=>new MutationObserver(()=>{if(fold.querySelector('.nb-leaf'))Reflect.set(window,'notebookLeafSeen',true);}).observe(fold,{childList:true}));
  await book.getByRole('button',{name:'Next notebook page',exact:true}).click();
  await expect.poll(()=>page.evaluate(()=>Reflect.get(window,'notebookAudio').find((item:any)=>item.audio.src.endsWith('paper-swipe.mp3'))?.plays??0)).toBeGreaterThan(0);
  await expect(status).toContainText(mobile?'Page 2 / 14':'Pages 3–4 / 14');
  expect(await page.evaluate(()=>Reflect.get(window,'notebookLeafSeen'))).toBe(true);
  await expect(book.locator('[data-nb-fold] .nb-leaf')).toHaveCount(0);
  await book.locator('.nb-tabs').getByRole('link',{name:'05 Vision Lab'}).click();
  await expect(status).toContainText('Vision Lab');
  await expect(page).toHaveURL(/#notebook-vision$/);
  await page.reload();await expect(status).toContainText('Vision Lab');
  await book.locator('.nb-tabs').getByRole('link',{name:'07 What Went Wrong'}).click();
  if(mobile)await book.getByRole('button',{name:'Next notebook page',exact:true}).click();
  await expect(book.getByRole('button',{name:'Next notebook page',exact:true})).toBeDisabled();
  await page.goBack();await expect(status).toContainText(mobile?'What Went Wrong':'Vision Lab');
  await book.locator('.nb-contents summary').click();
  await book.getByRole('navigation',{name:'Notebook contents'}).getByRole('link',{name:'02 The Build'}).click();
  await expect(status).toContainText('The Build');
  await page.keyboard.press('ArrowRight');await expect(status).toContainText(mobile?'Page 4':'The Software');
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
  expect(errors).toEqual([]);
});

test('reduced motion skips folds and the notebook is all the page holds',async({page})=>{
  await page.emulateMedia({reducedMotion:'reduce'});
  await page.goto('/documentation/#notebook-vision--notes');
  const book=page.locator('[data-notebook]');
  await expect(book.locator('[data-nb-status]')).toContainText('Vision Lab');
  await book.getByRole('button',{name:'Previous notebook page',exact:true}).click();
  await expect(book.locator('.nb-leaf')).toHaveCount(0);
  // The reference shelf that used to follow the notebook is gone, along with the links into it.
  await expect(page.locator('#reference-notes,#physical-setup,#limitations')).toHaveCount(0);
  await expect(page.getByRole('article',{name:'System documentation'})).toHaveCount(0);
  await expect(page.locator('main a[href*="#reference-notes"],main a[href*="#limitations"]')).toHaveCount(0);
});

test('all entries and image links remain readable without JavaScript',async({browser},info)=>{
  const context=await browser.newContext({javaScriptEnabled:false,viewport:info.project.use.viewport});
  const page=await context.newPage();await page.goto(`${test.info().project.use.baseURL}/documentation/`);
  const book=page.locator('[data-notebook]');
  await expect(book.locator('.nb-spread')).toHaveCount(7);
  for(const spread of await book.locator('.nb-spread').all())await expect(spread).toBeVisible();
  await expect(book.locator('[data-nb-controls]')).toBeHidden();
  await expect(book.locator('[data-nb-image]').first()).toHaveAttribute('href','/media/photo-incubation-2026-08-19.webp');
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
  await context.close();
});

test('horizontal gestures turn the paper without requiring a page corner',async({page})=>{
  await page.goto('/documentation/#notebook-idea');
  const binding=page.locator('[data-nb-binding]');
  await page.getByRole('button',{name:'Turn to next page',exact:true}).click();
  await expect(page.locator('[data-nb-status]')).not.toContainText('Pages 1–2');
  await page.getByRole('button',{name:'Turn to previous page',exact:true}).click();
  await binding.dispatchEvent('pointerdown',{clientX:250,clientY:350,pointerId:1,pointerType:'touch'});
  await binding.dispatchEvent('pointerup',{clientX:110,clientY:355,pointerId:1,pointerType:'touch'});
  await expect(page.locator('[data-nb-status]')).not.toContainText('Page 1 /');
  await expect(page.locator('[data-nb-status]')).not.toContainText('Pages 1–2');
});

test('soft page folds keep readable faces in both directions and land on the incoming page',async({page},info)=>{
  await page.goto('/documentation/#notebook-idea');
  const book=page.locator('[data-notebook]');
  const before=await book.locator('[data-nb-binding]').boundingBox();
  for(const direction of ['next','prev']){
    await book.evaluate((root,direction)=>{
      (root.querySelector(`[data-nb-controls] [data-nb-${direction}]`) as HTMLButtonElement).click();
      const animation=root.querySelector<HTMLElement>('.nb-leaf')!.getAnimations()[0];animation.pause();animation.currentTime=animation.effect!.getTiming().duration as number*.5;
    },direction);
    const state=await book.evaluate(root=>new Promise<{det:number;front:string;frontText:string;back:string;under:number}>(resolve=>requestAnimationFrame(()=>requestAnimationFrame(()=>{
      const leaf=root.querySelector<HTMLElement>('.nb-leaf')!;
      const [a,b,c,d]=(getComputedStyle(leaf.querySelector('.nb-leaf-flap')!).transform.match(/-?[\d.e]+/g)??['1','0','0','1']).map(Number);
      resolve({det:a*d-b*c,front:leaf.querySelector<HTMLElement>('.nb-leaf-front')!.style.clipPath,frontText:leaf.querySelector('.nb-leaf-front')!.textContent??'',back:leaf.querySelector('.nb-leaf-back')!.textContent??'',under:leaf.querySelectorAll('.nb-leaf-under > .nb-page').length});
    }))));
    // The reverse is a rotation of its page, never a mirror image, and the fold clips the front.
    expect(state.det).toBeCloseTo(1,3);
    expect(state.front).toMatch(/^polygon\(/);
    expect(state.under).toBe(info.project.name==='desktop'?2:1);
    // Either way the leaving page is the front and the incoming page is its reverse: going back, the left page lifts.
    if(info.project.name==='desktop'){if(direction==='next')expect(state.back).toContain('Follow the wire');else{expect(state.frontText).toContain('Follow the wire');expect(state.back).toContain('Why create a controlled habitat?');}}
    await book.locator('.nb-leaf').evaluate(el=>el.getAnimations()[0].finish());
    await expect(book.locator('.nb-leaf')).toHaveCount(0);
  }
  const after=await book.locator('[data-nb-binding]').boundingBox();
  expect(after!.width).toBeCloseTo(before!.width,1);expect(after!.height).toBeCloseTo(before!.height,1);
});

test('a dragged page follows the pointer, springs back when released early and turns when carried over',async({page},info)=>{
  test.skip(info.project.name!=='desktop','Mouse dragging is checked on the desktop spread.');
  await page.goto('/documentation/#notebook-idea');
  const book=page.locator('[data-notebook]');const status=book.locator('[data-nb-status]');
  await page.waitForTimeout(1200);
  const box=(await book.locator('[data-nb-fold]').boundingBox())!;
  const drag=async(distance:number)=>{
    await page.mouse.move(box.x+box.width-40,box.y+box.height-90);await page.mouse.down();
    for(let step=1;step<=8;step++)await page.mouse.move(box.x+box.width-40-distance*step/8,box.y+box.height-90-step*6);
  };
  await drag(120);
  await expect(book.locator('.nb-leaf')).toHaveAttribute('data-kind','drag');
  expect(await book.locator('.nb-leaf-front').evaluate(el=>el.style.clipPath)).toMatch(/^polygon\(/);
  await page.mouse.up();
  await expect(book.locator('.nb-leaf')).toHaveCount(0);
  await expect(status).toContainText('Pages 1–2');
  await drag(box.width*.6);await page.mouse.up();
  await expect(status).toContainText('Pages 3–4');
  await expect(book.locator('.nb-leaf')).toHaveCount(0);
  await expect(page).toHaveURL(/#notebook-build$/);
});

test('hovering a page corner lifts it and clicking continues the turn',async({page},info)=>{
  test.skip(info.project.name!=='desktop','Hover peeks need a fine pointer.');
  await page.goto('/documentation/#notebook-idea');
  const book=page.locator('[data-notebook]');
  await page.waitForTimeout(1200);
  const corner=book.getByRole('button',{name:'Turn to next page',exact:true});
  await corner.hover();
  await expect(book.locator('.nb-leaf')).toHaveAttribute('data-kind','peek');
  await page.mouse.move(20,20);
  await expect(book.locator('.nb-leaf')).toHaveCount(0);
  await corner.hover();await expect(book.locator('.nb-leaf')).toHaveAttribute('data-kind','peek');
  await corner.click();
  await expect(book.locator('[data-nb-status]')).toContainText('Pages 3–4');
  await expect(book.locator('.nb-leaf')).toHaveCount(0);
});

test('the bottom-left corner lifts the left page itself and a drag from it keeps hold of the paper',async({page},info)=>{
  test.skip(info.project.name!=='desktop','Hover peeks need a fine pointer.');
  await page.goto('/documentation/#notebook-lessons');
  const book=page.locator('[data-notebook]'),status=book.locator('[data-nb-status]');
  await page.waitForTimeout(1200);
  const corner=book.getByRole('button',{name:'Turn to previous page',exact:true});
  await corner.hover();
  await expect(book.locator('.nb-leaf')).toHaveAttribute('data-kind','peek');
  await page.waitForTimeout(500);
  // The page still lying on the left is the one being read, not the spread before it.
  const lifted=await book.locator('.nb-leaf').evaluate(leaf=>({front:leaf.querySelector('.nb-leaf-front')!.textContent??'',left:(leaf.querySelector('.nb-leaf-front') as HTMLElement).style.left,clip:(leaf.querySelector('.nb-leaf-front') as HTMLElement).style.clipPath}));
  expect(lifted.front).toContain('A restart');expect(lifted.left).toBe('0px');expect(lifted.clip).toMatch(/^polygon\(/);
  // Dragging on from the peek: the paper stays where the pointer left it instead of dropping back to the corner.
  const box=(await corner.boundingBox())!;
  await page.mouse.down();
  for(let step=1;step<=6;step++)await page.mouse.move(box.x+22+step*50,box.y+22-step*5);
  await page.waitForTimeout(400);
  const held=await book.locator('.nb-leaf-front').evaluate(el=>(el as HTMLElement).style.clipPath);
  expect(held).not.toBe(lifted.clip);
  await expect(status).toContainText('Pages 13–14');
  for(let step=1;step<=6;step++)await page.mouse.move(box.x+322+step*90,box.y-8);
  await page.mouse.up();
  await expect(status).toContainText('Pages 11–12');
  await expect(book.locator('.nb-leaf')).toHaveCount(0);
});

test('Initial design sticker opens the PVC drawing and cut list without resizing the notebook',async({page})=>{
  await page.goto('/documentation/#journey-pvc-pipes');
  const book=page.locator('[data-notebook]');
  const binding=book.locator('[data-nb-binding]');
  const before=await binding.boundingBox();
  const sticker=book.getByRole('button',{name:/Initial design/});
  await sticker.click();
  const dialog=book.getByRole('dialog',{name:'Initial design'});
  await expect(dialog).toBeVisible();
  await expect(dialog.locator('img')).toHaveJSProperty('naturalWidth',1200);
  await expect(dialog.locator('tbody tr')).toHaveCount(6);
  await expect(dialog.locator('tbody')).toContainText('42T joints');
  await expect(dialog.locator('tbody')).toContainText('416.75-inch pieces');
  await page.keyboard.press('Escape');
  await expect(dialog).not.toBeVisible();
  await expect(sticker).toBeFocused();
  const after=await binding.boundingBox();
  expect(after!.width).toBeCloseTo(before!.width,1);
  expect(after!.height).toBeCloseTo(before!.height,1);
});

test('Raspberry Pi note keeps its dated photographs accessible without resizing the notebook',async({page},info)=>{
  await page.goto('/documentation/#journey-raspberry-pi');
  const book=page.locator('[data-notebook]');
  const binding=book.locator('[data-nb-binding]');
  const before=await binding.boundingBox();
  if(info.project.name==='mobile'){
    await book.getByRole('button',{name:'Photos & dates'}).click();
    const dialog=book.getByRole('dialog',{name:'Photos & dates'});
    await expect(dialog).toBeVisible();
    const collection=dialog.locator('[data-journey-photos-panel="raspberry-pi"]');
    await expect(collection.locator('.journey-photo-card')).toHaveCount(3);
    await expect(collection.locator('time')).toHaveText(['17 May 2026','22 June 2026','28 June 2026']);
    await page.keyboard.press('Escape');
    await expect(dialog).not.toBeVisible();
  }else{
    const board=book.getByLabel('Raspberry Pi build photographs');
    await expect(board).toBeVisible();
    await expect(board.locator('.journey-photo-card')).toHaveCount(3);
    await expect(board.locator('time')).toHaveText(['17 May 2026','22 June 2026','28 June 2026']);
    await board.getByRole('link',{name:/initial hardware setup/i}).click();
    await expect(book.locator('.nb-lightbox')).toBeVisible();
    await page.keyboard.press('Escape');
  }
  const after=await binding.boundingBox();
  expect(after!.width).toBeCloseTo(before!.width,1);
  expect(after!.height).toBeCloseTo(before!.height,1);
});


test('The Journey is sixth with eleven independent paper notes and persistent links',async({page},info)=>{
  await page.goto('/documentation/#notebook-journey');
  const book=page.locator('[data-notebook]');
  const main=book.locator('.nb-tabs');
  await expect(main.locator('a').nth(5)).toHaveText('06The Journey');
  await expect(main.locator('a').nth(6)).toHaveText('07What Went Wrong');
  if(info.project.name==='mobile')await book.getByRole('button',{name:'Next notebook page',exact:true}).click();
  const tabs=book.getByRole('navigation',{name:'The Journey mini sections'});
  await expect(tabs.getByRole('link')).toHaveCount(11);
  for(const tab of await tabs.getByRole('link').all()){
    const slug=await tab.getAttribute('data-journey-tab');await tab.click();
    await expect(book.locator(`[data-journey-panel="${slug}"]`)).toBeVisible();
    await expect(book.locator('[data-journey-panel]:visible')).toHaveCount(1);
    await expect(tab).toHaveAttribute('aria-current','page');
    await expect(page).toHaveURL(new RegExp(`#journey-${slug}$`));
  }
  await page.reload();await expect(book.locator('[data-journey-panel="mushroom-cultivation"]')).toBeVisible();
  await page.goBack();await expect(book.locator('[data-journey-panel="mosfets-wiring"]')).toBeVisible();
  if(info.project.name==='desktop'){
    const paper=await book.locator('[data-nb-binding]').boundingBox();const rail=await tabs.boundingBox();
    expect(rail!.x).toBeGreaterThanOrEqual(paper!.x+paper!.width-5);
    for(const label of await tabs.locator('.journey-tab-label').all())await expect(label).toHaveCSS('opacity','1');
  }
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
  const journeyBox=await book.locator('[data-nb-binding]').boundingBox();
  await main.getByRole('link',{name:'07 What Went Wrong'}).click();
  await expect(tabs).not.toBeVisible();
  const otherBox=await book.locator('[data-nb-binding]').boundingBox();
  for(const key of ['x','width','height'] as const)expect(journeyBox![key]).toBeCloseTo(otherBox![key],1);
});

test('The Software is third: icon stickers and coloured tabs open ten layer notes that fit their paper',async({page},info)=>{
  const mobile=info.project.name==='mobile';
  await page.goto('/documentation/#notebook-build');
  const book=page.locator('[data-notebook]'),status=book.locator('[data-nb-status]');
  const before=await book.locator('[data-nb-binding]').boundingBox();
  await book.locator('.nb-tabs').getByRole('link',{name:'03 The Software'}).click();
  await expect(page).toHaveURL(/#notebook-software$/);
  await expect(book.locator('[data-nb-fold] .nb-leaf')).toHaveCount(0);
  // The facing page carries one sticker per layer, each with its icon.
  const stickers=book.locator('#notebook-software [data-note-pick]');
  await expect(stickers).toHaveCount(10);
  for(const sticker of await stickers.all())expect(await sticker.locator('svg').count()).toBeGreaterThan(0);
  await expect(stickers.first()).toHaveAttribute('aria-current','page');
  // A sticker opens its layer's note; on a phone it also turns to the note's page.
  await stickers.filter({hasText:'Controller'}).click();
  await expect(page).toHaveURL(/#software-controller$/);
  const note=book.locator('#software-controller');
  await expect(note).toBeVisible();
  await expect(note).toContainText('Environment Controller');
  for(const label of ['What it does','How it works','Output / Destination'])await expect(note.getByRole('heading',{name:label})).toBeVisible();
  await expect(note).toContainText('low humidity can trigger a humidifier decision');
  await expect(status).toContainText('The Software · Controller');
  await expect(book.locator('#notebook-software [data-journey-panel]:visible')).toHaveCount(1);
  // Every layer's words fit inside its note, and no note changes the notebook's size.
  const tabs=book.getByRole('navigation',{name:'The Software layers'});
  await expect(tabs.getByRole('link')).toHaveCount(10);
  for(const tab of await tabs.getByRole('link').all()){
    const slug=await tab.getAttribute('data-journey-tab');await tab.click();
    const panel=book.locator(`#software-${slug}`);
    await expect(panel).toBeVisible();await expect(tab).toHaveAttribute('aria-current','page');
    expect(await panel.evaluate(el=>el.lastElementChild!.getBoundingClientRect().bottom<=el.getBoundingClientRect().bottom-parseFloat(getComputedStyle(el).paddingBottom)+1)).toBe(true);
  }
  await expect(page).toHaveURL(/#software-grafana$/);
  if(!mobile)await expect(stickers.last()).toHaveAttribute('aria-current','page');
  const after=await book.locator('[data-nb-binding]').boundingBox();
  for(const key of ['x','width','height'] as const)expect(after![key]).toBeCloseTo(before![key],1);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
  // A layer's link survives a reload, and The Journey no longer carries a software note.
  await page.reload();await expect(book.locator('#software-grafana')).toBeVisible();
  await expect(book.locator('#notebook-journey [data-journey-panel="software"]')).toHaveCount(0);
});

test('the Build table names open each part in the 3D habitat',async({page},info)=>{
  // Phones show one page at a time; the table is on The Build's writing page.
  await page.goto(info.project.name==='mobile'?'/documentation/#notebook-build--notes':'/documentation/#notebook-build');
  const table=page.locator('[data-nb-page="3"] .hardware-notebook');
  for(const [name,part] of [['Frame','frame'],['Computing','pi'],['Ventilation','fan'],['Power','ups']] as const)
    await expect(table.getByRole('link',{name:`${name}: see it in the 3D habitat`})).toHaveAttribute('href',`/#study-${part}`);
  await expect(table.locator('th a')).toHaveCount(9);
});

test('handwriting writes itself once as a page settles and stays still with reduced motion',async({page,browser},info)=>{
  await page.goto('/documentation/#notebook-idea');
  const book=page.locator('[data-notebook]');
  const scribble=book.locator('[data-nb-page="0"] .nb-scribble');
  await expect(scribble).toHaveAttribute('data-ink','written');
  await expect(scribble).toHaveText('A small space. Plenty of questions.');
  expect(await scribble.locator('.nb-ink').count()).toBe(6);
  if(info.project.name==='desktop')await expect(book.locator('[data-nb-page="1"] h2')).toHaveAttribute('data-ink','written');
  const reduced=await browser.newContext({reducedMotion:'reduce',viewport:info.project.use.viewport});
  const still=await reduced.newPage();await still.goto(`${info.project.use.baseURL}/documentation/#notebook-idea`);
  await expect(still.locator('[data-notebook]')).toHaveAttribute('data-enhanced','true');
  await still.waitForTimeout(800);
  expect(await still.locator('.nb-ink').count()).toBe(0);
  await reduced.close();
});

test('growing notes flip through the three dated stills without turning or resizing the notebook',async({page},info)=>{
  await page.goto('/documentation/#notebook-growing');
  const book=page.locator('[data-notebook]'),flipbook=book.locator('[data-nb-flipbook]'),slider=flipbook.getByRole('slider',{name:'Incubation photograph date'});
  const status=book.locator('[data-nb-status]');
  const before=await book.locator('[data-nb-binding]').boundingBox();
  await expect(slider).toHaveAttribute('aria-valuetext','27 August 2026');
  await expect(flipbook.locator('figcaption')).toHaveText('An incubation observation · 27 August 2026');
  await slider.focus();await page.keyboard.press('End');
  await expect(slider).toHaveAttribute('aria-valuetext','4 September 2026');
  await expect(flipbook.locator('figcaption')).toHaveText('An incubation observation · 4 September 2026');
  await expect(flipbook.getByRole('link')).toHaveAttribute('href','/media/photo-incubation-2026-09-04.webp');
  await expect(flipbook.getByRole('img')).toHaveAttribute('alt',/4 September 2026/);
  await page.keyboard.press('ArrowLeft');await expect(slider).toHaveAttribute('aria-valuetext','27 August 2026');
  await expect(status).toContainText('Growing Notes');
  if(info.project.name==='desktop'){
    const frame=(await flipbook.locator('.nb-flip-frame').boundingBox())!;
    await page.mouse.move(frame.x+frame.width*.7,frame.y+30);await page.mouse.down();
    for(let step=1;step<=6;step++)await page.mouse.move(frame.x+frame.width*.7-step*frame.width*.09,frame.y+30);
    await page.mouse.up();
    await expect(slider).toHaveAttribute('aria-valuetext','19 August 2026');
    await expect(book.locator('.nb-lightbox')).toBeHidden();
    await expect(status).toContainText('Growing Notes');
  }
  await flipbook.getByRole('link').click({position:{x:40,y:40}});
  await expect(book.locator('.nb-lightbox img')).toHaveAttribute('src',info.project.name==='desktop'?/\/media\/photo-incubation-2026-08-19\.webp$/:/\/media\/photo-incubation-2026-08-27\.webp$/);
  await page.keyboard.press('Escape');
  const after=await book.locator('[data-nb-binding]').boundingBox();
  expect(after!.width).toBeCloseTo(before!.width,1);expect(after!.height).toBeCloseTo(before!.height,1);
});

test('a lens magnifies photographs on hover or press-and-hold without turning the page',async({page},info)=>{
  await page.goto('/documentation/#notebook-idea');
  const book=page.locator('[data-notebook]'),lens=book.locator('.nb-loupe'),status=book.locator('[data-nb-status]');
  await expect(book).toHaveAttribute('data-enhanced','true');await page.waitForTimeout(1200);
  const photo=book.locator('[data-nb-page="0"] .nb-photo img');
  // The lens hides while the page scrolls, so settle the scroll before pointing at the photo.
  await photo.evaluate(el=>el.scrollIntoView({block:'center',behavior:'instant'}));await page.waitForTimeout(300);
  const box=(await photo.boundingBox())!;const x=box.x+box.width*.4,y=box.y+box.height*.45;
  if(info.project.name==='desktop'){
    await page.mouse.move(x,y);await page.mouse.move(x+4,y+3);
    await expect(lens).toHaveAttribute('data-on','');
    expect(await lens.evaluate(el=>getComputedStyle(el).backgroundImage)).toContain('photo-incubation-2026-08-19.webp');
    await page.mouse.move(4,4);await expect(lens).not.toHaveAttribute('data-on');
    return;
  }
  const touch=await page.context().newCDPSession(page);
  await touch.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x,y}]});
  await expect(lens).toHaveAttribute('data-on','');
  for(let step=1;step<=5;step++)await touch.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:x+step*16,y}]});
  await touch.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
  await expect(lens).not.toHaveAttribute('data-on');
  await expect(book.locator('.nb-lightbox')).toBeHidden();
  await expect(status).toContainText('Page 1 / 14');
});

test('photo notes are pencilled on, then open from a sticky note',async({page})=>{
  await page.goto('/documentation/#notebook-idea');
  const photo=page.locator('#notebook-idea .nb-photo');
  const marks=photo.locator('.nb-marks');
  await expect(marks.locator('.nb-mark')).toHaveCount(2);
  await expect(marks).toHaveAttribute('data-ink','written');
  await expect.poll(()=>marks.locator('.nb-mark').first().evaluate(el=>getComputedStyle(el).strokeDashoffset),{timeout:10_000}).toMatch(/^0(px)?$/);
  const note=photo.getByLabel('Photo note: The Idea',{exact:true});
  await note.click();
  await expect(photo.locator('.nb-annotation')).toHaveAttribute('open','');
  await expect(photo.locator('.nb-annotation p')).toContainText('The hanging bags contain the growing substrate.');
});

test('on phones a Build steps sheet names every Journey step and closes after a choice',async({page},info)=>{
  test.skip(info.project.name!=='mobile','The tab rail shows its labels on the wide desktop layout.');
  await page.goto('/documentation/#journey-pvc-pipes');
  const book=page.locator('[data-notebook]'),chooser=book.getByRole('button',{name:/Build steps/});
  await expect(chooser).toBeVisible();await expect(chooser).toContainText('01 / 11');
  const before=await book.locator('[data-nb-binding]').boundingBox();
  // The collapsed tab rail no longer spreads its labels over the writing.
  await book.locator('[data-journey-tab="fan"]').click();
  await expect(book.locator('#notebook-journey .journey-tabs')).toHaveCSS('width','28px');
  await chooser.click();
  const sheet=page.getByRole('dialog',{name:'Choose a build step'});
  await expect(sheet.getByRole('link')).toHaveCount(11);
  await expect(sheet.getByRole('link',{name:/Fan/})).toHaveAttribute('aria-current','page');
  await sheet.getByRole('link',{name:/Sensors/}).click();
  await expect(sheet).toBeHidden();
  await expect(book.locator('[data-journey-panel="sensors"]')).toBeVisible();
  await expect(page).toHaveURL(/#journey-sensors$/);
  await expect(chooser).toContainText('08 / 11');await expect(chooser).toBeFocused();
  const after=await book.locator('[data-nb-binding]').boundingBox();
  expect(after!.width).toBeCloseTo(before!.width,1);expect(after!.height).toBeCloseTo(before!.height,1);
});

test('phone photo pages pin the photograph note in their free space without resizing',async({page},info)=>{
  await page.goto('/documentation/#notebook-idea');
  const book=page.locator('[data-notebook]');
  const pinned=book.locator('[data-nb-page="0"] .nb-pinned-note');
  if(info.project.name==='desktop'){await expect(pinned).toHaveCount(0);return;}
  await expect(pinned).toContainText('The hanging bags contain the growing substrate.');
  await expect(pinned).toHaveAttribute('aria-hidden','true');
  const fits=await book.locator('[data-nb-page="0"]').evaluate(pageElement=>{
    const note=pageElement.querySelector<HTMLElement>('.nb-pinned-note')!,folio=pageElement.querySelector<HTMLElement>(':scope > .nb-folio')!;
    return note.offsetTop+note.offsetHeight<=folio.offsetTop-12;
  });
  expect(fits).toBe(true);
});
