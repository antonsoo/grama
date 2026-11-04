import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { chromium, firefox } from "playwright";
import { reviewServer } from "./review-server.mjs";

const [first, second, output = "/tmp/grama-upgrade-audit"] = process.argv.slice(2);
assert(first && second, "Supply two independently built editions (the second must differ).");
await mkdir(output, { recursive: true });
const sha = async (directory) =>
  createHash("sha256")
    .update(await readFile(path.join(directory, "sw.js")))
    .digest("hex");
assert.notEqual(await sha(first), await sha(second));
const results = [];
for (const [name, type] of [
  ["chromium", chromium],
  ["firefox", firefox],
]) {
  const server = await reviewServer(first),
    browser = await type.launch(),
    context = await browser.newContext(),
    page = await context.newPage();
  let release;
  const held = new Promise((resolve) => {
    release = resolve;
  });
  try {
    await page.goto(`${server.base}tuning.html`);
    await page
      .locator("#offline-status")
      .filter({ hasText: /Ready offline/ })
      .waitFor();
    await page.locator("#preset-other").click();
    const hash = await page.evaluate(() => location.hash);
    const companion = await context.newPage();
    await companion.goto(server.base);
    await companion
      .locator("#offline-status")
      .filter({ hasText: /Ready offline/ })
      .waitFor();
    const firstCache = await page.evaluate(async () => {
      const key = (await caches.keys()).find((k) => k.startsWith("grama-"));
      await (await caches.open(key)).delete(new URL("sources/grosset-28.jpg", location.href));
      return key;
    });
    await page.locator("#check-offline").click();
    await page
      .locator("#offline-status")
      .filter({ hasText: /incomplete/ })
      .waitFor();
    server.faults.set("sources/grosset-28.jpg", { stall: true, release: held });
    await page.locator("#repair-offline").click();
    await page.locator("#offline-status").filter({ hasText: /KiB/ }).waitFor();
    for (
      let attempt = 0;
      attempt < 100 &&
      !server.requests.some(
        (request) =>
          request.pathname.endsWith("sources/grosset-28.jpg") &&
          request.bytes === 128 &&
          !request.finished,
      );
      attempt++
    )
      await page.waitForTimeout(20);
    assert(
      server.requests.some(
        (request) =>
          request.pathname.endsWith("sources/grosset-28.jpg") &&
          request.bytes === 128 &&
          !request.finished,
      ),
      "Old repair reached the held body",
    );
    // Native activation may wait for the old event; its body-inactivity deadline
    // releases that event. The old HTTP response is released only after activation.
    // The pending A response retains its own bytes while fresh requests now serve B.
    server.setDirectory(second);
    server.faults.delete("sources/grosset-28.jpg");
    await companion.evaluate(async () => {
      await (await navigator.serviceWorker.getRegistration()).update();
    });
    for (let attempt = 0; attempt < 800; attempt++) {
      if (await page.evaluate(async (key) => !(await caches.keys()).includes(key), firstCache))
        break;
      await page.waitForTimeout(50);
    }
    assert(
      await page.evaluate(async (key) => !(await caches.keys()).includes(key), firstCache),
      "Activation removed the old edition cache before releasing its response",
    );
    release();
    await page.getByRole("button", { name: "Reload saved edition", exact: true }).waitFor();
    await companion.getByRole("button", { name: "Reload saved edition", exact: true }).waitFor();
    assert.equal(await page.evaluate(() => location.hash), hash);
    assert(!/Ready offline/.test(await page.locator("#offline-status").textContent()));
    const before = await page.evaluate(async () => ({
      keys: await caches.keys(),
      controller: navigator.serviceWorker.controller.state,
    }));
    assert.equal(before.keys.length, 1);
    assert(!before.keys.includes(firstCache));
    await page.getByRole("button", { name: "Reload saved edition", exact: true }).click();
    await page
      .locator("#offline-status")
      .filter({ hasText: /Ready offline/ })
      .waitFor();
    assert.equal(await page.evaluate(() => location.hash), hash);
    server.offline();
    await context.setOffline(true);
    await page.reload();
    await page
      .locator("#offline-status")
      .filter({ hasText: /Ready offline/ })
      .waitFor();
    assert.deepEqual(await page.evaluate(async () => await caches.keys()), before.keys);
    results.push({
      browser: name,
      version: browser.version(),
      oldCacheRecreated: false,
      staleTabsOfferReload: true,
      settingsKept: true,
      newEditionOfflineReload: true,
    });
    console.log(
      `${name}: live edition replacement rejects late old repair, updates two stale tabs, retains settings and reopens offline`,
    );
  } finally {
    release();
    await context.close();
    await browser.close();
    await server.close();
  }
}
await writeFile(
  path.join(output, "review.json"),
  `${JSON.stringify({ checkedAt: new Date().toISOString(), scope: "Two independently built production editions, native worker replacement while old repair response is held", firstWorkerSha256: await sha(first), secondWorkerSha256: await sha(second), results }, null, 2)}\n`,
);
