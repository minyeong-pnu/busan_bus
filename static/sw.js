const CACHE_NAME = 'bus-tracker-v1';
const urlsToCache = [
    '/',
    '/index.html',
    '/style.css',
    '/app.js',
    '/manifest.json',
    '/bus-icon.svg'
];

self.addEventListener('install', event => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => cache.addAll(urlsToCache))
    );
});

self.addEventListener('fetch', event => {
    if (event.request.url.includes('/api/')) {
        // API 요청은 네트워크 우선
        event.respondWith(
            fetch(event.request).catch(() => caches.match(event.request))
        );
    } else {
        // 정적 파일은 캐시 우선
        event.respondWith(
            caches.match(event.request)
                .then(response => {
                    if (response) return response;
                    return fetch(event.request);
                })
        );
    }
});
