import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { createServer } from "node:http";
import path from "node:path";
import { pathToFileURL } from "node:url";
import AxeBuilder from "@axe-core/playwright";
import { chromium, firefox } from "playwright";

const output = path.resolve(process.argv[2] ?? "/tmp/grama-browser-review"),
  hosted = process.argv[3];
if (hosted) assert.match(hosted, /^https:\/\/.+\/$/);
await mkdir(output, { recursive: true });
const hash = (b) => createHash("sha256").update(b).digest("hex");
const manifest = JSON.parse(await readFile("public/sources/manifest.json", "utf8"));
const report = {
  checkedAt: new Date().toISOString(),
  scope: hosted
    ? "Public browser operations and native files. Offline checks disable browser networking; the public origin remains available."
    : "Local production browser operations, native files and offline use with the origin disabled. No deployment claim.",
  base: hosted ?? null,
  workerSha256: hash(await readFile("dist/sw.js")),
  configurations: [],
};
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
      const data = await readFile(path.join("dist", file));
      res
        .writeHead(200, {
          "Content-Type":
            {
              ".html": "text/html",
              ".js": "text/javascript",
              ".css": "text/css",
              ".svg": "image/svg+xml",
              ".jpg": "image/jpeg",
              ".json": "application/json",
              ".ttf": "font/ttf",
              ".woff2": "font/woff2",
            }[path.extname(file)] ?? "application/octet-stream",
          "Cache-Control": "no-store",
        })
        .end(data);
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
    async close() {
      server.closeAllConnections();
      await new Promise((r) => server.close(r));
    },
  };
}
async function save(page, selector, file) {
  const pending = page.waitForEvent("download");
  await page.locator(selector).click();
  await (await pending).saveAs(file);
  return readFile(file);
}
async function fits(page) {
  assert(
    await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1),
    "page fits viewport",
  );
}
for (const [name, type] of [
  ["chromium", chromium],
  ["firefox", firefox],
]) {
  const browser = await type.launch();
  try {
    for (const width of [1440, 375]) {
      const directory = path.join(output, `${name}-${width}`);
      await mkdir(directory, { recursive: true });
      const server = await serve(),
        base = hosted ?? server.base;
      const context = await browser.newContext({
        viewport: { width, height: 1000 },
        acceptDownloads: true,
      });
      await context.addInitScript(() => {
        window.audioReview = { started: [], stopped: 0 };
        const create = AudioContext.prototype.createBufferSource;
        AudioContext.prototype.createBufferSource = function (...args) {
          const source = create.apply(this, args),
            start = source.start,
            stop = source.stop;
          source.start = function (...args) {
            const buffer = this.buffer;
            if (buffer) {
              const data = buffer.getChannelData(0),
                pcm = new Int16Array(data.length);
              for (let i = 0; i < data.length; i++) pcm[i] = Math.round(data[i] * 32767);
              const record = { rate: buffer.sampleRate, frames: buffer.length, sha256: null };
              window.audioReview.started.push(record);
              crypto.subtle.digest("SHA-256", pcm.buffer).then((d) => {
                record.sha256 = Array.from(new Uint8Array(d), (b) =>
                  b.toString(16).padStart(2, "0"),
                ).join("");
              });
            }
            return start.apply(this, args);
          };
          source.stop = function (...args) {
            window.audioReview.stopped++;
            return stop.apply(this, args);
          };
          return source;
        };
      });
      const page = await context.newPage(),
        errors = [],
        external = [];
      page.on("pageerror", (e) => errors.push(String(e)));
      page.on("request", (r) => {
        if (/^https?:/.test(r.url()) && new URL(r.url()).origin !== new URL(base).origin)
          external.push(r.url());
      });
      try {
        await page.goto(base);
        await page.evaluate(() => document.fonts.ready);
        await page
          .locator("#offline-status")
          .filter({ hasText: /Ready offline/ })
          .waitFor({ timeout: 30000 });
        await fits(page);
        await page.screenshot({ path: path.join(directory, "opening.png") });
        await page.locator("#hear-context").click();
        await page.waitForFunction(() => window.audioReview.started[0]?.sha256);
        const originalAudio = await page.evaluate(() => window.audioReview.started[0]);
        const originalWave = await save(
          page,
          "#save-wav",
          path.join(directory, "ratio-comparison.wav"),
        );
        assert.equal(
          originalAudio.sha256,
          hash(originalWave.subarray(44)),
          "live AudioBuffer PCM and downloaded WAV agree",
        );
        assert.equal(originalAudio.rate, 44100);
        // A control edit must cancel the actual sound node, rather than only relabel it.
        await page.locator("#start").selectOption("1");
        assert((await page.evaluate(() => window.audioReview.stopped)) >= 1);
        assert.match(
          await page.locator("#order-description").textContent(),
          /^Re – Ga – Ma – Pa – Dha – Ni – Sa′ – Re′/,
        );
        assert.match(
          await page.locator("#comparison tbody tr").nth(4).textContent(),
          /330\.000 \/ 325\.926/,
        );
        for (let start = 0; start < 7; start++) {
          await page.locator("#start").selectOption(String(start));
          const row = await page.locator("#order-description").textContent();
          assert(row.startsWith(["Sa", "Re", "Ga", "Ma", "Pa", "Dha", "Ni"][start]));
          assert.match(row, /Sa stays at 220 Hz/);
        }
        await page.locator("#start").selectOption("1");
        await page.locator('input[value="madhyama"]').check();
        assert.match(
          await page.locator("#retune-result").textContent(),
          /Pa moved; the other six notes stayed/,
        );
        await page.locator("#model").focus();
        await page.locator("#model").selectOption("equal");
        assert.equal(await page.evaluate(() => document.activeElement.id), "model");
        assert.match(await page.locator("#lowering-comparison").textContent(), /54\.545/);
        await page.locator("#base").fill("432");
        await page.locator("#base").press("Enter");
        assert.match(await page.locator("#order-description").textContent(), /432 Hz/);
        await page.locator("#base").fill("999");
        await page.locator("#apply-base").click();
        assert.match(await page.locator("#order-description").textContent(), /432 Hz/);
        await page.locator("#base").fill("220");
        await page.locator("#base").press("Enter");
        // Native file reopening is strict and does not replace the current pose on failure.
        const jsonBytes = await save(page, "#save-json", path.join(directory, "comparison.json"));
        const saved = JSON.parse(jsonBytes);
        assert.deepEqual(saved.pose, { grama: "madhyama", start: 1, model: "equal", base: 220 });
        await page.locator("#open-json").setInputFiles({
          name: "invalid.json",
          mimeType: "application/json",
          buffer: Buffer.from(JSON.stringify({ ...saved, frequencies: [1, 2] })),
        });
        await page
          .locator("#file-status")
          .filter({ hasText: /current comparison was kept/ })
          .waitFor();
        assert.equal(await page.locator("#model").inputValue(), "equal");
        await page.locator("#model").selectOption("ratios");
        await page.locator("#open-json").setInputFiles(path.join(directory, "comparison.json"));
        await page
          .locator("#file-status")
          .filter({ hasText: /Reopened the comparison/ })
          .waitFor();
        assert.equal(await page.locator("#model").inputValue(), "equal");
        const share = page.url();
        await page.locator("#share").click();
        await page
          .locator("#file-status")
          .filter({ hasText: /Copied the comparison link|Copy this comparison link/ })
          .waitFor();
        const fallback = page.getByRole("textbox", { name: "Comparison link" });
        if (await fallback.count()) assert.equal(await fallback.inputValue(), share);
        await page.getByRole("link", { name: "Sanskrit", exact: true }).click();
        assert.equal(page.url(), share, "reading navigation preserves comparison URL");
        const second = await context.newPage();
        await second.goto(share);
        assert.equal(await second.locator("#start").inputValue(), "1");
        assert.equal(await second.locator("#model").inputValue(), "equal");
        await second.close();
        for (let i = 0; i < 8; i++) {
          await page.locator("#passage").selectOption(String(i));
          assert((await page.locator("#passage-text .deva").textContent()).length > 20);
          const words = page.locator("#passage-text button[data-word]");
          for (let j = 0; j < (await words.count()); j++) {
            await words.nth(j).focus();
            await words.nth(j).press("Enter");
            await page.locator("#word-note").waitFor({ state: "visible" });
            assert.equal(await words.nth(j).getAttribute("aria-expanded"), "true");
          }
        }
        let sourceHashes = 0;
        for (const p of manifest.pages) {
          await page.locator("#source-page").selectOption(p.file);
          await page.waitForFunction(() => {
            const img = document.querySelector("#scan");
            return img.complete && img.naturalWidth > 0;
          });
          const actual = await page.evaluate(async (file) => {
            const b = await (await fetch(new URL(file, location.href))).arrayBuffer();
            return Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", b)), (v) =>
              v.toString(16).padStart(2, "0"),
            ).join("");
          }, p.file);
          assert.equal(actual, p.sha256);
          sourceHashes++;
        }
        await page.locator("#passage").selectOption("2");
        await page.locator("#reading").scrollIntoViewIfNeeded();
        await page.screenshot({ path: path.join(directory, "sanskrit.png") });
        const axe = await new AxeBuilder({ page }).analyze();
        assert.deepEqual(
          axe.violations.map((v) => ({ id: v.id, nodes: v.nodes.map((n) => n.target) })),
          [],
        );
        const equalWave = await save(
          page,
          "#save-wav",
          path.join(directory, "equal-comparison.wav"),
        );
        assert.notEqual(hash(originalWave), hash(equalWave));
        const csv = await save(page, "#save-csv", path.join(directory, "pitches.csv"));
        assert.match(csv.toString(), /model=equal/);
        assert.equal(csv.toString().trim().split("\n").length, 17);
        const svg = await save(page, "#save-svg", path.join(directory, "counts.svg"));
        assert.match(svg.toString(), /ordinal counts/);
        assert(!svg.toString().includes("<script"));
        // Save must capture before async source loading, even when controls change immediately.
        const pending = page.waitForEvent("download");
        await page.locator("#save-reading").click();
        await page.locator("#model").selectOption("ratios");
        await page.locator("#start").selectOption("6");
        const readingPath = path.join(directory, "reading.html");
        await (await pending).saveAs(readingPath);
        const html = await readFile(readingPath, "utf8");
        assert(!/<script\b|\son\w+=/i.test(html));
        assert.match(html, /Madhyama-grāma; begin at Re; Sa = 220 Hz; 22 equal divisions/);
        const sources = [...html.matchAll(/<img src="data:image\/jpeg;base64,([^"]+)"/g)];
        assert.equal(sources.length, 11);
        sources.forEach((m, i) => {
          assert.equal(hash(Buffer.from(m[1], "base64")), manifest.pages[i].sha256);
        });
        const embeddedJSON =
          /download="grama-comparison.json" href="data:application\/json;base64,([^"]+)"/.exec(
            html,
          );
        assert(embeddedJSON);
        assert.deepEqual(JSON.parse(Buffer.from(embeddedJSON[1], "base64")), saved);
        const portableContext = await browser.newContext({ viewport: { width, height: 1000 } }),
          portable = await portableContext.newPage(),
          remote = [];
        portable.on("request", (r) => {
          if (/^https?:/.test(r.url())) remote.push(r.url());
        });
        await portable.goto(pathToFileURL(readingPath).href);
        await portable.evaluate(() => document.fonts.ready);
        assert.equal(await portable.locator("img").count(), 11);
        assert(
          await portable
            .locator("img")
            .evaluateAll((imgs) => imgs.every((i) => i.complete && i.naturalWidth > 0)),
        );
        assert.equal(await portable.locator("article").count(), 8);
        await fits(portable);
        const embeddedWav = await portable.locator("audio").getAttribute("src");
        assert.equal(hash(Buffer.from(embeddedWav.split(",")[1], "base64")), hash(equalWave));
        const portableSVG = await portable.locator("svg").count();
        assert.equal(portableSVG, 2);
        await portable.screenshot({ path: path.join(directory, "portable.png") });
        if (name === "chromium" && width === 1440)
          await portable.pdf({
            path: path.join(directory, "reading.pdf"),
            printBackground: true,
            preferCSSPageSize: true,
          });
        assert.deepEqual(remote, []);
        await portableContext.close();
        // Use the complete service worker edition with no reachable local origin.
        if (!hosted) server.offline();
        await context.setOffline(true);
        await page.reload();
        await page
          .locator("#offline-status")
          .filter({ hasText: /Ready offline/ })
          .waitFor();
        await page.locator('input[value="madhyama"]').check();
        await page.locator("#model").selectOption("equal");
        await page.locator("#passage").selectOption("6");
        await page.locator("#source-page").selectOption("sources/natya-302.jpg");
        await page.waitForFunction(() => {
          const i = document.querySelector("#scan");
          return i.complete && i.naturalWidth > 0;
        });
        const offlineWav = await save(page, "#save-wav", path.join(directory, "offline.wav"));
        assert.equal(hash(offlineWav), hash(equalWave));
        const offlineReading = await save(
          page,
          "#save-reading",
          path.join(directory, "offline-reading.html"),
        );
        assert(offlineReading.length > 5000000);
        await page.locator("#bench").scrollIntoViewIfNeeded();
        await page.screenshot({ path: path.join(directory, "bench.png") });
        await fits(page);
        assert.deepEqual(errors, []);
        assert.deepEqual(external, []);
        report.configurations.push({
          browser: name,
          version: browser.version(),
          width,
          startsExercised: 7,
          passagesRead: 8,
          sourceHashesVerified: sourceHashes,
          keyboardWordNotes: true,
          nativeReopenAndRejection: true,
          saveCapturesClickPose: true,
          liveAudioPcmMatchesWav: true,
          liveAudio: originalAudio,
          ratioWavSha256: hash(originalWave),
          equalWavSha256: hash(equalWave),
          readingSha256: hash(Buffer.from(html)),
          axeViolations: axe.violations.length,
          offlineOriginDisabled: !hosted,
          offlineNativeReading: true,
          portableRemoteRequests: remote,
          pageErrors: errors,
          externalRequests: external,
        });
        console.log(
          `${name} ${width}: count/start/tuning, actual audio PCM, native files, 11 scans and ${hosted ? "browser-offline" : "origin-disabled offline"} workflows passed`,
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
await writeFile(path.join(output, "review.json"), `${JSON.stringify(report, null, 2)}\n`);
