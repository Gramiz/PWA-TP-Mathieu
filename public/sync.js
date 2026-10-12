import { dbPromise, getDeviceToken, acquireSyncLease, releaseSyncLease } from './db.js';

let currentSync;
export function flushOutbox() {
  if (currentSync) return currentSync;
  currentSync = sendPending().finally(() => { currentSync = null; });
  return currentSync;
}

async function sendPending() {
  const owner = crypto.randomUUID();
  if (!await acquireSyncLease(owner)) return;
  try {
    const db = await dbPromise;
    const token = await getDeviceToken();
    let sent = false;
    // IndexedDB's auto-increment keys preserve create/delete order.
    while (true) {
      if (!await acquireSyncLease(owner)) return;
      const item = (await db.getAll('outbox', undefined, 1))[0];
      if (!item) break;
      const response = await fetch('/api/foods', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(item),
        signal: AbortSignal.timeout(12000),
      });
      // fetch resolves on 4xx/5xx too: never discard an unacknowledged action.
      if (!response.ok) throw new Error(`Le serveur a refusé l’envoi (${response.status}).`);
      const result = await response.json();
      if (!result.ok || result.id !== (item.food?.id ?? item.id)) throw new Error('Réponse du serveur invalide.');
      await db.delete('outbox', item.sequence);
      sent = true;
    }
    if (sent) await db.put('meta', Date.now(), 'lastSync');
  } finally {
    await releaseSyncLease(owner);
  }
}
