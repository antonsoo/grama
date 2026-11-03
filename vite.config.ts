import { createHash } from "node:crypto";
import { readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { defineConfig } from "vite";

const base = "/grama/";

async function filesIn(directory: string): Promise<string[]> {
  const entries = await readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(
    entries.map((entry) =>
      entry.isDirectory()
        ? filesIn(path.join(directory, entry.name))
        : Promise.resolve([path.join(directory, entry.name)]),
    ),
  );
  return nested.flat();
}

export default defineConfig(async ({ command }) => {
  const inputFiles = [
    ...(await filesIn("src")),
    ...(await filesIn("public")),
    "index.html",
    "tuning.html",
    "vite.config.ts",
    "tsconfig.json",
    "package.json",
    "package-lock.json",
  ].sort();
  const inputHash = createHash("sha256");
  for (const file of inputFiles) {
    inputHash.update(file);
    inputHash.update(await readFile(file));
  }
  const edition = command === "build" ? inputHash.digest("hex") : "development";
  return {
    base,
    build: {
      rolldownOptions: {
        input: { main: "index.html", tuning: "tuning.html" },
      },
    },
    define: {
      __GRAMA_EDITION__: JSON.stringify(edition),
      __ASSET_HASHES__: JSON.stringify(
        Object.fromEntries(
          await Promise.all(
            (await filesIn("public")).map(async (file) => [
              file.slice(7),
              createHash("sha256")
                .update(await readFile(file))
                .digest("hex"),
            ]),
          ),
        ),
      ),
    },
    plugins: [
      {
        name: "retained-source-manifest",
        resolveId(id: string) {
          if (id === "virtual:grama-sources") return "\0grama-sources";
        },
        async load(id: string) {
          if (id !== "\0grama-sources") return;
          const file = path.resolve("public/sources/manifest.json");
          this.addWatchFile(file);
          return `export default ${await readFile(file, "utf8")};`;
        },
      },
      {
        name: "offline-workshop",
        apply: "build",
        async closeBundle() {
          const files = (await filesIn("dist")).filter((f) => !f.endsWith("sw.js")).sort();
          const urls = files.map(
            (file) => base + path.relative("dist", file).split(path.sep).join("/"),
          );
          const integrity = Object.fromEntries(
            await Promise.all(
              files.map(async (file, index) => [
                urls[index],
                `sha256-${createHash("sha256")
                  .update(await readFile(file))
                  .digest("base64")}`,
              ]),
            ),
          );
          await writeFile(
            "dist/sw.js",
            `/* Offline edition ${edition}. Generated from the complete build. */
const CACHE = "grama-${edition}";
const EDITION = ${JSON.stringify(edition)};
const BASE = ${JSON.stringify(base)};
const FILES = ${JSON.stringify(urls)};
const INTEGRITY = ${JSON.stringify(integrity)};
async function valid(file, response) {
  if (!response || !response.ok) return false;
  const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", await response.arrayBuffer()));
  return "sha256-" + btoa(String.fromCharCode(...digest)) === INTEGRITY[file];
}
async function inspect() {
  // match() avoids recreating a deleted superseded cache.
  const checked = await Promise.all(FILES.map(async file => valid(file, await caches.match(file, { cacheName: CACHE }))));
  return checked.every(Boolean);
}
async function announce() {
  const clients = await self.clients.matchAll({ type: "window" });
  clients.forEach(client => client.postMessage({ type: "GRAMA_CACHE_CHANGED", edition: EDITION }));
}
let repairing;
async function repair() {
  if (repairing) return repairing;
  repairing = (async () => {
    const cache = await caches.open(CACHE);
    // Preserve valid files; fetch only missing or substituted bytes. Sequential
    // requests also avoid competing with a foreground illustrated reading.
    for (const file of FILES) {
      if (await valid(file, await cache.match(file))) continue;
      const response = await fetch(new Request(file, { cache: "reload", integrity: INTEGRITY[file], signal: AbortSignal.timeout(45000) }));
      if (!await valid(file, response.clone())) throw new Error("Edition identity mismatch");
      await cache.put(file, response);
    }
    return inspect();
  })().finally(() => { repairing = undefined; });
  return repairing;
}
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
  if (!["GRAMA_INSPECT", "GRAMA_REPAIR"].includes(event.data?.type) || !event.ports[0]) return;
  if (event.data.type === "GRAMA_REPAIR" && event.data.edition !== EDITION) return;
  // A late reply from a superseded worker must not recreate its deleted cache.
  const work = event.data.type === "GRAMA_REPAIR" ? repair() : inspect();
  event.waitUntil(work.then(complete => {
    event.ports[0].postMessage({ type: "GRAMA_EDITION", edition: EDITION, complete });
  }).catch(() => event.ports[0].postMessage({ type: "GRAMA_EDITION", edition: EDITION, complete: false })).finally(() => {
    if (event.data.type === "GRAMA_REPAIR") return announce();
  }));
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
`,
          );
        },
      },
    ],
  };
});
