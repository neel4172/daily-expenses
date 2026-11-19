/**
 * @file sw.js
 * @brief Offline shell for Daily Expenses: network first, cached copy when offline.
 * Your data itself is cached and synced by Firestore, not here.
 */
const CACHE = "daily-expenses-v3";
const SHELL = ["./", "index.html", "app-auth.js", "firebase-config.js", "manifest.webmanifest",
  "apple-touch-icon.png", "icon-192.png", "icon-512.png"];

self.addEventListener("install", e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});

self.addEventListener("fetch", e => {
  const url = new URL(e.request.url);
  const isShell = url.origin === location.origin || url.hostname === "www.gstatic.com" || url.hostname.endsWith("googleapis.com") && url.pathname.startsWith("/css");
  if (e.request.method !== "GET" || !isShell) return; // let Firebase API calls go straight to the network
  e.respondWith(
    fetch(e.request).then(res => {
      if (res.ok) { const copy = res.clone(); caches.open(CACHE).then(c => c.put(e.request, copy)); }
      return res;
    }).catch(() => caches.match(e.request, { ignoreSearch: true }).then(r => r || caches.match("index.html")))
  );
});
