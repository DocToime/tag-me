// Historical baseline audit (800413f). Use tests/usability.spec.ts for the current UI.
import { chromium, firefox, webkit } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
const out = new URL('./evidence/', import.meta.url);
await mkdir(out,{recursive:true});
const report={};
const browser=await chromium.launch({channel:'chrome',args:['--no-sandbox']});
const context=await browser.newContext({viewport:{width:768,height:1024},hasTouch:true});
const page=await context.newPage();
await page.goto('http://127.0.0.1:5173');
await page.getByRole('button',{name:'Start training'}).waitFor();
const cdp=await context.newCDPSession(page);
report.tabletAccessibility=(await cdp.send('Accessibility.getFullAXTree')).nodes
  .filter(n=>['button','link'].includes(n.role?.value)).map(n=>({role:n.role.value,name:n.name?.value,properties:n.properties}));
report.tabletNamedHomeButtons=await page.getByRole('button',{name:'My garden',exact:true}).count();
await page.setViewportSize({width:390,height:844});
report.copyContrast=await page.evaluate(()=>{
  function lum(rgb){ const a=rgb.map(c=>{c/=255;return c<=.04045?c/12.92:((c+.055)/1.055)**2.4;});return a[0]*.2126+a[1]*.7152+a[2]*.0722; }
  return ['.hero p','.hero-meta','.stats-row p','.quiet','.field-label'].map(selector=>{
    const el=document.querySelector(selector),cs=getComputedStyle(el);
    let node=el,bg='';
    while(node){bg=getComputedStyle(node).backgroundColor;if(bg!=='rgba(0, 0, 0, 0)' && bg!=='transparent')break;node=node.parentElement;}
    const fg=cs.color.match(/[\d.]+/g).slice(0,3).map(Number),back=bg.match(/[\d.]+/g).slice(0,3).map(Number);
    const a=lum(fg),b=lum(back);
    return {selector,fontSize:cs.fontSize,color:cs.color,background:bg,contrast:Number(((Math.max(a,b)+.05)/(Math.min(a,b)+.05)).toFixed(2))};
  });
});
await page.getByRole('button',{name:'Explore assessment'}).click();
report.dialogInitialFocus=await page.evaluate(()=>document.activeElement.getAttribute('aria-label'));
await page.keyboard.press('Shift+Tab');
report.dialogWrapFocus=await page.evaluate(()=>document.activeElement.textContent);
await page.keyboard.press('Escape');
report.dialogRestoredFocus=await page.evaluate(()=>document.activeElement.textContent);
await page.setViewportSize({width:681,height:844});
await page.clock.install();
await page.clock.pauseAt(new Date(Date.now()+1000));
await page.getByRole('button',{name:'Start training'}).click();
report.tutorialFocus=await page.evaluate(()=>({tag:document.activeElement.tagName,text:document.activeElement===document.body?'body':document.activeElement.textContent}));
for(let i=0;i<5;i++) await page.getByRole('button',{name:'Next number'}).click();
await page.getByRole('button',{name:'Try it in practice'}).click();
await page.clock.runFor(3100);
report.beforeResize=await page.locator('.playfield').boundingBox();
await page.setViewportSize({width:680,height:844});
await page.clock.runFor(100);
report.afterResize=await page.locator('.playfield').boundingBox();
report.resizePhase=await page.locator('.playfield').getAttribute('data-phase');
await page.getByRole('button',{name:'Stop round'}).click();
await page.getByRole('button',{name:'Finish for now'}).click();
await page.getByRole('button',{name:'Back to my garden'}).click();
await page.setViewportSize({width:640,height:360});
await page.getByRole('button',{name:'Start training'}).click();
for(let i=0;i<5;i++) await page.getByRole('button',{name:'Next number'}).click();
await page.getByRole('button',{name:'Try it in practice'}).click();
await page.clock.runFor(3100);
await page.evaluate(()=>scrollTo(0,0));
report.effective200PercentLaptop={viewport:{width:640,height:360},board:await page.locator('.playfield').boundingBox(),match:await page.locator('.match-button').boundingBox()};
await page.screenshot({path:new URL('640x360-play.png',out).pathname});
await context.close();
await browser.close();

report.crossBrowser=[];
for(const [name,type,executablePath] of [
  ['Firefox',firefox,'/home/ltoime/.cache/ms-playwright/firefox-1490/firefox/firefox'],
  ['WebKit',webkit,'/home/ltoime/.cache/ms-playwright/webkit-2203/pw_run.sh']
]){
  let b;
  const row={name};
  try{
    b=await type.launch({executablePath,headless:true,timeout:20000});
    row.version=b.version();
    const p=await b.newPage({viewport:{width:390,height:844}});
    row.errors=[];
    p.on('pageerror',e=>row.errors.push(e.message));
    await p.goto('http://127.0.0.1:5173');
    await p.getByRole('button',{name:'Start training'}).click();
    for(let i=0;i<5;i++) await p.getByRole('button',{name:'Next number'}).click();
    await p.getByRole('button',{name:'Try it in practice'}).click();
    await p.locator('.hole.occupied').waitFor({timeout:10000});
    await p.keyboard.press('Space');
    row.responseAcknowledged=(await p.locator('.match-button').getAttribute('class')).includes('acknowledged');
    await p.getByRole('button',{name:'Stop round'}).click();
    row.stopWorked=await p.getByRole('heading',{name:'Ready for a fresh start?'}).isVisible();
    await p.screenshot({path:new URL(`${name.toLowerCase()}-smoke.png`,out).pathname,fullPage:true});
  }catch(e){row.failure=String(e).slice(0,1800);}finally{await b?.close();}
  report.crossBrowser.push(row);
}
await writeFile(new URL('interaction.json',out),JSON.stringify(report,null,2));
console.log(JSON.stringify(report,null,2));
