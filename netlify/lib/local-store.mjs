import { createHash, randomUUID } from 'node:crypto';
import { mkdir, readFile, readdir, rename, rm, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

export function localStore(root) {
  let writing = Promise.resolve();
  const pathFor = key => {
    const path = resolve(root, `${key}.json`);
    if (!path.startsWith(resolve(root) + '/')) throw new Error('Clé invalide');
    return path;
  };
  const store = {
    async getWithMetadata(key) {
      try {
        const raw = await readFile(pathFor(key), 'utf8');
        return { data: JSON.parse(raw), etag: createHash('sha256').update(raw).digest('hex') };
      } catch (error) { if (error.code === 'ENOENT') return null; throw error; }
    },
    async get(key) { return (await store.getWithMetadata(key))?.data ?? null; },
    setJSON(key, value, options = {}) {
      const task = writing.catch(() => {}).then(async () => {
        const current = await store.getWithMetadata(key);
        if ((options.onlyIfNew && current) || (options.onlyIfMatch && current?.etag !== options.onlyIfMatch)) return { modified: false };
        const path = pathFor(key); await mkdir(resolve(path, '..'), { recursive: true });
        const temporary = `${path}.${randomUUID()}.tmp`;
        await writeFile(temporary, JSON.stringify(value)); await rename(temporary, path);
        return { modified: true };
      });
      writing = task; return task;
    },
    async delete(key) { await rm(pathFor(key), { force: true }); },
    async *list({ prefix = '' } = {}) {
      const blobs = [];
      async function walk(directory, relative = '') {
        let entries; try { entries = await readdir(directory, { withFileTypes: true }); } catch (error) { if (error.code === 'ENOENT') return; throw error; }
        for (const entry of entries) {
          const name = relative + entry.name;
          if (entry.isDirectory()) await walk(resolve(directory, entry.name), name + '/');
          else if (name.endsWith('.json') && name.slice(0, -5).startsWith(prefix)) blobs.push({ key: name.slice(0, -5) });
        }
      }
      await walk(root); yield { blobs };
    },
  };
  return store;
}
