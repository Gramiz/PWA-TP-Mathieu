import { getStore } from '@netlify/blobs';
import { handlePush } from '../lib/push.js';
export default async request => {
  try { return await handlePush(request, getStore({ name: 'vide-frigo-push', consistency: 'strong', region: 'eu-central-1' })); }
  catch { return Response.json({ error: 'Service de notifications indisponible.' }, { status: 503 }); }
};
