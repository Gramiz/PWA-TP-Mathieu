import { chromium, expect } from '@playwright/test';
import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';

const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true, args: ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream'] });
await mkdir('test-results', { recursive: true });
const errors = [];
const context = await browser.newContext({ viewport: { width: 1200, height: 900 }, permissions: ['camera'] });
const page = await context.newPage();
page.on('pageerror', error => errors.push(error.message));
async function state() { return page.evaluate(async () => { const { dbPromise } = await import('/db.js'); const db = await dbPromise; return { foods: await db.getAll('foods'), outbox: await db.getAll('outbox'), token: await db.get('meta', 'deviceToken') }; }); }
async function waitEmpty() { await expect(page.locator('#sync-status')).toHaveText('Toutes les actions ont été envoyées au serveur.', { timeout: 25000 }); assert.equal((await state()).outbox.length, 0); }
async function add(name, date) { await page.locator('#food-name').fill(name); await page.locator('#food-date').fill(date); await page.locator('#add-button').click(); await page.getByRole('heading', { name, exact: true }).waitFor(); }
async function remoteFood(id, token) { return page.evaluate(async ({id, token}) => { const r = await fetch(`/api/foods?id=${id}`, { headers: { Authorization: `Bearer ${token}` } }); return { status: r.status, body: await r.json() }; }, { id, token }); }
try {
  await page.goto('http://localhost:8888');
  await page.waitForFunction(() => !!navigator.serviceWorker.controller);
  await page.locator('#empty-state').waitFor({state:'visible'});
  console.log('OK — démarrage, IndexedDB, Service Worker actif');
  await context.setOffline(true);
  await page.reload();
  await page.locator('#offline-notice').waitFor({ state: 'visible' });
  await add('Yaourts hors ligne', '2026-10-16');
  await add('Salade hors ligne', '2026-10-12');
  let data = await state(); assert.equal(data.outbox.length, 2);
  assert.deepEqual(await page.locator('.food-name').allTextContents(), ['Salade hors ligne','Yaourts hors ligne']);
  await page.reload(); await page.getByRole('heading', { name: 'Salade hors ligne', exact: true }).waitFor();
  assert.equal((await state()).foods.length, 2);
  console.log('OK — ouverture hors ligne, ajouts, tri, persistance après rechargement');
  await page.goto('http://localhost:8888/page-inconnue');
  await page.getByRole('heading', { name: 'Cette page est indisponible hors ligne.' }).waitFor();
  await page.getByRole('link', { name: 'Retourner à mon frigo' }).click();
  await context.setOffline(false); await waitEmpty();
  data = await state(); const remote = await remoteFood(data.foods[0].id, data.token);
  if (remote.status !== 200) console.log({ status: remote.status, body: remote.body, tokenPresent: !!data.token, id: data.foods[0].id, remaining: data.outbox.length });
  assert.equal(remote.status, 200);
  console.log('OK — page de secours, repli online, aliments reçus au serveur');
  await page.locator('#camera-button').click();
  await page.waitForFunction(() => document.querySelector('#camera-video').videoWidth > 0);
  await page.locator('#capture-button').click();
  await add('Lait avec photo', '2026-10-19'); await waitEmpty();
  data = await state(); const photographed = data.foods.find(f => f.name === 'Lait avec photo');
  assert.ok(photographed.photoData.startsWith('data:image/jpeg;base64,'));
  assert.equal((await remoteFood(photographed.id, data.token)).body.photoData, photographed.photoData);
  assert.equal(await page.locator('#camera-video').evaluate(video => video.srcObject), null);
  console.log('OK — caméra simulée, compression JPEG, photo locale et serveur, caméra arrêtée');
  // HTTP errors must retain the outbox; navigator.onLine is still true.
  await context.route('**/api/foods', route => route.fulfill({ status: 503, contentType: 'application/json', body: '{"error":"Test indisponible"}' }));
  await add('Serveur indisponible', '2026-10-20');
  await page.getByText('Serveur injoignable', { exact: true }).waitFor(); assert.ok((await state()).outbox.length > 0);
  await context.unroute('**/api/foods'); await page.reload(); await waitEmpty();
  console.log('OK — erreur HTTP 503 conserve la file, nouvel essai au lancement');
  await context.setOffline(true);
  await page.getByRole('button', { name: 'Supprimer Lait avec photo', exact: true }).click();
  await page.waitForFunction(() => ![...document.querySelectorAll('.food-name')].some(n => n.textContent === 'Lait avec photo'));
  assert.ok((await state()).outbox.some(item => item.type === 'delete'));
  await context.setOffline(false); await waitEmpty();
  assert.equal((await remoteFood(photographed.id, data.token)).status, 404);
  console.log('OK — suppression hors ligne synchronisée au serveur');
  // Close and reopen the page without network: data survives.
  await context.setOffline(true); await page.close();
  const reopened = await context.newPage(); await reopened.goto('http://localhost:8888');
  await reopened.getByRole('heading', { name: 'Salade hors ligne', exact: true }).waitFor(); await reopened.close();
  await context.setOffline(false);
  console.log('OK — fermeture et réouverture hors ligne');
  const updatePage = await context.newPage(); await updatePage.goto('http://localhost:8888');
  const source = await readFile('public/styles.css', 'utf8');
  try {
    await writeFile('public/styles.css', source + '\n/* version de test */\n'); execFileSync('node', ['scripts/build.mjs']);
    await updatePage.evaluate(async () => (await navigator.serviceWorker.getRegistration()).update());
    await updatePage.locator('#update-banner').waitFor({ state: 'visible' });
    await updatePage.locator('#update-button').click();
    await updatePage.waitForFunction(() => document.querySelector('#update-banner').hidden);
    assert.equal((await updatePage.evaluate(() => caches.keys())).filter(k => k.startsWith('vide-frigo-')).length, 1);
    console.log('OK — bannière de mise à jour, activation et nettoyage du cache');
  } finally { await writeFile('public/styles.css', source); execFileSync('node', ['scripts/build.mjs']); }
  await updatePage.close();
  // Separate clean context: refuse camera and keep adding without a photo.
  const denied = await browser.newContext({ viewport: {width:390,height:844} });
  const deniedPage = await denied.newPage(); await deniedPage.goto('http://localhost:8888');
  await deniedPage.evaluate(() => { navigator.mediaDevices.getUserMedia = async () => { throw new DOMException('Refus de test', 'NotAllowedError'); }; });
  await deniedPage.locator('#camera-button').click();
  await deniedPage.getByText(/Accès à la caméra refusé/).waitFor();
  await deniedPage.locator('#food-name').fill('Sans photo'); await deniedPage.locator('#food-date').fill('2026-10-17'); await deniedPage.locator('#add-button').click();
  await deniedPage.getByRole('heading', {name:'Sans photo',exact:true}).waitFor();
  console.log('OK — refus caméra expliqué, ajout sans photo');
  // Visual QA in one batch, empty app desktop and phone, no seeded personal data.
  const visual = await browser.newContext({ viewport: { width:1200, height:900 } });
  const visualPage = await visual.newPage(); await visualPage.goto('http://localhost:8888'); await visualPage.locator('#empty-state').waitFor({state:'visible'});
  await visualPage.screenshot({ path:'test-results/desktop.png', fullPage:true });
  // A tall viewport avoids Chromium's full-page stitching at narrow widths.
  await visualPage.setViewportSize({width:390,height:1700});
  assert.equal(await visualPage.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
  await visualPage.screenshot({ path:'test-results/mobile.png', fullPage:false });
  assert.deepEqual(errors, []);
  await writeFile('test-results/browser-summary.txt', 'Chromium : installation du SW, mode hors ligne, tri, persistance, page de secours, sync online, photo simulée, refus caméra, erreurs 503, suppression et mise à jour vérifiés.\n');
  console.log('OK — responsive 390 px, pas de débordement, pas d’erreur JS');
} finally { await browser.close(); }
