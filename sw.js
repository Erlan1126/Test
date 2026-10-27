// Offline support for Skyrise. Pages load from the network first so updates show up
// right away, and fall back to the saved copy when there is no connection.
const CACHE = "skyrise-v4";
const CORE = [
  "./",
  "index.html",
  "manifest.webmanifest",
  "icon.svg",
  "icon-192.png",
  "icon-512.png",
  "apple-touch-icon.png",
];
const FONT_HOSTS = ["fonts.googleapis.com", "fonts.gstatic.com"];

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

  // Fonts rarely change: serve the saved copy and refresh it in the background.
  if (FONT_HOSTS.includes(url.hostname)) {
    event.respondWith(
      caches.open(CACHE).then(async cache => {
        const saved = await cache.match(req);
        const fresh = fetch(req).then(res => { cache.put(req, res.clone()); return res; }).catch(() => saved);
        return saved || fresh;
      })
    );
    return;
  }

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
