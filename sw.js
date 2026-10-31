// Offline support for Skyrise and Echo. Pages load from the network first so updates show up
// right away, and fall back to the saved copy when there is no connection. Both games' files
// are saved when the service worker installs, so they work offline after the first visit.
const CACHE = "games-v3";
const CORE = [
  "./",
  "index.html",
  "manifest.webmanifest",
  "icon.svg",
  "icon-192.png",
  "icon-512.png",
  "apple-touch-icon.png",
  "echo.html",
  "echo.webmanifest",
  "echo-icon.svg",
  "echo-icon-192.png",
  "echo-icon-512.png",
  "echo-apple-touch-icon.png",
  "echo/levels.js",
  "echo/save.js",
  "echo/audio.js",
  "echo/render.js",
  "echo/decor.js",
  "echo/gl.js",
  "echo/game.js",
  "echo/mobs.js",
  "echo/draw.js",
  "echo/ui.js",
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
