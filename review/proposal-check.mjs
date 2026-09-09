import { chromium } from '@playwright/test';
import { writeFile } from 'node:fs/promises';
const browser=await chromium.launch({channel:'chrome',args:['--no-sandbox']});
const results=[];
for(const [width,height] of [[320,568],[390,844],[667,375],[844,390],[1280,720],[1366,768]]){
 const p=await browser.newPage({viewport:{width,height}});
 await p.goto('http://127.0.0.1:5173/review/proposed-layout.html');
 const row={width,height};
 row.home=await p.evaluate(()=>({width:document.documentElement.scrollWidth,height:document.documentElement.scrollHeight}));
 await p.locator('.study button[data-screen=play]').click();
 await p.locator('#match').click();
 row.play=await p.evaluate(()=>({width:document.documentElement.scrollWidth,height:document.documentElement.scrollHeight,board:document.querySelector('.board').getBoundingClientRect().toJSON(),match:document.querySelector('#match').getBoundingClientRect().toJSON()}));
 await p.screenshot({path:new URL(`./evidence/proposed-${width}x${height}-play.png`,import.meta.url).pathname});
 results.push(row);await p.close();
}
await browser.close();
await writeFile(new URL('./evidence/proposal.json',import.meta.url),JSON.stringify(results,null,2));
console.log(JSON.stringify(results,null,2));
