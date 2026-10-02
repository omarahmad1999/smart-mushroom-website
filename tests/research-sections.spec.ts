import {test,expect} from '@playwright/test';
test.setTimeout(120_000);

test('the experiment says what it measures, controls and records, and points to the parts and the data',async({page})=>{
  await page.goto('/');
  const experiment=page.locator('#experiment');
  const ledger=experiment.locator('.rc-ledger');
  for(const label of ['MEASURED','CONTROLLED','RECORDED'])await expect(ledger).toContainText(label);
  await expect(ledger).toContainText('Temperature, humidity and CO₂');
  await expect(experiment.getByText('See the measurements in Grafana')).toBeVisible();
  // Six documented facts, including the tent's size.
  await expect(experiment.locator('.rc-experiment-facts > div')).toHaveCount(6);
  await expect(experiment.locator('.rc-experiment-facts')).toContainText('185 × 82 × 55 cm');
  // The tent is shown against the room it is compared with.
  await expect(experiment.getByRole('img',{name:'The tent and the room around it'})).toBeVisible();
  // Each numbered part of the workbench photograph opens the same part in the habitat.
  const key=experiment.getByRole('list',{name:/Parts on the workbench/});
  await expect(key.getByRole('link')).toHaveCount(4);
  for(const [name,id] of [['Raspberry Pi 5','pi'],['Breadboard & T-cobbler','cobbler'],['Wago junctions','wago-red'],['APC UPS','ups']])
    await expect(key.getByRole('link',{name})).toHaveAttribute('href',`#study-${id}`);
  await key.getByRole('link',{name:'Raspberry Pi 5'}).click();
  await expect(page).toHaveURL(/#study-pi$/);
  await expect.poll(()=>page.locator('#material-study').evaluate(section=>Math.round(section.getBoundingClientRect().top)),{timeout:15000}).toBeLessThan(220);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
});

test('the camera section explains how the stills are taken and opens the Record path',async({page})=>{
  await page.goto('/');
  const observations=page.locator('#observations');
  const card=observations.locator('.rc-capture-card');
  await expect(card).toContainText('Camera Module 3 Wide');
  await expect(card).toContainText('every six hours');
  await card.getByRole('link',{name:/How these are captured/}).click();
  await expect(page.getByRole('tab',{name:/Record/})).toHaveAttribute('aria-selected','true');
  await expect(page.locator('#architecture-panel-record')).toBeVisible();
  await expect.poll(()=>page.locator('#architecture-panel-record').evaluate(panel=>Math.round(panel.getBoundingClientRect().top)),{timeout:15000}).toBeLessThan(260);
});

test.describe('without JavaScript',()=>{
  test.use({javaScriptEnabled:false});
  test('the comparison shows both stills split down the middle, and the film keeps its own controls',async({page})=>{
    await page.goto('/');
    const compare=page.locator('[data-compare]');
    await expect(compare).toHaveAttribute('style',/--split:\s*50%/);
    await expect(compare.locator('img')).toHaveCount(2);
    await expect(page.locator('[data-scrub]')).toBeHidden();
    await expect(page.getByLabel('Silent timelapse of the controlled tent during incubation')).toHaveAttribute('controls','');
  });
});
