import webpush from 'web-push';
import { execFileSync } from 'node:child_process';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const cli = resolve('node_modules/.bin/netlify');
let existing;
try { existing = JSON.parse(execFileSync(cli, ['env:list', '--json'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] })); }
catch { console.error('Impossible de lire la configuration Netlify. Vérifiez la connexion du CLI.'); process.exit(1); }
const names = Array.isArray(existing) ? existing.map(item => item.key) : Object.keys(existing);
if (names.includes('VAPID_PRIVATE_KEY')) {
  console.log('Clés VAPID déjà configurées : elles sont conservées.');
} else {
  const keys = webpush.generateVAPIDKeys();
  const values = `VAPID_PUBLIC_KEY=${keys.publicKey}\nVAPID_PRIVATE_KEY=${keys.privateKey}\nVAPID_SUBJECT=https://vide-frigo-mathieu-tp.netlify.app\n`;
  const directory = await mkdtemp('/private/tmp/vide-frigo-push-');
  try {
    const file = resolve(directory, '.env'); await writeFile(file, values, { mode: 0o600 });
    try { execFileSync(cli, ['env:import', file], { stdio: ['ignore', 'pipe', 'pipe'] }); }
    catch { console.error('Import Netlify refusé. Aucune clé privée affichée.'); process.exitCode = 1; }
    if (process.exitCode) throw new Error('Configuration push non enregistrée.');
    let local = ''; try { local = await readFile('.env', 'utf8'); } catch (error) { if (error.code !== 'ENOENT') throw error; }
    if (!local.includes('VAPID_PRIVATE_KEY=')) await writeFile('.env', local + '\n' + values, { mode: 0o600 });
    console.log('Clés VAPID configurées sur Netlify et dans le fichier local ignoré par Git. Aucune clé privée affichée.');
  } finally { await rm(directory, { recursive: true, force: true }); }
}
