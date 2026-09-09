import { chromium, firefox, webkit } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';

const baseURL=process.env.REVIEW_URL || 'http://127.0.0.1:4183';
const out=new URL(process.env.REVIEW_LIVE ? '../test-results/deployment/' : './implemented/',import.meta.url);
await mkdir(out,{recursive:true});
const report={baseURL,checks:[]};
for(const [name,type,options] of [
  ['Chrome',chromium,{channel:'chrome',args:['--no-sandbox']}],
  ['Firefox',firefox,{executablePath:'/home/ltoime/.cache/ms-playwright/firefox-1490/firefox/firefox'}],
  ['WebKit',webkit,{executablePath:'/home/ltoime/.cache/ms-playwright/webkit-2203/pw_run.sh'}],
]) {
  const browser=await type.launch({headless:true,...options});
  try {
    for(const [width,height] of name==='Chrome' ? [[320,568],[390,844],[844,390],[1280,720]] : [[390,844]]) {
      const context=await browser.newContext({viewport:{width,height},hasTouch:true});
      const page=await context.newPage();
      const row={browser:name,version:browser.version(),width,height,errors:[]};
      page.on('pageerror',e=>row.errors.push(e.message));
      await page.clock.install();await page.clock.pauseAt(new Date(Date.now()+1000));
      await page.goto(baseURL);
      await page.getByRole('button',{name:'Start training'}).waitFor();
      row.home=await page.evaluate(()=>({width:document.documentElement.scrollWidth,height:document.documentElement.scrollHeight,start:document.querySelector('.start-training').getBoundingClientRect().toJSON()}));
      await page.screenshot({path:new URL(`${name}-${width}x${height}-home.png`,out).pathname,fullPage:true});
      await page.getByRole('button',{name:'Start training'}).click();
      await page.screenshot({path:new URL(`${name}-${width}x${height}-learn.png`,out).pathname,fullPage:true});
      await page.getByRole('button',{name:'Start practice',exact:true}).click();
      await page.clock.runFor(3100);
      row.play=await page.evaluate(()=>({phase:document.querySelector('.playfield')?.getAttribute('data-phase'),width:document.documentElement.scrollWidth,height:document.documentElement.scrollHeight,board:document.querySelector('.playfield').getBoundingClientRect().toJSON(),match:document.querySelector('.match-button').getBoundingClientRect().toJSON()}));
      if(row.play.phase!=='visible'||row.play.height!==height||row.play.width!==width||row.play.match.bottom>height||row.play.board.bottom>height) throw Error(`${name} ${width}x${height}: play did not fit`);
      await page.screenshot({path:new URL(`${name}-${width}x${height}-play.png`,out).pathname});
      await page.keyboard.press('Space');
      row.responseAcknowledged=(await page.locator('.match-button').getAttribute('class')).includes('acknowledged');
      await page.getByRole('button',{name:'Stop round'}).click();
      row.stopped=await page.getByRole('heading',{name:'Round stopped'}).isVisible();
      if(!row.responseAcknowledged||!row.stopped||row.errors.length) throw Error(`${name}: interaction failed`);
      await page.screenshot({path:new URL(`${name}-${width}x${height}-stopped.png`,out).pathname,fullPage:true});
      report.checks.push(row);await context.close();
    }
  } finally {await browser.close();}
}
await writeFile(new URL('checks.json',out),JSON.stringify(report,null,2));
console.log(JSON.stringify(report,null,2));
