// Service Worker - Cache + Update Detection
const CACHE_NAME = 'prometeus-v1';
const ASSETS_TO_CACHE = [
  '/',
  '/index.html',
  '/manifest.json',
  '/version.json'
];

// Instalar - cachear assets
self.addEventListener('install', event => {
  console.log('🔧 [SW] Instalando...');
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      console.log('💾 [SW] Cacheando assets principais');
      return cache.addAll(ASSETS_TO_CACHE).catch(err => {
        console.log('⚠️ Erro ao cachear alguns assets (normal):', err);
      });
    }).then(() => self.skipWaiting())
  );
});

// Ativar - limpar caches antigos
self.addEventListener('activate', event => {
  console.log('⚡ [SW] Ativando...');
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheName !== CACHE_NAME) {
            console.log('🗑️ [SW] Limpando cache antigo:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Fetch - Estratégia: Cache First, Fall Back to Network
self.addEventListener('fetch', event => {
  const { request } = event;
  const url = new URL(request.url);

  // Ignorar requisições externas (Google Sheets, Firebase, etc)
  if (url.origin !== self.location.origin) {
    return;
  }

  // version.json: SEMPRE atualizar do network primeiro
  if (url.pathname === '/version.json') {
    event.respondWith(
      fetch(request, { cache: 'no-store' })
        .then(response => {
          if (response && response.status === 200) {
            caches.open(CACHE_NAME).then(cache => {
              cache.put(request, response.clone());
            });
          }
          return response;
        })
        .catch(() => {
          return caches.match(request);
        })
    );
    return;
  }

  // Estratégia: Cache First para tudo mais
  event.respondWith(
    caches.match(request).then(response => {
      if (response) {
        // Atualizar cache em background para próxima vez
        fetch(request).then(networkResponse => {
          if (networkResponse && networkResponse.status === 200) {
            caches.open(CACHE_NAME).then(cache => {
              cache.put(request, networkResponse.clone());
            });
          }
        }).catch(() => {
          // Network falhou, usar cache
        });
        return response;
      }

      // Não está no cache, ir para network
      return fetch(request).then(networkResponse => {
        if (!networkResponse || networkResponse.status !== 200) {
          return networkResponse;
        }

        // Cachear response bem-sucedida
        const responseToCache = networkResponse.clone();
        caches.open(CACHE_NAME).then(cache => {
          cache.put(request, responseToCache);
        });

        return networkResponse;
      }).catch(error => {
        console.log('❌ [SW] Fetch failed:', error);
        // Retornar versão cacheada se disponível
        return caches.match(request);
      });
    })
  );
});

// Verificar versão
self.addEventListener('message', event => {
  if (event.data && event.data.type === 'CHECK_VERSION') {
    console.log('📋 [SW] Verificando versão...');
    
    fetch('/version.json?t=' + Date.now(), { cache: 'no-store' })
      .then(response => response.json())
      .then(data => {
        console.log('✓ [SW] Versão atual:', data.version);
        
        // Guardar versão no storage
        if (typeof caches !== 'undefined') {
          caches.open(CACHE_NAME).then(cache => {
            const response = new Response(JSON.stringify(data));
            cache.put('/version.json', response);
          });
        }
        
        event.ports[0].postMessage({ version: data.version });
      })
      .catch(error => {
        console.log('⚠️ [SW] Erro ao verificar versão:', error);
        event.ports[0].postMessage({ error: 'Failed to check version' });
      });
  }
});

