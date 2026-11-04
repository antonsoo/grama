import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { cp, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { chromium, firefox } from "playwright";
import { reviewServer } from "./review-server.mjs";

const output = process.argv[2] ?? "/tmp/grama-network-audit";
await mkdir(output, { recursive: true });
// Never mix one worker's inventory with a later rebuild during long transfers.
const fixture = await mkdtemp(path.join(tmpdir(), "grama-network-"));
await cp("dist", fixture, { recursive: true });
const workerSha256 = createHash("sha256")
  .update(await readFile(path.join(fixture, "sw.js")))
  .digest("hex");
const source = "sources/grosset-28.jpg";
async function remove(page, file) {
  await page.evaluate(async (file) => {
    const key = (await caches.keys()).find((key) => key.startsWith("grama-"));
    assertKey(key);
    function assertKey(value) {
      if (!value) throw new Error("No saved edition");
    }
    await (await caches.open(key)).delete(new URL(file, location.href));
  }, file);
}
async function ready(page, timeout = 30000) {
  await page
    .locator("#offline-status")
    .filter({ hasText: /Ready offline/ })
    .waitFor({ timeout });
}
const results = await Promise.all(
  [
    ["chromium", chromium],
    ["firefox", firefox],
  ].map(async ([name, type]) => {
    const server = await reviewServer(fixture),
      browser = await type.launch();
    const context = await browser.newContext({ reducedMotion: "reduce" }),
      page = await context.newPage();
    const row = { browser: name, version: browser.version(), checks: [] };
    try {
      await page.goto(`${server.base}tuning.html`);
      await ready(page);
      await page.locator("#preset-other").click();
      const hash = await page.evaluate(() => location.hash);
      // A responsive transfer must survive both former 45s network and 90s UI deadlines.
      await remove(page, source);
      await page.locator("#check-offline").click();
      await page
        .locator("#offline-status")
        .filter({ hasText: /incomplete/ })
        .waitFor();
      server.faults.set(source, { bytesPerSecond: 4000 });
      const started = Date.now();
      await page.locator("#repair-offline").click();
      await page.locator("#offline-status").filter({ hasText: /KiB/ }).waitFor();
      await ready(page, 160000);
      const elapsedMs = Date.now() - started,
        transfer = server.requests.filter((r) => r.pathname.endsWith(source)).at(-1);
      assert(elapsedMs > 100000);
      assert(transfer.finished);
      assert.equal(transfer.bytes, 431366);
      assert.equal(await page.evaluate(() => location.hash), hash);
      row.checks.push({
        check: "continuous 4000 bytes/s repair",
        elapsedMs,
        transfer,
        settingsKept: true,
      });
      console.log(`${name}: slow repair completed after ${elapsedMs} ms`);
      server.faults.delete(source);
      // A silent body must release the repair control, preserve state, and remain incomplete.
      await remove(page, source);
      await page.locator("#check-offline").click();
      await page
        .locator("#offline-status")
        .filter({ hasText: /incomplete/ })
        .waitFor();
      server.faults.set(source, { stall: true });
      const stalled = Date.now();
      await page.locator("#repair-offline").click();
      await page.waitForFunction(
        () => !document.querySelector("#repair-offline").disabled,
        {},
        { timeout: 25000 },
      );
      await page
        .locator("#offline-status")
        .filter({ hasText: /incomplete/ })
        .waitFor();
      const stallElapsedMs = Date.now() - stalled;
      assert(stallElapsedMs >= 14000 && stallElapsedMs < 24000);
      server.faults.delete(source);
      await page.locator("#repair-offline").click();
      await ready(page);
      row.checks.push({ check: "body inactivity deadline and repair retry", stallElapsedMs });
      // HTTP errors on the origin must not hide a valid saved lesson.
      server.faults.set("tuning.html", { status: 503 });
      await page.reload();
      await ready(page);
      assert.equal(await page.evaluate(() => location.hash), hash);
      server.faults.delete("tuning.html");
      row.checks.push({
        check: "HTTP 503 navigation uses verified saved document",
        settingsKept: true,
      });
      // Bad source cache bytes plus bad origin bytes must never appear as printed evidence or be exported.
      await page.evaluate(async (file) => {
        const key = (await caches.keys()).find((k) => k.startsWith("grama-"));
        await (await caches.open(key)).put(
          new URL(file, location.href),
          new Response("wrong page"),
        );
      }, source);
      server.faults.set(source, { body: "wrong printed page" });
      await page.locator("#source-page").selectOption("29");
      await page.locator("#scan").waitFor({ state: "visible" });
      await page.locator("#source-page").selectOption("28");
      await page.getByRole("button", { name: "Retry source page", exact: true }).waitFor();
      assert(await page.locator("#scan").isHidden());
      assert(await page.locator("#scan-link").isHidden());
      let downloads = 0;
      page.on("download", () => downloads++);
      await page.locator("#save-reading").click();
      await page
        .locator("#file-status")
        .filter({ hasText: /returned HTTP|Failed to fetch|NetworkError|differs|Load failed/ })
        .waitFor();
      assert.equal(downloads, 0);
      server.faults.delete(source);
      await page.getByRole("button", { name: "Retry source page", exact: true }).click();
      await page.locator("#scan").waitFor({ state: "visible" });
      const shown = await page
        .locator("#scan")
        .evaluate(async (image) =>
          Array.from(
            new Uint8Array(
              await crypto.subtle.digest("SHA-256", await (await fetch(image.src)).arrayBuffer()),
            ),
            (b) => b.toString(16).padStart(2, "0"),
          ).join(""),
        );
      assert.equal(shown, "a91b49178abfeea7daa478843f6d385ff4d0136d2733abdb95bd2bdca66bafe3");
      row.checks.push({
        check: "substituted source hidden and export blocked; retry displays exact source",
        shownSha256: shown,
      });
      // A foreground source read must receive progress before the entire body
      // finishes, even while the same source is missing from the worker cache.
      await remove(page, source);
      server.faults.set(source, { bytesPerSecond: 4000 });
      await page.locator("#source-page").selectOption("29");
      await page.locator("#scan").waitFor({ state: "visible" });
      const sourceStarted = Date.now();
      await page.locator("#source-page").selectOption("28");
      await page.locator("#scan").waitFor({ state: "visible", timeout: 160000 });
      assert(Date.now() - sourceStarted > 100000);
      row.checks.push({
        check: "foreground verified source streams for more than 100 seconds",
        elapsedMs: Date.now() - sourceStarted,
      });
      server.faults.delete(source);
      // Cancel a stalled reading, then save again in the same tab.
      await remove(page, source);
      server.faults.set(source, { stall: true });
      await page.locator("#save-reading").click();
      await page.getByRole("button", { name: "Cancel reading save", exact: true }).click();
      await page
        .locator("#file-status")
        .filter({ hasText: /cancelled/ })
        .waitFor();
      assert.equal(downloads, 0);
      assert.equal(await page.evaluate(() => location.hash), hash);
      server.faults.delete(source);
      const downloaded = page.waitForEvent("download");
      await page.locator("#save-reading").click();
      await (await downloaded).saveAs(path.join(output, `${name}-recovered-reading.html`));
      row.checks.push({
        check: "reading cancellation preserves settings and next native save succeeds",
      });
      await page.locator("#check-offline").click();
      await page
        .locator("#offline-status")
        .filter({ hasText: /incomplete/ })
        .waitFor();
      await page.locator("#repair-offline").click();
      await ready(page);
      // An independently opened tab must lose ready status after external cache damage.
      const second = await context.newPage();
      await second.goto(server.base);
      await ready(second);
      await remove(page, "sources/natya-302.jpg");
      await page.locator("#check-offline").click();
      await page
        .locator("#offline-status")
        .filter({ hasText: /incomplete/ })
        .waitFor();
      await second
        .locator("#offline-status")
        .filter({ hasText: /incomplete/ })
        .waitFor();
      await page.locator("#repair-offline").click();
      await ready(page);
      await ready(second);
      server.offline();
      await context.setOffline(true);
      await second.reload();
      await ready(second);
      row.checks.push({
        check: "cache damage and repair propagate to two tabs; origin-disabled reload succeeds",
      });
      return row;
    } catch (error) {
      console.error(
        name,
        await page.locator("#offline-status").textContent(),
        await page.locator("#file-status").textContent(),
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
      workerSha256,
      scope:
        "Real local HTTP fault injection and native service workers; isolated immutable build; not hosted evidence",
      results,
    },
    null,
    2,
  )}\n`,
);
await rm(fixture, { recursive: true, force: true });
console.log("Both browser network journeys passed.");
