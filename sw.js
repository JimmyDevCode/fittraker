// Primero la red (siempre la última versión tras un deploy) y, sin conexión, la copia guardada.
// Las llamadas a Google no pasan por aquí: los datos pendientes ya se guardan en localStorage.
const CACHE = 'fittracker-shell-v9';
const SHELL = ['./', 'index.html', 'styles.css', 'app.js', 'sheets.js', 'config.js', 'manifest.webmanifest', 'icons/icon.svg', 'icons/icon-192.png', 'data/tabla-peruana.json'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys()
    .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});

self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== location.origin) return;
  e.respondWith(
    fetch(e.request)
      .then(res => {
        if (res.ok) {
          const copy = res.clone();
          caches.open(CACHE).then(c => c.put(e.request, copy));
        }
        return res;
      })
      .catch(() => caches.match(e.request, { ignoreSearch: true })
        .then(hit => hit || (e.request.mode === 'navigate' ? caches.match('index.html') : Response.error())))
  );
});
