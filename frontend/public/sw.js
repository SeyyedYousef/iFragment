const CACHE_NAME = 'ifragment-cache-v1';
const ASSETS_TO_CACHE = [
	'/',
	'/index.html',
	'/manifest.webmanifest',
	'/offline.html',
	'/material-symbols-outlined.woff2',
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
					// If offline and requesting navigation, serve offline fallback
					if (event.request.mode === 'navigate') {
						return caches.match('/offline.html') || caches.match('/index.html');
					}
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
