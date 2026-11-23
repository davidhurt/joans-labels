// Lets the app open even without internet, and picks up updates automatically.
const CACHE = 'jll-v3';
const FILES = [
  './', 'index.html', 'css/app.css', 'manifest.webmanifest', 'vendor/jspdf.umd.min.js',
  'js/app.js', 'js/store.js', 'js/ui.js', 'js/engine.js', 'js/templates.js', 'js/pictures.js',
  'js/views/home.js', 'js/views/labels.js', 'js/views/envelopes.js', 'js/views/letters.js',
  'js/views/addresses.js', 'js/views/settings.js', 'js/views/help.js',
  'icons/icon-180.png', 'icons/icon-192.png', 'icons/icon-512.png',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(FILES)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
// Network first (so updates show up), fall back to the saved copy when offline.
self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET' || new URL(e.request.url).origin !== location.origin) return;
  e.respondWith(
    // 'no-cache' asks the server whether a file changed, so updates show up right away.
    fetch(e.request.url, { cache: 'no-cache', credentials: 'same-origin' }).then(res => {
      if (!res.ok) return res;
      const copy = res.clone();
      caches.open(CACHE).then(c => c.put(e.request, copy));
      return res;
    }).catch(() => caches.match(e.request, { ignoreSearch: true }).then(r => r || caches.match('index.html')))
  );
});
