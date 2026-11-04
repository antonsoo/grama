import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import AxeBuilder from "@axe-core/playwright";
import { chromium, firefox } from "playwright";
import { reviewServer } from "./review-server.mjs";

const out = path.resolve(process.argv[2] ?? "/tmp/claude-1000/grama-listening-record");
const hosted = process.argv[3];
if (hosted) assert.match(hosted, /^https:\/\/.+\/$/);
await mkdir(out, { recursive: true });
const report = {
  checkedAt: new Date().toISOString(),
  scope: hosted
    ? "Hosted HTTPS production with browser networking disabled for offline reuse; no origin-outage claim."
    : "Local production; native file uploads/downloads and AudioBuffers; delayed file reads and resumes are deliberately injected; actual origin refused for offline reuse.",
  cases: [],
};
for (const [name, engine] of [
  ["chromium", chromium],
  ["firefox", firefox],
]) {
  const browser = await engine.launch();
  try {
    for (const width of [1440, 375]) {
      const server = await reviewServer(),
        base = hosted ?? server.base;
      const folder = path.join(out, `${name}-${width}`);
      await mkdir(folder, { recursive: true });
      const context = await browser.newContext({
        viewport: { width, height: 1100 },
        reducedMotion: "reduce",
      });
      await context.addInitScript(() => {
        window.recordAudit = {
          pendingRead: null,
          pendingResume: null,
          holdResume: false,
          sounds: [],
        };
        const text = File.prototype.text,
          resume = AudioContext.prototype.resume,
          create = AudioContext.prototype.createBufferSource;
        File.prototype.text = async function (...args) {
          const raw = await text.apply(this, args);
          if (this.name === "slow.json")
            await new Promise((resolve) => {
              window.recordAudit.pendingRead = resolve;
            });
          return raw;
        };
        AudioContext.prototype.resume = async function (...args) {
          await resume.apply(this, args);
          if (window.recordAudit.holdResume) {
            window.recordAudit.holdResume = false;
            await new Promise((resolve) => {
              window.recordAudit.pendingResume = resolve;
            });
          }
        };
        AudioContext.prototype.createBufferSource = function (...args) {
          const source = create.apply(this, args),
            start = source.start;
          source.start = function (...a) {
            const result = start.apply(this, a);
            window.recordAudit.sounds.push(Array.from(source.buffer.getChannelData(0)));
            return result;
          };
          return source;
        };
      });
      const page = await context.newPage(),
        errors = [];
      page.on("pageerror", (error) => errors.push(error.message));
      const node = (id) => page.locator(`#listening-${id}`);
      const upload = (record, name = "record.json") =>
        node("open").setInputFiles({
          name,
          mimeType: "application/json",
          buffer: Buffer.from(typeof record === "string" ? record : JSON.stringify(record)),
        });
      async function save(id, file) {
        const pending = page.waitForEvent("download");
        await node(id).click();
        await (await pending).saveAs(file);
        return readFile(file);
      }
      async function open(record) {
        await upload(record);
        await node("open-status")
          .filter({ hasText: /^Reopened/ })
          .waitFor();
      }
      const hash = (pcm) =>
        createHash("sha256")
          .update(Buffer.from(new Float32Array(pcm).buffer))
          .digest("hex");
      async function play(id, label = "1 completed") {
        const before = await page.evaluate(() => window.recordAudit.sounds.length);
        await node(id).click();
        await page.waitForFunction((old) => window.recordAudit.sounds.length > old, before);
        if (label) await node(`${id}-count`).filter({ hasText: label }).waitFor();
        await node("status")
          .filter({ hasText: new RegExp(`${id.toUpperCase()} finished|each completed`) })
          .waitFor();
        return page.evaluate(() => window.recordAudit.sounds.at(-1));
      }
      try {
        await page.goto(`${base}tuning.html#listening`);
        await page
          .locator("#offline-status")
          .filter({ hasText: /Ready offline/ })
          .waitFor({ timeout: 60000 });
        await node("example").click();
        await node("start").click();
        const originalA = await play("a");
        await play("b");
        await play("x");
        await node("answer-a").click();
        await page.locator("#preset-other").click();
        await page.locator("#base").fill("220.5");
        await page.locator("#set-base").click();
        await node("stimulus").selectOption("phrase");
        const json = await save("json", path.join(folder, "record.json")),
          original = JSON.parse(json);
        assert.equal(original.state.base, 220.5);
        assert.equal(original.results[0].state.base, 220);
        assert(!("provenance" in original.results[0]) && !("identical" in original.results[0]));
        const expectedHash = new URL(page.url()).hash;
        await page.reload();
        await open(original);
        assert.equal(new URL(page.url()).hash, expectedHash);
        assert.match(await node("summary").textContent(), /reopened from a file/);
        assert.equal(await node("a-count").textContent(), "1 recorded in file");
        assert(await node("answer-a").isDisabled());
        assert.equal(
          hash(await play("a", null)),
          hash(originalA),
          "restored playback keeps the frozen original, not current settings",
        );
        assert.equal(
          (await save("json", path.join(folder, "roundtrip.json"))).toString(),
          json.toString(),
        );
        assert.match(
          (await save("csv", path.join(folder, "reopened.csv"))).toString(),
          /,reopened\n/,
        );
        const study = path.join(folder, "reopened-study.html");
        await save("reading", study);
        const portable = await context.newPage();
        await portable.goto(pathToFileURL(study).href);
        assert.match(
          await portable.locator("#listening-record").textContent(),
          /Record origin: reopened file/,
        );
        const recover = portable.getByRole("link", {
          name: "Download the reopenable listening record",
          exact: true,
        });
        const pending = portable.waitForEvent("download");
        await recover.click();
        const embedded = path.join(folder, "from-study.json");
        await (await pending).saveAs(embedded);
        assert.equal((await readFile(embedded)).toString(), json.toString());
        await portable.close();
        // Reject hostile records atomically, with an active trial still usable.
        await node("start").click();
        assert.equal(await node("a-count").textContent(), "Not completed");
        const bad = [];
        for (const alter of [
          (r) => {
            r.results[0].completed.X = 0;
          },
          (r) => {
            r.results[0].completed.A = -1;
          },
          (r) => {
            r.results[0].identical = false;
          },
          (r) => {
            r.results[0].provenance = "this-tab";
          },
          (r) => {
            r.results[0].stimulus = "constructor";
          },
          (r) => {
            r.state.base = "220";
          },
          (r) => {
            r.results = Array(13).fill(r.results[0]);
          },
          (r) => {
            r.notice = "replaced";
          },
        ]) {
          const record = structuredClone(original);
          alter(record);
          bad.push(record);
        }
        bad.push("{", " ".repeat(65537));
        for (const record of bad) {
          await upload(record);
          await node("open-status")
            .filter({ hasText: /Your current experiment was kept/ })
            .waitFor();
          assert.equal(new URL(page.url()).hash, expectedHash);
          assert(await node("reveal").isEnabled());
          assert.equal(
            (await save("json", path.join(folder, "after-invalid.json"))).toString(),
            json.toString(),
          );
        }
        // A delayed read cannot overwrite a subsequent tuning edit.
        await upload(original, "slow.json");
        await page.waitForFunction(() => window.recordAudit.pendingRead);
        await page.locator("#two").focus();
        await page.keyboard.press("ArrowRight");
        const editedHash = new URL(page.url()).hash;
        await page.evaluate(() => window.recordAudit.pendingRead());
        await node("open-status")
          .filter({ hasText: /changed while the file was opening/ })
          .waitFor();
        assert.equal(new URL(page.url()).hash, editedHash);
        // A later file selection wins even when an earlier selection finishes late.
        await page.evaluate(() => {
          window.recordAudit.pendingRead = null;
        });
        await upload(original, "slow.json");
        await page.waitForFunction(() => window.recordAudit.pendingRead);
        const later = structuredClone(original);
        later.state.base = 330.5;
        await open(later);
        const laterHash = new URL(page.url()).hash;
        await page.evaluate(() => window.recordAudit.pendingRead());
        await page.waitForTimeout(150);
        assert.equal(new URL(page.url()).hash, laterHash);
        assert.match(await node("open-status").textContent(), /^Reopened/);
        // Import cancels an old pending audio resume before a fresh trial starts.
        await node("start").click();
        await page.evaluate(() => {
          window.recordAudit.holdResume = true;
        });
        await node("x").click();
        await page.waitForFunction(() => window.recordAudit.pendingResume);
        await open(original);
        await node("start").click();
        const sounds = await page.evaluate(() => window.recordAudit.sounds.length);
        await page.evaluate(() => window.recordAudit.pendingResume());
        await page.waitForTimeout(200);
        assert.equal(await page.evaluate(() => window.recordAudit.sounds.length), sounds);
        assert.equal(await node("x-count").textContent(), "Not completed");
        assert(await node("answer-a").isDisabled());
        const full = structuredClone(original);
        full.results = Array(12).fill(full.results[0]);
        await open(full);
        assert(await node("start").isDisabled());
        assert.equal(await node("history").locator("li").count(), 12);
        const empty = structuredClone(original);
        empty.results = [];
        empty.state.base = 110.75;
        empty.state.locked = false;
        empty.state.current = { four: 200, two: 100 };
        await open(empty);
        assert(await node("start").isEnabled());
        assert(await node("reading").isDisabled());
        assert.equal(await page.locator("#base").inputValue(), "110.75");
        await node("start").click();
        await node("reveal").click();
        assert.match(await node("result").textContent(), /lower Pa fails/);
        await page.locator("#listening").scrollIntoViewIfNeeded();
        assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
        const axe = await new AxeBuilder({ page })
          .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
          .analyze();
        assert.deepEqual(axe.violations, []);
        if (!hosted) server.offline();
        await context.setOffline(true);
        await page.reload();
        await open(original);
        assert.equal(hash(await play("a", null)), hash(originalA));
        await save("reading", path.join(folder, "offline-restored-study.html"));
        assert.deepEqual(errors, []);
        report.cases.push({
          browser: name,
          width,
          nativeFileRoundTrip: true,
          restoredPCMMatchesOriginal: true,
          importedClaimsLabeled: true,
          invalidVariantsKeptCurrentExperiment: bad.length,
          delayedReadCannotOverwriteEdits: true,
          laterSelectionWins: true,
          pendingResumeCancelledByImport: true,
          fullRecordNotEvicted: true,
          emptyAndFailedCandidatesRestored: true,
          scriptFreeStudyContainsReopenableRecord: true,
          offlineRestoreAndExport: true,
          accessibilityViolations: 0,
          pageErrors: errors,
        });
        console.log(
          `${name} ${width}: native record roundtrip, atomic failures, races and offline restore passed`,
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
