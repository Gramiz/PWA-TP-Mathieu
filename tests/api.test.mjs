import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { handleFoods } from '../netlify/lib/api.js';

function memoryStore() {
  const values = new Map();
  const etags = new Map();
  return {
    async get(key) { return values.get(key) ?? null; },
    async getWithMetadata(key) { return values.has(key) ? { data: values.get(key), etag: etags.get(key) } : null; },
    async setJSON(key, value, options = {}) {
      if ((options.onlyIfNew && values.has(key)) || (options.onlyIfMatch && etags.get(key) !== options.onlyIfMatch)) return { modified: false };
      values.set(key, structuredClone(value)); etags.set(key, randomUUID()); return { modified: true };
    },
  };
}
const token = 'a'.repeat(64);
function request(action, auth = token) {
  return new Request('https://vide-frigo.test/api/foods', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${auth}` }, body: JSON.stringify(action) });
}
function read(id, auth = token) {
  return new Request(`https://vide-frigo.test/api/foods?id=${id}`, { headers: { Authorization: `Bearer ${auth}` } });
}
function food() { return { id: randomUUID(), name: 'Yaourts', date: '2026-10-15', photoData: null, createdAt: Date.now() }; }

test('création persistée, rejeu idempotent et suppression non ressuscitée', async () => {
  const store = memoryStore(); const value = food(); const action = { type: 'save', food: value };
  assert.equal((await handleFoods(request(action), store)).status, 200);
  assert.deepEqual(await (await handleFoods(read(value.id), store)).json(), { ...value, version: 1 });
  assert.equal((await handleFoods(request(action), store)).status, 200);
  assert.equal((await handleFoods(request({ type: 'delete', id: value.id }), store)).status, 200);
  assert.equal((await handleFoods(request(action), store)).status, 200);
  assert.equal((await handleFoods(read(value.id), store)).status, 404);
});
test('deux modifications de v1 : la seconde reçoit 412, puis résolution en v2', async () => {
  const store = memoryStore(); const value = food();
  await handleFoods(request({ type: 'save', food: value }), store);
  const edit = (name, version, operationId = randomUUID()) => { const req = request({ type: 'update', food: { ...value, name }, operationId }); req.headers.set('If-Match', `"${version}"`); return req; };
  const first = edit('Version A', 1); assert.equal((await handleFoods(first, store)).status, 200);
  const conflict = await handleFoods(edit('Version B', 1), store);
  assert.equal(conflict.status, 412); assert.equal((await conflict.json()).current.name, 'Version A');
  assert.equal((await handleFoods(edit('Version B', 2), store)).status, 200);
  const final = await (await handleFoods(read(value.id), store)).json(); assert.equal(final.name, 'Version B'); assert.equal(final.version, 3);
});
test('ETag atomique : deux écritures simultanées ne peuvent pas toutes deux gagner', async () => {
  const store = memoryStore(); const value = food(); await handleFoods(request({ type: 'save', food: value }), store);
  const edits = ['A', 'B'].map(name => { const req = request({ type: 'update', food: { ...value, name }, operationId: randomUUID() }); req.headers.set('If-Match', '"1"'); return req; });
  const results = await Promise.all(edits.map(req => handleFoods(req, store)));
  assert.deepEqual(results.map(r => r.status).sort(), [200, 412]);
});
test('un envoi déjà reçu peut être rejoué sans nouveau conflit ni version', async () => {
  const store = memoryStore(); const value = food(); await handleFoods(request({ type: 'save', food: value }), store);
  const action = { type: 'update', food: { ...value, name: 'Modifié' }, operationId: randomUUID() };
  for (let i = 0; i < 2; i++) { const req = request(action); req.headers.set('If-Match', '"1"'); const res = await handleFoods(req, store); assert.equal(res.status, 200); assert.equal((await res.json()).version, 2); }
});
test('précondition dans le corps conservée quand un proxy retire If-Match', async () => {
  const store = memoryStore(); const value = food(); await handleFoods(request({ type: 'save', food: value }), store);
  const update = () => request({ type: 'update', food: { ...value, name: 'Modifié' }, baseVersion: 1, operationId: randomUUID() });
  assert.equal((await handleFoods(update(), store)).status, 200);
  assert.equal((await handleFoods(update(), store)).status, 412);
});
test('un appareil ne peut pas lire les aliments d’un autre', async () => {
  const store = memoryStore(); const value = food();
  await handleFoods(request({ type: 'save', food: value }), store);
  assert.equal((await handleFoods(read(value.id, 'b'.repeat(64)), store)).status, 404);
  assert.equal((await handleFoods(read(value.id, 'bad'), store)).status, 401);
});
test('dates impossibles, photos invalides et tailles excessives refusées', async () => {
  const store = memoryStore();
  for (const override of [{ date: '2026-02-30' }, { name: ' ' }, { photoData: 'data:image/svg+xml;base64,AAAA' }, { photoData: 'data:image/jpeg;base64,AAAA' }]) {
    assert.equal((await handleFoods(request({ type: 'save', food: { ...food(), ...override } }), store)).status, 400);
  }
  assert.equal((await handleFoods(request({ type: 'save', food: { ...food(), photoData: 'x'.repeat(430000) } }), store)).status, 413);
});
test('stockage indisponible : aucun faux acquittement de succès', async () => {
  const store = { async get() { return null; }, async setJSON() { throw new Error('Unavailable'); } };
  await assert.rejects(handleFoods(request({ type: 'save', food: food() }), store), /Unavailable/);
});
test('JSON incorrect et requête venant d’un autre site refusés', async () => {
  const store = memoryStore();
  const invalid = new Request('https://vide-frigo.test/api/foods', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: '{' });
  assert.equal((await handleFoods(invalid, store)).status, 400);
  const foreign = request({ type: 'save', food: food() }); foreign.headers.set('Origin', 'https://autre.test');
  assert.equal((await handleFoods(foreign, store)).status, 403);
});
