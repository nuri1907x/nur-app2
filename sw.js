// Nur – Service Worker: App offline, gelesene Suren/Hadithe/Gebetszeiten aus dem Cache
const VERSION = 'nur-v6';
const SHELL = ['./', './index.html', './manifest.json', './apple-touch-icon.png', './icon-192.png', './icon-512.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(VERSION).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys => Promise.all(keys.filter(k => k !== VERSION && k !== VERSION + '-data').map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  // Audio nicht cachen (zu groß)
  if (url.pathname.endsWith('.mp3')) return;

  if (url.origin === location.origin) {
    // App-Dateien: Cache zuerst, im Hintergrund aktualisieren
    e.respondWith(
      caches.match(req).then(hit => {
        const net = fetch(req).then(res => {
          if (res.ok) caches.open(VERSION).then(c => c.put(req, res.clone()));
          return res;
        }).catch(() => hit);
        return hit || net;
      })
    );
  } else {
    // APIs: Netzwerk zuerst, offline aus dem Cache
    e.respondWith(
      fetch(req).then(res => {
        if (res.ok) { const copy = res.clone(); caches.open(VERSION + '-data').then(c => c.put(req, copy)); }
        return res;
      }).catch(() => caches.match(req))
    );
  }
});
