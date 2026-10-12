import { getStore } from '@netlify/blobs';
import { handleFoods } from '../lib/api.js';

export default async function handler(request) {
  try {
    const store = getStore({ name: 'vide-frigo', consistency: 'strong', region: 'eu-central-1' });
    return await handleFoods(request, store);
  } catch {
    return Response.json({ error: 'Le stockage du serveur est temporairement indisponible.' }, { status: 503, headers: { 'Cache-Control': 'no-store' } });
  }
}
