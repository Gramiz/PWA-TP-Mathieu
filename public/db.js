import { openDB } from '/vendor/idb.js';

export const dbPromise = openDB('vide-frigo', 1, {
  upgrade(db) {
    db.createObjectStore('foods', { keyPath: 'id' });
    db.createObjectStore('outbox', { keyPath: 'sequence', autoIncrement: true });
    db.createObjectStore('meta');
  },
});

export async function getDeviceToken() {
  const db = await dbPromise;
  const tx = db.transaction('meta', 'readwrite');
  let token = await tx.store.get('deviceToken');
  if (!token) {
    token = Array.from(crypto.getRandomValues(new Uint8Array(32)), n => n.toString(16).padStart(2, '0')).join('');
    await tx.store.put(token, 'deviceToken');
  }
  await tx.done;
  return token;
}

export async function saveFood(food) {
  const db = await dbPromise;
  const tx = db.transaction(['foods', 'outbox'], 'readwrite');
  await tx.objectStore('foods').add({ ...food, version: 0 });
  await tx.objectStore('outbox').add({ type: 'save', food, operationId: crypto.randomUUID() });
  await tx.done;
}

export async function deleteFood(id) {
  const db = await dbPromise;
  const tx = db.transaction(['foods', 'outbox'], 'readwrite');
  const food = await tx.objectStore('foods').get(id);
  const pending = (await tx.objectStore('outbox').getAll()).some(item => item.food?.id === id && item.type === 'save');
  await tx.objectStore('foods').delete(id);
  await tx.objectStore('outbox').add({ type: 'delete', id, baseVersion: pending ? null : food?.version ?? 1, operationId: crypto.randomUUID() });
  await tx.done;
}

export async function updateFood(food, baseVersion) {
  const db = await dbPromise;
  const tx = db.transaction(['foods', 'outbox'], 'readwrite');
  const pendingCreate = (await tx.objectStore('outbox').getAll()).find(item => item.type === 'save' && item.food.id === food.id);
  await tx.objectStore('foods').put(food);
  if (pendingCreate) await tx.objectStore('outbox').put({ ...pendingCreate, food });
  else await tx.objectStore('outbox').add({ type: 'update', food, baseVersion, operationId: crypto.randomUUID() });
  await tx.done;
}

export async function resolveConflict(sequence, keepLocal) {
  const db = await dbPromise;
  const tx = db.transaction(['foods', 'outbox'], 'readwrite');
  const item = await tx.objectStore('outbox').get(sequence);
  if (!item?.conflictServer) { await tx.done; return; }
  const current = item.conflictServer;
  const id = item.food?.id ?? item.id;
  if (keepLocal) {
    const updated = { ...item, type: item.type === 'delete' ? 'delete' : current.deleted ? 'save' : 'update', baseVersion: current.version, operationId: crypto.randomUUID() };
    // A recreation still checks the known tombstone version.
    if (updated.type === 'save') updated.type = 'update';
    delete updated.conflictServer;
    await tx.objectStore('outbox').put(updated);
  } else {
    // Choosing the server version discards later pending edits to this food too.
    for (const pending of await tx.objectStore('outbox').getAll()) if ((pending.food?.id ?? pending.id) === id) await tx.objectStore('outbox').delete(pending.sequence);
    if (current.deleted) await tx.objectStore('foods').delete(id);
    else { const { lastOperation, ...food } = current; await tx.objectStore('foods').put(food); }
  }
  await tx.done;
}

// A lease shared by page and worker also works when Web Locks is absent.
export async function acquireSyncLease(owner) {
  const db = await dbPromise;
  const tx = db.transaction('meta', 'readwrite');
  const lease = await tx.store.get('syncLease');
  const allowed = !lease || lease.expires < Date.now() || lease.owner === owner;
  if (allowed) await tx.store.put({ owner, expires: Date.now() + 30000 }, 'syncLease');
  await tx.done;
  return allowed;
}

export async function releaseSyncLease(owner) {
  const db = await dbPromise;
  const tx = db.transaction('meta', 'readwrite');
  if ((await tx.store.get('syncLease'))?.owner === owner) await tx.store.delete('syncLease');
  await tx.done;
}
