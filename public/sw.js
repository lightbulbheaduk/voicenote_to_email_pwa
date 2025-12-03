const CACHE_NAME = 'voicenote-pwa-v1';
const ASSETS = [
  '/', '/index.html', '/src/styles.css', '/src/app.js', '/manifest.json'
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE_NAME).then(c => c.addAll(ASSETS)));
});

self.addEventListener('fetch', (e) => {
  e.respondWith(caches.match(e.request).then(r => r || fetch(e.request)));
});
