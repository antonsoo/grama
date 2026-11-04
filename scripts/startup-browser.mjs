import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { chromium, firefox } from "playwright";
import { reviewServer } from "./review-server.mjs";

const out = path.resolve(process.argv[2] ?? "/tmp/claude-1000/grama-startup");
await mkdir(out, { recursive: true });
const report = {
  checkedAt: new Date().toISOString(),
  scope:
    "Real HTML and controls with the production entry module deliberately withheld. A pending native action waits for readiness; it must then perform the intended edit, not fall through to an identical default pair. No public speed claim.",
  workerSha256: createHash("sha256")
    .update(await readFile("dist/sw.js"))
    .digest("hex"),
  cases: [],
};
for (const [name, engine] of [
  ["chromium", chromium],
  ["firefox", firefox],
]) {
  const browser = await engine.launch();
  try {
    for (const width of [1440, 375])
      for (const room of ["count", "family"]) {
        const server = await reviewServer(),
          context = await browser.newContext({
            viewport: { width, height: 1100 },
            serviceWorkers: "block",
            reducedMotion: "reduce",
          }),
          page = await context.newPage();
        let release;
        const entry = new Promise((resolve) => {
          release = resolve;
        });
        const errors = [];
        page.on("pageerror", (e) => errors.push(e.message));
        await context.route(/\/assets\/(?:main|tuning)-[^/]+\.js$/, async (route) => {
          await entry;
          await route.continue();
        });
        try {
          await page.goto(server.base + (room === "family" ? "tuning.html#listening" : ""), {
            waitUntil: "commit",
          });
          const primary = page.locator(room === "family" ? "#listening-example" : "#base");
          await primary.waitFor();
          assert(await primary.isDisabled());
          assert(await page.locator("#open-json").isDisabled());
          assert(await page.locator("#save-reading").isDisabled());
          if (room === "family") {
            assert(await page.locator("#listening-open").isDisabled());
            assert(await page.locator("#listening-start").isDisabled());
          }
          let performed = false;
          const intended = (room === "family" ? primary.click() : primary.fill("330.5")).then(
            () => {
              performed = true;
            },
          );
          await page.waitForTimeout(150);
          assert.equal(performed, false);
          release();
          await intended;
          await page.waitForLoadState("domcontentloaded");
          assert.equal(await page.locator("[data-startup-control]").count(), 0);
          assert(await page.locator("#open-json").isEnabled());
          if (room === "family") {
            assert(
              await page.locator("#four").isDisabled(),
              "The source-independent fourth/fifth lock remains applied",
            );
            await page.locator("#listening-start").click();
            assert.doesNotMatch(
              await page.locator("#listening-status").textContent(),
              /identical samples/,
            );
            assert(await page.locator("#listening-answer-a").isDisabled());
            for (const key of ["a", "b", "x"]) {
              await page.locator(`#listening-${key}`).click();
              await page
                .locator(`#listening-${key}-count`)
                .filter({ hasText: /^1 completed$/ })
                .waitFor({ timeout: 15000 });
            }
            assert(await page.locator("#listening-answer-a").isEnabled());
            await page.locator("#listening-reveal").click();
            assert.match(await page.locator("#listening-result").textContent(), /10\.000000 cents/);
            const d = page.waitForEvent("download");
            await page.locator("#listening-json").click();
            await (await d).saveAs(path.join(out, `${name}-${width}-record.json`));
          } else {
            await page.locator("#apply-base").click();
            assert.equal(await page.locator("#base").inputValue(), "330.5");
            assert.match(page.url(), /hz=330\.5/);
            const d = page.waitForEvent("download");
            await page.locator("#save-json").click();
            const file = path.join(out, `${name}-${width}-comparison.json`);
            await (await d).saveAs(file);
            assert.equal(JSON.parse(await readFile(file, "utf8")).pose.base, 330.5);
          }
          assert.deepEqual(errors, []);
          report.cases.push({
            browser: name,
            width,
            room,
            unavailableBeforeHandlers: true,
            intendedActionAppliedAfterReady: true,
            statefulDisablingPreserved: true,
            nativeRecordDownloaded: true,
            pageErrors: errors,
          });
          console.log(
            `${name} ${width} ${room}: bootstrap gate preserves the first real action and disabled states`,
          );
        } finally {
          release();
          await context.close();
          await server.close();
        }
      }
  } finally {
    await browser.close();
  }
}
await writeFile(path.join(out, "report.json"), `${JSON.stringify(report, null, 2)}\n`);
