import assert from "node:assert/strict";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import AxeBuilder from "@axe-core/playwright";
import { chromium, firefox } from "playwright";
import { reviewServer } from "./review-server.mjs";

const out = path.resolve(process.argv[2] ?? "/tmp/claude-1000/grama-attachment");
const hosted = process.argv[3];
if (hosted) assert.match(hosted, /^https:\/\/.+\/$/);
await mkdir(out, { recursive: true });
const manifest = JSON.parse(await readFile("public/sources/manifest.json", "utf8"));
const report = {
  scope: hosted
    ? "Canonical HTTPS count-placement diagnostic; native audio and downloaded reading; browser networking disabled for offline test. No origin outage claim."
    : "Local production count-placement diagnostic; native audio, physical source hashes and actual downloaded files; origin refused for offline reload. Source response is deliberately stalled for snapshot verification.",
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
        context = await browser.newContext({
          viewport: { width, height: 1100 },
          reducedMotion: "reduce",
        }),
        page = await context.newPage(),
        errors = [];
      page.on("pageerror", (e) => errors.push(e.message));
      const folder = path.join(out, `${name}-${width}`);
      await mkdir(folder, { recursive: true });
      await context.addInitScript(() => {
        window.attachmentAudio = [];
        const create = AudioContext.prototype.createBufferSource;
        AudioContext.prototype.createBufferSource = function (...args) {
          const node = create.apply(this, args),
            start = node.start;
          node.start = function (...a) {
            const r = start.apply(this, a);
            window.attachmentAudio.push(Array.from(node.buffer.getChannelData(0)));
            return r;
          };
          return node;
        };
      });
      const base = hosted ?? server.base;
      async function save(id, file) {
        const d = page.waitForEvent("download");
        await page.locator(id).click();
        await (await d).saveAs(file);
        return readFile(file);
      }
      async function source(pageNumber) {
        const sourceImage = page.locator("#scan");
        await sourceImage.waitFor({ state: "visible" });
        await page.locator("#source-page").filter({ visible: true }).waitFor();
        assert.equal(
          await page.locator("#source-page").inputValue(),
          `sources/grosset-${pageNumber}.jpg`,
        );
        const actual = await sourceImage.evaluate(async (image) =>
          Array.from(
            new Uint8Array(
              await crypto.subtle.digest("SHA-256", await (await fetch(image.src)).arrayBuffer()),
            ),
            (b) => b.toString(16).padStart(2, "0"),
          ).join(""),
        );
        assert.equal(
          actual,
          manifest.pages.find((p) => p.file === `sources/grosset-${pageNumber}.jpg`).sha256,
        );
      }
      try {
        await page.goto(`${base}?attachment=leaving`);
        await page
          .locator("#offline-status")
          .filter({ hasText: /Ready offline/ })
          .waitFor({ timeout: 60000 });
        await page.evaluate(() => document.fonts.ready);
        await page.locator('a[href="#attachment"]').click();
        assert.match(
          await page.locator("#attachment-finding").textContent(),
          /^Dha moves; Pa stays fixed/,
        );
        assert.match(
          await page.locator("#attachment-checks").textContent(),
          /Sa–Ma remains 4\/3 and Sa–Pa 3\/2/,
        );
        for (const model of ["ratios", "equal"]) {
          await page.locator("#model").selectOption(model);
          await page.locator("#base").fill("220.5");
          await page.locator("#apply-base").click();
          for (const placement of ["leaving", "arriving"]) {
            await page.locator("#attachment-select").selectOption(placement);
            await page.locator("#attachment-hear").click();
            await page
              .locator("#attachment-sound")
              .filter({
                hasText: placement === "leaving" ? /Dha moves; Pa stays fixed/ : /^Pa moves/,
              })
              .waitFor({ timeout: 15000 });
            const label = `${placement}-${model}`;
            const pcm = await page.evaluate(() => window.attachmentAudio.at(-1));
            await writeFile(
              path.join(folder, `${label}.f32`),
              Buffer.from(new Float32Array(pcm).buffer),
            );
            await save("#attachment-wav", path.join(folder, `${label}.wav`));
            await save("#attachment-csv", path.join(folder, `${label}.csv`));
            const svg = (
              await save("#attachment-svg", path.join(folder, `${label}.svg`))
            ).toString();
            assert.match(svg, placement === "leaving" ? /misreading/ : /Pa moves under incoming/);
            const file = path.join(folder, `${label}.json`);
            await save("#save-json", file);
            const data = JSON.parse(await readFile(file, "utf8"));
            assert.equal(data.format, "grama-comparison-v3");
            assert.equal(data.attachment, placement);
            await page
              .locator("#attachment-select")
              .selectOption(placement === "leaving" ? "arriving" : "leaving");
            await page.locator("#open-json").setInputFiles(file);
            await page
              .locator("#file-status")
              .filter({ hasText: /^Reopened/ })
              .waitFor();
            assert.equal(await page.locator("#attachment-select").inputValue(), placement);
          }
        }
        await page.locator("#model").selectOption("ratios");
        await page.locator("#attachment-select").selectOption("leaving");
        await page.locator("#attachment-instruction").click();
        await source(28);
        await page.locator("#attachment-source").click();
        await source(29);
        await page
          .locator("#attachment")
          .getByText("Inspect every note frequency", { exact: true })
          .click();
        assert.equal(await page.locator("#attachment-table tbody tr.pa th").textContent(), "Dha");
        await page.locator("#attachment-table").focus();
        await page.keyboard.press("ArrowRight");
        if (width === 375)
          await page.waitForFunction(
            () => document.querySelector("#attachment-table").scrollLeft > 0,
          );
        assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
        const axe = await new AxeBuilder({ page })
          .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
          .analyze();
        assert.deepEqual(axe.violations, []);
        await page.locator("#attachment").evaluate((e) => e.scrollIntoView({ block: "start" }));
        await page.screenshot({ path: path.join(folder, "diagnostic.png") });
        // Capture the deliberate misreading, then change the live control before source loading finishes.
        let release;
        if (!hosted) {
          await page.evaluate(async () => {
            const key = (await caches.keys()).find((k) => k.startsWith("grama-"));
            await (await caches.open(key)).delete(new URL("sources/grosset-28.jpg", location.href));
          });
          const held = new Promise((resolve) => {
            release = resolve;
          });
          server.faults.set("sources/grosset-28.jpg", { stall: true, release: held });
        }
        const file = path.join(folder, "placement-reading.html"),
          pending = page.waitForEvent("download");
        await page.locator("#save-reading").click();
        if (!hosted) {
          const deadline = Date.now() + 10000;
          while (
            !server.requests.some(
              (r) => r.url.endsWith("grosset-28.jpg") && r.bytes === 128 && !r.finished,
            )
          ) {
            assert(Date.now() < deadline);
            await new Promise((r) => setTimeout(r, 25));
          }
        }
        await page.locator("#attachment-select").selectOption("arriving");
        if (release) release();
        await (await pending).saveAs(file);
        const html = await readFile(file, "utf8");
        assert(!/<script\b/i.test(html));
        assert.match(html, /Count placement diagnostic: deliberate misreading/);
        assert.match(html, /Dha moves; Pa stays fixed/);
        const portable = await context.newPage();
        await portable.goto(pathToFileURL(file).href);
        await portable.evaluate(() => document.fonts.ready);
        assert(
          await portable.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1),
        );
        assert.equal(
          await portable
            .locator(".source-page img")
            .evaluateAll(
              (images) => images.filter((im) => im.complete && im.naturalWidth > 0).length,
            ),
          11,
        );
        const continuation = await portable
          .getByRole("link", { name: "Continue this comparison in the app", exact: true })
          .getAttribute("href");
        assert.equal(new URL(continuation).searchParams.get("attachment"), "leaving");
        const jsonDownload = portable.waitForEvent("download");
        await portable
          .getByRole("link", { name: "Download editable comparison JSON", exact: true })
          .click();
        const resumed = path.join(folder, "from-reading.json");
        await (await jsonDownload).saveAs(resumed);
        assert.equal(JSON.parse(await readFile(resumed, "utf8")).attachment, "leaving");
        await portable.close();
        if (!hosted) server.faults.delete("sources/grosset-28.jpg");
        await page.locator("#check-offline").click();
        if (await page.locator("#repair-offline").isVisible())
          await page.locator("#repair-offline").click();
        await page
          .locator("#offline-status")
          .filter({ hasText: /Ready offline/ })
          .waitFor({ timeout: 60000 });
        if (!hosted) server.offline();
        await context.setOffline(true);
        await page.reload();
        assert.equal(await page.locator("#attachment-select").inputValue(), "arriving");
        await page.locator("#open-json").setInputFiles(resumed);
        await page
          .locator("#file-status")
          .filter({ hasText: /^Reopened/ })
          .waitFor();
        assert.equal(await page.locator("#attachment-select").inputValue(), "leaving");
        await save("#save-reading", path.join(folder, "offline-placement-reading.html"));
        assert.deepEqual(errors, []);
        report.cases.push({
          browser: name,
          width,
          modernModels: 2,
          placements: 2,
          nativeSounds: 4,
          source28And29Verified: true,
          JSONAndLinksRetainPlacement: true,
          scriptFreeStudySnapshotKept: true,
          tableKeyboardAccessible: true,
          sourcePages: 11,
          offlineReopenAndExport: true,
          accessibilityViolations: 0,
          pageErrors: errors,
        });
        console.log(
          `${name} ${width}: wrong Dha/correct Pa, both modern models, native exports, source and offline recovery passed`,
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
