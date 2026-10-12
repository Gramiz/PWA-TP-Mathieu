import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { handleFoods } from '../netlify/lib/api.js';

function memoryStore() {
  const values = new Map();
  return { async get(key) { return values.get(key) ?? null; }, async setJSON(key, value) { values.set(key, structuredClone(value)); } };
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
  assert.deepEqual(await (await handleFoods(read(value.id), store)).json(), value);
  assert.equal((await handleFoods(request(action), store)).status, 200);
  assert.equal((await handleFoods(request({ type: 'delete', id: value.id }), store)).status, 200);
  assert.equal((await handleFoods(request(action), store)).status, 200);
  assert.equal((await handleFoods(read(value.id), store)).status, 404);
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
