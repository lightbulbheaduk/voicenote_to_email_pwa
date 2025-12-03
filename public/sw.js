const CACHE_NAME = 'voicenote-pwa-v1';
const ASSETS = [
  './', 'index.html', 'src/styles.css', 'src/app.js', 'manifest.json',
  'icons/icon-192.png', 'icons/icon-512.png'
];

// Install: Cache assets
self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME).then(c => c.addAll(ASSETS))
  );
});

// Activate: Remove old caches
self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys.filter(key => key !== CACHE_NAME)
            .map(key => caches.delete(key))
      )
    )
  );
});

// Fetch: Respond from cache first, then network
self.addEventListener('fetch', (e) => {
  e.respondWith(
    caches.match(e.request).then(r => r || fetch(e.request))
  );
});