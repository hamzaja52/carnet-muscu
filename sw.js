/* Carnet Muscu — service worker : 100 % hors ligne après la 1re visite.
   Stratégie : cache d'abord, mise à jour du cache en arrière-plan. */
'use strict';

// IMPORTANT : À INCRÉMENTER à chaque mise à jour d'un fichier de l'appli (v3, v4…) :
// c'est ce qui force les téléphones à télécharger la nouvelle version.
const VERSION = 'v3';
const CACHE = `carnet-muscu-${VERSION}`;
const ASSETS = [
  './',
  './index.html',
  './styles.css',
  './app.js',
  './seed.js',
  './manifest.webmanifest',
  './icons/icon.svg',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/maskable-512.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE)
      // Chaque fichier séparément : une icône manquante ne fait pas échouer l'installation.
      .then((cache) => Promise.all(ASSETS.map((url) =>
        cache.add(new Request(url, { cache: 'reload' })).catch(() => { /* fichier ignoré */ }))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys
        .filter((k) => k.startsWith('carnet-muscu-') && k !== CACHE)
        .map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  const isNav = req.mode === 'navigate';
  event.respondWith((async () => {
    const cache = await caches.open(CACHE);
    const cached = await cache.match(req, { ignoreSearch: true });

    const network = fetch(req).then((res) => {
      if (res && res.ok && res.type === 'basic') cache.put(req, res.clone()).catch(() => {});
      return res;
    });

    if (cached) {
      // Mise à jour silencieuse pour la prochaine ouverture.
      event.waitUntil(network.catch(() => {}));
      return cached;
    }
    try {
      return await network;
    } catch (err) {
      if (isNav) {
        const shell = (await cache.match('./index.html')) || (await cache.match('./'));
        if (shell) return shell;
      }
      return new Response('Hors ligne', { status: 503, statusText: 'Hors ligne', headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
    }
  })());
});
