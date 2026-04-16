const CACHE_NAME = 'cardledger-offline-v5';

const CORE_ASSETS = [
    '/',
    '/cards',
    '/sets',
    '/about',
    '/dashboard',
    '/manifest.json' 
];

self.addEventListener('install', (event) => {
    // Force the waiting service worker to become the active service worker.
    self.skipWaiting();
    
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            console.log('[ServiceWorker] Pre-caching core assets');
            return cache.addAll(CORE_ASSETS);
        })
    );
});

self.addEventListener('activate', (event) => {
    // Claim any clients immediately so we don't have to reload the page
    event.waitUntil(self.clients.claim());
    
    // Clean up old caches
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames.map((cacheName) => {
                    if (cacheName !== CACHE_NAME) {
                        console.log('[ServiceWorker] Deleting old cache:', cacheName);
                        return caches.delete(cacheName);
                    }
                })
            );
        })
    );
});

self.addEventListener('fetch', (event) => {
    if (event.request.method !== 'GET') return;

    const url = new URL(event.request.url);

    // 1. Handle RSC (React Server Component) Data Requests
    // Cache these so client-side routing works offline for visited cards
    if (event.request.headers.get('RSC') === '1') {
        event.respondWith(
            fetch(event.request).then((networkResponse) => {
                // If network is good, save a copy to the cache
                if (networkResponse.ok) {
                    const clone = networkResponse.clone();
                    caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
                }
                return networkResponse;
            }).catch(() => {
                // If offline, try to find the RSC payload in the cache
                return caches.match(event.request);
            })
        );
        return;
    }

    // 2. Handle the Pointer File from R2
    if (url.href.includes('assets.cardledger.io/indices/card-index.current.json')) {
        event.respondWith(
            caches.match(event.request).then((cachedResponse) => {
                const fetchPromise = fetch(event.request).then((networkResponse) => {
                    if (networkResponse.status === 200) {
                        caches.open(CACHE_NAME).then((cache) => {
                            cache.put(event.request, networkResponse.clone());
                        });
                    }
                    return networkResponse;
                }).catch(() => cachedResponse);
                return cachedResponse || fetchPromise;
            })
        );
        return;
    }

    // 3. Handle HTML Navigation (Dynamic Routes & Fallbacks)
    if (event.request.mode === 'navigate') {
        event.respondWith(
            fetch(event.request).then((networkResponse) => {
                if (networkResponse.ok) {
                    const clone = networkResponse.clone();
                    caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
                }
                return networkResponse;
            }).catch(() => {
                return caches.match(event.request, { ignoreSearch: true }).then((response) => {
                    // 1. If we have the page cached, serve it
                    if (response) return response;

                    const url = new URL(event.request.url);
                    const pathname = url.pathname;

                    // 2. Circuit Breaker: Never redirect root directories
                    if (pathname === '/sets' || pathname === '/cards' || pathname === '/dashboard') {
                        return caches.match('/'); 
                    }

                    // 3. The Referrer Bounce (with Anti-Loop Protection)
                    const referer = event.request.referrer;
                    // Only bounce back if the referrer exists AND is not the exact same URL we just failed on
                    if (referer && referer !== event.request.url) {
                        return Response.redirect(referer, 302);
                    }

                    // 4. Ultimate Directory Fallback
                    // If we got here, they hit refresh on an uncached page. Bounce them up a level.
                    if (pathname.startsWith('/sets/')) return Response.redirect('/sets', 302);
                    if (pathname.startsWith('/cards/')) return Response.redirect('/cards', 302);
                    
                    return caches.match('/'); 
                });
            })
        );
        return;
    }

    // 4. Handle Static Assets (Images, CSS, JS)
    event.respondWith(
        caches.match(event.request).then((cachedResponse) => {
            if (cachedResponse) return cachedResponse;
            return fetch(event.request).then((networkResponse) => {
                if (!networkResponse || networkResponse.status !== 200 || networkResponse.type !== 'basic') {
                    return networkResponse;
                }
                const responseToCache = networkResponse.clone();
                caches.open(CACHE_NAME).then((cache) => cache.put(event.request, responseToCache));
                return networkResponse;
            });
        })
    );
});