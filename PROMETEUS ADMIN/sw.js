const CACHE_NAME = 'prometeus-v1';
const urlsToCache = [
  '/',
  '/index.html',
  '/admin.html',
  '/manifest.json',
  '/manifest-admin.json'
];

// Instalar service worker
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      console.log('Cache aberto');
      return cache.addAll(urlsToCache).catch(err => {
        console.log('Erro ao cachear arquivos:', err);
      });
    })
  );
  self.skipWaiting();
});

// Ativar service worker
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheName !== CACHE_NAME) {
            console.log('Deletando cache antigo:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  self.clients.claim();
});

// Interceptar requisições
self.addEventListener('fetch', event => {
  // Apenas para GET
  if (event.request.method !== 'GET') {
    return;
  }

  event.respondWith(
    caches.match(event.request).then(response => {
      // Se está em cache, retornar do cache
      if (response) {
        return response;
      }

      // Senão, fazer requisição normal
      return fetch(event.request).then(response => {
        // Não cachear respostas que não são sucesso
        if (!response || response.status !== 200 || response.type !== 'basic') {
          return response;
        }

        // Clonar a resposta
        const responseToCache = response.clone();

        caches.open(CACHE_NAME).then(cache => {
          cache.put(event.request, responseToCache);
        });

        return response;
      }).catch(() => {
        // Se falhar e for HTML, tentar retornar index.html em cache
        if (event.request.headers.get('accept').includes('text/html')) {
          return caches.match('/index.html').catch(() => {
            return caches.match('/admin.html');
          });
        }
        return caches.match('/index.html');
      });
    })
  );
});

