/**
 * Service Worker — Finrush PWA
 *
 * Strategy: Network-first with cache fallback.
 * During development / rapid deploys we NEVER want stale cached pages.
 * The cache is only used as an offline fallback.
 *
 * On every new deployment the CACHE_VERSION changes (bumped by CI or manually),
 * which triggers the `activate` event and wipes old caches.
 */

const CACHE_VERSION = 'finrush-v2';
const OFFLINE_ASSETS = [
    '/manifest.json',
    '/icon-192.png',
    '/icon-512.png',
];

// Install — pre-cache only essential offline assets (NOT the HTML pages)
self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_VERSION)
            .then((cache) => cache.addAll(OFFLINE_ASSETS))
            .then(() => self.skipWaiting()) // Activate immediately
    );
});

// Activate — delete all old caches so stale content is never served
self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((keys) =>
            Promise.all(
                keys
                    .filter((key) => key !== CACHE_VERSION)
                    .map((key) => caches.delete(key))
            )
        ).then(() => self.clients.claim()) // Take control of all open pages
    );
});

// Fetch — Network-first: always try the network, fall back to cache on failure
self.addEventListener('fetch', (event) => {
    // Skip non-GET and WebSocket/Sentry requests
    if (event.request.method !== 'GET') return;
    const url = new URL(event.request.url);
    if (url.pathname.startsWith('/monitoring')) return; // Sentry tunnel
    if (url.protocol === 'ws:' || url.protocol === 'wss:') return;

    event.respondWith(
        fetch(event.request)
            .then((response) => {
                // Cache a clone for offline fallback
                if (response.ok) {
                    const clone = response.clone();
                    caches.open(CACHE_VERSION).then((cache) => cache.put(event.request, clone));
                }
                return response;
            })
            .catch(() => {
                // Network failed — try cache
                return caches.match(event.request).then((cached) => {
                    return cached || new Response('Offline — please check your connection.', {
                        status: 503,
                        headers: { 'Content-Type': 'text/plain' },
                    });
                });
            })
    );
});
