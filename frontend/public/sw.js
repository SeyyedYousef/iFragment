const CACHE_NAME = 'ifragment-cache-v9';
const SCOPE_URL = new URL('./', self.registration ? self.registration.scope : self.location.href);
const OFFLINE_URL = new URL('offline.html', SCOPE_URL).href;
const INDEX_URL = new URL('index.html', SCOPE_URL).href;
const ASSETS_TO_CACHE = [
	SCOPE_URL.href,
	new URL('manifest.webmanifest', SCOPE_URL).href,
	OFFLINE_URL,
	new URL('material-symbols-outlined.woff2', SCOPE_URL).href,
];

self.addEventListener('install', (event) => {
	self.skipWaiting();
	event.waitUntil(
		caches.open(CACHE_NAME).then((cache) => {
			return cache.addAll(ASSETS_TO_CACHE).catch((err) => {
				console.warn('[SW] Pre-caching failed:', err);
			});
		}),
	);
});

self.addEventListener('activate', (event) => {
	event.waitUntil(
		caches
			.keys()
			.then((cacheNames) => {
				return Promise.all(
					cacheNames.map((cacheName) => {
						if (cacheName !== CACHE_NAME) {
							console.log('[SW] Clearing old cache:', cacheName);
							return caches.delete(cacheName);
						}
					}),
				);
			})
			.then(() => self.clients.claim()),
	);
});

self.addEventListener('fetch', (event) => {
	const requestUrl = new URL(event.request.url);

	// Bypass API requests and external telemetry/sentry
	if (
		event.request.method !== 'GET' ||
		requestUrl.pathname.startsWith('/api') ||
		requestUrl.hostname.includes('sentry') ||
		requestUrl.hostname.includes('telemetry')
	) {
		return;
	}

	// For HTML/navigation requests, use Network-First strategy to ensure instant updates.
	// Fall back to cached files only if network is offline or unreachable.
	if (
		event.request.mode === 'navigate' ||
		requestUrl.href === SCOPE_URL.href ||
		requestUrl.href === INDEX_URL
	) {
		event.respondWith(
			fetch(event.request)
				.then((networkResponse) => {
					if (networkResponse && networkResponse.status === 200) {
						const responseToCache = networkResponse.clone();
						caches.open(CACHE_NAME).then((cache) => {
							cache.put(event.request, responseToCache);
						});
					}
					return networkResponse;
				})
				.catch(() => {
					return caches.match(OFFLINE_URL).then((res) => res || caches.match(INDEX_URL));
				}),
		);
		return;
	}

	// For all other static assets, use Stale-While-Revalidate caching strategy.
	event.respondWith(
		caches.match(event.request).then((cachedResponse) => {
			if (cachedResponse) {
				// Fetch in background to update cache for next time
				fetch(event.request)
					.then((networkResponse) => {
						if (networkResponse.status === 200) {
							caches.open(CACHE_NAME).then((cache) => cache.put(event.request, networkResponse));
						}
					})
					.catch(() => {
						/* ignore offline fetch error */
					});
				return cachedResponse;
			}

			return fetch(event.request)
				.then((networkResponse) => {
					if (
						!networkResponse ||
						networkResponse.status !== 200 ||
						(networkResponse.type !== 'basic' && networkResponse.type !== 'cors')
					) {
						return networkResponse;
					}

					const responseToCache = networkResponse.clone();
					caches.open(CACHE_NAME).then((cache) => {
						cache.put(event.request, responseToCache);
					});

					return networkResponse;
				})
				.catch((error) => {
					return Promise.reject(error);
				});
		}),
	);
});

// Trigger immediate page refresh on new service worker activation
self.addEventListener('message', (event) => {
	if (event.data && event.data.type === 'SKIP_WAITING') {
		self.skipWaiting();
	}
});
