import { cp, mkdir, readdir, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';
import { build } from 'esbuild';

const configured = process.env.SITE_URL || process.env.URL || 'http://localhost:8888';
const siteURL = new URL(configured);
const lastModified = new Date().toISOString().slice(0, 10);
if (!['http:', 'https:'].includes(siteURL.protocol) || siteURL.pathname !== '/' || siteURL.username || siteURL.password) throw new Error('SITE_URL doit être une URL d’origine sans chemin.');
await rm('dist', { recursive: true, force: true });
await cp('public', 'dist', { recursive: true });
await mkdir('dist/vendor', { recursive: true });
await cp('node_modules/idb/build/index.js', 'dist/vendor/idb.js');
// Only the worker is bundled: Firefox supports classic SW but not module SW.
await build({
  entryPoints: ['public/sw.js'],
  outfile: 'dist/sw.js',
  bundle: true,
  format: 'iife',
  platform: 'browser',
  target: ['es2022'],
  plugins: [{ name: 'local-idb', setup(build) {
    build.onResolve({ filter: /^\/vendor\/idb\.js$/ }, () => ({ path: resolve('node_modules/idb/build/index.js') }));
  } }],
});
const hash = createHash('sha256');
async function walk(directory) {
  for (const name of (await readdir(directory)).sort()) {
    const path = `${directory}/${name}`;
    if ((await stat(path)).isDirectory()) await walk(path);
    else {
      let value = await readFile(path);
      if (/\.(html|xml|txt|md)$/.test(name)) {
        value = Buffer.from(value.toString().replaceAll('__SITE_URL__', siteURL.origin).replaceAll('__LAST_MODIFIED__', lastModified));
        await writeFile(path, value);
      }
      hash.update(path); hash.update(value);
    }
  }
}
await walk('dist');
const version = hash.digest('hex').slice(0, 12);
const sw = await readFile('dist/sw.js', 'utf8');
await writeFile('dist/sw.js', sw.replaceAll('__BUILD_VERSION__', version));
console.log(`Build Vide-frigo ${version} — ${siteURL.origin}`);
