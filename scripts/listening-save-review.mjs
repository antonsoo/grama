import assert from "node:assert/strict";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { chromium, firefox } from "playwright";
import { reviewServer } from "./review-server.mjs";

const out = path.resolve(process.argv[2] ?? "/tmp/claude-1000/grama-listening-save");
await mkdir(out, { recursive: true });
const report = {
  scope:
    "Local production with real response bodies deliberately stalled at 128 bytes; native downloads and cancellation. Service workers blocked to isolate the foreground reading save.",
  cases: [],
};
for (const [name, engine] of [
  ["chromium", chromium],
  ["firefox", firefox],
]) {
  const server = await reviewServer(),
    browser = await engine.launch();
  const context = await browser.newContext({ serviceWorkers: "block" });
  const page = await context.newPage();
  const node = (id) => page.locator(`#listening-${id}`);
  try {
    await page.goto(`${server.base}tuning.html#listening`);
    await node("example").click();
    await node("stimulus").selectOption("ma");
    await node("start").click();
    await node("reveal").click();
    let release;
    const stall = () => {
      const promise = new Promise((resolve) => {
        release = resolve;
      });
      server.faults.set("sources/grosset-28.jpg", { stall: true, release: promise });
    };
    async function stalledSince(offset) {
      const deadline = Date.now() + 10000;
      while (
        !server.requests
          .slice(offset)
          .some((r) => r.pathname.endsWith("grosset-28.jpg") && r.bytes === 128)
      ) {
        assert(Date.now() < deadline, "foreground source request must reach the stalled body");
        await new Promise((r) => setTimeout(r, 25));
      }
    }
    stall();
    let offset = server.requests.length;
    const download = page.waitForEvent("download");
    await node("reading").click();
    await stalledSince(offset);
    await node("clear").click();
    assert(await node("reading").isDisabled());
    await node("example").click();
    await node("start").click();
    await node("reveal").click();
    assert(
      await node("reading").isDisabled(),
      "a new result cannot reenable a save already in flight",
    );
    release();
    const file = path.join(out, `${name}-captured-study.html`);
    await (await download).saveAs(file);
    await node("file-status")
      .filter({ hasText: /^Saved/ })
      .waitFor();
    const saved = await context.newPage();
    await saved.goto(pathToFileURL(file).href);
    assert.equal(await saved.locator("#listening-record article").count(), 1);
    assert.match(await saved.locator("#listening-record article").textContent(), /Ma control/);
    assert.doesNotMatch(
      await saved.locator("#listening-record article").textContent(),
      /Lowered Pa/,
    );
    await saved.close();
    assert.match(await node("history").textContent(), /Lowered Pa/);
    // Cancellation preserves the current record and produces no file.
    stall();
    offset = server.requests.length;
    let unexpectedDownload = false;
    const observe = () => {
      unexpectedDownload = true;
    };
    page.on("download", observe);
    await node("reading").click();
    await stalledSince(offset);
    await page.getByRole("button", { name: "Cancel reading save", exact: true }).last().click();
    await node("file-status")
      .filter({ hasText: /cancelled/ })
      .waitFor();
    release();
    await page.waitForTimeout(200);
    page.off("download", observe);
    assert.equal(unexpectedDownload, false);
    assert.match(await node("history").textContent(), /Lowered Pa/);
    // Clearing during a save leaves export disabled when that save finishes.
    stall();
    offset = server.requests.length;
    const finalDownload = page.waitForEvent("download");
    await node("reading").click();
    await stalledSince(offset);
    await node("clear").click();
    release();
    await (await finalDownload).saveAs(path.join(out, `${name}-before-clear.html`));
    await node("file-status")
      .filter({ hasText: /^Saved/ })
      .waitFor();
    assert(await node("reading").isDisabled());
    assert.equal(await node("history").textContent(), "");
    await page.locator("#preset-failed").click();
    await node("start").click();
    await node("reveal").click();
    assert.match(await node("result").textContent(), /lower Pa fails; ordered whole gaps fails/);
    report.cases.push({
      browser: name,
      failedCandidateChecksVisible: true,
      capturePreservedAcrossClearAndNewResult: true,
      busyButtonStayedDisabled: true,
      cancellationWithoutDownload: true,
      emptyRecordExportRemainedDisabledAfterSave: true,
      capturedBytes: (await readFile(file)).length,
    });
    console.log(`${name}: stalled save snapshots, cancellation and export eligibility passed`);
  } finally {
    await context.close();
    await browser.close();
    await server.close();
  }
}
await writeFile(path.join(out, "report.json"), `${JSON.stringify(report, null, 2)}\n`);
