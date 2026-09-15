/* ============================================================================
   service-worker.js — MetroCDMX PWA
   ----------------------------------------------------------------------------
   Estrategia CACHE-FIRST:
     1. Al instalarse, guarda en caché los archivos de la app (precarga).
     2. En cada petición, responde primero desde la caché; si no está, va a la
        red y guarda la respuesta para la próxima vez.
   Resultado: después de la primera visita la app abre sin internet.

   IMPORTANTE al publicar cambios: sube el número de CACHE_VERSION. Eso hace
   que el navegador instale un service worker nuevo, vuelva a descargar los
   archivos y borre la caché vieja. Si no lo subes, los usuarios seguirán
   viendo la versión anterior (es el precio de "cache-first").
   ========================================================================== */

const CACHE_VERSION = 'v2026-09-15-1652';
const CACHE_NAME = 'metrocdmx-' + CACHE_VERSION;

// Archivos que se precargan al instalar. Rutas relativas al service worker.
const PRECACHE = [
  './',
  './index.html',
  './manifest.json',
  './stations.json',
  './icon-192.png',
  './icon-512.png',
  './apple-touch-icon.png',
];

// 1. Instalación: precargar todo. skipWaiting() hace que la versión nueva
//    tome el control en cuanto termina de instalarse, sin esperar a que se
//    cierren todas las pestañas.
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(PRECACHE))
      .then(() => self.skipWaiting())
  );
});

// 2. Activación: borrar cachés de versiones anteriores y reclamar las
//    pestañas abiertas para que usen este service worker de inmediato.
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k.startsWith('metrocdmx-') && k !== CACHE_NAME).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// 3. Peticiones: cache-first. Solo GET; lo demás (si algún día hay POST a una
//    API) pasa directo a la red.
self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET') return;

  event.respondWith(
    caches.match(req, { ignoreSearch: true }).then(cached => {
      if (cached) return cached;
      return fetch(req).then(res => {
        // Guardar en caché lo que llegue bien de la red. Incluye recursos de
        // otros dominios (las fuentes de Google) para que también funcionen
        // sin conexión después de la primera carga; sus respuestas "opacas"
        // (status 0) se guardan tal cual.
        const ok = res && (res.status === 200 || res.type === 'opaque');
        if (ok) {
          const copy = res.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(req, copy));
        }
        return res;
      }).catch(() => {
        // Sin red y sin caché: si pedían una página, devolvemos la app.
        if (req.mode === 'navigate') return caches.match('./index.html');
        return new Response('', { status: 503, statusText: 'Sin conexión' });
      });
    })
  );
});
