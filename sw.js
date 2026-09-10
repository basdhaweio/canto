/* Canto service worker: app shell cached, content JSON network-first. */
const VERSION = 'canto-v9';
const SHELL = [
  './', './index.html', './manifest.json', './css/app.css',
  './js/ui.js', './js/data.js', './js/progress.js', './js/unit.js', './js/flashcards.js',
  './js/dialogue.js', './js/grammar.js', './js/exercises.js', './js/app.js',
  './icons/icon-192.png', './icons/icon-512.png'
];

self.addEventListener('install', (e) => {
  // cache: 'reload' bypasses the browser HTTP cache so a new worker never installs stale files.
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(SHELL.map((u) => new Request(u, { cache: 'reload' })))).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('message', (e) => {
  if (e.data === 'clear-cache') caches.delete(VERSION);
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== location.origin) return; // fonts etc: let the browser handle them

  if (url.pathname.includes('/data/')) {
    // Content: network first so new units show up, cache as fallback for offline.
    e.respondWith(
      fetch(req).then((res) => {
        const copy = res.clone();
        caches.open(VERSION).then((c) => c.put(req, copy));
        return res;
      }).catch(() => caches.match(req))
    );
    return;
  }

  // Shell: cache first, refresh in the background.
  e.respondWith(
    caches.match(req).then((cached) => {
      const network = fetch(req, { cache: 'no-cache' }).then((res) => {
        if (res && res.ok) caches.open(VERSION).then((c) => c.put(req, res.clone()));
        return res;
      }).catch(() => cached);
      return cached || network;
    })
  );
});
