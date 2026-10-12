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
      const pending = await db.getAll('outbox');
      const blockedIds = new Set(pending.filter(item => item.conflictServer).map(item => item.food?.id ?? item.id));
      const item = pending.find(item => !item.conflictServer && !blockedIds.has(item.food?.id ?? item.id));
      if (!item) break;
      const response = await fetch('/api/foods', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}`, ...(item.baseVersion != null ? { 'If-Match': `"${item.baseVersion}"` } : {}) },
        body: JSON.stringify(item),
        signal: AbortSignal.timeout(12000),
      });
      // fetch resolves on 4xx/5xx too: never discard an unacknowledged action.
      if (response.status === 412) {
        const result = await response.json();
        if (!result.current) throw new Error('Réponse de conflit invalide.');
        await db.put('outbox', { ...item, conflictServer: result.current });
        continue;
      }
      if (!response.ok) throw new Error(`Le serveur a refusé l’envoi (${response.status}).`);
      const result = await response.json();
      if (!result.ok || result.id !== (item.food?.id ?? item.id)) throw new Error('Réponse du serveur invalide.');
      const tx = db.transaction(['foods', 'outbox'], 'readwrite');
      const food = await tx.objectStore('foods').get(result.id);
      if (food && result.version) await tx.objectStore('foods').put({ ...food, version: result.version });
      await tx.objectStore('outbox').delete(item.sequence);
      await tx.done;
      sent = true;
    }
    if (sent) await db.put('meta', Date.now(), 'lastSync');
  } finally {
    await releaseSyncLease(owner);
  }
}
