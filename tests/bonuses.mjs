import { chromium, expect } from '@playwright/test';
import assert from 'node:assert/strict';

const origin = process.env.TEST_URL || 'http://localhost:8888';
const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true });
try {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await context.newPage(); page.setDefaultTimeout(20000); await page.goto(origin);
  await page.locator('#food-name').fill('Aliment bonus'); await page.locator('#food-date').fill('2026-10-20'); await page.locator('#add-button').click();
  await expect(page.locator('#sync-status')).toHaveText('Toutes les actions ont été envoyées au serveur.', { timeout: 40000 });
  // Only the OS share dialog is simulated; the text comes from the actual app.
  await page.evaluate(() => { navigator.share = async payload => { window.sharedPayload = payload; }; });
  await page.locator('#share-button').click(); await expect(page.locator('#share-message')).toHaveText('Liste partagée.');
  assert.match(await page.evaluate(() => window.sharedPayload.text), /Aliment bonus — 20\/10\/2026/);
  await page.evaluate(() => { navigator.share = async () => { throw new DOMException('Annulé', 'AbortError'); }; });
  await page.locator('#share-button').click(); await expect(page.locator('#share-message')).toHaveText('Partage annulé.');
  console.log('OK — partage de la liste et annulation');
  const other = await context.newPage(); await other.goto(origin);
  async function createConflict(a, b) {
    await page.reload(); await other.reload();
    const name = await page.locator('.food-name').first().innerText();
    await page.getByRole('button', { name: `Modifier ${name}`, exact: true }).click();
    await other.getByRole('button', { name: `Modifier ${name}`, exact: true }).click();
    await context.setOffline(true);
    await page.locator('#food-name').fill(a); await page.locator('#add-button').click();
    await expect(page.locator('.food-name')).toHaveText(a);
    await other.locator('#food-name').fill(b); await other.locator('#add-button').click();
    await expect(other.locator('.food-name')).toHaveText(b);
    await context.setOffline(false);
    await expect(page.locator('#conflict-panel')).toBeVisible({ timeout: 40000 });
    await expect(page.locator('#conflict-list')).toContainText(`Sur le serveur : ${a}`);
    await expect(page.locator('#conflict-list')).toContainText(`Votre version : ${b}`);
  }
  await createConflict('Version A', 'Version B');
  await page.getByRole('button', { name: 'Garder ma version', exact: true }).click();
  await expect(page.locator('#conflict-panel')).toBeHidden();
  await expect(page.locator('#sync-status')).toHaveText('Toutes les actions ont été envoyées au serveur.', { timeout: 40000 });
  await expect(page.locator('.food-name')).toHaveText('Version B');
  console.log('OK — conflit hors ligne entre deux onglets, choix garder ma version');
  await createConflict('Version serveur', 'Version locale');
  await page.getByRole('button', { name: 'Prendre celle du serveur', exact: true }).click();
  await expect(page.locator('#conflict-panel')).toBeHidden(); await expect(page.locator('.food-name')).toHaveText('Version serveur');
  console.log('OK — choix prendre celle du serveur');
  await page.getByRole('button', { name: 'Supprimer Version serveur', exact: true }).click();
  await expect(page.locator('#empty-state')).toBeVisible(); await expect(page.locator('#sync-status')).toHaveText('Toutes les actions ont été envoyées au serveur.', { timeout: 40000 });
  const denied = await browser.newContext(); const deniedPage = await denied.newPage(); await deniedPage.goto(origin);
  await deniedPage.evaluate(() => { Notification.requestPermission = async () => 'denied'; });
  await expect(deniedPage.locator('#push-button')).toBeEnabled();
  await deniedPage.locator('#push-button').click(); await expect(deniedPage.locator('#push-message')).toContainText('Notifications refusées.');
  console.log('OK — refus de permission notifications géré');
  await page.screenshot({ path: 'test-results/bonuses-mobile.png', fullPage: true });
} finally { await browser.close(); }
