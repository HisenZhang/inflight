// Flight Planning Tool - Service Worker for Offline Support
const CACHE_NAME = 'flight-planning-v54';
const ASSETS_TO_CACHE = [
    './',
    './index.html',
    './styles.css',
    './styles/print.css',
    './manifest.json',
    // External Libraries
    './lib/geodesy.js',
    './lib/wind-stations.js',
    // Utilities Layer
    './utils/formatters.js',
    // Data Engine
    './data/nasr-adapter.js',
    './data/ourairports-adapter.js',
    './data/data-manager.js',
    // Compute Engine
    './compute/winds-aloft.js',
    './compute/route-expander.js',
    './compute/route-calculator.js',
    './compute/query-engine.js',
    // State Management
    './state/flight-state.js',
    // Display Layer
    './display/ui-controller.js',
    './display/tactical-display.js',
    './display/app.js'
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

// Fetch event - NETWORK FIRST (cache disabled during debugging)
self.addEventListener('fetch', (event) => {
    const url = new URL(event.request.url);

    // Handle same-origin requests only (no external CDN dependencies)
    const isSameOrigin = url.origin === location.origin;

    if (!isSameOrigin) {
        // Let the browser handle cross-origin requests (CORS proxy, Google Fonts)
        return;
    }

    // NETWORK FIRST - always fetch fresh content
    event.respondWith(
        fetch(event.request).then((networkResponse) => {
            console.log('[ServiceWorker] Fresh from network:', event.request.url);
            return networkResponse;
        }).catch((error) => {
            console.error('[ServiceWorker] Fetch failed:', error);
            // Try cache as fallback
            return caches.match(event.request).then(cachedResponse => {
                if (cachedResponse) {
                    console.log('[ServiceWorker] Fallback to cache:', event.request.url);
                    return cachedResponse;
                }
                throw error;
            });
        })
    );
});
