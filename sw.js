
const CACHE_NAME = 'pae-multiforms-cache-v2';
const ASSETS = ['./', './index.html', './admin.html', './style.css', './db.js', './app.js', './admin.js', './manifest.webmanifest', './icons/icon-192.png', './icons/icon-512.png', './assets/logo-pae.png', './assets/logo-org.png'];
self.addEventListener('install', e => { e.waitUntil(caches.open(CACHE_NAME).then(c => c.addAll(ASSETS))); self.skipWaiting(); });
self.addEventListener('activate', e => { e.waitUntil(caches.keys().then(keys => Promise.all(keys.map(k => k !== CACHE_NAME ? caches.delete(k) : null)))); self.clients.claim(); });
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);

  if (url.pathname.startsWith('/pae/server/')) {
    e.respondWith(
      fetch(e.request).catch(() =>
        new Response(
          JSON.stringify({ ok: false, message: 'Sin conexión' }),
          { headers: { 'Content-Type': 'application/json' }, status: 503 }
        )
      )
    );
    return;
  }


  if (e.request.mode === 'navigate') {
    e.respondWith(
      caches.match('./index.html').then(resp => resp || fetch(e.request))
    );
    return;
  }


  e.respondWith(
    caches.match(e.request).then(c => c || fetch(e.request))
  );
});
