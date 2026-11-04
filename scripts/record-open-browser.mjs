import assert from "node:assert/strict";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { chromium, firefox } from "playwright";
import { reviewServer } from "./review-server.mjs";

const out = path.resolve(process.argv[2] ?? "/tmp/claude-1000/grama-record-open");
await mkdir(out, { recursive: true });
const report = {
  scope:
    "Original count and tuning JSON importers, actual native files; File.text completion and pagehide are deliberately delayed/dispatched to exercise races. Local production, service workers blocked.",
  cases: [],
};
for (const [name, engine] of [
  ["chromium", chromium],
  ["firefox", firefox],
]) {
  const browser = await engine.launch();
  try {
    for (const width of [1440, 375])
      for (const family of [false, true]) {
        const server = await reviewServer(),
          context = await browser.newContext({
            viewport: { width, height: 1000 },
            serviceWorkers: "block",
          });
        await context.addInitScript(() => {
          const read = File.prototype.text;
          File.prototype.text = async function (...args) {
            const raw = await read.apply(this, args);
            if (this.name === "delayed.json")
              await new Promise((resolve) => {
                window.releaseRecord = resolve;
              });
            return raw;
          };
        });
        const page = await context.newPage(),
          errors = [];
        page.on("pageerror", (e) => errors.push(e.message));
        const folder = path.join(out, `${name}-${width}-${family ? "family" : "count"}`);
        await mkdir(folder, { recursive: true });
        const upload = (data, name = "record.json") =>
          page.locator("#open-json").setInputFiles({
            name,
            mimeType: "application/json",
            buffer: Buffer.from(typeof data === "string" ? data : JSON.stringify(data)),
          });
        const status = page.locator("#file-status");

        try {
          await page.goto(server.base + (family ? "tuning.html" : ""));
          const pending = page.waitForEvent("download");
          await page.locator("#save-json").click();
          const saved = path.join(folder, "original.json");
          await (await pending).saveAs(saved);
          const original = JSON.parse(await readFile(saved, "utf8")),
            delayed = structuredClone(original);
          (family ? delayed.state : delayed.pose).base = 330;
          await upload(delayed, "delayed.json");
          await page.waitForFunction(() => window.releaseRecord);
          await page.locator("#base").fill("220.5");
          await page.locator(family ? "#set-base" : "#apply-base").click();
          const edited = page.url();
          await page.evaluate(() => window.releaseRecord());
          await status.filter({ hasText: /changed while the file was opening/ }).waitFor();
          assert.equal(page.url(), edited);
          assert.equal(await page.locator("#base").inputValue(), "220.5");
          // An unsubmitted number-field draft also belongs to the user.
          await page.evaluate(() => {
            window.releaseRecord = null;
          });
          await upload(delayed, "delayed.json");
          await page.waitForFunction(() => window.releaseRecord);
          await page.locator("#base").fill("220.75");
          await page.evaluate(() => window.releaseRecord());
          await status.filter({ hasText: /changed while the file was opening/ }).waitFor();
          assert.equal(await page.locator("#base").inputValue(), "220.75");
          assert.equal(page.url(), edited);
          // A more recent file wins; late completion cannot replace it or its status.
          await page.evaluate(() => {
            window.releaseRecord = null;
          });
          await upload(delayed, "delayed.json");
          await page.waitForFunction(() => window.releaseRecord);
          const later = structuredClone(original);
          (family ? later.state : later.pose).base = 440;
          await upload(later);
          await status.filter({ hasText: /^Reopened/ }).waitFor();
          const newer = page.url();
          await page.evaluate(() => window.releaseRecord());
          await page.waitForTimeout(100);
          assert.equal(page.url(), newer);
          assert.equal(await page.locator("#base").inputValue(), "440");
          assert.match(await status.textContent(), /^Reopened/);
          for (const invalid of [
            "{",
            " ".repeat(65537),
            JSON.stringify({ ...original, notice: "changed" }),
          ]) {
            await upload(invalid);
            await status.filter({ hasText: /current (comparison|experiment) was kept/ }).waitFor();
            assert.equal(page.url(), newer);
          }
          if (!family) {
            await page.evaluate(() => {
              window.releaseRecord = null;
            });
            await upload(delayed, "delayed.json");
            await page.waitForFunction(() => window.releaseRecord);
            await page.locator("#attachment-select").selectOption("arriving");
            await page.evaluate(() => window.releaseRecord());
            await status.filter({ hasText: /changed while the file was opening/ }).waitFor();
            assert.equal(await page.locator("#attachment-select").inputValue(), "arriving");
            for (const legacy of [
              { format: "grama-comparison-v1", pose: original.pose },
              { ...original, format: "grama-comparison-v2" },
            ]) {
              delete legacy.attachment;
              await upload(legacy);
              await status.filter({ hasText: /^Reopened/ }).waitFor();
            }
          }
          await page.evaluate(() => {
            window.releaseRecord = null;
          });
          await upload(delayed, "delayed.json");
          await page.waitForFunction(() => window.releaseRecord);
          const beforeHide = page.url();
          await page.evaluate(() => {
            window.dispatchEvent(new PageTransitionEvent("pagehide"));
            window.releaseRecord();
          });
          await page.waitForTimeout(100);
          assert.equal(page.url(), beforeHide);
          assert.match(await status.textContent(), /interrupted by navigation/);
          assert.equal(await page.locator("#open-json").inputValue(), "");
          assert.deepEqual(errors, []);
          report.cases.push({
            browser: name,
            width,
            room: family ? "family" : "count",
            newAppliedEditKept: true,
            unsubmittedDraftKept: true,
            laterFileWins: true,
            malformedFilesKeptState: true,
            navigationCancelsPendingRead: true,
            legacyComparisonRecordsAccepted: !family,
            placementEditKept: !family,
            pageErrors: errors,
          });
          console.log(
            `${name} ${width} ${family ? "family" : "count"}: delayed import preserves edits, drafts, later files and navigation`,
          );
        } finally {
          await context.close();
          await server.close();
        }
      }
  } finally {
    await browser.close();
  }
}
await writeFile(path.join(out, "report.json"), `${JSON.stringify(report, null, 2)}\n`);
