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
  await tx.objectStore('foods').add(food);
  await tx.objectStore('outbox').add({ type: 'save', food });
  await tx.done;
}

export async function deleteFood(id) {
  const db = await dbPromise;
  const tx = db.transaction(['foods', 'outbox'], 'readwrite');
  await tx.objectStore('foods').delete(id);
  await tx.objectStore('outbox').add({ type: 'delete', id });
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
