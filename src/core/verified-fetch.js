/**
 * Read bounded, identified bytes. A slow active transfer may take as long as it
 * needs; only waiting for headers or a silent body consumes the network deadline.
 * This exact helper also runs inside the generated service worker.
 * @param {string} url
 * @param {{ sha256: string, bytes: number }} identity
 * @param {{signal?: AbortSignal | undefined, onProgress?: ((received: number, total: number) => void) | undefined, headers?: HeadersInit | undefined, cache?: RequestCache, headerWaitMs?: number, idleWaitMs?: number}} options
 * @returns {Promise<Uint8Array<ArrayBuffer>>}
 */
export async function verifiedFetch(url, identity, options = {}) {
  if (
    !/^[a-f0-9]{64}$/.test(identity.sha256) ||
    !Number.isSafeInteger(identity.bytes) ||
    identity.bytes < 0 ||
    identity.bytes > 64 * 1024 * 1024
  )
    throw new Error("The retained file has no bounded identity.");
  const controller = new AbortController();
  const abort = () => controller.abort(options.signal?.reason);
  options.signal?.addEventListener("abort", abort, { once: true });
  if (options.signal?.aborted) abort();
  /** @type {ReturnType<typeof setTimeout> | undefined} */
  let timer;
  /** @type {ReadableStreamDefaultReader<Uint8Array<ArrayBufferLike>> | undefined} */
  let reader;
  /** @param {number} milliseconds @param {string} message */
  const arm = (milliseconds, message) => {
    clearTimeout(timer);
    timer = setTimeout(
      () => controller.abort(new DOMException(message, "TimeoutError")),
      milliseconds,
    );
  };
  try {
    arm(
      options.headerWaitMs ?? 15000,
      "The retained file did not send its headers. Retry when the connection responds.",
    );
    const response = await fetch(url, {
      cache: options.cache ?? "no-store",
      signal: controller.signal,
      ...(options.headers ? { headers: options.headers } : {}),
    });
    if (!response.ok) throw new Error(`The retained file returned HTTP ${response.status}.`);
    if (!response.body) throw new Error("The retained file has no response body.");
    reader = response.body.getReader();
    const bytes = new Uint8Array(identity.bytes);
    let offset = 0;
    options.onProgress?.(0, identity.bytes);
    arm(
      options.idleWaitMs ?? 15000,
      "The retained file stopped sending bytes. Retry when the connection responds.",
    );
    for (;;) {
      const next = await reader.read();
      if (next.done) break;
      if (next.value.length === 0) continue;
      if (offset + next.value.length > bytes.length)
        throw Object.assign(new Error("The retained file is larger than its reviewed identity."), {
          name: "IntegrityError",
        });
      bytes.set(next.value, offset);
      offset += next.value.length;
      arm(
        options.idleWaitMs ?? 15000,
        "The retained file stopped sending bytes. Retry when the connection responds.",
      );
      options.onProgress?.(offset, identity.bytes);
    }
    clearTimeout(timer);
    if (offset !== identity.bytes)
      throw Object.assign(new Error("The retained file is incomplete."), {
        name: "IntegrityError",
      });
    const digest = Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", bytes)), (b) =>
      b.toString(16).padStart(2, "0"),
    ).join("");
    if (controller.signal.aborted) throw controller.signal.reason;
    if (digest !== identity.sha256)
      throw Object.assign(new Error("The retained file differs from its reviewed identity."), {
        name: "IntegrityError",
      });
    return bytes;
  } catch (error) {
    controller.abort(error);
    if (reader) void reader.cancel(error).catch(() => {});
    throw error;
  } finally {
    clearTimeout(timer);
    reader?.releaseLock();
    options.signal?.removeEventListener("abort", abort);
  }
}
