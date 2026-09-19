import {test,expect} from '@playwright/test';
test.setTimeout(90_000);
test.use({reducedMotion:'reduce',launchOptions:{executablePath:'/usr/bin/chromium',args:['--no-sandbox','--enable-unsafe-swiftshader']}});
test('opening habitat, collapsed catalogue, separate notes and photo footer work together',async({page},info)=>{
  const errors:string[]=[];page.on('pageerror',error=>errors.push(error.message));
  await page.goto('/');
  await expect(page.locator('main > section').nth(0)).toHaveAttribute('id','material-study');
  await expect(page.locator('main > section').nth(1)).toHaveAttribute('id','architecture');
  await expect(page.locator('#habitat,#resources')).toHaveCount(0);
  await expect(page.locator('#study-heading')).toHaveRole('heading');
  await expect(page.locator('.ms-explore')).toHaveAttribute('href','#experiment');
  const alignment=await page.locator('#material-study').evaluate(section=>{
    const scene=section.querySelector('.ms-scene-shell')!.getBoundingClientRect();
    const photo=section.querySelector('.ms-mushroom-photo')!.getBoundingClientRect();
    const button=section.querySelector('.ms-explore')!.getBoundingClientRect();
    const caption=section.querySelector('.ms-pairing-caption p')!.getBoundingClientRect();
    return {
      buttonToPhotoRight:Math.abs(photo.right-button.right),
      buttonToSceneBottom:Math.abs(scene.bottom-button.bottom),
      buttonToPhotoCenter:Math.abs((photo.left+photo.right)/2-(button.left+button.right)/2),
      captionBelowPhoto:caption.top-photo.bottom,
      buttonBelowCaption:button.top-caption.bottom,
    };
  });
  if(info.project.name==='desktop'){
    expect(alignment.buttonToPhotoRight).toBeLessThanOrEqual(1);
    expect(alignment.buttonToSceneBottom).toBeLessThanOrEqual(1);
  }else expect(alignment.buttonToPhotoCenter).toBeLessThanOrEqual(1);
  expect(alignment.captionBelowPhoto).toBeGreaterThan(0);
  expect(alignment.buttonBelowCaption).toBeGreaterThan(0);
  const catalogue=page.locator('.ms-exploration');
  await expect(catalogue).not.toHaveAttribute('open');
  await expect(catalogue.locator('.ms-component-groups')).toBeHidden();
  await catalogue.locator('summary').click();
  await expect(catalogue.locator('.ms-component-groups')).toBeVisible();
  await catalogue.locator('summary').focus();await page.keyboard.press('Enter');
  await expect(catalogue.locator('.ms-component-groups')).toBeHidden();
  await expect(page.locator('#architecture .tab-arrow,#architecture .route-note,#architecture .schematic-footer,#architecture .architecture-caption')).toHaveCount(0);
  for(const link of await page.locator('header a').filter({hasText:'Field notes'}).all())await expect(link).toHaveAttribute('href','/documentation/');
  await expect(page.locator('.header-github')).toContainText('GitHub');
  await expect(page.locator('.desktop-nav')).toContainText('Home');
  await expect(page.locator('.desktop-nav')).not.toContainText('The experiment');
  await expect(page.locator('.footer-socials .footer-social')).toHaveCount(2);
  await page.locator('.photo-footer').scrollIntoViewIfNeeded();
  await expect.poll(()=>page.locator('.footer-photo').evaluate((image:HTMLImageElement)=>image.naturalWidth)).toBeGreaterThan(0);
  await page.locator('.photo-footer').getByRole('link',{name:'About me'}).click();
  await expect(page).toHaveURL(/\/about\/$/);
  await expect(page.locator('.about-grid article')).toHaveCount(3);
  await page.getByRole('link',{name:'Open the field notes'}).click();
  await expect(page).toHaveURL(/\/documentation\/$/);
  await page.getByRole('link',{name:'Explore the interactive tent'}).click();
  await expect(page).toHaveURL(/\/#material-study$/);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
  expect(errors).toEqual([]);
});
