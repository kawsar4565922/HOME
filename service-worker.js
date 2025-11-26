const CACHE_NAME = 'secret-chat-v1';
const urlsToCache = [
  './',
  './index.html',
  './manifest.json',
  './css/style-global.css',
  './css/style-lock.css',
  './css/style-auth.css',
  './css/style-home.css',
  './css/style-chat.css',
  './css/style-modal.css',
  './js/js-config.js',
  './js/js-lock.js',
  './js/js-auth.js',
  './js/js-home.js',
  './js/js-chat.js',
  './js/js-profile.js',
  'https://fonts.googleapis.com/css2?family=Roboto:wght@300;400;500;700&display=swap'
];

// Install SW
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('Opened cache');
        return cache.addAll(urlsToCache);
      })
  );
});

// Listen for requests
self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request)
      .then((response) => {
        // Cache hit - return response
        if (response) {
          return response;
        }
        return fetch(event.request);
      })
  );
});

// Activate the SW
self.addEventListener('activate', (event) => {
  const cacheWhitelist = [CACHE_NAME];
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheWhitelist.indexOf(cacheName) === -1) {
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
});