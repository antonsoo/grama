import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { createServer } from "node:http";
import path from "node:path";
import { chromium, firefox } from "playwright";

const out = process.argv[2] ?? "/tmp/grama-offline-failure";
await mkdir(out, { recursive: true });
const report = {
  checkedAt: new Date().toISOString(),
  workerSha256: createHash("sha256")
    .update(await readFile("dist/sw.js"))
    .digest("hex"),
  scope:
    "Local initial offline installs; held and substituted source bytes, followed by successful recovery. Separate corrupt-source export rejection.",
  cases: [],
};
for (const [name, type] of [
  ["chromium", chromium],
  ["firefox", firefox],
]) {
  const browser = await type.launch();
  try {
    for (const fault of ["held", "substituted"]) {
      let broken = true,
        online = true,
        release,
        requested = false;
      const pending = new Promise((r) => {
        release = r;
      });
      const server = createServer(async (req, res) => {
        if (!online) {
          req.socket.destroy();
          return;
        }
        try {
          const file =
            new URL(req.url, "http://local").pathname.replace(/^\/grama\//, "") || "index.html";
          const bytes = await readFile(path.join("dist", file));
          if (file === "sources/natya-302.jpg" && broken) {
            requested = true;
            if (fault === "held") await pending;
            else {
              res
                .writeHead(200, { "Content-Type": "image/jpeg" })
                .end(Buffer.from("substituted source bytes"));
              return;
            }
          }
          res
            .writeHead(200, {
              "Content-Type":
                {
                  ".html": "text/html",
                  ".js": "text/javascript",
                  ".css": "text/css",
                  ".jpg": "image/jpeg",
                  ".json": "application/json",
                  ".svg": "image/svg+xml",
                  ".ttf": "font/ttf",
                  ".woff2": "font/woff2",
                }[path.extname(file)] ?? "application/octet-stream",
              "Cache-Control": "no-store",
            })
            .end(bytes);
        } catch {
          res.writeHead(404).end();
        }
      });
      await new Promise((r) => server.listen(0, "127.0.0.1", r));
      const base = `http://127.0.0.1:${server.address().port}/grama/`,
        context = await browser.newContext(),
        page = await context.newPage();
      try {
        await page.goto(base);
        await page.waitForFunction(
          () =>
            document.querySelector("#offline-status").textContent.includes("Saving") ||
            document.querySelector("#offline-status").textContent.includes("could not"),
        );
        for (let n = 0; n < 100 && !requested; n++) await new Promise((r) => setTimeout(r, 25));
        assert(requested);
        if (fault === "held") {
          assert(!/Ready offline/.test(await page.locator("#offline-status").textContent()));
          broken = false;
          release();
        } else {
          await page
            .locator("#offline-status")
            .filter({ hasText: /could not be saved offline/ })
            .waitFor();
          broken = false;
          await page.reload();
        }
        await page
          .locator("#offline-status")
          .filter({ hasText: /Ready offline/ })
          .waitFor({ timeout: 30000 });
        // Remove the controller's entire cached source identity and inject bad bytes.
        await page.evaluate(async () => {
          const keys = await caches.keys(),
            key = keys.find((k) => k.startsWith("grama-"));
          const c = await caches.open(key);
          await c.put(
            new URL("sources/grosset-28.jpg", location.href),
            new Response("wrong printed page", { headers: { "Content-Type": "image/jpeg" } }),
          );
        });
        let downloads = 0;
        page.on("download", () => downloads++);
        await page.locator("#save-reading").click();
        await page
          .locator("#file-status")
          .filter({ hasText: /differs from this edition/ })
          .waitFor();
        assert.equal(downloads, 0, "a substituted source must not be silently exported");
        // Restore the known bytes, then prove the same edition can export offline.
        const known = await readFile("dist/sources/grosset-28.jpg");
        await page.evaluate(async (data) => {
          const key = (await caches.keys()).find((k) => k.startsWith("grama-")),
            c = await caches.open(key);
          await c.put(
            new URL("sources/grosset-28.jpg", location.href),
            new Response(
              Uint8Array.from(atob(data), (c) => c.charCodeAt(0)),
              { headers: { "Content-Type": "image/jpeg" } },
            ),
          );
        }, known.toString("base64"));
        online = false;
        server.closeAllConnections();
        await context.setOffline(true);
        await page.reload();
        await page
          .locator("#offline-status")
          .filter({ hasText: /Ready offline/ })
          .waitFor();
        const download = page.waitForEvent("download");
        await page.locator("#save-reading").click();
        await (await download).saveAs(path.join(out, `${name}-${fault}.html`));
        report.cases.push({
          browser: name,
          version: browser.version(),
          fault,
          falseReadyWhilePendingOrFailed: false,
          recoveredAfter:
            fault === "held" ? "release source response" : "reload after correcting source bytes",
          corruptSourceExportBlocked: true,
          offlineReadingAfterRestoration: true,
        });
        console.log(
          `${name} ${fault}: no premature readiness, recovery and corrupt-source export rejection verified`,
        );
      } finally {
        release();
        await context.close();
        server.closeAllConnections();
        await new Promise((r) => server.close(r));
      }
    }
  } finally {
    await browser.close();
  }
}
await writeFile(path.join(out, "review.json"), `${JSON.stringify(report, null, 2)}\n`);
