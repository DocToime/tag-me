// Historical baseline audit (800413f). Use tests/usability.spec.ts for the current UI.
import { chromium } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';

// Run with the local app at :5173. Outputs observations, not passing assertions.
const out = new URL('./evidence/', import.meta.url);
await mkdir(out, { recursive: true });
const browser = await chromium.launch({ channel: 'chrome', args: ['--no-sandbox'] });
const sizes = [[320,568],[360,640],[375,667],[390,844],[430,932],[667,375],[844,390],[768,1024],[1024,768],[1280,720],[1366,768],[1440,900],[1920,1080]];
const records = [];
for (const [width,height] of sizes) {
  const context = await browser.newContext({ viewport:{width,height}, hasTouch: width < 1100 });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.clock.install();
  await page.clock.pauseAt(new Date(Date.now()+1000));
  const row = {width,height,errors};
  async function snapshot(state, fullPage = false) {
    await page.evaluate(() => window.scrollTo(0,0));
    row[state] = await page.evaluate(() => {
      const bounds = selector => {
        const el = document.querySelector(selector);
        if (!el) return null;
        const r = el.getBoundingClientRect();
        return {x:Math.round(r.x),y:Math.round(r.y),width:Math.round(r.width),height:Math.round(r.height),bottom:Math.round(r.bottom)};
      };
      return {
        pageHeight:document.documentElement.scrollHeight,
        pageWidth:document.documentElement.scrollWidth,
        scrollY,
        hero:bounds('.hero'),setup:bounds('.setup-card'),start:bounds('.hero-cta'),
        board:bounds('.playfield'),match:bounds('.match-button'),
        actions:bounds('.example-card .button-row, .break-page > .button-row'),
        nav:bounds('.sidebar'),
        mainWords:document.querySelector('main').innerText.trim().split(/\s+/).length,
        unnamedNav:[...document.querySelectorAll('.sidebar button')].map(el=>({
          text:el.innerText,aria:el.getAttribute('aria-label'),title:el.getAttribute('title')
        })),
        overflow:[...document.querySelectorAll('main *')].filter(el=>{
          const r=el.getBoundingClientRect(); return r.width>0 && (r.right>innerWidth+1 || r.left< -1);
        }).slice(0,12).map(el=>({tag:el.tagName,class:el.getAttribute('class'),text:el.textContent.slice(0,60)})),
      };
    });
    await page.screenshot({path:new URL(`${width}x${height}-${state}.png`,out).pathname,fullPage});
  }
  await page.goto('http://127.0.0.1:5173');
  await page.getByRole('button',{name:'Start training'}).waitFor();
  await snapshot('home',true);
  await page.getByRole('button',{name:'Start training'}).click();
  await snapshot('tutorial',true);
  for(let i=0;i<5;i++) await page.getByRole('button',{name:'Next number'}).click();
  await page.getByRole('button',{name:'Try it in practice'}).click();
  await page.clock.runFor(3100);
  await snapshot('play');
  // Perfect practice: use the visible digits, with no access to the generated sequence.
  const digits=[];
  for(let i=0;i<13;i++) {
    const digit=Number(await page.locator('.playfield .mole-svg text').textContent());
    if(i>0 && digits[i-1]===digit) await page.keyboard.press('Space');
    digits.push(digit);
    await page.clock.runFor(2750);
  }
  await snapshot('practicePassed',true);
  records.push(row);
  await writeFile(new URL('responsive.json',out),JSON.stringify({browser:browser.version(),records},null,2));
  console.log(JSON.stringify({size:`${width}x${height}`,homeHeight:row.home.pageHeight,setupY:row.home.setup.y,playHeight:row.play.pageHeight,board:row.play.board,match:row.play.match,continue:row.practicePassed.actions,errors}));
  await context.close();
}
await browser.close();
