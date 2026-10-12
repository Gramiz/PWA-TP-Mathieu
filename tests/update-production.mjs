import { chromium, expect } from '@playwright/test';
import assert from 'node:assert/strict';

const origin = process.env.TEST_URL;
if (!origin?.startsWith('https://')) throw new Error('Définir TEST_URL avec le site HTTPS à redéployer.');
const browser = await chromium.launch({executablePath:process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true});
try {
  const context=await browser.newContext();const page=await context.newPage();page.setDefaultTimeout(20000);await page.goto(origin);
  await page.waitForFunction(()=>!!navigator.serviceWorker.controller);
  await page.locator('#food-name').fill('Test conservation à la mise à jour');await page.locator('#food-date').fill('2026-10-18');await page.locator('#add-button').click();
  await expect(page.locator('#sync-status')).toHaveText('Toutes les actions ont été envoyées au serveur.',{timeout:40000});
  console.log('PRÊT — ancien build actif, aliment enregistré ; redéployer maintenant.');
  await page.evaluate(()=>{window.updatePoll=setInterval(()=>navigator.serviceWorker.getRegistration().then(reg=>reg?.update()).catch(()=>{}),4000);});
  await page.locator('#update-banner').waitFor({state:'visible',timeout:120000});
  await page.locator('#update-button').click();
  await expect(page.locator('#update-banner')).toBeHidden({timeout:20000});
  await page.getByRole('heading',{name:'Test conservation à la mise à jour',exact:true}).waitFor();
  assert.equal((await page.evaluate(()=>caches.keys())).filter(k=>k.startsWith('vide-frigo-')).length,1);
  const saved=await page.evaluate(async()=>{const db=await(await import('/db.js')).dbPromise;return {food:(await db.getAll('foods'))[0],token:await db.get('meta','deviceToken')};});
  assert.equal((await context.request.get(origin+'/api/foods?id='+saved.food.id,{headers:{Authorization:`Bearer ${saved.token}`}})).status(),200);
  await page.getByRole('button',{name:'Supprimer Test conservation à la mise à jour',exact:true}).click();await expect(page.locator('#sync-status')).toHaveText('Toutes les actions ont été envoyées au serveur.',{timeout:40000});
  console.log('OK — redéploiement Netlify, bannière, nouvelle version sans vider le cache, données locales et serveur conservées');
} finally {await browser.close();}
