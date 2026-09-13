// My Pantry service worker: opens instantly from the saved copy, works offline,
// and refreshes the saved copy in the background.
// Bump VERSION on every release: phones then install the new version and offer a reload.
const VERSION = 'v5';
const CACHE = 'my-pantry-' + VERSION;
const FILES = [
  './',
  './index.html',
  './manifest.webmanifest',
  './css/app.css',
  './js/core.js',
  './js/ui.js',
  './js/sheets.js',
  './js/cloud.js',
  './js/app.js',
  './fonts/figtree.woff2',
  './fonts/bricolage.woff2',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-maskable-512.png',
  './icons/apple-touch-icon.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE)
      .then((cache) => cache.addAll(FILES.map((f) => new Request(f, { cache: 'reload' }))))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith('my-pantry-') && k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return;
  const key = req.mode === 'navigate' ? './index.html' : req;
  event.respondWith((async () => {
    const cache = await caches.open(CACHE);
    const hit = await cache.match(key, { ignoreSearch: true });
    const fresh = fetch(req)
      .then((res) => { if (res.ok && res.type === 'basic') cache.put(key, res.clone()); return res; })
      .catch(() => null);
    if (hit) { event.waitUntil(fresh); return hit; }
    return (await fresh) || (await cache.match('./index.html')) || Response.error();
  })());
});
