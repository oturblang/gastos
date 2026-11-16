/* Service worker: guarda a app em cache para funcionar offline. Caminhos relativos (subpasta do GitHub Pages).
   Com internet vai buscar sempre a versão mais recente; sem internet usa a cópia guardada.
   Ao alterar ficheiros, aumenta o número de CACHE e acrescenta ficheiros novos à lista. */
const CACHE = 'gastos-v8';
const FICHEIROS = ['./', './index.html', './styles.css', './js/util.js', './js/calc.js', './js/db.js', './js/app.js', './js/metas.js', './js/graficos.js',
  './js/demo.js', './js/analise.js', './js/calculos.js', './js/csv.js', './testes.html', './js/testes.js', './js/poupanca.js', './js/invest.js', './js/periodos.js', './js/registo.js', './manifest.webmanifest', './icons/icon-192.png', './icons/icon-512.png'];
self.addEventListener('install', e => { e.waitUntil(caches.open(CACHE).then(c => c.addAll(FICHEIROS)).then(() => self.skipWaiting())); });
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET' || new URL(e.request.url).origin !== location.origin) return;
  e.respondWith(
    fetch(e.request.url, { cache: 'no-cache' }).then(r => {
      if (r.ok) { const c = r.clone(); caches.open(CACHE).then(ca => ca.put(e.request.url, c)); }
      return r;
    }).catch(() => caches.match(e.request.url, { ignoreSearch: true }).then(r => r || (e.request.mode === 'navigate' ? caches.match('./index.html') : Response.error())))
  );
});
