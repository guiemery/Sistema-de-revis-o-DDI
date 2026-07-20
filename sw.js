// Service Worker - Dica de Interno (Revisão Espaçada)
// Estratégia: cache-first para o app shell, permitindo abrir 100% offline,
// já que todos os dados do usuário ficam salvos localmente (localStorage).

const CACHE_NAME = 'dica-de-interno-v1';
const CACHE_VERSION = 1;

const APP_SHELL = [
  './',
  './index.html',
  './manifest.json',
  './icons/icon-16.png',
  './icons/icon-32.png',
  './icons/icon-72.png',
  './icons/icon-96.png',
  './icons/icon-128.png',
  './icons/icon-144.png',
  './icons/icon-152.png',
  './icons/icon-180.png',
  './icons/icon-192.png',
  './icons/icon-384.png',
  './icons/icon-512.png',
  './icons/icon-maskable-192.png',
  './icons/icon-maskable-512.png'
];

// Instala e faz o cache do app shell
self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(APP_SHELL).catch(() => {
        // Se algum recurso externo (CDN) falhar no addAll, tenta em separado
        // para não travar a instalação por causa de recursos de terceiros.
        return Promise.all(
          APP_SHELL.map((url) =>
            cache.add(url).catch((err) => console.warn('SW: falha ao cachear', url, err))
          )
        );
      });
    })
  );
});

// Ativa e remove caches antigos
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key !== CACHE_NAME)
          .map((key) => caches.delete(key))
      )
    ).then(() => self.clients.claim())
  );
});

// Estratégia de fetch:
// - Navegação (HTML): network-first com fallback para cache (garante update quando online,
//   e funcionamento offline quando não há internet).
// - Demais recursos (ícones, manifest, CDNs): cache-first com atualização em segundo plano.
self.addEventListener('fetch', (event) => {
  const { request } = event;

  if (request.method !== 'GET') return;

  const isNavigation = request.mode === 'navigate' ||
    (request.method === 'GET' && request.headers.get('accept')?.includes('text/html'));

  if (isNavigation) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put('./index.html', clone));
          return response;
        })
        .catch(() => caches.match('./index.html').then((res) => res || caches.match(request)))
    );
    return;
  }

  event.respondWith(
    caches.match(request).then((cached) => {
      const networkFetch = fetch(request)
        .then((response) => {
          if (response && response.status === 200) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
          }
          return response;
        })
        .catch(() => cached);

      return cached || networkFetch;
    })
  );
});
