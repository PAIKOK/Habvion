import { chromium } from 'playwright-core';
import { mkdir } from 'node:fs/promises';
const phase = Number(process.argv[2] || '1');
const url = process.env.HB_SMOKE_URL || 'http://127.0.0.1:5175';
await mkdir('artifacts', { recursive:true });
const browser = await chromium.launch({ channel:'chrome', headless:true });
let failures = 0;
const check = (label, ok, detail='') => { if (!ok) failures++; console.log(`${ok ? 'PASS' : 'FAIL'} ${label}${detail ? ` — ${detail}` : ''}`); };
const page = await browser.newPage({ viewport:{width:1440,height:1000}, colorScheme:'light' });
// A returning visitor who chose "Essential only", so the cookie banner never covers what a smoke clicks.
// Phase 19 tests the banner itself in a fresh context.
await page.addInitScript(() => { try { if (!localStorage.getItem('hb-consent')) localStorage.setItem('hb-consent', JSON.stringify({ v:1, google:false, at:'smoke' })); } catch {} });
const errors = [];
page.on('pageerror', error => { errors.push(error.message); console.log('BROWSER ERROR', error.message); });
try {
  await page.goto(url, { waitUntil:'networkidle' });
  check('browser title uses Habvion branding', (await page.title()) === 'Habvion · Design it. See it. Make it yours.');
  check('page description uses Habvion branding', (await page.locator('meta[name="description"]').getAttribute('content'))?.startsWith('Habvion — Design it. See it. Make it yours.') === true);
  check('header uses Habvion branding', await page.getByRole('link',{name:'Habvion home',exact:true}).isVisible() && (await page.locator('.brand').innerText()) === 'Habvion');
  check('footer uses Habvion branding', (await page.locator('.site-footer > span').innerText()) === 'Habvion');
  check('landing headline shows the new tagline', await page.getByRole('heading',{level:1,name:/^Design it\.\s*See it\.\s*Make it yours\.$/}).isVisible());
  await page.getByTestId('demo-card').first().waitFor({ timeout: 15000 });
  check('demo section lists the six demo homes', (await page.getByTestId('demo-card').count()) === 6);
  const health = await page.request.get(`${url}/api/health`);
  const healthBody = await health.json();
  check('Vite proxies the health API', health.ok() && healthBody.status === 'ok' && healthBody.app === 'Habvion');
  if(phase === 1) {
  await page.screenshot({ path:`artifacts/phase-${String(phase).padStart(2,'0')}-light.png`,fullPage:true });
  await page.getByRole('button',{name:'Switch to dark mode'}).click();
  check('dark mode changes the CSS token theme', await page.evaluate(() => document.documentElement.dataset.theme === 'dark'));
  await page.reload({ waitUntil:'networkidle' });
  check('theme persists after reload', await page.evaluate(() => document.documentElement.dataset.theme === 'dark'));
  await page.screenshot({ path:`artifacts/phase-${String(phase).padStart(2,'0')}-dark.png`,fullPage:true });
  await page.getByRole('link',{name:'Design my home'}).click();
  await page.waitForURL('**/signup?next=*');
  await page.getByRole('heading',{name:'Start your home.'}).waitFor();
  check('start CTA asks a newcomer to sign up, then returns to /start', new URL(page.url()).searchParams.get('next') === '/start');
  await page.goto(url); await page.setViewportSize({width:390,height:844});
  check('mobile viewport has no horizontal overflow', await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
  check('mobile header remains usable', await page.getByRole('link',{name:'Start building'}).isVisible());
  await page.screenshot({path:`artifacts/phase-${String(phase).padStart(2,'0')}-mobile.png`,fullPage:true});
  } else {
    const run=(await import(`./smoke/phase-${String(phase).padStart(2,'0')}.mjs`)).default;
    await run({page,url,check});
    await page.screenshot({path:`artifacts/phase-${String(phase).padStart(2,'0')}-light.png`,fullPage:true});
  }
  check('no browser runtime errors', errors.length === 0, errors.join('; '));
} catch (error) { check('smoke script completes', false, String(error)); }
finally { await browser.close(); }
console.log(`\nPhase ${phase} browser gate: ${failures} failures. Screenshots need human/agent visual inspection.`);
process.exitCode = failures ? 1 : 0;
