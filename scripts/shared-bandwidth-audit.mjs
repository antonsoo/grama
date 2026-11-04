import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { createServer } from "node:http";
import path from "node:path";
import { chromium, firefox } from "playwright";

const out = path.resolve(process.argv[2] ?? "/tmp/claude-1000/grama-shared-bandwidth"),
  mode = process.argv[3] ?? "all";
assert(["all", "foreground", "multi", "fallback", "queue"].includes(mode));
await mkdir(out, { recursive: true });
const types = {
  ".html": "text/html",
  ".js": "text/javascript",
  ".css": "text/css",
  ".jpg": "image/jpeg",
  ".woff2": "font/woff2",
  ".ttf": "font/ttf",
  ".json": "application/json",
  ".svg": "image/svg+xml",
  ".txt": "text/plain",
};
async function origin(rate, fastFonts = false) {
  const active = new Set(),
    requests = [],
    faults = new Map();
  let transferred = 0,
    peakIdentified = 0;
  const server = createServer(async (request, response) => {
    try {
      const url = new URL(request.url, "http://local"),
        file = url.pathname.replace(/^\/grama\//, "") || "index.html";
      assert(!file.includes(".."));
      const bytes = await readFile(path.join("dist", file));
      const retained =
          /\.(jpg|woff2|ttf)$/.test(file) && !(fastFonts && /\.(woff2|ttf)$/.test(file)),
        identified = retained && request.headers["sec-fetch-dest"] === "empty";
      const record = { file, identified, started: Date.now(), bytes: 0, finished: false };
      requests.push(record);
      response.once("close", () => {
        record.ended = Date.now();
      });
      if (faults.get(file) === "headers") return;
      response.writeHead(200, {
        "Content-Type": types[path.extname(file)] ?? "application/octet-stream",
        "Content-Length": bytes.length,
        "Cache-Control": "no-store",
      });
      if (["body", "drip"].includes(faults.get(file))) {
        response.write(bytes.subarray(0, 128));
        record.bytes = 128;
        if (faults.get(file) === "drip") {
          let offset = 128;
          const heartbeat = setInterval(() => {
            response.write(bytes.subarray(offset, offset + 1));
            record.bytes = ++offset;
          }, 1000);
          response.once("close", () => clearInterval(heartbeat));
        }
        return;
      }
      if (!retained) {
        response.end(bytes);
        record.bytes = bytes.length;
        record.finished = true;
        return;
      }
      const transfer = { response, bytes, offset: 0, record };
      active.add(transfer);
      peakIdentified = Math.max(
        peakIdentified,
        [...active].filter((t) => t.record.identified).length,
      );
      response.once("close", () => active.delete(transfer));
    } catch {
      response.writeHead(404).end();
    }
  });
  const ticker = setInterval(() => {
    const portion = Math.max(1, Math.floor(rate / 20 / Math.max(1, active.size)));
    for (const transfer of [...active]) {
      const end = Math.min(transfer.bytes.length, transfer.offset + portion);
      transfer.response.write(transfer.bytes.subarray(transfer.offset, end));
      transferred += end - transfer.offset;
      transfer.offset = end;
      transfer.record.bytes = end;
      if (end === transfer.bytes.length) {
        active.delete(transfer);
        transfer.record.finished = true;
        transfer.response.end();
      }
    }
  }, 50);
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  return {
    base: `http://127.0.0.1:${server.address().port}/grama/`,
    faults,
    requests,
    stats: () => ({
      rateBytesPerSecond: rate,
      transferred,
      peakIdentifiedBodies: peakIdentified,
      requests,
    }),
    close: async () => {
      clearInterval(ticker);
      server.closeAllConnections();
      await new Promise((resolve) => server.close(resolve));
    },
  };
}
const report = {
  checkedAt: new Date().toISOString(),
  scope:
    "One shared byte budget per local HTTP/1.1 origin, fair across every retained image/font response. Bootstrap HTML/JS/CSS is fast. Cancellation isolates queue behavior with fast fonts and two one-byte/s source bodies. Real native files, workers and locks; no public bandwidth or outage claim.",
  workerSha256: createHash("sha256")
    .update(await readFile("dist/sw.js"))
    .digest("hex"),
  cases: [],
};
const runs = await Promise.allSettled(
  [
    ["chromium", chromium],
    ["firefox", firefox],
  ]
    .filter(([name]) => !process.argv[4] || process.argv[4] === name)
    .map(async ([name, engine]) => {
      const browser = await engine.launch();
      try {
        for (const kind of ["foreground", "multi", "fallback", "queue"].filter(
          (k) => mode === "all" || k === mode,
        )) {
          const rate = kind === "multi" ? 131072 : 65536,
            s = await origin(rate, kind === "queue");
          const context = await browser.newContext({
            serviceWorkers: kind === "multi" ? "allow" : "block",
            reducedMotion: "reduce",
          });
          if (kind === "fallback")
            await context.addInitScript(() =>
              Object.defineProperty(navigator, "locks", { value: undefined }),
            );
          const errors = [];
          context.on("page", (page) => page.on("pageerror", (e) => errors.push(e.message)));
          const started = Date.now(),
            files = [];
          const snapshot = async () => ({
            elapsedMs: Date.now() - started,
            ...s.stats(),
            pages: await Promise.all(
              context.pages().map(async (page) => ({
                url: page.url(),
                status: await page
                  .locator("#file-status")
                  .textContent({ timeout: 1000 })
                  .catch(() => "unavailable"),
                locks: await page.evaluate(() => navigator.locks?.query()).catch(() => null),
              })),
            ),
          });
          const trace = setInterval(() => {
            void snapshot()
              .then((state) =>
                writeFile(
                  path.join(out, `${name}-${kind}-progress.json`),
                  `${JSON.stringify(state, null, 2)}\n`,
                ),
              )
              .catch(() => {});
          }, 10000);
          let failed = false;
          try {
            if (kind === "queue") {
              s.faults.set("sources/grosset-28.jpg", "drip");
              const holders = [];
              for (let i = 0; i < 2; i++) {
                const page = await context.newPage();
                holders.push(page);
                await page.goto(s.base, { waitUntil: "domcontentloaded" });
              }
              await holders[0].waitForFunction(
                async () =>
                  (await navigator.locks.query()).held.filter((l) =>
                    l.name.startsWith("grama-retained-transfer-"),
                  ).length === 2,
              );
              const owners = (await holders[0].evaluate(() => navigator.locks.query())).held
                .map((l) => l.clientId)
                .sort();
              const page = await context.newPage();
              await page.goto(`${s.base}tuning.html`, { waitUntil: "domcontentloaded" });
              await page.locator("#save-reading").click();
              await page.waitForFunction(
                async () =>
                  (await navigator.locks.query()).pending.filter((l) =>
                    l.name.startsWith("grama-retained-transfer-"),
                  ).length >= 3,
              );
              const cancelStart = Date.now();
              await page
                .getByRole("button", { name: "Cancel reading save", exact: true })
                .first()
                .click();
              await page
                .locator("#file-status")
                .filter({ hasText: /cancelled/ })
                .waitFor();
              const after = await page.evaluate(() => navigator.locks.query());
              assert.equal(
                after.held.filter((l) => l.name.startsWith("grama-retained-transfer-")).length,
                2,
              );
              assert.equal(
                after.pending.filter((l) => l.name.startsWith("grama-retained-transfer-")).length,
                1,
              );
              assert.deepEqual(after.held.map((l) => l.clientId).sort(), owners);
              const cancellationMs = Date.now() - cancelStart;
              assert(cancellationMs < 3000);
              await page.close();
              await holders[0].waitForFunction(
                async () =>
                  (await navigator.locks.query()).pending.filter((l) =>
                    l.name.startsWith("grama-retained-transfer-"),
                  ).length === 0,
              );
              report.cases.push({
                browser: name,
                kind,
                queuedExportCancelledMs: cancellationMs,
                otherWindowsKeptPermits: true,
                noQueuedExportRequestsLeft: true,
              });
            } else {
              const pages = [];
              for (let i = 0; i < (kind === "multi" ? 2 : 1); i++) {
                const page = await context.newPage();
                pages.push(page);
                await page.goto(s.base + (i ? "tuning.html" : ""), {
                  waitUntil: "domcontentloaded",
                });
              }
              const pending = pages.map(async (page, index) => {
                const d = page.waitForEvent("download", { timeout: 360000 });
                await page.locator("#save-reading").click();
                const file = path.join(out, `${name}-${kind}-${index}.html`);
                const failure = page
                  .waitForFunction(
                    () => {
                      const status = document.querySelector("#file-status")?.textContent ?? "";
                      return status && !/^(Preparing|Saved)/.test(status);
                    },
                    {},
                    { timeout: 360000 },
                  )
                  .then(async () => {
                    throw new Error(await page.locator("#file-status").textContent());
                  });
                await (await Promise.race([d, failure])).saveAs(file);
                files.push(file);
                assert.match(await page.locator("#file-status").textContent(), /^Saved/);
              });
              await Promise.all(pending);
              const elapsedMs = Date.now() - started;
              assert(elapsedMs > 30000);
              for (const file of files) {
                const html = await readFile(file, "utf8");
                assert(!/<script\b/i.test(html));
                assert.equal((html.match(/class="source-page"/g) ?? []).length, 11);
              }
              if (kind === "multi")
                for (const page of pages)
                  await page
                    .locator("#offline-status")
                    .filter({ hasText: /Ready offline/ })
                    .waitFor({ timeout: 180000 });
              const stats = s.stats();
              if (kind !== "fallback")
                assert(stats.peakIdentifiedBodies <= 2, JSON.stringify(stats));
              const locks =
                kind === "fallback" ? null : await pages[0].evaluate(() => navigator.locks.query());
              assert(!locks || locks.pending.length === 0);
              report.cases.push({
                browser: name,
                kind,
                elapsedMs,
                files: await Promise.all(
                  files.map(async (file) => ({
                    file: path.basename(file),
                    bytes: (await readFile(file)).length,
                    sha256: createHash("sha256")
                      .update(await readFile(file))
                      .digest("hex"),
                  })),
                ),
                ...stats,
                allSourcesRetained: true,
                workerReady: kind === "multi",
                locksReleased: !locks || locks.held.length === 0,
              });
            }
            assert.deepEqual(errors, []);
            console.log(
              `${name} ${kind}: shared bandwidth, complete native studies and bounded/cancelled reads passed after ${Date.now() - started} ms`,
            );
          } catch (error) {
            failed = true;
            await writeFile(
              path.join(out, `${name}-${kind}-failure.json`),
              `${JSON.stringify({ error: String(error), state: await snapshot() }, null, 2)}\n`,
            );
            throw error;
          } finally {
            clearInterval(trace);
            await context.close().catch((error) => {
              if (!failed) throw error;
            });
            await s.close();
          }
        }
      } finally {
        await browser.close();
      }
    }),
);
report.failures = runs.filter((r) => r.status === "rejected").map((r) => String(r.reason));
await writeFile(path.join(out, "report.json"), `${JSON.stringify(report, null, 2)}\n`);
assert.deepEqual(report.failures, []);
