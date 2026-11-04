// Offline support for Skyrise. Pages load from the network first so updates show up
// right away, and fall back to the saved copy when there is no connection.
const CACHE = "skyrise-v7";
const CORE = [
  "./",
  "index.html",
  "manifest.webmanifest",
  "icon.svg",
  "icon-192.png",
  "icon-512.png",
  "apple-touch-icon.png",
  "fonts/fonts.css",
  "fonts/bungee.woff2",
  "fonts/lilita-one.woff2",
  "fonts/figtree.woff2",
];

self.addEventListener("install", event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(CORE)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", event => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);

  if (url.origin !== location.origin) return;

  event.respondWith(
    fetch(req)
      .then(res => {
        if (res.ok) {
          const copy = res.clone();
          caches.open(CACHE).then(cache => cache.put(req, copy));
        }
        return res;
      })
      // Challenge links (?beat=...) fall back to the saved game page.
      .catch(() => caches.match(req, { ignoreSearch: true }).then(hit => hit || caches.match("./")))
  );
});
