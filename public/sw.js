import { flushOutbox } from './sync.js';

const CACHE_NAME = 'vide-frigo-__BUILD_VERSION__';
const APP_SHELL = ['/', '/index.html', '/styles.css', '/app.js', '/db.js', '/sync.js', '/vendor/idb.js', '/manifest.webmanifest', '/offline.html', '/icons/icon-192.png', '/icons/icon-512.png'];

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(APP_SHELL)));
  // Waiting is intentional: the page offers the update before activating it.
});
self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(key => key.startsWith('vide-frigo-') && key !== CACHE_NAME).map(key => caches.delete(key)));
    await self.clients.claim();
  })());
});
self.addEventListener('message', event => {
  if (event.data?.type === 'SKIP_WAITING') self.skipWaiting();
});
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  if (event.request.method !== 'GET' || url.origin !== self.location.origin || url.pathname.startsWith('/api/') || url.pathname.startsWith('/.netlify/') || url.pathname === '/sw.js') return;
  event.respondWith((async () => {
    const cache = await caches.open(CACHE_NAME);
    // A versioned shell keeps HTML and JS consistent until the offered update.
    const known = APP_SHELL.includes(url.pathname);
    const cached = await cache.match(known ? url.pathname : event.request);
    if (cached) return cached;
    try {
      return await fetch(event.request);
    } catch (error) {
      if (event.request.mode === 'navigate') return cache.match('/offline.html');
      throw error;
    }
  })());
});
self.addEventListener('sync', event => {
  if (event.tag !== 'vide-frigo-outbox') return;
  event.waitUntil((async () => {
    try { await flushOutbox(); }
    finally {
      const clients = await self.clients.matchAll({ type: 'window' });
      clients.forEach(client => client.postMessage({ type: 'SYNC_FINISHED' }));
    }
  })());
});
