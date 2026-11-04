import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import AxeBuilder from "@axe-core/playwright";
import { chromium, firefox } from "playwright";
import { reviewServer } from "./review-server.mjs";

const out = path.resolve(process.argv[2] ?? "/tmp/claude-1000/grama-listening");
const hosted = process.argv[3];
if (hosted) assert.match(hosted, /^https:\/\/.+\/$/);
await mkdir(out, { recursive: true });
const digest = (bytes) => createHash("sha256").update(bytes).digest("hex");
const report = {
  checkedAt: new Date().toISOString(),
  scope: hosted
    ? "Hosted HTTPS production; actual native AudioBuffers and downloaded studies; browser networking disabled after worker takeover. No origin-outage or physical-speaker claim."
    : "Local production; real native AudioBuffers, completion events, actual downloads reopened from disk, and origin refused for offline use. No physical-speaker or public delivery claim.",
  configurations: [],
};
for (const [name, engine] of [
  ["chromium", chromium],
  ["firefox", firefox],
]) {
  const browser = await engine.launch();
  try {
    for (const width of [1440, 375]) {
      const folder = path.join(out, `${name}-${width}`);
      await mkdir(folder, { recursive: true });
      const server = await reviewServer(),
        context = await browser.newContext({
          viewport: { width, height: 1100 },
          reducedMotion: "reduce",
        });
      await context.addInitScript(() => {
        window.listeningAudit = { sources: [], hold: false, pending: null };
        const create = AudioContext.prototype.createBufferSource,
          resume = AudioContext.prototype.resume;
        AudioContext.prototype.createBufferSource = function (...args) {
          const source = create.apply(this, args),
            start = source.start;
          source.start = function (...values) {
            const result = start.apply(this, values);
            window.listeningAudit.sources.push({
              pcm: Array.from(source.buffer.getChannelData(0)),
              rate: source.buffer.sampleRate,
            });
            return result;
          };
          return source;
        };
        AudioContext.prototype.resume = async function (...args) {
          await resume.apply(this, args);
          if (window.listeningAudit.hold) {
            window.listeningAudit.hold = false;
            await new Promise((resolve) => {
              window.listeningAudit.pending = resolve;
            });
          }
        };
      });
      const page = await context.newPage(),
        errors = [];
      page.on("pageerror", (error) => errors.push(error.message));
      const node = (id) => page.locator(`#listening-${id}`);
      async function play(key, count = 1) {
        await node(key).click();
        await node(`${key}-count`)
          .filter({ hasText: `${count} completed` })
          .waitFor({ timeout: 15000 });
        return page.evaluate(() => window.listeningAudit.sources.at(-1));
      }
      async function save(id, file) {
        const download = page.waitForEvent("download");
        await node(id).click();
        await (await download).saveAs(file);
        return readFile(file);
      }
      try {
        const base = hosted ?? server.base;
        await page.goto(`${base}tuning.html`);
        await page
          .locator("#offline-status")
          .filter({ hasText: /Ready offline/ })
          .waitFor({ timeout: 60000 });
        await page.goto(base);
        await page.locator('a[href="tuning.html#listening"]').click();
        await node("example").click();
        await node("start").focus();
        await page.keyboard.press("Enter");
        assert(await node("answer-a").isDisabled());
        // Stopped audio and a resume completed after settings changed earn no credit.
        await node("a").click();
        await node("stop").click();
        assert.equal(await node("a-count").textContent(), "Not completed");
        await page.evaluate(() => {
          window.listeningAudit.hold = true;
        });
        await node("x").click();
        await page.waitForFunction(() => window.listeningAudit.pending !== null);
        await page.locator("#two").focus();
        await page.keyboard.press("ArrowRight");
        assert(await node("desk").isHidden());
        assert.match(await node("status").textContent(), /discarded/);
        const before = await page.evaluate(() => window.listeningAudit.sources.length);
        await page.evaluate(() => {
          window.listeningAudit.pending();
        });
        await page.waitForTimeout(200);
        assert.equal(await page.evaluate(() => window.listeningAudit.sources.length), before);
        await node("example").click();
        await node("start").click();
        const A = await play("a"),
          B = await play("b"),
          X = await play("x");
        assert.notDeepEqual(A.pcm, B.pcm);
        await writeFile(
          path.join(folder, "native-A.f32"),
          Buffer.from(new Float32Array(A.pcm).buffer),
        );
        await writeFile(
          path.join(folder, "native-B.f32"),
          Buffer.from(new Float32Array(B.pcm).buffer),
        );
        const hashPCM = (record) => digest(Buffer.from(new Float32Array(record.pcm).buffer));
        const assigned = hashPCM(X) === hashPCM(A) ? "a" : "b";
        assert.equal(hashPCM(X), hashPCM(assigned === "a" ? A : B));
        assert.equal(hashPCM(await play("x", 2)), hashPCM(X), "replaying X retains exact PCM");
        assert(await node("answer-a").isEnabled());
        await node(`answer-${assigned}`).focus();
        await page.keyboard.press("Enter");
        assert.match(await node("status").textContent(), /^Matched/);
        assert.match(await node("result").textContent(), /10\.000000 cents/);
        await node("start").click();
        const A2 = await play("a"),
          X2 = await play("x");
        await play("b");
        const wrong = hashPCM(X2) === hashPCM(A2) ? "b" : "a";
        await node(`answer-${wrong}`).click();
        assert.match(await node("status").textContent(), /^Missed/);
        // A distinct settings pair can still give exactly the same Ma control.
        await node("stimulus").selectOption("ma");
        await node("start").click();
        assert.match(await node("status").textContent(), /identical samples/);
        const maA = await play("a"),
          maB = await play("b");
        await play("x");
        assert.equal(hashPCM(maA), hashPCM(maB));
        assert(await node("answer-a").isDisabled());
        await node("reveal").click();
        assert.match(await node("status").textContent(), /Unscored/);
        const csvFile = path.join(folder, "record.csv"),
          csv = (await save("csv", csvFile)).toString();
        assert.match(csv, /matched/);
        assert.match(csv, /missed/);
        assert.match(csv, /identical_unscored/);
        const readingFile = path.join(folder, "study.html");
        await save("reading", readingFile);
        const reading = await readFile(readingFile, "utf8");
        assert(!/<script\b/i.test(reading));
        assert.match(reading, /id="listening-record"/);
        const saved = await context.newPage();
        const externalRequests = [];
        await saved.route(/^https?:/, (route) => {
          externalRequests.push(route.request().url());
          return route.abort();
        });
        await saved.goto(pathToFileURL(readingFile).href);
        await saved.evaluate(() => document.fonts.ready);
        assert(
          await saved.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1),
          "saved study must fit the viewport",
        );
        const pitchTable = saved.locator("#listening-record .table-scroll").first();
        await pitchTable.focus();
        await saved.keyboard.press("ArrowRight");
        if (width === 375)
          await saved.waitForFunction(
            () => document.querySelector("#listening-record .table-scroll").scrollLeft > 0,
          );
        const savedAudio = saved.locator("#listening-record audio");
        assert.equal(await savedAudio.count(), 6);
        const sounds = await savedAudio.evaluateAll((nodes) => nodes.map((n) => n.src));
        for (const [i, uri] of sounds.entries())
          await writeFile(
            path.join(folder, `sound-${i}.wav`),
            Buffer.from(uri.split(",")[1], "base64"),
          );
        assert.equal(sounds[4], sounds[5], "control WAVs are byte-identical");
        await saved.locator("#listening-record").scrollIntoViewIfNeeded();
        await saved.screenshot({ path: path.join(folder, "saved-study.png") });
        await saved
          .locator("#listening-record audio")
          .first()
          .evaluate((audio) => audio.play());
        await saved.waitForFunction(() => document.querySelector("#listening-record audio").ended);
        assert.equal(
          await saved
            .locator(".source-page img")
            .evaluateAll(
              (images) => images.filter((im) => im.complete && im.naturalWidth > 0).length,
            ),
          11,
        );
        assert.deepEqual(externalRequests, []);
        await saved.close();
        // Finished records remain frozen after changing the current tuning.
        await page.locator("#two").focus();
        await page.keyboard.press("ArrowRight");
        assert.equal((await save("csv", path.join(folder, "after-edit.csv"))).toString(), csv);
        // A revealed history entry replays its frozen sound despite later edits.
        await page.locator("#listening-history button").first().click();
        const oldCount = await page.evaluate(() => window.listeningAudit.sources.length);
        await node("a").click();
        await page.waitForFunction(
          (before) => window.listeningAudit.sources.length > before,
          oldCount,
        );
        await node("status").filter({ hasText: "A finished." }).waitFor();
        assert.equal(
          hashPCM(await page.evaluate(() => window.listeningAudit.sources.at(-1))),
          hashPCM(A),
        );
        assert.match(await node("result").textContent(), /Matched/);
        // Keep an unscored example visible for the screenshot and inspect evidence.
        await node("stimulus").selectOption("phrase");
        await node("start").click();
        await node("reveal").click();
        await page.locator("#source-page").selectOption("28");
        await page.locator("#scan").filter({ visible: true }).waitFor();
        await page.locator("#listening").scrollIntoViewIfNeeded();
        await page.screenshot({ path: path.join(folder, "revealed.png"), fullPage: false });
        await node("start").click();
        await node("desk").screenshot({ path: path.join(folder, "listening.png") });
        await node("reveal").click();
        assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
        const axe = await new AxeBuilder({ page })
          .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
          .analyze();
        assert.deepEqual(axe.violations, []);
        // A full record cannot silently discard an older attempt.
        for (let i = 5; i < 12; i++) {
          await node("start").click();
          await node("reveal").click();
        }
        assert(await node("start").isDisabled());
        assert.match(await node("summary").textContent(), /record is full/);
        await node("clear").click();
        assert(await node("start").isEnabled());
        assert(await node("csv").isDisabled());
        // Shut down the actual local origin, then operate and save from its worker.
        if (!hosted) server.offline();
        await context.setOffline(true);
        await page.reload();
        await node("example").click();
        await node("start").click();
        await play("a");
        await play("b");
        await play("x");
        await node("reveal").click();
        await save("reading", path.join(folder, "offline-study.html"));
        assert.deepEqual(errors, []);
        if (hosted) {
          await context.setOffline(false);
          const response = await fetch(hosted, {
            cache: "no-store",
            signal: AbortSignal.timeout(20000),
          });
          assert.equal(response.status, 200);
          assert.equal(
            digest(Buffer.from(await response.arrayBuffer())),
            digest(await readFile("dist/index.html")),
            "canonical entry remains current after hosted workflow",
          );
        }
        report.configurations.push({
          browser: name,
          width,
          nativeXExactMatch: assigned.toUpperCase(),
          replayPCMIdentical: true,
          controlPCMIdentical: true,
          stoppedAndStaleResumeNotCredited: true,
          matchedAndMissedAnswers: true,
          recordFrozenAcrossEdits: true,
          recordLimit: 12,
          offlineOriginRefused: !hosted,
          browserNetworkDisabledForOffline: true,
          standaloneStudy: {
            images: 11,
            trialAudio: 6,
            externalRequests: 0,
            nativePlaybackFinished: true,
          },
          accessibilityViolations: 0,
          pageErrors: errors,
        });
        console.log(
          `${name} ${width}: native audio, saved study and refused-origin operation passed`,
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
