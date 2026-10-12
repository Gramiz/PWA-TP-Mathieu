import { createHash } from 'node:crypto';

const UUID = /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i;
export function deviceKey(request) {
  const token = request.headers.get('authorization')?.match(/^Bearer ([a-f0-9]{64})$/)?.[1];
  return token ? createHash('sha256').update(token).digest('hex') : null;
}
function json(value, status = 200) {
  return Response.json(value, { status, headers: { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', 'X-Robots-Tag': 'noindex' } });
}
export function validDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value) || value < '1900-01-01' || value > '9999-12-31') return false;
  const date = new Date(`${value}T12:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}
export function validPhoto(value) {
  if (value === null || value === undefined) return true;
  if (typeof value !== 'string' || value.length > 400000 || !/^data:image\/jpeg;base64,[A-Za-z0-9+/]+=*$/.test(value)) return false;
  const bytes = Buffer.from(value.slice(value.indexOf(',') + 1), 'base64');
  return bytes.length > 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes.at(-2) === 0xff && bytes.at(-1) === 0xd9;
}
export async function handleFoods(request, store) {
  const device = deviceKey(request);
  if (!device) return json({ error: 'Identifiant d’appareil manquant ou invalide.' }, 401);
  const origin = request.headers.get('origin');
  if (origin && origin !== new URL(request.url).origin) return json({ error: 'Origine refusée.' }, 403);
  if (request.method === 'GET') {
    const id = new URL(request.url).searchParams.get('id');
    if (!UUID.test(id ?? '')) return json({ error: 'Identifiant invalide.' }, 400);
    const food = await store.get(`${device}/${id}`, { type: 'json' });
    return food && !food.deleted ? json(food) : json({ error: 'Aliment introuvable.' }, 404);
  }
  if (request.method !== 'POST') return json({ error: 'Méthode non autorisée.' }, 405);
  if (!request.headers.get('content-type')?.startsWith('application/json')) return json({ error: 'JSON attendu.' }, 415);
  if (Number(request.headers.get('content-length')) > 420000) return json({ error: 'Photo trop volumineuse.' }, 413);
  const raw = await request.text();
  if (Buffer.byteLength(raw) > 420000) return json({ error: 'Données trop volumineuses.' }, 413);
  let data;
  try { data = JSON.parse(raw); } catch { return json({ error: 'JSON invalide.' }, 400); }
  if (!data || typeof data !== 'object') return json({ error: 'Action invalide.' }, 400);
  const id = data.type === 'save' ? data.food?.id : data.id;
  if (!UUID.test(id ?? '') || !['save', 'delete'].includes(data.type)) return json({ error: 'Action invalide.' }, 400);
  const key = `${device}/${id}`;
  if (data.type === 'delete') {
    // Tombstone: retrying an older creation cannot restore a deleted food.
    await store.setJSON(key, { id, deleted: true });
    return json({ ok: true, id });
  }
  const food = data.food;
  if (typeof food.name !== 'string' || !food.name.trim() || food.name.length > 80 || !validDate(food.date) || !validPhoto(food.photoData) || !Number.isSafeInteger(food.createdAt) || food.createdAt < 0) return json({ error: 'Aliment invalide.' }, 400);
  const previous = await store.get(key, { type: 'json' });
  if (!previous) await store.setJSON(key, { id, name: food.name.trim(), date: food.date, photoData: food.photoData ?? null, createdAt: food.createdAt });
  return json({ ok: true, id });
}
