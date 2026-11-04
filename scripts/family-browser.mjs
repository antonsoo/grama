import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import { createServer } from "node:http";
import path from "node:path";
import { pathToFileURL } from "node:url";
import AxeBuilder from "@axe-core/playwright";
import { chromium, firefox } from "playwright";

const output = path.resolve(process.argv[2] ?? "/tmp/claude-1000/grama-family-browser");
const hosted = process.argv[3];
if (hosted) assert.match(hosted, /^https:\/\/.+\/$/);
await mkdir(output, { recursive: true });
const hash = (bytes) => createHash("sha256").update(bytes).digest("hex");
const manifest = JSON.parse(await readFile("public/sources/manifest.json", "utf8"));
async function files(dir) {
  return (
    await Promise.all(
      (
        await readdir(dir, { withFileTypes: true })
      ).map((e) => (e.isDirectory() ? files(path.join(dir, e.name)) : [path.join(dir, e.name)])),
    )
  ).flat();
}
async function serve() {
  let online = true;
  const server = createServer(async (req, res) => {
    if (!online) {
      req.socket.destroy();
      return;
    }
    try {
      const file =
        new URL(req.url, "http://local").pathname.replace(/^\/grama\//, "") || "index.html";
      assert(!file.includes(".."));
      const bytes = await readFile(path.join("dist", file));
      res
        .writeHead(200, {
          "Content-Type":
            {
              ".html": "text/html",
              ".js": "text/javascript",
              ".css": "text/css",
              ".jpg": "image/jpeg",
              ".svg": "image/svg+xml",
              ".json": "application/json",
              ".woff2": "font/woff2",
              ".ttf": "font/ttf",
            }[path.extname(file)] ?? "application/octet-stream",
          "Cache-Control": "no-store",
        })
        .end(bytes);
    } catch {
      res.writeHead(404).end();
    }
  });
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  return {
    base: `http://127.0.0.1:${server.address().port}/grama/`,
    offline() {
      online = false;
      server.closeAllConnections();
    },
    online() {
      online = true;
    },
    async close() {
      server.closeAllConnections();
      await new Promise((r) => server.close(r));
    },
  };
}
async function save(page, id, file) {
  const pending = page.waitForEvent("download");
  await page.locator(id).click();
  await (await pending).saveAs(file);
  return readFile(file);
}
async function ready(page) {
  await page
    .locator("#offline-status")
    .filter({ hasText: /Ready offline/ })
    .waitFor({ timeout: 30000 });
}
async function fits(page) {
  assert(
    await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1),
    "document fits viewport",
  );
}
const report = {
  checkedAt: new Date().toISOString(),
  scope: hosted
    ? "Public production; actual native files and audio nodes; browser networking disabled for offline reload. The public origin remains available."
    : "Local production; actual native files and audio nodes; origin disabled for offline reload. No publication claim.",
  workerSha256: hash(await readFile("dist/sw.js")),
  configurations: [],
};
for (const [name, type] of [
  ["chromium", chromium],
  ["firefox", firefox],
]) {
  const browser = await type.launch();
  try {
    for (const width of [1440, 375]) {
      const folder = path.join(output, `${name}-${width}`);
      await mkdir(folder, { recursive: true });
      const server = await serve(),
        context = await browser.newContext({
          viewport: { width, height: 1000 },
          acceptDownloads: true,
          reducedMotion: "reduce",
        });
      await context.addInitScript(() => {
        window.audioReview = { started: [], stopped: 0, defer: false, release: null };
        const resume = AudioContext.prototype.resume,
          create = AudioContext.prototype.createBufferSource;
        AudioContext.prototype.resume = async function (...args) {
          await resume.apply(this, args);
          if (window.audioReview.defer)
            await new Promise((r) => {
              window.audioReview.release = r;
            });
        };
        AudioContext.prototype.createBufferSource = function (...args) {
          const source = create.apply(this, args),
            start = source.start,
            stop = source.stop;
          source.start = function (...args) {
            const data = this.buffer.getChannelData(0),
              pcm = new Int16Array(data.length),
              record = { frames: data.length, rate: this.buffer.sampleRate, sha256: null };
            for (let i = 0; i < data.length; i++) pcm[i] = Math.round(data[i] * 32767);
            window.audioReview.started.push(record);
            crypto.subtle.digest("SHA-256", pcm.buffer).then((d) => {
              record.sha256 = Array.from(new Uint8Array(d), (b) =>
                b.toString(16).padStart(2, "0"),
              ).join("");
            });
            return start.apply(this, args);
          };
          source.stop = function (...args) {
            window.audioReview.stopped++;
            return stop.apply(this, args);
          };
          return source;
        };
      });
      if (hosted) server.base = hosted;
      const page = await context.newPage(),
        errors = [],
        external = [];
      page.on("pageerror", (error) => errors.push(String(error)));
      page.on("request", (request) => {
        if (
          /^https?:/.test(request.url()) &&
          new URL(request.url()).origin !== new URL(server.base).origin
        )
          external.push(request.url());
      });
      try {
        // Start at the existing lesson, then follow its real new-workshop link.
        await page.goto(server.base);
        await ready(page);
        await page.getByRole("link", { name: "Find another tuning" }).click();
        await ready(page);
        await page.evaluate(() => document.fonts.ready);
        assert.equal(await page.locator("#four").isDisabled(), true);
        const initial = Number(await page.locator("#two").inputValue());
        await page.locator("#two").focus();
        await page.keyboard.press("Shift+ArrowRight");
        assert(Math.abs(Number(await page.locator("#two").inputValue()) - initial - 10) < 1e-9);
        assert.match(await page.locator("#constraints").textContent(), /Pa falls 31\.506/);
        assert.match(
          await page.locator("#movement").textContent(),
          /4\/3 by 0\.000 cents; Sa–Pa differs from 3\/2 by 0\.000/,
        );
        await page.locator("#pin").click();
        assert.match(await page.locator("#file-status").textContent(), /Saved witness replaced/);
        // Changing a preset cannot mutate the pinned witness.
        await page.locator("#preset-other").click();
        assert.match(
          await page.locator("#comparison-summary").textContent(),
          /Saved Pa lowering: 31\.506/,
        );
        await page.locator("#preset-ratios").click();
        await page.locator("#pin").click();
        await page.locator("#preset-failed").click();
        assert.equal(await page.locator("#verdict").getAttribute("data-pass"), "false");
        assert.match(await page.locator("#constraints").textContent(), /Pa stays put/);
        assert(await page.locator("#pin").isDisabled());
        const failed = await save(page, "#save-reading", path.join(folder, "failed-reading.html"));
        assert.match(failed.toString(), /retained as a failed candidate/);
        assert.match(failed.toString(), /Pa-lowering test: fails/);
        await page.locator("#preset-other").click();
        assert.equal(await page.locator("#verdict").getAttribute("data-pass"), "true");
        assert.match(await page.locator("#constraints").textContent(), /65\.000/);
        // Validate cancellation while AudioContext.resume is genuinely awaiting.
        await page.evaluate(() => {
          window.audioReview.defer = true;
        });
        await page.locator("#hear-current").click();
        await page.waitForFunction(() => window.audioReview.release);
        await page.locator("#stop").click();
        await page.evaluate(() => {
          window.audioReview.defer = false;
          window.audioReview.release();
        });
        assert.equal(await page.evaluate(() => window.audioReview.started.length), 0);
        await page.locator("#hear-compare").click();
        await page.waitForFunction(() => window.audioReview.started[0]?.sha256);
        const pcm = await page.evaluate(() => window.audioReview.started[0]);
        const wave = await save(page, "#save-wav", path.join(folder, "two-witnesses.wav"));
        assert.equal(
          pcm.sha256,
          hash(wave.subarray(44, 44 + wave.readUInt32LE(40))),
          "actual live AudioBuffer and native WAV contain the same PCM",
        );
        const starts = await page.evaluate(() => window.audioReview.stopped);
        await page.locator("#two").focus();
        await page.keyboard.press("ArrowRight");
        assert(
          (await page.evaluate(() => window.audioReview.stopped)) > starts,
          "editing stops the actual playing node",
        );
        await page.locator("#preset-other").click();
        // Strict native reopening and incoming links preserve or reject atomically.
        const json = await save(page, "#save-json", path.join(folder, "tuning.json")),
          saved = JSON.parse(json);
        assert.equal(saved.state.current.four, 230);
        assert.equal(saved.state.current.two, 90);
        await page.locator("#preset-equal").click();
        await page.locator("#open-json").setInputFiles(path.join(folder, "tuning.json"));
        await page
          .locator("#file-status")
          .filter({ hasText: /Reopened both/ })
          .waitFor();
        assert.equal(await page.locator("#four").inputValue(), "230");
        await page.locator("#open-json").setInputFiles({
          name: "bad.json",
          mimeType: "application/json",
          buffer: Buffer.from(JSON.stringify({ ...saved, frequencies: [0] })),
        });
        await page
          .locator("#file-status")
          .filter({ hasText: /current experiment was kept/ })
          .waitFor();
        assert.equal(await page.locator("#four").inputValue(), "230");
        const shared = page.url();
        await page.evaluate(() => {
          location.hash = "a=999";
        });
        await page
          .locator("#file-status")
          .filter({ hasText: /Invalid tuning link/ })
          .waitFor();
        assert.equal(await page.locator("#four").inputValue(), "230");
        await page.goto(shared);
        await ready(page);
        await page.getByRole("link", { name: "Sanskrit", exact: true }).click();
        assert.equal(page.url(), shared, "section navigation retains the tuning record");
        await page.locator("#share").click();
        await page
          .locator("#file-status")
          .filter({ hasText: /Copied the tuning link|Copy this tuning link/ })
          .waitFor();
        const field = page.getByRole("textbox", { name: "Tuning link" });
        if (await field.count()) assert.equal(await field.inputValue(), shared);
        const second = await context.newPage();
        await second.goto(shared);
        await ready(second);
        assert.equal(await second.locator("#four").inputValue(), "230");
        assert.equal(await second.locator("#two").inputValue(), "90");
        await second.close();
        const csv = await save(page, "#save-csv", path.join(folder, "two-witnesses.csv"));
        assert.equal(csv.toString().trim().split("\n").length, 34);
        assert.match(csv.toString(), /current,sadja,Pa,4,715\.000000000/);
        for (const printed of ["28", "29", "86"]) {
          await page.locator("#source-page").selectOption(printed);
          await page.waitForFunction(() => {
            const img = document.querySelector("#scan");
            return !img.hidden && img.complete && img.naturalWidth > 0;
          });
          const sourceHash = await page.locator("#scan").evaluate(async (image) => {
            const bytes = await (await fetch(image.src)).arrayBuffer();
            return Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", bytes)), (b) =>
              b.toString(16).padStart(2, "0"),
            ).join("");
          });
          assert.equal(
            sourceHash,
            manifest.pages.find((p) => p.file.endsWith(`grosset-${printed}.jpg`)).sha256,
          );
        }
        await page.locator("#family-reading summary").first().focus();
        await page.keyboard.press("Enter");
        assert(
          (await page.locator("#family-reading details").first().getAttribute("open")) !== null,
        );
        const axe = await new AxeBuilder({ page }).analyze();
        assert.deepEqual(
          axe.violations.map((v) => ({ id: v.id, nodes: v.nodes.map((n) => n.target) })),
          [],
        );
        await fits(page);
        await page
          .locator("#workbench")
          .evaluate((node) => node.scrollIntoView({ block: "start" }));
        await page.screenshot({ path: path.join(folder, "controls.png") });
        await page
          .locator(".instrument")
          .evaluate((node) => node.scrollIntoView({ block: "start" }));
        await page.screenshot({ path: path.join(folder, "instrument.png") });
        // Capture a snapshot, then edit while the verified assets are being read.
        const pending = page.waitForEvent("download");
        await page.locator("#save-reading").click();
        await page.locator("#preset-equal").click();
        const readingPath = path.join(folder, "reading.html");
        await (await pending).saveAs(readingPath);
        const html = await readFile(readingPath, "utf8");
        assert(!/<script\b|\son\w+=/i.test(html));
        const record =
          /download="grama-tuning-family.json" href="data:application\/json;base64,([^"]+)"/.exec(
            html,
          );
        assert(record);
        assert.deepEqual(JSON.parse(Buffer.from(record[1], "base64")), saved);
        const images = [...html.matchAll(/<img src="data:image\/jpeg;base64,([^"]+)"/g)];
        assert.equal(images.length, 11);
        images.forEach((m, i) => {
          assert.equal(hash(Buffer.from(m[1], "base64")), manifest.pages[i].sha256);
        });
        const portableContext = await browser.newContext({ viewport: { width, height: 1000 } }),
          portable = await portableContext.newPage(),
          remote = [];
        portable.on("request", (r) => {
          if (/^https?:/.test(r.url())) remote.push(r.url());
        });
        await portable.goto(pathToFileURL(readingPath).href);
        await portable.evaluate(() => document.fonts.ready);
        assert(
          await portable
            .locator("img")
            .evaluateAll((images) => images.every((i) => i.complete && i.naturalWidth > 0)),
        );
        assert.equal(await portable.locator("article").count(), 8);
        const embeddedWave = await portable.locator("#family-comparison-audio").getAttribute("src");
        assert.equal(hash(Buffer.from(embeddedWave.split(",")[1], "base64")), hash(wave));
        await fits(portable);
        await portable.screenshot({ path: path.join(folder, "portable.png") });
        if (name === "chromium" && width === 1440)
          await portable.pdf({
            path: path.join(folder, "reading.pdf"),
            printBackground: true,
            preferCSSPageSize: true,
          });
        assert.deepEqual(remote, []);
        await portableContext.close();
        await page.locator("#open-json").setInputFiles(path.join(folder, "tuning.json"));
        await page
          .locator("#file-status")
          .filter({ hasText: /Reopened both/ })
          .waitFor();
        if (!hosted) {
          // Corrupt a real cached source. Presence alone must not mean ready.
          const companion = await context.newPage();
          await companion.goto(server.base);
          await ready(companion);
          const sourceURL = new URL("sources/grosset-28.jpg", server.base).href;
          await page.evaluate(async (url) => {
            const key = (await caches.keys()).find((k) => k.startsWith("grama-")),
              cache = await caches.open(key);
            await cache.put(url, new Response("wrong source bytes"));
            await cache.delete(new URL("tuning.html", location.href).href);
          }, sourceURL);
          await page.locator("#check-offline").click();
          await page
            .locator("#offline-status")
            .filter({ hasText: /incomplete or damaged/ })
            .waitFor();
          server.offline();
          await context.setOffline(true);
          let downloads = 0;
          page.on("download", () => downloads++);
          await page.locator("#save-reading").click();
          await page
            .locator("#file-status")
            .filter({
              hasText:
                /differs from this edition|Failed to fetch|NetworkError|Load failed|did not send its headers|stopped sending bytes|Error in input stream/,
            })
            .waitFor();
          assert.equal(downloads, 0);
          // Failed offline repair keeps the candidate; reconnecting repair updates both tabs.
          server.offline();
          await context.setOffline(true);
          await page.locator("#repair-offline").click();
          await page.waitForFunction(() => !document.querySelector("#repair-offline").disabled);
          await page
            .locator("#offline-status")
            .filter({ hasText: /incomplete or damaged|could not be repaired/ })
            .waitFor();
          assert.equal(await page.locator("#four").inputValue(), "230");
          server.online();
          await context.setOffline(false);
          await page.locator("#repair-offline").click();
          await ready(page);
          await ready(companion);
          assert.equal(await page.locator("#four").inputValue(), "230");
          await companion.close();
        }
        server.offline();
        await context.setOffline(true);
        await page.reload();
        await ready(page);
        assert.equal(await page.locator("#four").inputValue(), "230");
        const offlineWave = await save(page, "#save-wav", path.join(folder, "offline.wav"));
        assert.equal(hash(offlineWave), hash(wave));
        const offlineReading = await save(
          page,
          "#save-reading",
          path.join(folder, "offline-reading.html"),
        );
        assert.equal(hash(offlineReading), hash(Buffer.from(html)));
        assert.deepEqual(errors, []);
        assert.deepEqual(external, []);
        report.configurations.push({
          browser: name,
          version: browser.version(),
          width,
          reducedMotion: true,
          lockedGapChangedWithPureFourthFifth: true,
          failedCandidateRetained: true,
          keyboardOperated: true,
          pinnedWitnessIndependent: true,
          delayedResumeCancelled: true,
          livePcmMatchesNativeWav: true,
          wavSha256: hash(wave),
          readingSha256: hash(Buffer.from(html)),
          allElevenEmbeddedSourceHashes: true,
          portableRemoteRequests: remote,
          corruptSourceExportRejected: hosted ? null : true,
          corruptCacheReadinessRejected: hosted ? null : true,
          missingWorkshopPageRepaired: hosted ? null : true,
          offlineRepairFailurePreservesTuning: hosted ? null : true,
          crossTabRepair: hosted ? null : true,
          offlineOriginDisabled: !hosted,
          offlineReadingByteIdentical: true,
          axeViolations: axe.violations.length,
          pageErrors: errors,
          externalRequests: external,
        });
        console.log(
          `${name} ${width}: operated tuning, actual PCM, native reopening, script-free reading, ${hosted ? "" : "cache damage/repair and "}${hosted ? "browser-offline" : "origin-disabled offline"} use passed`,
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
// Each canonical local HTTP response must equal the build actually reviewed.
const server = await serve(),
  served = [];
try {
  for (const file of (await files("dist")).sort()) {
    const bytes = await readFile(file),
      response = await fetch(new URL(file.slice(5), server.base));
    assert(response.ok);
    assert.equal(hash(new Uint8Array(await response.arrayBuffer())), hash(bytes));
    served.push({ file: file.slice(5), bytes: bytes.length, sha256: hash(bytes) });
  }
} finally {
  await server.close();
}
report.servedFiles = served;
await writeFile(path.join(output, "review.json"), `${JSON.stringify(report, null, 2)}\n`);
