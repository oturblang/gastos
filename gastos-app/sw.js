/* Service worker: guarda a app em cache para funcionar offline. Caminhos relativos (subpasta do GitHub Pages).
   Ao alterar qualquer ficheiro, aumenta o número de CACHE para os dispositivos receberem a nova versão. */
const CACHE = 'gastos-v2';
const FICHEIROS = ['./', './index.html', './styles.css', './js/util.js', './js/calc.js', './js/db.js', './js/app.js', './js/registo.js',
  './manifest.webmanifest', './icons/icon-192.png', './icons/icon-512.png'];
self.addEventListener('install', e => { e.waitUntil(caches.open(CACHE).then(c => c.addAll(FICHEIROS)).then(() => self.skipWaiting())); });
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  e.respondWith(caches.match(e.request, { ignoreSearch: true }).then(r => r || fetch(e.request).catch(() =>
    e.request.mode === 'navigate' ? caches.match('./index.html') : Response.error())));
});
