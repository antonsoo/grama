const scope = /** @type {ServiceWorkerGlobalScope} */ (/** @type {unknown} */ (self));
const FILES = Object.keys(CONFIG.assets);
let mutation = 0;
/** @type {boolean | undefined} */
let lastComplete;
/** @type {{ revision: number, promise: Promise<boolean> } | undefined} */
let checking;
/** @type {ServiceWorker | undefined} */
let ownedLease;

/** @param {{postMessage: (data: unknown) => void} | null | undefined} target @param {unknown} data */
function send(target, data) {
  try {
    target?.postMessage(data);
  } catch {
    /* A tab or its port may already be closed. */
  }
}
async function announce() {
  for (const client of await scope.clients.matchAll({ type: "window", includeUncontrolled: true }))
    send(client, { type: "GRAMA_CACHE_CHANGED", edition: CONFIG.edition });
}
/** @param {string} file @param {Response | undefined} response */
async function valid(file, response) {
  const expected = CONFIG.assets[file];
  if (!expected || !response?.ok) return false;
  const bytes = await response.arrayBuffer();
  if (bytes.byteLength !== expected.bytes) return false;
  const hash = Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", bytes)), (b) =>
    b.toString(16).padStart(2, "0"),
  ).join("");
  return hash === expected.sha256;
}
/** @returns {Promise<boolean>} */
async function inspect() {
  if (checking?.revision === mutation) return checking.promise;
  const revision = mutation;
  const promise = (async () => {
    const checks = await Promise.all(
      FILES.map(async (file) => valid(file, await caches.match(file, { cacheName: CONFIG.cache }))),
    );
    if (revision !== mutation) return inspect();
    const complete = checks.every(Boolean),
      changed = lastComplete !== undefined && lastComplete !== complete;
    lastComplete = complete;
    if (changed) await announce();
    return complete;
  })();
  checking = { revision, promise };
  try {
    return await promise;
  } finally {
    if (checking?.promise === promise) checking = undefined;
  }
}
/** @param {ServiceWorker} worker @returns {Promise<{edition:string,cache:string} | null>} */
function version(worker) {
  return new Promise((resolve) => {
    const channel = new MessageChannel();
    /** @param {{edition:string,cache:string} | null} value */
    const finish = (value) => {
      clearTimeout(timer);
      channel.port1.close();
      resolve(value);
    };
    const timer = setTimeout(() => finish(null), 3000);
    channel.port1.onmessage = (event) => {
      const data = event.data;
      finish(
        data?.type === "GRAMA_VERSION" &&
          typeof data.edition === "string" &&
          typeof data.cache === "string"
          ? data
          : null,
      );
    };
    try {
      worker.postMessage({ type: "GRAMA_VERSION" }, [channel.port2]);
    } catch {
      finish(null);
    }
  });
}
/** @param {ServiceWorker} lease @param {boolean} installing */
function permitted(lease, installing) {
  return (
    lease.state !== "redundant" &&
    (scope.registration.active === lease ||
      (installing &&
        (scope.registration.installing === lease || scope.registration.waiting === lease)))
  );
}
async function owner() {
  if (ownedLease && permitted(ownedLease, false)) return ownedLease;
  const active = scope.registration.active;
  if (!active) throw new Error("The saved worker has no current owner.");
  const reply = await version(active);
  if (reply?.edition !== CONFIG.edition || reply.cache !== CONFIG.cache)
    throw new Error("Another edition now controls this tab. Reload the lesson.");
  ownedLease = active;
  return active;
}
async function discardSuperseded() {
  const active = scope.registration.active;
  const current = active ? await version(active) : null;
  if (current?.cache !== CONFIG.cache) await caches.delete(CONFIG.cache);
}
/** @param {string} file @param {Uint8Array<ArrayBuffer>} bytes @param {ServiceWorker} lease @param {boolean} installing */
async function store(file, bytes, lease, installing = false) {
  if (!permitted(lease, installing)) throw new Error("This edition has been superseded.");
  const cache = await caches.open(CONFIG.cache);
  if (!permitted(lease, installing)) {
    await discardSuperseded();
    throw new Error("This edition has been superseded.");
  }
  await cache.put(
    file,
    new Response(bytes, {
      headers: { "Content-Type": CONFIG.assets[file]?.type ?? "application/octet-stream" },
    }),
  );
  mutation++;
  if (!permitted(lease, installing)) {
    await discardSuperseded();
    throw new Error("This edition has been superseded.");
  }
}
/** @typedef {{checked:number,total:number,received:number,expected:number,file:string}} Progress */
/** @param {(progress:Progress)=>void} progress @param {ServiceWorker} lease @param {boolean} installing */
async function completeEdition(progress, lease, installing = false) {
  let checked = 0;
  for (const file of FILES) {
    const identity = CONFIG.assets[file];
    if (!identity) throw new Error("A saved file has no identity.");
    if (!permitted(lease, installing)) throw new Error("This edition has been superseded.");
    if (!(await valid(file, await caches.match(file, { cacheName: CONFIG.cache })))) {
      const bytes = await verifiedFetch(file, identity, {
        onProgress(received, expected) {
          progress({ checked, total: FILES.length, received, expected, file });
        },
      });
      await store(file, bytes, lease, installing);
    }
    checked++;
    progress({
      checked,
      total: FILES.length,
      received: identity.bytes,
      expected: identity.bytes,
      file,
    });
  }
  return inspect();
}
/** @type {Promise<boolean> | undefined} */
let repairing;
/** @type {Set<(progress:Progress)=>void>} */
const listeners = new Set();
/** @param {(progress:Progress)=>void} progress */
async function repair(progress) {
  listeners.add(progress);
  if (!repairing)
    repairing = (async () => {
      const lease = await owner();
      return completeEdition((update) => {
        for (const listener of listeners) listener(update);
      }, lease);
    })().finally(async () => {
      repairing = undefined;
      await announce();
    });
  try {
    return await repairing;
  } finally {
    listeners.delete(progress);
  }
}

scope.addEventListener("install", (event) => {
  const lease = scope.registration.installing;
  if (!lease) return;
  event.waitUntil(
    completeEdition(() => {}, lease, true).then((complete) => {
      if (!complete) throw new Error("The complete edition could not be saved.");
      return scope.skipWaiting();
    }),
  );
});
scope.addEventListener("activate", (event) => {
  ownedLease = scope.registration.active ?? undefined;
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key.startsWith("grama-") && key !== CONFIG.cache)
            .map((key) => caches.delete(key)),
        ),
      )
      .then(() => scope.clients.claim()),
  );
});
scope.addEventListener("message", (event) => {
  const data = event.data,
    port = event.ports[0];
  if (data?.type === "GRAMA_SAVE_ACK" && data.edition === CONFIG.edition) {
    // A real open page is still awaiting a save; no new work is scheduled here.
    return;
  }
  if (data?.type === "GRAMA_VERSION") {
    send(port, { type: "GRAMA_VERSION", edition: CONFIG.edition, cache: CONFIG.cache });
    return;
  }
  if (data?.type === "GRAMA_CLAIM" && data.edition === CONFIG.edition) {
    event.waitUntil(scope.clients.claim());
    return;
  }
  if (data?.type === "GRAMA_ACTIVATE") {
    event.waitUntil(scope.skipWaiting());
    return;
  }
  if (!port || !["GRAMA_INSPECT", "GRAMA_REPAIR"].includes(data?.type)) return;
  if (data.type === "GRAMA_REPAIR" && data.edition !== CONFIG.edition) return;
  /** @param {Progress} update */
  const progress = (update) =>
    send(port, { type: "GRAMA_PROGRESS", edition: CONFIG.edition, ...update });
  const work = data.type === "GRAMA_REPAIR" ? repair(progress) : inspect();
  event.waitUntil(
    work
      .then((complete) => send(port, { type: "GRAMA_EDITION", edition: CONFIG.edition, complete }))
      .catch((error) =>
        send(port, {
          type: "GRAMA_EDITION",
          edition: CONFIG.edition,
          complete: false,
          error:
            error instanceof Error ? error.message : "The saved edition could not be repaired.",
        }),
      ),
  );
});

/** @param {string} file @param {Request} request */
async function savedOrFetched(file, request) {
  // A current page must not receive an older controller's source bytes.
  const requested = request.headers.get("X-Grama-Edition");
  if (requested && requested !== CONFIG.edition) return fetch(request);
  const cached = await caches.match(file, { cacheName: CONFIG.cache });
  if (await valid(file, cached?.clone())) return /** @type {Response} */ (cached);
  if (cached) {
    const key = (await caches.keys()).includes(CONFIG.cache)
      ? await caches.open(CONFIG.cache)
      : null;
    await key?.delete(file);
    mutation++;
  }
  lastComplete = false;
  await announce();
  // The document verifies its own identified source reads before displaying or
  // exporting them. Forward their response stream immediately: buffering here
  // would hide active bytes behind the document's header-inactivity deadline.
  if (requested === CONFIG.edition) return fetch(request);
  const identity = CONFIG.assets[file];
  if (!identity) return fetch(request);
  const lease = await owner();
  const bytes = await verifiedFetch(request.url, identity, { signal: request.signal });
  await store(file, bytes, lease);
  await announce();
  return new Response(bytes, { headers: { "Content-Type": identity.type } });
}
/** @param {string} file @param {Request} request */
async function navigate(file, request) {
  try {
    const response = await fetch(request);
    if (response.ok) return response;
  } catch {
    /* A verified saved page remains useful when the origin fails. */
  }
  const cached = await caches.match(file, { cacheName: CONFIG.cache });
  if (await valid(file, cached?.clone())) return /** @type {Response} */ (cached);
  lastComplete = false;
  await announce();
  return new Response(
    '<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Grāma — saved lesson unavailable</title><main><h1>The saved lesson is missing or damaged.</h1><p>Reconnect and reload this tab. Settings in the address will stay there.</p></main></html>',
    { status: 503, headers: { "Content-Type": "text/html" } },
  );
}
scope.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);
  if (
    event.request.method !== "GET" ||
    url.origin !== scope.location.origin ||
    !url.pathname.startsWith(CONFIG.base)
  )
    return;
  const file = url.pathname === CONFIG.base ? `${CONFIG.base}index.html` : url.pathname;
  if (!CONFIG.assets[file]) return;
  if (event.request.mode === "navigate") event.respondWith(navigate(file, event.request));
  else event.respondWith(savedOrFetched(file, event.request));
});
