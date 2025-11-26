// Flight Planning Tool - Service Worker for Offline Support

// Import version configuration
importScripts('./version.js');

// Use centralized cache name from version.js
const CACHE_NAME = self.AppVersion.CACHE_NAME;
console.log('[ServiceWorker] Cache name:', CACHE_NAME, '| App version:', self.AppVersion.VERSION);
const ASSETS_TO_CACHE = [
    './',
    './index.html',
    './styles.css',
    './styles/base.css',
    './styles/components.css',
    './styles/map.css',
    './styles/welcome.css',
    './styles/print.css',
    './styles/pwa-install.css',
    './styles/tutorial.css',
    './styles/tokens.css',
    './styles/utilities.css',
    './manifest.json',
    './version.js',
    // UI Layer
    './ui/pwa-install.js',
    './ui/tutorial.js',
    // PWA Icons and Screenshots
    './public/icon-192.svg',
    './public/icon-512.svg',
    './public/icon-maskable-192.svg',
    './public/icon-maskable-512.svg',
    './public/apple-touch-icon.svg',
    './public/favicon.svg',
    './public/screenshot-wide.svg',
    // External Libraries
    './lib/geodesy.js',
    './lib/wind-stations.js',
    // Utilities Layer
    './utils/formatters.js',
    './utils/compression.js',
    './utils/wake-lock.js',
    // Data Engine
    './data/nasr-adapter.js',
    './data/ourairports-adapter.js',
    './data/data-manager.js',
    // Compute Engine
    './compute/winds-aloft.js',
    './compute/route-lexer.js',
    './compute/route-parser.js',
    './compute/route-resolver.js',
    './compute/route-engine.js',
    './compute/route-expander.js',
    './compute/route-calculator.js',
    './compute/query-engine.js',
    './compute/terrain-analyzer.js',
    // State Management
    './state/flight-state.js',
    './state/flight-tracker.js',
    // Display Layer
    './display/ui-controller.js',
    './display/stats-controller.js',
    './display/checklist-controller.js',
    './display/map-display.js',
    './display/app.js'
];

// Install event - cache assets
self.addEventListener('install', (event) => {
    console.log('[ServiceWorker] Install');
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            console.log('[ServiceWorker] Caching app shell');
            return cache.addAll(ASSETS_TO_CACHE);
        })
        // Don't auto-skipWaiting - wait for user action
    );
});

// Listen for messages from clients
self.addEventListener('message', (event) => {
    if (event.data && event.data.type === 'SKIP_WAITING') {
        console.log('[ServiceWorker] Received SKIP_WAITING message');
        self.skipWaiting();
    }
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
            // Only log in development (when not on https://)
            if (location.protocol !== 'https:') {
                console.log('[ServiceWorker] Fresh from network:', event.request.url);
            }
            return networkResponse;
        }).catch((error) => {
            // Try cache as fallback
            return caches.match(event.request).then(cachedResponse => {
                if (cachedResponse) {
                    // Success: offline mode working
                    console.log('[ServiceWorker] Serving from cache (offline):', event.request.url);
                    return cachedResponse;
                }
                // Only error if cache also failed
                console.error('[ServiceWorker] Not in cache and network failed:', event.request.url);
                throw error;
            });
        })
    );
});
