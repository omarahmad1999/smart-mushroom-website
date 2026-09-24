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
  await expect(status).toContainText(mobile?'Page 1 / 12':'Pages 1–2 / 12');
  await expect(book.getByRole('button',{name:'Previous notebook page',exact:true})).toBeDisabled();
  await book.getByRole('link',{name:/Enlarge photograph/}).first().click();
  const dialog=book.locator('.nb-lightbox');await expect(dialog).toBeVisible();
  await expect(dialog.locator('img')).toHaveJSProperty('naturalWidth',1600);
  await expect(dialog).toContainText('19 August 2026');
  await page.keyboard.press('Escape');await expect(dialog).not.toBeVisible();
  await expect(book.getByRole('link',{name:/Enlarge photograph/}).first()).toBeFocused();
  await book.getByLabel('Photo note: The Idea',{exact:true}).click();
  await expect(book.locator('#notebook-idea .nb-annotation')).toHaveAttribute('open','');
  await book.getByRole('button',{name:'Next notebook page',exact:true}).click();
  await expect.poll(()=>page.evaluate(()=>Reflect.get(window,'notebookAudio').find((item:any)=>item.audio.src.endsWith('paper-swipe.mp3'))?.plays??0)).toBeGreaterThan(0);
  await expect(status).toContainText(mobile?'Page 2 / 12':'Pages 3–4 / 12');
  await expect(book.locator('[data-nb-fold] .nb-leaf')).toHaveCount(1);
  await expect(book.locator('[data-nb-fold] .nb-leaf')).toHaveCount(0);
  await book.locator('.nb-tabs').getByRole('link',{name:'04 Vision Lab'}).click();
  await expect(status).toContainText('Vision Lab');
  await expect(page).toHaveURL(/#notebook-vision$/);
  await page.reload();await expect(status).toContainText('Vision Lab');
  await book.locator('.nb-tabs').getByRole('link',{name:'06 What Went Wrong'}).click();
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
  await expect(book.locator('.nb-spread')).toHaveCount(6);
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
    // Turning forward, the incoming page is the reverse; turning back, it is the returning front.
    if(info.project.name==='desktop'){if(direction==='next')expect(state.back).toContain('Follow the wire');else expect(state.frontText).toContain('Why create a controlled habitat?');}
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


test('The Journey is fifth with twelve independent paper notes and persistent links',async({page},info)=>{
  await page.goto('/documentation/#notebook-journey');
  const book=page.locator('[data-notebook]');
  const main=book.locator('.nb-tabs');
  await expect(main.locator('a').nth(4)).toHaveText('05The Journey');
  await expect(main.locator('a').nth(5)).toHaveText('06What Went Wrong');
  if(info.project.name==='mobile')await book.getByRole('button',{name:'Next notebook page',exact:true}).click();
  const tabs=book.getByRole('navigation',{name:'The Journey mini sections'});
  await expect(tabs.getByRole('link')).toHaveCount(12);
  for(const tab of await tabs.getByRole('link').all()){
    const slug=await tab.getAttribute('data-journey-tab');await tab.click();
    await expect(book.locator(`[data-journey-panel="${slug}"]`)).toBeVisible();
    await expect(book.locator('[data-journey-panel]:visible')).toHaveCount(1);
    await expect(tab).toHaveAttribute('aria-current','page');
    await expect(page).toHaveURL(new RegExp(`#journey-${slug}$`));
  }
  await page.reload();await expect(book.locator('[data-journey-panel="mushroom-cultivation"]')).toBeVisible();
  await page.goBack();await expect(book.locator('[data-journey-panel="software"]')).toBeVisible();
  if(info.project.name==='desktop'){
    const paper=await book.locator('[data-nb-binding]').boundingBox();const rail=await tabs.boundingBox();
    expect(rail!.x).toBeGreaterThanOrEqual(paper!.x+paper!.width-5);
    for(const label of await tabs.locator('.journey-tab-label').all())await expect(label).toHaveCSS('opacity','1');
  }
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
  const journeyBox=await book.locator('[data-nb-binding]').boundingBox();
  await main.getByRole('link',{name:'06 What Went Wrong'}).click();
  await expect(tabs).not.toBeVisible();
  const otherBox=await book.locator('[data-nb-binding]').boundingBox();
  for(const key of ['x','width','height'] as const)expect(journeyBox![key]).toBeCloseTo(otherBox![key],1);
});
