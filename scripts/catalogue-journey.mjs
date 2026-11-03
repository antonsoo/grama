import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { chromium, firefox } from "playwright";

const output = path.resolve(process.argv[2] ?? "/tmp/grama-catalogue-journey"),
  reviewRevision = process.argv[3];
assert.match(reviewRevision ?? "", /^[a-f0-9]{40}$/);
await mkdir(output, { recursive: true });
const results = [];
for (const [name, type] of [
  ["chromium", chromium],
  ["firefox", firefox],
]) {
  const browser = await type.launch();
  try {
    for (const width of [1440, 375]) {
      const context = await browser.newContext({
          viewport: { width, height: 1000 },
          reducedMotion: "reduce",
        }),
        page = await context.newPage();
      try {
        await page.goto("https://antonsoo.github.io/officina/");
        await page.locator("#tool-search").fill("Bharata");
        const card = page.locator('[data-project="grama"]');
        await card.waitFor({ state: "visible" });
        const oldReview = await card.locator('a[href*="/blob/"]').first().getAttribute("href");
        assert.match(oldReview, /\/blob\/[a-f0-9]{40}\//);
        await card.locator("[data-project-demo]").click();
        await page
          .locator("#offline-status")
          .filter({ hasText: /Ready offline/ })
          .waitFor({ timeout: 60000 });
        await page.getByRole("link", { name: /Find another tuning/ }).click();
        await page.locator("#four").waitFor();
        await page.locator("#lock").check();
        const before = Number(await page.locator("#two").inputValue());
        await page.locator("#two").focus();
        await page.keyboard.press("Shift+ArrowRight");
        assert.equal(Number(await page.locator("#two").inputValue()), before + 10);
        assert.match(await page.locator("#constraints").textContent(), /4\/3|fourth/);
        await page.locator("#source-page").selectOption("86");
        await page.locator("#scan").waitFor({ state: "visible" });
        const sourceHash = await page
          .locator("#scan")
          .evaluate(async (image) =>
            Array.from(
              new Uint8Array(
                await crypto.subtle.digest("SHA-256", await (await fetch(image.src)).arrayBuffer()),
              ),
              (b) => b.toString(16).padStart(2, "0"),
            ).join(""),
          );
        const expected = JSON.parse(
          await readFile("public/sources/manifest.json", "utf8"),
        ).pages.find((p) => p.file === "sources/grosset-86.jpg").sha256;
        assert.equal(sourceHash, expected);
        const file = path.join(output, `${name}-${width}-tuning.json`),
          download = page.waitForEvent("download");
        await page.locator("#save-json").click();
        await (await download).saveAs(file);
        assert.equal(JSON.parse(await readFile(file, "utf8")).format, "grama-tuning-family-v1");
        const pinned = `https://github.com/antonsoo/grama/blob/${reviewRevision}/docs/audit.md`;
        await page.goto(pinned);
        await page
          .getByRole("heading", {
            name: "Operated audit of the count bench and tuning family",
            exact: true,
          })
          .waitFor();
        const raw = `https://raw.githubusercontent.com/antonsoo/grama/${reviewRevision}/docs/audit.md`,
          body = Buffer.from(await (await page.request.get(raw)).body());
        assert.deepEqual(body, await readFile("docs/audit.md"));
        results.push({
          browser: name,
          width,
          query: "Bharata",
          catalogueReview: oldReview,
          newAudit: pinned,
          lockedCandidateOperated: true,
          nativeJSONDownloaded: true,
          printedUncertaintyPageSha256: sourceHash,
          pinnedAuditSha256: createHash("sha256").update(body).digest("hex"),
        });
        console.log(
          `${name} ${width}: public catalogue -> count bench -> tuning family -> operated lock -> verified scan -> native JSON -> pinned audit`,
        );
      } finally {
        await context.close();
      }
    }
  } finally {
    await browser.close();
  }
}
await writeFile(
  path.join(output, "review.json"),
  `${JSON.stringify({ checkedAt: new Date().toISOString(), scope: "Public continuous catalogue-to-workshop learning journey; old catalogue review remains pinned to its original edition, new audit opened at supplied immutable revision", results }, null, 2)}\n`,
);
