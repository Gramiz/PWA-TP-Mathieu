import webpush from 'web-push';
import { deviceKey, json } from './api.js';

export function pushConfigured() { return !!(process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY && process.env.VAPID_SUBJECT); }
export function validSubscription(subscription) {
  try {
    const url = new URL(subscription.endpoint);
    const allowed = ['fcm.googleapis.com', 'updates.push.services.mozilla.com', 'web.push.apple.com'].includes(url.hostname) || url.hostname.endsWith('.push.apple.com') || url.hostname.endsWith('.notify.windows.com');
    const key = Buffer.from(subscription.keys?.p256dh ?? '', 'base64url');
    const auth = Buffer.from(subscription.keys?.auth ?? '', 'base64url');
    return allowed && url.protocol === 'https:' && !url.port && !url.username && !url.password && key.length === 65 && key[0] === 4 && auth.length === 16;
  } catch { return false; }
}
export async function deliverPush(subscription, payload, sender = webpush.sendNotification) {
  if (!pushConfigured()) throw new Error('Push non configuré');
  return sender(subscription, JSON.stringify(payload), {
    vapidDetails: { subject: process.env.VAPID_SUBJECT, publicKey: process.env.VAPID_PUBLIC_KEY, privateKey: process.env.VAPID_PRIVATE_KEY },
    TTL: 3600, timeout: 10000,
  });
}
export async function handlePush(request, store, sender) {
  if (!pushConfigured()) return json({ error: 'Les notifications ne sont pas configurées sur ce serveur.' }, 503);
  if (request.method === 'GET') return json({ publicKey: process.env.VAPID_PUBLIC_KEY });
  const device = deviceKey(request);
  if (!device) return json({ error: 'Identifiant d’appareil invalide.' }, 401);
  if (request.headers.get('origin') && request.headers.get('origin') !== new URL(request.url).origin) return json({ error: 'Origine refusée.' }, 403);
  if (request.method === 'DELETE') { await store.delete(device); return json({ ok: true }); }
  if (request.method !== 'POST') return json({ error: 'Méthode non autorisée.' }, 405);
  const raw = await request.text();
  if (Buffer.byteLength(raw) > 8192) return json({ error: 'Abonnement trop volumineux.' }, 413);
  let body; try { body = JSON.parse(raw); } catch { return json({ error: 'JSON invalide.' }, 400); }
  if (body?.action === 'test') {
    const record = await store.get(device, { type: 'json' });
    if (!record) return json({ error: 'Activez d’abord les notifications.' }, 404);
    try {
      await deliverPush(record.subscription, { title: 'Vide-frigo', body: 'Les notifications de Vide-frigo fonctionnent.', tag: 'vide-frigo-test', url: '/' }, sender);
      return json({ ok: true });
    } catch (error) {
      if ([404, 410].includes(error.statusCode)) { await store.delete(device); return json({ error: 'Abonnement expiré. Réactivez les notifications.' }, 410); }
      return json({ error: 'La notification n’a pas pu être envoyée. Réessayez.' }, 502);
    }
  }
  if (!validSubscription(body?.subscription)) return json({ error: 'Abonnement push invalide.' }, 400);
  const previous = await store.get(device, { type: 'json' });
  await store.setJSON(device, { subscription: body.subscription, lastReminder: previous?.lastReminder ?? null });
  return json({ ok: true });
}

export async function sendReminders(subscriptions, foods, sender, now = new Date()) {
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Paris', year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
  let sent = 0;
  for await (const page of subscriptions.list({ paginate: true })) {
    for (const { key: device } of page.blobs) {
      const record = await subscriptions.get(device, { type: 'json' });
      if (!record || record.lastReminder === today) continue;
      let count = 0;
      for await (const foodPage of foods.list({ prefix: `${device}/`, paginate: true })) for (const { key } of foodPage.blobs) {
        const food = await foods.get(key, { type: 'json' }); if (food && !food.deleted && food.date <= today) count++;
      }
      if (!count) continue;
      try {
        await deliverPush(record.subscription, { title: 'Dates à vérifier', body: `${count} aliment${count > 1 ? 's' : ''} à date limite atteinte dans votre frigo.`, tag: 'vide-frigo-dates', url: '/' }, sender);
        await subscriptions.setJSON(device, { ...record, lastReminder: today }); sent++;
      } catch (error) { if ([404, 410].includes(error.statusCode)) await subscriptions.delete(device); }
    }
  }
  return sent;
}
