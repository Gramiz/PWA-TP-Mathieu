import { getStore } from '@netlify/blobs';
import { sendReminders } from '../lib/push.js';
export default async () => {
  const options = { consistency: 'strong', region: 'eu-central-1' };
  const sent = await sendReminders(getStore({ name: 'vide-frigo-push', ...options }), getStore({ name: 'vide-frigo', ...options }));
  return Response.json({ sent });
};
export const config = { schedule: '0 8 * * *' };
