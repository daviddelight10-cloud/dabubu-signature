const CACHE_NAME = 'dabubu-v13';
const ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './icon.svg',
  './images/lookbook-1.jpg',
  './images/lookbook-2.jpg',
  './images/lookbook-3.jpg',
  './images/lookbook-4.jpg',
  './images/lookbook-5.jpg',
  './images/lookbook-6.jpg',
  './images/lookbook-7.jpg',
  './images/lookbook-8.jpg',
  './images/lookbook-9.jpg',
  'https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,300;0,9..144,450;0,9..144,600;1,9..144,400;1,9..144,500&family=Jost:wght@300;400;500;600&display=swap',
  'https://www.gstatic.com/firebasejs/10.12.2/firebase-app-compat.js',
  'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth-compat.js',
  'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore-compat.js'
];

self.addEventListener('install', function(e) {
  e.waitUntil(
    caches.open(CACHE_NAME).then(function(cache) {
      return cache.addAll(ASSETS).catch(function() {});
    }).then(function() {
      return self.skipWaiting();
    })
  );
});

self.addEventListener('activate', function(e) {
  e.waitUntil(
    caches.keys().then(function(names) {
      return Promise.all(
        names.filter(function(n) { return n !== CACHE_NAME; })
             .map(function(n) { return caches.delete(n); })
      );
    }).then(function() {
      return self.clients.claim();
    })
  );
});

self.addEventListener('fetch', function(e) {
  if (e.request.method !== 'GET') return;
  var url = new URL(e.request.url);
  var isHTML = url.pathname.endsWith('/') || url.pathname.endsWith('.html');
  if (isHTML) {
    e.respondWith(
      fetch(e.request).then(function(response) {
        var clone = response.clone();
        caches.open(CACHE_NAME).then(function(cache) {
          cache.put(e.request, clone).catch(function() {});
        });
        return response;
      }).catch(function() {
        return caches.match(e.request).then(function(cached) {
          return cached || caches.match('./index.html');
        });
      })
    );
  } else {
    e.respondWith(
      caches.match(e.request).then(function(cached) {
        if (cached) return cached;
        return fetch(e.request).then(function(response) {
          var clone = response.clone();
          caches.open(CACHE_NAME).then(function(cache) {
            cache.put(e.request, clone).catch(function() {});
          });
          return response;
        }).catch(function() {
          return caches.match('./index.html');
        });
      })
    );
  }
});
