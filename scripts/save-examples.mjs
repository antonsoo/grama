import assert from "node:assert/strict";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { chromium } from "playwright";
import { reviewServer } from "./review-server.mjs";

const output = path.resolve(process.argv[2] ?? "/tmp/grama-native-examples");
await mkdir(output, { recursive: true });
const server = await reviewServer(),
  browser = await chromium.launch(),
  page = await browser.newPage();
async function save(id, name) {
  const event = page.waitForEvent("download");
  await page.locator(id).click();
  await (await event).saveAs(path.join(output, name));
}
try {
  await page.goto(server.base);
  await page
    .locator("#offline-status")
    .filter({ hasText: /Ready offline/ })
    .waitFor();
  for (const [id, name] of [
    ["json", "grama-comparison.json"],
    ["csv", "grama-pitch-comparison.csv"],
    ["svg", "grama-counts.svg"],
    ["wav", "grama-modern-comparison.wav"],
    ["reading", "grama-illustrated-reading.html"],
  ])
    await save(`#save-${id}`, name);
  await page.goto(`${server.base}tuning.html`);
  await page.locator("#preset-other").click();
  for (const [id, name] of [
    ["json", "tuning-family.json"],
    ["csv", "tuning-family.csv"],
    ["wav", "tuning-family.wav"],
  ])
    await save(`#save-${id}`, name);
  const portable = await browser.newPage();
  await portable.goto(pathToFileURL(path.join(output, "grama-illustrated-reading.html")).href);
  await portable.evaluate(async () => {
    await document.fonts.ready;
    await Promise.all([...document.images].map((img) => img.decode()));
  });
  assert.equal(await portable.locator(".source-page img").count(), 11);
  await portable.pdf({
    path: path.join(output, "grama-illustrated-reading.pdf"),
    format: "A4",
    printBackground: true,
  });
  const json = JSON.parse(await readFile(path.join(output, "grama-comparison.json"), "utf8"));
  assert.equal(json.format, "grama-comparison-v3");
  assert.match(json.notice, /PolyForm/);
  await writeFile(
    path.join(output, "review.json"),
    `${JSON.stringify({ checkedAt: new Date().toISOString(), scope: "Native application downloads, default count bench and different whole-gap candidate; portable HTML printed by Chromium after all eleven images and embedded fonts decode", files: ["grama-comparison.json", "grama-pitch-comparison.csv", "grama-counts.svg", "grama-modern-comparison.wav", "grama-illustrated-reading.html", "grama-illustrated-reading.pdf", "tuning-family.json", "tuning-family.csv", "tuning-family.wav"] }, null, 2)}\n`,
  );
  console.log("Current native examples and portable-reading PDF saved.");
} finally {
  await browser.close();
  await server.close();
}
