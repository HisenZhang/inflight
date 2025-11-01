// Flight Planning Tool - Service Worker for Offline Support
const CACHE_NAME = 'flight-planning-v7';
const ASSETS_TO_CACHE = [
    './',
    './index.html',
    './app.js',
    './geodesy.js',  // WMM2025 with spherical harmonics
    './styles.css',
    './manifest.json'
];

// Install event - cache assets
self.addEventListener('install', (event) => {
    console.log('[ServiceWorker] Install');
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            console.log('[ServiceWorker] Caching app shell');
            return cache.addAll(ASSETS_TO_CACHE);
        }).then(() => {
            return self.skipWaiting();
        })
    );
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
    console.log('[ServiceWorker] Activate');
    event.waitUntil(
        caches.keys().then((keyList) => {
            return Promise.all(keyList.map((key) => {
                if (key !== CACHE_NAME) {
                    console.log('[ServiceWorker] Removing old cache', key);
                    return caches.delete(key);
                }
            }));
        }).then(() => {
            return self.clients.claim();
        })
    );
});

// Fetch event - serve from cache, fallback to network
self.addEventListener('fetch', (event) => {
    const url = new URL(event.request.url);

    // Handle same-origin requests only (no external CDN dependencies)
    const isSameOrigin = url.origin === location.origin;

    if (!isSameOrigin) {
        // Let the browser handle cross-origin requests (CORS proxy, Google Fonts)
        return;
    }

    // For same-origin requests, use cache-first strategy
    event.respondWith(
        caches.match(event.request).then((cachedResponse) => {
            if (cachedResponse) {
                console.log('[ServiceWorker] Serving from cache:', event.request.url);
                return cachedResponse;
            }

            console.log('[ServiceWorker] Fetching from network:', event.request.url);

            return fetch(event.request).then((networkResponse) => {
                // Check if we received a valid response
                if (!networkResponse || networkResponse.status !== 200 || networkResponse.type !== 'basic') {
                    // Don't cache invalid, error, or opaque responses
                    return networkResponse;
                }

                // Clone the response (can only be consumed once)
                const responseToCache = networkResponse.clone();

                caches.open(CACHE_NAME).then((cache) => {
                    cache.put(event.request, responseToCache);
                });

                return networkResponse;
            }).catch((error) => {
                console.error('[ServiceWorker] Fetch failed:', error);
                // If fetch fails and we don't have cache, let it fail naturally
                throw error;
            });
        })
    );
});
