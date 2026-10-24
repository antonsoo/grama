import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const base = process.argv[2],
  sourceRevision = process.argv[3],
  pagesRevision = process.argv[4];
assert.match(base ?? "", /^https:\/\/.+\/$/);
assert.match(sourceRevision ?? "", /^[a-f0-9]{40}$/);
assert.match(pagesRevision ?? "", /^[a-f0-9]{40}$/);
const output = process.argv[5] ?? "/tmp/grama-public-files.json";
const digest = (bytes) => createHash("sha256").update(bytes).digest("hex");
async function filesIn(directory) {
  return (
    await Promise.all(
      (
        await readdir(directory, { withFileTypes: true })
      ).map((entry) => {
        const file = path.join(directory, entry.name);
        return entry.isDirectory() ? filesIn(file) : [file];
      }),
    )
  )
    .flat()
    .sort();
}
const files = await Promise.all(
  (await filesIn("dist")).map(async (file) => {
    const bytes = await readFile(file);
    return {
      file: path.relative("dist", file).split(path.sep).join("/"),
      bytes: bytes.length,
      sha256: digest(bytes),
    };
  }),
);
const index = files.find((f) => f.file === "index.html");
assert(index);
async function inspect(file) {
  const controller = new AbortController(),
    timeout = setTimeout(() => controller.abort(), 20000);
  try {
    const response = await fetch(base + file.file, {
      cache: "no-store",
      signal: controller.signal,
    });
    const bytes = Buffer.from(await response.arrayBuffer()),
      sha256 = digest(bytes);
    return {
      ...file,
      status: response.status,
      actualBytes: bytes.length,
      actualSha256: sha256,
      matches: response.ok && sha256 === file.sha256,
    };
  } catch (error) {
    return { ...file, matches: false, error: String(error) };
  } finally {
    clearTimeout(timeout);
  }
}
const directoryBefore = await inspect({ ...index, file: "" });
const records = [];
for (let start = 0; start < files.length; start += 8)
  records.push(...(await Promise.all(files.slice(start, start + 8).map(inspect))));
const directoryAfter = await inspect({ ...index, file: "" });
const mismatches = [directoryBefore, ...records, directoryAfter].filter((file) => !file.matches);
const report = {
  checkedAt: new Date().toISOString(),
  scope:
    "Canonical HTTPS URLs without query cache-busting; every current build file plus directory index before and after. Extra historical hashed assets are outside this inventory.",
  base,
  sourceRevision,
  pagesRevision,
  directoryBefore,
  directoryAfter,
  files: records,
  mismatches,
};
await writeFile(output, `${JSON.stringify(report, null, 2)}\n`);
assert.equal(
  mismatches.length,
  0,
  `Unmatched hosted files: ${mismatches.map((f) => f.file || "/").join(", ")}`,
);
console.log(`Matched ${records.length} canonical public files and both directory checks.`);
