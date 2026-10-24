/* Offline edition d4ee8a24f5cdbd6ee2fcb7b28943226c4b34869d61c2300ed8f5e903043ae5ba. Generated from the complete build. */
const CACHE = "grama-d4ee8a24f5cdbd6ee2fcb7b28943226c4b34869d61c2300ed8f5e903043ae5ba";
const EDITION = "d4ee8a24f5cdbd6ee2fcb7b28943226c4b34869d61c2300ed8f5e903043ae5ba";
const BASE = "/grama/";
const FILES = ["/grama/assets/main-BDUA8IuM.js","/grama/assets/main-BNACetDe.css","/grama/favicon.svg","/grama/fonts/IBMPlex-OFL.txt","/grama/fonts/IBMPlexSans-Regular.woff2","/grama/fonts/IBMPlexSans-SemiBold.woff2","/grama/fonts/NotoSerif-OFL.txt","/grama/fonts/NotoSerif-Regular.ttf","/grama/fonts/NotoSerifDevanagari-OFL.txt","/grama/fonts/NotoSerifDevanagari.ttf","/grama/index.html","/grama/sources/grosset-21.jpg","/grama/sources/grosset-28.jpg","/grama/sources/grosset-29.jpg","/grama/sources/grosset-57.jpg","/grama/sources/grosset-58.jpg","/grama/sources/grosset-85.jpg","/grama/sources/grosset-86.jpg","/grama/sources/grosset-title.jpg","/grama/sources/manifest.json","/grama/sources/natya-301.jpg","/grama/sources/natya-302.jpg","/grama/sources/natya-title.jpg"];
const INTEGRITY = {"/grama/assets/main-BDUA8IuM.js":"sha256-1MlKl2n4Xe3CtPd6dgt9TQcLbkwBCleC32WTZiengSw=","/grama/assets/main-BNACetDe.css":"sha256-WQWK35RxGTn5EHfefVpnqY5lVFPyiRa0iCuIjByiKn8=","/grama/favicon.svg":"sha256-rp23x+Bk2WyHn0uBJmgmWdwKqoFELctsJ8YZFwUuoUQ=","/grama/fonts/IBMPlex-OFL.txt":"sha256-fmsoGO29j2oBroBkHMjxalEIDQj7TlMr46C290rbB9o=","/grama/fonts/IBMPlexSans-Regular.woff2":"sha256-unEaMIX/nydEC2ucRVDPxHyXvzZZHV2pWLl1uzrdjBo=","/grama/fonts/IBMPlexSans-SemiBold.woff2":"sha256-94BIAw6rYuhg76OaDfeeLlWBvxIuuVubxCwLikmI0gU=","/grama/fonts/NotoSerif-OFL.txt":"sha256-zumJL58MyP6ILJ6VN+5qiWIdhu586vcLAuKyscJcBho=","/grama/fonts/NotoSerif-Regular.ttf":"sha256-VHPS5DvdAY7hJKSt26gJH9CimJSxIcu3QQI69lSWYrY=","/grama/fonts/NotoSerifDevanagari-OFL.txt":"sha256-ohb2+NhccigJPg7l4ljZ03fmZx9orLTbGTCylYPQ8zE=","/grama/fonts/NotoSerifDevanagari.ttf":"sha256-EZHge/6wYtgOJS64Ww6v372h41BweipgYoZo6PZ327s=","/grama/index.html":"sha256-aKVles3d7tt7kwHA31WTlug6hinAZ7+D25MXcfi97GM=","/grama/sources/grosset-21.jpg":"sha256-efa3H7zoHxjWPWY84QiDoqF8wV/irbdrgkrPQmFIowk=","/grama/sources/grosset-28.jpg":"sha256-qRtJF4q/7qfapHiEP204X/TQE20nM6vblb0r3KZrr+M=","/grama/sources/grosset-29.jpg":"sha256-pgeQvd6hZFanUZbJJ0WXpnteQ1MaZahDdI1Tl9xRPr4=","/grama/sources/grosset-57.jpg":"sha256-859+VxwGy5XhWpKwac4L4JVVOjdin4danSbYkU3xiuY=","/grama/sources/grosset-58.jpg":"sha256-vcyHPHpW42S884xaNvOawcQ+0vbmjvFktSTwBsyerLQ=","/grama/sources/grosset-85.jpg":"sha256-psfWznPh0RauiyBIPFUi3+4rUeFrqa3sGdzm7P8YCjo=","/grama/sources/grosset-86.jpg":"sha256-WekN6FmdkxMQp8Q21K1Z6yJniHLjrLsApx+TaSMezZI=","/grama/sources/grosset-title.jpg":"sha256-+QDlyMc3saw+ma8PuD4WHrsqd4HkjtlO5ymPD0yaG7M=","/grama/sources/manifest.json":"sha256-3ehkg7mARTezFiTA+sLPIL9alWtaUN6n+1hbV3GhiPs=","/grama/sources/natya-301.jpg":"sha256-vqNv/eBbap9iBf2SgRp6uYjnzCculvk/zjPf7LXRL9o=","/grama/sources/natya-302.jpg":"sha256-qH7dxxeKcibO23ATXhvfi9o6zjI+MBhJkoaTZApIqug=","/grama/sources/natya-title.jpg":"sha256-rhaiVr8hvZ8+ftfXISyz4dMY3lsl3aFKVxs0jSwGSNU="};
self.addEventListener("install", event => {
  // HTTP success does not establish edition identity. A stale entry page or
  // substituted scan must fail the complete install before this worker activates.
  const requests = FILES.map(url => new Request(url, { cache: "reload", integrity: INTEGRITY[url] }));
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(requests)).then(() => self.skipWaiting()));
});
self.addEventListener("activate", event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key.startsWith("grama-") && key !== CACHE).map(key => caches.delete(key)))).then(() => self.clients.claim()));
});
self.addEventListener("message", event => {
  if (event.data?.type === "GRAMA_CLAIM" && event.data.edition === EDITION) {
    event.waitUntil(self.clients.claim());
    return;
  }
  if (event.data?.type === "GRAMA_ACTIVATE") {
    event.waitUntil(self.skipWaiting());
    return;
  }
  if (event.data?.type !== "GRAMA_INSPECT" || !event.ports[0]) return;
  // A late reply from a superseded worker must not recreate its deleted cache.
  event.waitUntil(Promise.all(FILES.map(file => caches.match(file, { cacheName: CACHE }))).then(saved => {
    event.ports[0].postMessage({ type: "GRAMA_EDITION", edition: EDITION, complete: saved.every(Boolean) });
  }).catch(() => event.ports[0].postMessage({ type: "GRAMA_EDITION", edition: EDITION, complete: false })));
});
self.addEventListener("fetch", event => {
  const url = new URL(event.request.url);
  if (event.request.method !== "GET" || url.origin !== self.location.origin || !url.pathname.startsWith(BASE)) return;
  if (event.request.mode === "navigate") {
    const page = url.pathname === BASE || url.pathname === BASE + "index.html" ? BASE + "index.html" : url.pathname;
    if (FILES.includes(page)) event.respondWith(fetch(event.request).catch(() => caches.open(CACHE).then(cache => cache.match(page))));
  } else if (FILES.includes(url.pathname)) {
    event.respondWith(caches.open(CACHE).then(cache => cache.match(url.pathname)).then(cached => cached || fetch(event.request)));
  }
});
