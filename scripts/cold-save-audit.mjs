import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { cp, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { chromium, firefox } from "playwright";
import { reviewServer } from "./review-server.mjs";

const output = process.argv[2] ?? "/tmp/grama-cold-save";
await mkdir(output, { recursive: true });
const fixture = await mkdtemp(path.join(tmpdir(), "grama-cold-"));
await cp("dist", fixture, { recursive: true });
const results = await Promise.all(
  [
    ["chromium", chromium],
    ["firefox", firefox],
  ].map(async ([name, type]) => {
    const server = await reviewServer(fixture),
      browser = await type.launch(),
      context = await browser.newContext(),
      page = await context.newPage();
    try {
      server.faults.set("sources/grosset-28.jpg", { bytesPerSecond: 4000 });
      const start = Date.now();
      await page.goto(`${server.base}tuning.html`);
      await page.locator("#preset-other").click();
      await page
        .locator("#offline-status")
        .filter({ hasText: /Ready offline/ })
        .waitFor({ timeout: 160000 });
      const elapsedMs = Date.now() - start;
      assert(elapsedMs > 100000);
      const transfers = server.requests.filter((r) => r.url.endsWith("sources/grosset-28.jpg"));
      assert(transfers.length >= 2);
      assert(transfers.every((r) => r.finished && r.bytes === 431366));
      await page.locator("#scan").waitFor({ state: "visible" });
      server.faults.delete("sources/grosset-28.jpg");
      const hash = await page.evaluate(() => location.hash);
      // A source that sends no headers must time out and permit a same-tab retry.
      await page.evaluate(async () => {
        const key = (await caches.keys()).find((k) => k.startsWith("grama-"));
        await (await caches.open(key)).delete(new URL("sources/grosset-86.jpg", location.href));
      });
      server.faults.set("sources/grosset-86.jpg", { headersStall: true });
      const stalled = Date.now();
      await page.locator("#source-page").selectOption("86");
      await page
        .getByRole("button", { name: "Retry source page", exact: true })
        .waitFor({ timeout: 22000 });
      const headerWaitMs = Date.now() - stalled;
      assert(headerWaitMs >= 14000 && headerWaitMs < 22000);
      assert(await page.locator("#scan").isHidden());
      server.faults.delete("sources/grosset-86.jpg");
      await page.getByRole("button", { name: "Retry source page", exact: true }).click();
      await page.locator("#scan").waitFor({ state: "visible" });
      assert.equal(await page.evaluate(() => location.hash), hash);
      await page.locator("#check-offline").click();
      await page
        .locator("#offline-status")
        .filter({ hasText: /incomplete/ })
        .waitFor();
      await page.locator("#repair-offline").click();
      await page
        .locator("#offline-status")
        .filter({ hasText: /Ready offline/ })
        .waitFor();
      server.offline();
      await context.setOffline(true);
      await page.reload();
      await page
        .locator("#offline-status")
        .filter({ hasText: /Ready offline/ })
        .waitFor();
      console.log(
        `${name}: cold installation and foreground source completed after ${elapsedMs} ms; header stall timed out and retry recovered`,
      );
      return {
        browser: name,
        version: browser.version(),
        coldSaveElapsedMs: elapsedMs,
        sourceTransfers: transfers,
        headerInactivityMs: headerWaitMs,
        sourceRetry: true,
        originDisabledReload: true,
        settingsKept: true,
      };
    } catch (error) {
      console.error(
        name,
        await page.locator("#scan-caption").textContent(),
        await page.locator("#offline-status").textContent(),
        server.requests.filter((r) => r.url.endsWith("sources/grosset-28.jpg")),
      );
      throw error;
    } finally {
      await context.close();
      await browser.close();
      await server.close();
    }
  }),
);
await writeFile(
  path.join(output, "review.json"),
  `${JSON.stringify(
    {
      checkedAt: new Date().toISOString(),
      scope:
        "Cold native installation with concurrent foreground source at 4000 bytes/s per response, then header stall and retry; local origin only",
      workerSha256: createHash("sha256")
        .update(await readFile(path.join(fixture, "sw.js")))
        .digest("hex"),
      results,
    },
    null,
    2,
  )}\n`,
);
await rm(fixture, { recursive: true, force: true });
