import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createECDH, randomBytes } from 'node:crypto';
import webpush from 'web-push';
import { handlePush, sendReminders, validSubscription } from '../netlify/lib/push.js';

const vapid = webpush.generateVAPIDKeys();
process.env.VAPID_PUBLIC_KEY = vapid.publicKey;
process.env.VAPID_PRIVATE_KEY = vapid.privateKey;
process.env.VAPID_SUBJECT = 'https://vide-frigo.test';
const ecdh = createECDH('prime256v1'); ecdh.generateKeys();
const subscription = { endpoint: 'https://fcm.googleapis.com/fcm/send/test-endpoint', keys: { p256dh: ecdh.getPublicKey().toString('base64url'), auth: randomBytes(16).toString('base64url') } };
const token = 'a'.repeat(64);
function store() { const values = new Map(); return { async get(key) { return values.get(key) ?? null; }, async setJSON(key, value) { values.set(key, structuredClone(value)); }, async delete(key) { values.delete(key); }, async *list({ prefix = '' } = {}) { yield { blobs: [...values.keys()].filter(key => key.startsWith(prefix)).map(key => ({ key })) }; } }; }
function request(method, body) { return new Request('https://vide-frigo.test/api/push', { method, headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, ...(body ? { body: JSON.stringify(body) } : {}) }); }

test('push : abonnement authentifié, envoi serveur et désactivation', async () => {
  const subscriptions = store();
  assert.equal((await handlePush(request('POST', { subscription }), subscriptions)).status, 200);
  let sent = false;
  const response = await handlePush(request('POST', { action: 'test' }), subscriptions, async (sub, payload, options) => {
    assert.equal(sub.endpoint, subscription.endpoint); assert.equal(JSON.parse(payload).title, 'Vide-frigo'); assert.equal(options.vapidDetails.publicKey, vapid.publicKey); sent = true;
  });
  assert.equal(response.status, 200); assert.equal(sent, true);
  assert.equal((await handlePush(request('DELETE'), subscriptions)).status, 200);
  assert.equal((await handlePush(request('POST', { action: 'test' }), subscriptions)).status, 404);
});
test('push : URLs internes et clés invalides refusées', () => {
  assert.equal(validSubscription(subscription), true);
  for (const endpoint of ['http://fcm.googleapis.com/test', 'https://127.0.0.1/test', 'https://evil.test/test', 'https://fcm.googleapis.com.evil.test/test']) assert.equal(validSubscription({ ...subscription, endpoint }), false);
  assert.equal(validSubscription({ ...subscription, keys: { p256dh: 'bad', auth: 'bad' } }), false);
});
test('rappel : dates atteintes seulement, un envoi par jour et abonnement expiré supprimé', async () => {
  const subscriptions = store(); const foods = store();
  await subscriptions.setJSON('device', { subscription, lastReminder: null });
  await foods.setJSON('device/one', { date: '2026-10-12' });
  await foods.setJSON('device/two', { date: '2026-10-15' });
  await foods.setJSON('device/deleted', { date: '2026-10-10', deleted: true });
  let sends = 0;
  const sender = async (_, payload) => { assert.match(JSON.parse(payload).body, /^1 aliment/); sends++; };
  const now = new Date('2026-10-12T08:00:00Z');
  assert.equal(await sendReminders(subscriptions, foods, sender, now), 1);
  assert.equal(await sendReminders(subscriptions, foods, sender, now), 0); assert.equal(sends, 1);
  await subscriptions.setJSON('device', { subscription, lastReminder: null });
  await sendReminders(subscriptions, foods, async () => { throw { statusCode: 410 }; }, now);
  assert.equal(await subscriptions.get('device'), null);
});
