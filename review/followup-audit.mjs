// Historical baseline audit (800413f). Use tests/usability.spec.ts for the current UI.
import { chromium, webkit } from '@playwright/test';
import { writeFile } from 'node:fs/promises';
const out=new URL('./evidence/',import.meta.url),report={};
const chrome=await chromium.launch({channel:'chrome',args:['--no-sandbox']});
const p=await chrome.newPage({viewport:{width:390,height:844}});
await p.goto('http://127.0.0.1:5173');
await p.getByRole('button',{name:'Explore assessment'}).focus();
await p.keyboard.press('Enter');
await p.getByRole('dialog').waitFor();
await p.keyboard.press('Escape');
await p.getByRole('dialog').waitFor({state:'detached'});
report.modalKeyboardReturn=await p.evaluate(()=>({tag:document.activeElement.tagName,name:document.activeElement.getAttribute('aria-label')}));
await p.setViewportSize({width:320,height:568});
report.overflow=await p.evaluate(()=>[...document.querySelectorAll('.dashboard-grid,.setup-card,.how-card,.section-heading,.setup-bottom,.level-options')].map(el=>({class:el.className,rect:el.getBoundingClientRect().toJSON(),minWidth:getComputedStyle(el).minWidth,scrollWidth:el.scrollWidth})));
await chrome.close();
report.webkit=[];
for(const controlled of [false,true]){
 const b=await webkit.launch({executablePath:'/home/ltoime/.cache/ms-playwright/webkit-2203/pw_run.sh',headless:true});
 const p=await b.newPage({viewport:{width:390,height:844}});
 const row={controlled,errors:[]};
 p.on('pageerror',e=>row.errors.push(e.message));
 if(controlled){await p.clock.install();await p.clock.pauseAt(new Date(Date.now()+1000));}
 await p.goto('http://127.0.0.1:5173');
 await p.getByRole('button',{name:'Start training'}).click();
 for(let i=0;i<5;i++) await p.getByRole('button',{name:'Next number'}).click();
 await p.getByRole('button',{name:'Try it in practice'}).click();
 if(controlled) await p.clock.runFor(3100);
 else await p.waitForTimeout(4200);
 row.text=await p.locator('main').innerText();
 row.phase=await p.locator('.playfield').getAttribute('data-phase').catch(()=>null);
 if(await p.locator('.hole.occupied').count()){
   await p.keyboard.press('Space');
   row.ack=(await p.locator('.match-button').getAttribute('class')).includes('acknowledged');
   await p.getByRole('button',{name:'Stop round'}).click();
   row.stopped=await p.getByRole('heading',{name:'Ready for a fresh start?'}).isVisible();
 }
 await p.screenshot({path:new URL(`webkit-${controlled?'controlled':'real'}-followup.png`,out).pathname,fullPage:true});
 report.webkit.push(row);
 await b.close();
}
await writeFile(new URL('followup.json',out),JSON.stringify(report,null,2));
console.log(JSON.stringify(report,null,2));
