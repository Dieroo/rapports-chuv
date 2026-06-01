// Service Worker — Slice 1.a
// Stratégie : cache-first sur les assets de l'app, network-first sur le HTML
// (pour qu'une mise à jour du HTML soit prise en compte rapidement).

const CACHE_VERSION = 'rapports-chuv-v1-a-001';
const ASSETS = [
  './',
  './index.html',
  './manifest.webmanifest',
  './styles/base.css',
  './scripts/app.js',
  './scripts/db.js',
  './scripts/lib/dexie.min.js',
  './data/referentiels.js',
  './assets/icons/icon-192.png',
  './assets/icons/icon-512.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_VERSION)
      .then(cache => cache.addAll(ASSETS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  // Supprime les anciens caches
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

  // Ignore les requêtes non-GET et les requêtes vers d'autres origines
  if (req.method !== 'GET' || new URL(req.url).origin !== location.origin) {
    return;
  }

  // HTML : network-first (pour récupérer la dernière version quand on est en ligne)
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

  // Autres assets : cache-first
  event.respondWith(
    caches.match(req).then(cached => cached || fetch(req).then(res => {
      const copy = res.clone();
      caches.open(CACHE_VERSION).then(c => c.put(req, copy));
      return res;
    }))
  );
});
