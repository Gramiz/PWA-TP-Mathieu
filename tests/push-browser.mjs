import { chromium, expect } from '@playwright/test';
import { mkdtemp, rm } from 'node:fs/promises';
const origin = process.env.TEST_URL || 'http://localhost:8888';
// Chrome does not allow a push subscription in an incognito context.
const profile = await mkdtemp('/private/tmp/vide-frigo-push-browser-');
const context = await chromium.launchPersistentContext(profile, { executablePath: process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true, permissions: ['notifications'] });
try {
  const page = await context.newPage(); page.setDefaultTimeout(30000); await page.goto(origin);
  await page.waitForFunction(() => !!navigator.serviceWorker.controller);
  await expect(page.locator('#push-button')).toBeEnabled();
  await page.locator('#push-button').click();
  try { await expect(page.locator('#push-message')).toContainText('Rappels activés.', { timeout: 45000 }); }
  catch (error) { console.log('Diagnostic push réel :', await page.locator('#push-message').innerText()); throw error; }
  await page.locator('#push-test-button').click(); await expect(page.locator('#push-message')).toHaveText('Notification envoyée.', { timeout: 20000 });
  await expect.poll(async () => page.evaluate(async () => (await (await navigator.serviceWorker.ready).getNotifications()).some(n => n.tag === 'vide-frigo-test')), { timeout: 30000 }).toBe(true);
  console.log('OK — abonnement Push API réel, envoi web-push par le serveur et notification reçue par le Service Worker');
  await page.locator('#push-button').click(); await expect(page.locator('#push-message')).toHaveText('Notifications désactivées.');
} finally { await context.close(); await rm(profile, { recursive: true, force: true }); }
