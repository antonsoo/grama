import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { cp, mkdir, mkdtemp, readFile, symlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { chromium } from "playwright";

// Mutate only a throwaway copy. The application keeps one authoritative raw JSON.
await mkdir("/tmp/claude-1000", { recursive: true });
const root = process.cwd(),
  folder = await mkdtemp("/tmp/claude-1000/grama-source-json-"),
  out = process.argv[2] ?? path.join(folder, "review.json");
for (const file of [
  "src",
  "public",
  "index.html",
  "tuning.html",
  "vite.config.ts",
  "tsconfig.json",
  "package.json",
  "package-lock.json",
])
  await cp(file, path.join(folder, file), { recursive: true });
await symlink(path.join(root, "node_modules"), path.join(folder, "node_modules"), "dir");
const originalMain = await readFile(path.join(folder, "src/main.ts"), "utf8");
await writeFile(
  path.join(folder, "src/main.ts"),
  originalMain.replace('"virtual:grama-sources"', '"../public/sources/manifest.json"'),
);
const child = spawn(
  process.execPath,
  [
    path.join(root, "node_modules/vite/bin/vite.js"),
    "--host",
    "127.0.0.1",
    "--port",
    "4395",
    "--strictPort",
  ],
  { cwd: folder, stdio: ["ignore", "pipe", "pipe"] },
);
let log = "";
child.stdout.on("data", (data) => {
  log += data;
});
child.stderr.on("data", (data) => {
  log += data;
});
const browser = await chromium.launch(),
  page = await browser.newPage();
const errors = [];
page.on("pageerror", (error) => errors.push(String(error)));
try {
  for (let attempt = 0; attempt < 100 && !log.includes("http://127.0.0.1:4395"); attempt++)
    await new Promise((r) => setTimeout(r, 50));
  const base = "http://127.0.0.1:4395/grama/";
  await page.goto(base);
  await page.waitForTimeout(300);
  const reproduced = /Assets in public directory cannot be imported from JavaScript/.test(log);
  assert(reproduced, `Expected the original development diagnostic. Actual log: ${log}`);
  await writeFile(path.join(folder, "src/main.ts"), originalMain);
  // Errors from the intentionally broken baseline are expected; none may remain
  // after switching back to the actual virtual import.
  errors.length = 0;
  await page.reload();
  await page.locator("#source-page option").first().waitFor({ state: "attached" });
  const manifestPath = path.join(folder, "public/sources/manifest.json"),
    original = await readFile(manifestPath, "utf8"),
    manifest = JSON.parse(original);
  const caption = manifest.pages[0].caption;
  manifest.pages[0].caption = "Controlled source edit: retained JSON reload";
  await writeFile(manifestPath, JSON.stringify(manifest, null, 2));
  await page.waitForFunction(() =>
    document.querySelector("#source-page option")?.textContent.includes("Controlled source edit"),
  );
  const raw = await (await page.request.get(new URL("sources/manifest.json", base).href)).json();
  assert.equal(raw.pages[0].caption, manifest.pages[0].caption);
  await writeFile(manifestPath, original);
  await page.waitForFunction(
    (expected) => document.querySelector("#source-page option")?.textContent.includes(expected),
    caption,
  );
  assert.deepEqual(
    await (await page.request.get(new URL("sources/manifest.json", base).href)).json(),
    JSON.parse(original),
  );
  assert.deepEqual(errors, []);
  const report = {
    checkedAt: new Date().toISOString(),
    scope: "Isolated development fixture; no live-checkout source edits",
    originalPublicImportWarningReproduced: true,
    virtualModuleReloadedOnSourceEdit: true,
    rawDownloadMatchesSameJSON: true,
    sourceRestorationReloaded: true,
    pageErrorsAfterFix: errors,
  };
  await mkdir(path.dirname(out), { recursive: true });
  await writeFile(out, `${JSON.stringify(report, null, 2)}\n`);
  console.log(JSON.stringify(report, null, 2));
} finally {
  await browser.close();
  child.kill();
}
