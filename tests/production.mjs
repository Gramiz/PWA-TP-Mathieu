import { chromium, expect } from '@playwright/test';
import assert from 'node:assert/strict';

const origin = process.env.TEST_URL;
if (!origin || !origin.startsWith('https://')) throw new Error('Définir TEST_URL avec l’URL HTTPS publiée.');
for (const path of ['/', '/robots.txt', '/sitemap.xml', '/llms.txt', '/manifest.webmanifest', '/icons/icon-192.png', '/icons/icon-512.png']) {
  const r = await fetch(origin + path);
  assert.equal(r.status, 200, path);
  if (path === '/') {
    const html = await r.text(); assert.ok(html.includes('Exemples d’aliments')); assert.ok(html.includes(origin)); assert.ok(!html.includes('__SITE_URL__'));
    assert.ok(r.headers.get('content-security-policy')?.includes("default-src 'self'"));
  }
  console.log('OK — HTTPS', path);
}
const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless:true, args:['--use-fake-device-for-media-stream','--use-fake-ui-for-media-stream'] });
try {
  const context = await browser.newContext({ viewport:{width:390,height:844},permissions:['camera'] });
  const page = await context.newPage(); page.setDefaultTimeout(20000);
  const errors=[]; page.on('pageerror',e=>errors.push(e.message));
  await page.goto(origin);
  await page.waitForFunction(()=>!!navigator.serviceWorker.controller);
  await context.setOffline(true); await page.reload();
  await page.locator('#camera-button').click();
  await page.waitForFunction(()=>document.querySelector('#camera-video').videoWidth>0);
  await page.locator('#capture-button').click();
  await page.locator('#food-name').fill('Test déploiement — photo facultative');
  await page.locator('#food-date').fill('2026-10-19'); await page.locator('#add-button').click();
  await page.getByRole('heading',{name:'Test déploiement — photo facultative',exact:true}).waitFor();
  const local = await page.evaluate(async()=>{const db=await(await import('/db.js')).dbPromise;return {food:(await db.getAll('foods'))[0],token:await db.get('meta','deviceToken'),pending:await db.count('outbox')};});
  assert.equal(local.pending,1); assert.ok(local.food.photoData);
  await page.reload(); await page.getByRole('heading',{name:'Test déploiement — photo facultative',exact:true}).waitFor();
  await context.setOffline(false);
  await expect(page.locator('#sync-status')).toHaveText('Toutes les actions ont été envoyées au serveur.',{timeout:40000});
  const remote=await context.request.get(origin+'/api/foods?id='+local.food.id,{headers:{Authorization:`Bearer ${local.token}`}});
  assert.equal(remote.status(),200); assert.deepEqual(await remote.json(),local.food);
  console.log('OK — création et photo hors ligne, rechargement, puis réception réelle dans Netlify Blobs');
  const other=await context.request.get(origin+'/api/foods?id='+local.food.id,{headers:{Authorization:`Bearer ${'b'.repeat(64)}`}});assert.equal(other.status(),404);
  await context.setOffline(true); await page.getByRole('button',{name:'Supprimer Test déploiement — photo facultative',exact:true}).click();
  await page.locator('#empty-state').waitFor({state:'visible'});
  await context.setOffline(false); await expect(page.locator('#sync-status')).toHaveText('Toutes les actions ont été envoyées au serveur.',{timeout:40000});
  assert.equal((await context.request.get(origin+'/api/foods?id='+local.food.id,{headers:{Authorization:`Bearer ${local.token}`}})).status(),404);
  assert.deepEqual(errors,[]);
  console.log('OK — isolation des données, suppression réelle et aucune erreur JavaScript');
} finally {await browser.close();}
