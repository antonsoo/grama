import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createServer } from "node:http";
import path from "node:path";

/** A real local origin with observable, configurable response-body faults. */
export async function reviewServer(directory = "dist") {
  let root = path.resolve(directory);
  const faults = new Map(),
    requests = [];
  let online = true;
  const mime = {
    ".html": "text/html",
    ".js": "text/javascript",
    ".css": "text/css",
    ".jpg": "image/jpeg",
    ".json": "application/json",
    ".svg": "image/svg+xml",
    ".woff2": "font/woff2",
    ".ttf": "font/ttf",
    ".txt": "text/plain",
  };
  const server = createServer(async (request, response) => {
    const record = {
      url: request.url,
      bytes: 0,
      finished: false,
      started: Date.now(),
      ended: null,
    };
    requests.push(record);
    response.once("close", () => {
      record.ended = Date.now();
    });
    response.once("finish", () => {
      record.finished = true;
    });
    if (!online) {
      request.socket.destroy();
      return;
    }
    try {
      const pathname = new URL(request.url, "http://local").pathname;
      assert(pathname.startsWith("/grama/"));
      const file = pathname.slice(7) || "index.html";
      assert(!file.includes(".."));
      const fault = faults.get(file) ?? {};
      const bytes =
        fault.body === undefined ? await readFile(path.join(root, file)) : Buffer.from(fault.body);
      if (fault.headersStall) return;
      response.writeHead(fault.status ?? 200, {
        "Content-Type": mime[path.extname(file)] ?? "application/octet-stream",
        "Cache-Control": "no-store",
        ...(fault.chunked ? {} : { "Content-Length": bytes.length }),
      });
      if (fault.stall) {
        response.write(bytes.subarray(0, 128));
        record.bytes = 128;
        if (fault.release)
          void fault.release.then(() => {
            if (response.destroyed) return;
            record.bytes = bytes.length;
            response.end(bytes.subarray(128));
          });
      } else if (fault.bytesPerSecond) {
        let offset = 0;
        const tick = () => {
          if (response.destroyed) return;
          const next = Math.min(
            bytes.length,
            offset + Math.max(1, Math.floor(fault.bytesPerSecond / 10)),
          );
          response.write(bytes.subarray(offset, next));
          record.bytes += next - offset;
          offset = next;
          if (offset === bytes.length) response.end();
          else setTimeout(tick, 100);
        };
        tick();
      } else {
        record.bytes = bytes.length;
        response.end(bytes);
      }
    } catch {
      response.writeHead(404).end();
    }
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  return {
    base: `http://127.0.0.1:${server.address().port}/grama/`,
    faults,
    requests,
    setDirectory(directory) {
      root = path.resolve(directory);
    },
    offline() {
      online = false;
      server.closeAllConnections();
    },
    online() {
      online = true;
    },
    async close() {
      server.closeAllConnections();
      await new Promise((resolve) => server.close(resolve));
    },
  };
}
