const CACHE_VERSION = 'dabubu-v18';
const STATIC_CACHE = CACHE_VERSION + '-static';
const IMAGE_CACHE = CACHE_VERSION + '-images';
const FONT_CACHE = CACHE_VERSION + '-fonts';

const STATIC_ASSETS = [
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
  'https://www.gstatic.com/firebasejs/10.12.2/firebase-app-compat.js',
  'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth-compat.js',
  'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore-compat.js'
];

const FONT_ASSETS = [
  'https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,300;0,9..144,450;0,9..144,600;1,9..144,400;1,9..144,500&family=Jost:wght@300;400;500;600&display=swap'
];

const CACHE_NAMES = [STATIC_CACHE, IMAGE_CACHE, FONT_CACHE];

/* ---------- Install: pre-cache static assets ---------- */
self.addEventListener('install', function(e) {
  e.waitUntil(
    Promise.all([
      caches.open(STATIC_CACHE).then(function(cache) {
        return cache.addAll(STATIC_ASSETS).catch(function() {});
      }),
      caches.open(FONT_CACHE).then(function(cache) {
        return cache.addAll(FONT_ASSETS).catch(function() {});
      })
    ]).then(function() {
      return self.skipWaiting();
    })
  );
});

self.addEventListener('message', function(e) {
  if (e.data === 'SKIP_WAITING') self.skipWaiting();
});

/* ---------- Activate: clean old caches ---------- */
self.addEventListener('activate', function(e) {
  e.waitUntil(
    caches.keys().then(function(names) {
      return Promise.all(
        names.filter(function(n) { return CACHE_NAMES.indexOf(n) === -1; })
             .map(function(n) { return caches.delete(n); })
      );
    }).then(function() {
      return self.clients.claim();
    })
  );
});

/* ---------- Helper: classify request ---------- */
function getCacheName(url) {
  if (url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com') return FONT_CACHE;
  if (/\.(jpg|jpeg|png|gif|webp|svg|ico)$/i.test(url.pathname)) return IMAGE_CACHE;
  return STATIC_CACHE;
}

function isHTMLRequest(url) {
  return url.pathname.endsWith('/') || url.pathname.endsWith('.html');
}

/* ---------- Network-first for HTML (fresh content when online, cached when offline) ---------- */
function handleHTML(e) {
  return fetch(e.request).then(function(response) {
    var clone = response.clone();
    caches.open(STATIC_CACHE).then(function(cache) {
      cache.put(e.request, clone).catch(function() {});
    });
    return response;
  }).catch(function() {
    return caches.match(e.request).then(function(cached) {
      return cached || caches.match('./index.html');
    });
  });
}

/* ---------- Cache-first for fonts (rarely change, long-lived) ---------- */
function handleFont(e) {
  return caches.match(e.request).then(function(cached) {
    if (cached) {
      // Revalidate in background
      fetch(e.request).then(function(response) {
        caches.open(FONT_CACHE).then(function(cache) {
          cache.put(e.request, response).catch(function() {});
        });
      }).catch(function() {});
      return cached;
    }
    return fetch(e.request).then(function(response) {
      var clone = response.clone();
      caches.open(FONT_CACHE).then(function(cache) {
        cache.put(e.request, clone).catch(function() {});
      });
      return response;
    }).catch(function() {
      return new Response('', { status: 504, statusText: 'Offline' });
    });
  });
}

/* ---------- Stale-while-revalidate for images and other static assets ---------- */
function handleStaleRevalidate(e, cacheName) {
  return caches.open(cacheName).then(function(cache) {
    return cache.match(e.request).then(function(cached) {
      var fetchPromise = fetch(e.request).then(function(response) {
        cache.put(e.request, response.clone()).catch(function() {});
        return response;
      }).catch(function() {
        return cached || new Response('', { status: 504, statusText: 'Offline' });
      });
      return cached || fetchPromise;
    });
  });
}

/* ---------- Fetch handler ---------- */
self.addEventListener('fetch', function(e) {
  if (e.request.method !== 'GET') return;

  var url = new URL(e.request.url);

  // Skip Firestore / Firebase API calls — handled by the app's offline data layer
  if (url.hostname.indexOf('firestore.googleapis.com') !== -1 ||
      url.hostname.indexOf('firebase') !== -1) {
    return;
  }

  if (isHTMLRequest(url)) {
    e.respondWith(handleHTML(e));
  } else if (url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com') {
    e.respondWith(handleFont(e));
  } else {
    e.respondWith(handleStaleRevalidate(e, getCacheName(url)));
  }
});

/* ---------- Background Sync: replay queued writes when connectivity returns ---------- */
self.addEventListener('sync', function(e) {
  if (e.tag === 'dabubu-sync') {
    e.waitUntil(
      self.clients.matchAll().then(function(clients) {
        clients.forEach(function(client) {
          client.postMessage({ type: 'REPLAY_SYNC' });
        });
        return Promise.resolve();
      })
    );
  }
});

/* ---------- Periodic cleanup of image cache (keep max 60 entries) ---------- */
self.addEventListener('message', function(e) {
  if (e.data === 'CLEAN_IMAGE_CACHE') {
    caches.open(IMAGE_CACHE).then(function(cache) {
      cache.keys().then(function(keys) {
        if (keys.length > 60) {
          keys.slice(0, keys.length - 60).forEach(function(req) {
            cache.delete(req).catch(function() {});
          });
        }
      });
    });
  }
});
