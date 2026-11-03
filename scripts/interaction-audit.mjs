import assert from "node:assert/strict";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import AxeBuilder from "@axe-core/playwright";
import { chromium, firefox } from "playwright";
import { reviewServer } from "./review-server.mjs";

const out = path.resolve(process.argv[2] ?? "/tmp/claude-1000/grama-interaction-audit");
await mkdir(out, { recursive: true });
const report = {
  checkedAt: new Date().toISOString(),
  scope:
    "Real native Web Audio nodes with delayed resume outcomes and explicit lifecycle faults; native reading downloads opened from local files. Pagehide is dispatched deliberately, not a claim about physical OS interruptions.",
  cases: [],
};
for (const [name, type] of [
  ["chromium", chromium],
  ["firefox", firefox],
]) {
  const browser = await type.launch();
  try {
    for (const width of [1440, 375]) {
      for (const family of [false, true]) {
        const kind = family ? "family" : "bench",
          folder = path.join(out, `${name}-${width}-${kind}`);
        await mkdir(folder, { recursive: true });
        const server = await reviewServer(),
          context = await browser.newContext({
            viewport: { width, height: 1000 },
            serviceWorkers: "block",
            reducedMotion: "reduce",
          });
        await context.addInitScript(() => {
          window.audit = {
            contexts: [],
            nodes: [],
            holdNext: false,
            pending: null,
            failStart: false,
          };
          const resume = AudioContext.prototype.resume,
            create = AudioContext.prototype.createBufferSource;
          AudioContext.prototype.resume = async function (...args) {
            if (!window.audit.contexts.includes(this)) window.audit.contexts.push(this);
            await resume.apply(this, args);
            if (window.audit.holdNext) {
              window.audit.holdNext = false;
              await new Promise((resolve, reject) => {
                window.audit.pending = { resolve, reject };
              });
            }
          };
          AudioContext.prototype.createBufferSource = function (...args) {
            const source = create.apply(this, args),
              record = { started: false, stopped: false },
              start = source.start,
              stop = source.stop;
            window.audit.nodes.push(record);
            source.start = function (...a) {
              if (window.audit.failStart) {
                window.audit.failStart = false;
                throw new DOMException("Injected unavailable source", "InvalidStateError");
              }
              const result = start.apply(this, a);
              record.started = true;
              return result;
            };
            source.stop = function (...a) {
              const result = stop.apply(this, a);
              record.stopped = true;
              return result;
            };
            return source;
          };
        });
        const page = await context.newPage(),
          errors = [];
        page.on("pageerror", (error) => errors.push(String(error)));
        try {
          await page.goto(server.base + (family ? "tuning.html" : ""));
          const first = family ? "#hear-current" : "#hear-scale",
            second = family ? "#hear-compare" : "#hear-context";
          await page.evaluate(() => {
            window.audit.holdNext = true;
          });
          await page.locator(first).click();
          await page.waitForFunction(() => window.audit.pending);
          await page.locator(second).click();
          await page.waitForFunction(() => window.audit.nodes.some((n) => n.started));
          await page.evaluate(() => {
            window.audit.pending.reject(new Error("Earlier resume failed"));
            window.audit.pending = null;
          });
          await page.waitForTimeout(80);
          assert(
            await page.evaluate(
              () => window.audit.nodes.at(-1).started && !window.audit.nodes.at(-1).stopped,
            ),
          );
          assert(!/could not start/.test(await page.locator("#sound-status").textContent()));
          // Both Stop and edits must cancel a successful but delayed old resume.
          for (const action of ["stop", "edit"]) {
            const starts = await page.evaluate(
              () => window.audit.nodes.filter((n) => n.started).length,
            );
            await page.evaluate(() => {
              window.audit.holdNext = true;
            });
            await page.locator(first).click();
            await page.waitForFunction(() => window.audit.pending);
            if (action === "stop") await page.locator("#stop").click();
            else if (family) {
              await page.locator("#two").focus();
              await page.keyboard.press("ArrowRight");
            } else await page.locator("#model").selectOption("equal");
            await page.evaluate(() => {
              window.audit.pending.resolve();
              window.audit.pending = null;
            });
            await page.waitForTimeout(50);
            assert.equal(
              await page.evaluate(() => window.audit.nodes.filter((n) => n.started).length),
              starts,
            );
          }
          // Suspending a real context stops its source; it must not resume by itself.
          await page.locator(second).click();
          await page.waitForFunction(() => window.audit.nodes.at(-1)?.started);
          await page.evaluate(() => window.audit.contexts.at(-1).suspend());
          await page
            .locator("#sound-status")
            .filter({ hasText: /interrupted/ })
            .waitFor();
          assert(await page.evaluate(() => window.audit.nodes.at(-1).stopped));
          await page.locator(second).click();
          await page.waitForFunction(() => !window.audit.nodes.at(-1).stopped);
          const contexts = await page.evaluate(() => window.audit.contexts.length);
          await page.evaluate(() => window.audit.contexts.at(-1).close());
          await page
            .locator("#sound-status")
            .filter({ hasText: /interrupted/ })
            .waitFor();
          await page.locator(second).click();
          await page.waitForFunction(
            (expected) => window.audit.contexts.length === expected + 1,
            contexts,
          );
          // Dispatch pagehide while resume waits, then create a fresh context.
          await page.evaluate(() => {
            window.audit.holdNext = true;
          });
          await page.locator(first).click();
          await page.waitForFunction(() => window.audit.pending);
          await page.evaluate(() => window.dispatchEvent(new PageTransitionEvent("pagehide")));
          await page.locator(second).click();
          await page.waitForFunction(() => !window.audit.nodes.at(-1).stopped);
          await page.evaluate(() => {
            window.audit.pending.reject(new Error("Old hidden-page resume"));
            window.audit.pending = null;
          });
          await page.waitForTimeout(50);
          assert(await page.evaluate(() => !window.audit.nodes.at(-1).stopped));
          // A source-start failure cannot be followed by stop() on an unstarted node.
          await page.evaluate(() => {
            window.audit.failStart = true;
          });
          await page.locator(first).click();
          await page
            .locator("#sound-status")
            .filter({ hasText: /could not start/ })
            .waitFor();
          await page.locator(second).click();
          await page.waitForFunction(() => window.audit.nodes.at(-1).started);
          await page.locator("#stop").click();
          await page.locator("#base").fill("220.5");
          await page.locator(family ? "#set-base" : "#apply-base").click();
          assert.equal(await page.locator("#base").inputValue(), "220.5");
          const valid = page.url();
          for (const bad of family
            ? ["a=999", `${valid.split("#")[1]}&a=230`]
            : [
                "hz=432",
                "g=sadja&m=equal&hz=220",
                `${valid.split("#")[1]}&s=1`,
                `${valid.split("#")[1]}&extra=1`,
              ]) {
            await page.evaluate((hash) => {
              location.hash = hash;
            }, bad);
            await page
              .locator("#file-status")
              .filter({ hasText: /Invalid.*link/ })
              .waitFor();
            assert.equal(await page.locator("#base").inputValue(), "220.5");
          }
          await page.goto(valid);
          if (family) {
            await page.locator("#preset-failed").click();
            for (const [id, value] of [
              ["four", "180"],
              ["two", "60"],
            ])
              await page.locator(`#${id}`).evaluate((input, value) => {
                input.value = value;
                input.dispatchEvent(new Event("input", { bubbles: true }));
              }, value);
            assert.match(await page.locator("#family-ruler").textContent(), /RAISED Pa \(failed\)/);
            assert.match(
              await page.locator("#comparison-summary").textContent(),
              /raises Pa by 90\.000 cents/,
            );
          }
          const download = page.waitForEvent("download");
          await page.locator("#save-reading").click();
          const file = path.join(folder, "reading.html");
          await (await download).saveAs(file);
          const html = await readFile(file, "utf8");
          if (family) assert.match(html, /Pa rises by 90\.000000 cents/);
          const portable = await context.newPage();
          await portable.goto(pathToFileURL(file).href);
          await portable.evaluate(() => document.fonts.ready);
          assert(
            await portable.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1),
          );
          const region = portable.locator(family ? ".instrument" : ".figure-scroll").first();
          await region.focus();
          const before = await region.evaluate((node) => node.scrollLeft);
          await portable.keyboard.press("ArrowRight");
          if (width < 650) {
            await portable.waitForFunction(
              (selector) => document.querySelector(selector).scrollLeft > 0,
              family ? ".instrument" : ".figure-scroll",
            );
            assert((await region.evaluate((node) => node.scrollLeft)) > before);
          }
          const letters = await portable
            .locator(family ? ".instrument svg text" : ".figure-scroll svg text")
            .first()
            .evaluate((node) => ({
              fontPixels: parseFloat(getComputedStyle(node).fontSize) * node.getScreenCTM().a,
              box: node.getBoundingClientRect().height,
            }));
          assert(
            letters.fontPixels >= 12,
            `native diagram text remains readable: ${JSON.stringify(letters)}`,
          );
          await region.evaluate((node) => {
            node.scrollLeft = 0;
            node.scrollIntoView({ block: "start" });
          });
          await portable.screenshot({ path: path.join(folder, "portable-diagram.png") });
          const axe = await new AxeBuilder({ page: portable }).analyze();
          assert.deepEqual(
            axe.violations.map((v) => ({ id: v.id, nodes: v.nodes.map((n) => n.target) })),
            [],
          );
          await portable.close();
          assert.deepEqual(errors, []);
          report.cases.push({
            browser: name,
            version: browser.version(),
            width,
            page: kind,
            staleResumeRejectionPreservesNewSound: true,
            delayedSuccessCancelledByStopAndEdit: true,
            nativeContextSuspendStopsSource: true,
            closedContextRecreated: true,
            pagehideDisposesContext: true,
            unstartedSourceFailureHandled: true,
            invalidLinksPreserveSettings: true,
            fractionalReferenceAccepted: true,
            failedCandidateLabelsFollowActualMovement: family,
            portableKeyboardScrolling: true,
            nativeDiagramTextPixels: letters.fontPixels,
            portableAxeViolations: 0,
            pageErrors: errors,
          });
          console.log(
            `${name} ${width} ${kind}: audio request ownership, context recovery, links and readable keyboard-scrollable reading passed`,
          );
        } finally {
          await context.close();
          await server.close();
        }
      }
    }
  } finally {
    await browser.close();
  }
}
await writeFile(path.join(out, "review.json"), `${JSON.stringify(report, null, 2)}\n`);
