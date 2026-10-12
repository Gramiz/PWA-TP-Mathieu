import { chromium, firefox, expect } from '@playwright/test';
import assert from 'node:assert/strict';
import { resolve } from 'node:path';
import { mkdir, rm } from 'node:fs/promises';

const origin = 'http://localhost:8888';
async function fill(page, name) {
  await page.locator('#food-name').fill(name);
  await page.locator('#food-date').fill('2026-10-18');
  await page.locator('#add-button').click();
  await page.getByRole('heading', { name, exact: true }).waitFor();
}
async function data(page) {
  return page.evaluate(async () => { const db = await (await import('/db.js')).dbPromise; return { foods: await db.getAll('foods'), token: await db.get('meta', 'deviceToken'), pending: await db.count('outbox') }; });
}
const chrome = await chromium.launch({ executablePath: process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless:true });
try {
  const context = await chrome.newContext();
  const anchor = await context.newPage(); const session = await context.newCDPSession(anchor);
  let registrationId;
  session.on('ServiceWorker.workerRegistrationUpdated', event => { for (const r of event.registrations) if(r.scopeURL === origin + '/' && !r.isDeleted) registrationId = r.registrationId; });
  await session.send('ServiceWorker.enable');
  const page = await context.newPage(); await page.goto(origin);
  await page.waitForFunction(() => !!navigator.serviceWorker.controller);
  await expect.poll(() => registrationId).toBeTruthy();
  await context.setOffline(true); await fill(page,'Background Sync onglet fermé');
  const saved = await data(page); assert.equal(saved.pending,1); await page.close();
  await context.setOffline(false);
  // DevTools dispatches the browser event; no window online handler can run.
  await session.send('ServiceWorker.dispatchSyncEvent', { origin, registrationId, tag:'vide-frigo-outbox', lastChance:false });
  await expect.poll(async () => (await context.request.get(`${origin}/api/foods?id=${saved.foods[0].id}`,{headers:{Authorization:`Bearer ${saved.token}`}})).status(), {timeout:15000}).toBe(200);
  const reopened = await context.newPage(); await reopened.goto(origin);
  await expect(reopened.locator('#sync-status')).toHaveText('Toutes les actions ont été envoyées au serveur.');
  assert.equal((await data(reopened)).pending,0);
  console.log('OK — événement Background Sync Chromium : envoi et outbox vidée avec onglet application fermé');
} finally { await chrome.close(); }

if (process.env.TEST_FIREFOX === '1' || process.env.FIREFOX_PATH) {
  const profile = resolve('.local-data', `firefox-test-${crypto.randomUUID()}`);
  await mkdir(profile, { recursive:true });
  const context = await firefox.launchPersistentContext(profile, { ...(process.env.FIREFOX_PATH ? { executablePath: process.env.FIREFOX_PATH } : {}),headless:true,timeout:20000 });
  try {
    const page = await context.newPage(); page.setDefaultTimeout(20000); await page.goto(origin);
    await page.waitForFunction(() => !!navigator.serviceWorker.controller);
    assert.equal(await page.evaluate(async () => 'sync' in await navigator.serviceWorker.getRegistration()), false);
    await context.setOffline(true); await fill(page,'Repli Firefox hors ligne');
    assert.equal((await data(page)).pending,1); await page.reload();
    await page.getByRole('heading',{name:'Repli Firefox hors ligne',exact:true}).waitFor();
    await context.setOffline(false);
    await expect(page.locator('#sync-status')).toHaveText('Toutes les actions ont été envoyées au serveur.',{timeout:20000});
    const saved = await data(page); assert.equal(saved.pending,0);
    assert.equal((await context.request.get(`${origin}/api/foods?id=${saved.foods[0].id}`,{headers:{Authorization:`Bearer ${saved.token}`}})).status(),200);
    console.log('OK — Firefox sans Background Sync : hors ligne, persistance et envoi par repli online');
  } finally { await context.close(); await rm(profile, {recursive:true,force:true}); }
}
