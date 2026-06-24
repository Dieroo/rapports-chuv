// Service Worker — Slice 4 V2
const CACHE_VERSION = 'rapports-chuv-v1-test-012';

const ASSETS = [
  './',
  './index.html',
  './manifest.webmanifest',
  './styles/base.css',
  './styles/components.css',
  './styles/gardes.css',
  './scripts/app.js',
  './scripts/db.js',
  './scripts/theme.js',
  './scripts/state.js',
  './scripts/ui.js',
  './scripts/lieux-store.js',
  './scripts/service-store.js',
  './scripts/templates.js',
  './scripts/export-claude.js',
  './scripts/screens/poste-selector.js',
  './scripts/screens/intervention-list.js',
  './scripts/screens/intervention-edit.js',
  './scripts/screens/bloc-service.js',
  './scripts/screens/gardes.js',
  './scripts/lib/dexie.min.js',
  './data/referentiels.js',
  './assets/icons/icon-192.png',
  './assets/icons/icon-512.png',
  './assets/icons/icon-maskable.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_VERSION)
      .then(cache => cache.addAll(ASSETS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys.filter(k => k !== CACHE_VERSION).map(k => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== location.origin) return;

  if (req.mode === 'navigate' || req.destination === 'document') {
    event.respondWith(
      fetch(req)
        .then(res => {
          const copy = res.clone();
          caches.open(CACHE_VERSION).then(c => c.put(req, copy));
          return res;
        })
        .catch(() => caches.match(req).then(r => r || caches.match('./index.html')))
    );
    return;
  }

  event.respondWith(
    caches.match(req).then(cached => cached || fetch(req).then(res => {
      const copy = res.clone();
      caches.open(CACHE_VERSION).then(c => c.put(req, copy));
      return res;
    }))
  );
});
