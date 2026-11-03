/* Regia : fonctionnement hors ligne.
   À chaque mise à jour de l'app : python3 outils/maj_sw.py (liste des fichiers et VERSION).
   Les appareils proposent alors « Mettre à jour ». */
const VERSION = '2026-11-03.2';
const CACHE = 'regia-' + VERSION;
const CORE = [
  './',
  'index.html',
  'manifest.webmanifest',
  'css/base.css',
  'css/views.css',
  'fonts/archivo-latin-ext.woff2',
  'fonts/archivo-latin.woff2',
  'fonts/atkinson-latin-400.woff2',
  'fonts/atkinson-latin-700.woff2',
  'fonts/atkinson-latin-ext-400.woff2',
  'fonts/atkinson-latin-ext-700.woff2',
  'fonts/fonts.css',
  'fonts/plexmono-latin-500.woff2',
  'fonts/plexmono-latin-600.woff2',
  'fonts/plexmono-latin-ext-500.woff2',
  'fonts/plexmono-latin-ext-600.woff2',
  'icons/apple-touch-icon.png',
  'icons/favicon-32.png',
  'icons/icon-192.png',
  'icons/icon-512.png',
  'icons/icon-maskable-512.png',
  'js/main.js',
  'js/core/config.js',
  'js/core/dates.js',
  'js/core/db.js',
  'js/core/files.js',
  'js/core/store.js',
  'js/core/sync.js',
  'js/core/ui.js',
  'js/core/util.js',
  'js/tabs/aujourdhui.js',
  'js/tabs/candidatures.js',
  'js/tabs/contenus.js',
  'js/tabs/exercices.js',
  'js/tabs/notes.js',
  'js/tabs/oggi.js',
  'js/tabs/planning.js',
  'js/tabs/reglages.js',
  'js/tabs/reunions.js',
  'js/tabs/taches.js',
  'vendor/xlsx.mini.min.js'
];

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(CORE.map(url => new Request(url, { cache: 'reload' })))));
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    for (const key of await caches.keys()) if ((key.startsWith('regia-') || key.startsWith('planning-')) && key !== CACHE) await caches.delete(key);
    await self.clients.claim();
  })());
});

self.addEventListener('message', event => { if (event.data === 'skipWaiting') self.skipWaiting(); });

self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET') return;                       // la synchro (POST) passe toujours par le réseau
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;         // le script Google n'est jamais mis en cache
  if (req.mode === 'navigate') {
    event.respondWith(caches.match('index.html', { cacheName: CACHE }).then(res => res || fetch(req)));
    return;
  }
  event.respondWith(caches.match(req, { ignoreSearch: true, cacheName: CACHE }).then(res => res || fetch(req)));
});
