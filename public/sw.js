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

// Source - https://stackoverflow.com/questions/79738938/how-to-install-a-progressive-web-app-pwa-on-android
// Posted by mmm
// Retrieved 2025-12-03, License - CC BY-SA 4.0

let deferredEvent;

window.addEventListener('beforeinstallprompt', (e) => {
  // prevent the browser from displaying the default install dialog
  e.preventDefault();
  
  // Stash the event so it can be triggered later when the user clicks the button
  deferredEvent = e;
});

installButton.addEventListener('click', () => {
  // if the deferredEvent exists, call its prompt method to display the install dialog
  if(deferredEvent) {
    deferredEvent.prompt();
  }
});
