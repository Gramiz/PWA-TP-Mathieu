import { createServer } from 'node:http';
import { mkdir, readFile } from 'node:fs/promises';
import { resolve, extname } from 'node:path';
import { handleFoods } from '../netlify/lib/api.js';
import { localStore } from '../netlify/lib/local-store.mjs';
import { handlePush } from '../netlify/lib/push.js';

const port = Number(process.env.PORT || 8888);
const root = resolve('dist');
const dataRoot = resolve('.local-data');
await mkdir(dataRoot, { recursive: true });
const store = localStore(dataRoot);
const pushStore = localStore(resolve(dataRoot, 'push-subscriptions'));
const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.webmanifest': 'application/manifest+json', '.png': 'image/png', '.txt': 'text/plain; charset=utf-8', '.xml': 'application/xml' };
const csp = "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' blob: data:; media-src 'self' blob:; connect-src 'self'; worker-src 'self'; object-src 'none'; base-uri 'self'; frame-ancestors 'none'; form-action 'self'";
createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://${req.headers.host}`);
    if (url.pathname === '/api/foods' || url.pathname.startsWith('/api/push')) {
      let length = 0; const chunks = [];
      for await (const chunk of req) { length += chunk.length; if (length > 420000) { res.writeHead(413); res.end('Trop volumineux'); return; } chunks.push(chunk); }
      const body = Buffer.concat(chunks);
      const request = new Request(url, { method: req.method, headers: req.headers, ...(body.length ? { body } : {}) });
      const result = url.pathname === '/api/foods' ? await handleFoods(request, store) : await handlePush(request, pushStore);
      res.writeHead(result.status, Object.fromEntries(result.headers)); res.end(Buffer.from(await result.arrayBuffer())); return;
    }
    if (!['GET', 'HEAD'].includes(req.method)) { res.writeHead(405); res.end(); return; }
    const pathname = decodeURIComponent(url.pathname);
    const path = resolve(root, `.${pathname === '/' ? '/index.html' : pathname}`);
    if (!path.startsWith(root + '/')) { res.writeHead(403); res.end(); return; }
    const content = await readFile(path);
    res.writeHead(200, { 'Content-Type': types[extname(path)] || 'application/octet-stream', 'Cache-Control': 'no-cache', 'Content-Security-Policy': csp, 'X-Content-Type-Options': 'nosniff', 'Permissions-Policy': 'camera=(self), microphone=(), geolocation=()', 'Referrer-Policy': 'strict-origin-when-cross-origin' });
    res.end(req.method === 'HEAD' ? undefined : content);
  } catch (error) { res.writeHead(error.code === 'ENOENT' || error.code === 'EISDIR' ? 404 : 500); res.end('Page indisponible'); }
}).listen(port, '0.0.0.0', () => console.log(`Vide-frigo : http://localhost:${port}`));
