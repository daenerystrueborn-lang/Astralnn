const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const base=process.env.ASTRAL_URL||'http://localhost:5173';
const delay=ms=>new Promise(resolve=>setTimeout(resolve,ms));
(async()=>{
  fs.mkdirSync('test-results',{recursive:true});
  const browser=await chromium.launch({channel:'msedge',headless:true,args:['--enable-unsafe-swiftshader']});
  const context=await browser.newContext({viewport:{width:1440,height:900}});
  const page=await context.newPage();const errors=[];const missing=[];
  page.on('pageerror',error=>{errors.push(error.message);console.error('Browser error:',error.message)});page.on('response',response=>{if(response.status()>=400)missing.push(`${response.status()} ${response.url()}`)});
  await page.goto(base);await page.waitForTimeout(1600);
  await page.screenshot({path:'test-results/hub-desktop.png'});
  console.log('Hub rendered; local fonts and assets loaded.');
  await page.locator('.ticket-recruit').click();await page.locator('button[data-action="recruit"]').click();assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('astral-fantasy:save:v1')).party.length),2);
  await page.locator('.modal-close').click();await page.locator('.ticket-shop').click();await page.locator('[data-action="buy"][data-id="pendant"]').click();await page.locator('.modal-close').click();
  await page.locator('.ticket-party').click();await page.locator('[data-action="equip"][data-id="astral-pendant"]').click();await page.locator('.modal-close').click();
  console.log('Recruitment, purchase and equipment verified.');
  await page.locator('.ticket-story').click();await page.screenshot({path:'test-results/story-desktop.png'});
  await page.locator('[data-action="advance"]').click();await page.locator('[data-action="advance"]').click();await page.locator('[data-action="choice"][data-id="together"]').click();
  assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('astral-fantasy:save:v1')).affinity),12);
  await page.locator('[data-action="advance"]').click();await page.locator('[data-action="advance"]').click();await page.screenshot({path:'test-results/cutscene-desktop.png'});
  await page.locator('.cutscene-caption [data-screen="dungeon"]').click();await page.waitForSelector('#world-root canvas');await page.waitForFunction(()=>document.querySelector('[data-stat="phase"]')?.textContent?.includes('celestial ward'),{timeout:20000});await page.waitForTimeout(500);
  await page.screenshot({path:'test-results/dungeon-desktop.png'});
  assert.equal(await page.locator('#world-root canvas').count(),1);
  console.log('Story branch, affinity and dungeon entry verified.');
  const startHp=await page.locator('[data-stat="hp-label"]').textContent();
  await page.locator('[data-action="menu"][data-menu="settings"]').click();await page.waitForTimeout(1000);assert.equal(await page.locator('[data-stat="hp-label"]').textContent(),startHp);await page.locator('.modal-close').click();
  await page.locator('[data-action="auto"]').click();
  const started=Date.now();let victory=false;
  while(Date.now()-started<180000){
    if(await page.locator('.result-panel,.result-modal,.result-scrim').count()){victory=true;break;}
    if(await page.locator('[data-action="resultClose"]').count()){victory=true;break;}
    if(Math.floor((Date.now()-started)/5000)%2===0){await page.locator('[data-action="skill"][data-index="6"]').click({timeout:3000}).catch(()=>{});}
    if(Math.floor((Date.now()-started)/7000)%2===0){await page.locator('[data-action="skill"][data-index="3"]').click({timeout:3000}).catch(()=>{});}
    await delay(700);
  }
  await page.screenshot({path:'test-results/combat-result.png'});
  const save=await page.evaluate(()=>JSON.parse(localStorage.getItem('astral-fantasy:save:v1')));
  console.log('Combat outcome:',JSON.stringify({victoryModal: victory,cleared:save.dungeonCleared,runs:save.runs,elapsedSeconds:Math.round((Date.now()-started)/1000)}));
  assert.equal(save.dungeonCleared,true,'Auto and skills should complete the first dungeon');
  await page.locator('[data-action="resultClose"]').click();
  await page.locator('[data-action="advance"]').click();await page.locator('[data-action="advance"]').click();assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('astral-fantasy:save:v1')).storyCompleted),true);
  await page.locator('.ticket-missions').click();await page.locator('[data-action="claim"][data-id="departure"]').click();await page.locator('[data-action="claim"][data-id="clear"]').click();await page.locator('.modal-close').click();
  await page.reload();await page.waitForTimeout(700);assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('astral-fantasy:save:v1')).storyCompleted),true);
  console.log('Victory rewards, post-battle story, missions and reload save verified.');
  const mobile=await browser.newContext({viewport:{width:844,height:390},isMobile:true,hasTouch:true,deviceScaleFactor:2});const phone=await mobile.newPage();await phone.goto(base);await phone.waitForTimeout(1000);await phone.screenshot({path:'test-results/hub-phone-landscape.png'});
  await phone.setViewportSize({width:390,height:844});await phone.waitForTimeout(200);await phone.screenshot({path:'test-results/phone-portrait.png'});assert.equal(await phone.locator('.rotate-screen').isVisible(),true);
  console.log('Phone landscape and portrait rotation gate verified.');
  console.log(JSON.stringify({errors,missing}));assert.deepEqual(errors,[]);assert.deepEqual(missing,[]);
  await browser.close();
})().catch(error=>{console.error(error);process.exit(1)});
