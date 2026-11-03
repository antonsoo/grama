import { createHash } from "node:crypto";
import { readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { defineConfig } from "vite";

const base = "/grama/";

async function filesIn(directory: string): Promise<string[]> {
  const entries = await readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(
    entries.map((entry) =>
      entry.isDirectory()
        ? filesIn(path.join(directory, entry.name))
        : Promise.resolve([path.join(directory, entry.name)]),
    ),
  );
  return nested.flat();
}

export default defineConfig(async ({ command }) => {
  const inputFiles = [
    ...(await filesIn("src")),
    ...(await filesIn("public")),
    "index.html",
    "tuning.html",
    "vite.config.ts",
    "tsconfig.json",
    "tsconfig.worker.json",
    "package.json",
    "package-lock.json",
  ].sort();
  const inputHash = createHash("sha256");
  for (const file of inputFiles) {
    inputHash.update(file);
    inputHash.update(await readFile(file));
  }
  const edition = command === "build" ? inputHash.digest("hex") : "development";
  return {
    base,
    build: {
      rolldownOptions: {
        input: { main: "index.html", tuning: "tuning.html" },
      },
    },
    define: {
      __ASSET_BYTES__: JSON.stringify(
        Object.fromEntries(
          await Promise.all(
            (await filesIn("public")).map(async (file) => [
              file.slice(7),
              (await readFile(file)).length,
            ]),
          ),
        ),
      ),
      __GRAMA_EDITION__: JSON.stringify(edition),
      __ASSET_HASHES__: JSON.stringify(
        Object.fromEntries(
          await Promise.all(
            (await filesIn("public")).map(async (file) => [
              file.slice(7),
              createHash("sha256")
                .update(await readFile(file))
                .digest("hex"),
            ]),
          ),
        ),
      ),
    },
    plugins: [
      {
        name: "retained-source-manifest",
        resolveId(id: string) {
          if (id === "virtual:grama-sources") return "\0grama-sources";
        },
        async load(id: string) {
          if (id !== "\0grama-sources") return;
          const file = path.resolve("public/sources/manifest.json");
          this.addWatchFile(file);
          return `export default ${await readFile(file, "utf8")};`;
        },
      },
      {
        name: "offline-workshop",
        apply: "build",
        async closeBundle() {
          const files = (await filesIn("dist")).filter((f) => !f.endsWith("sw.js")).sort();
          const urls = files.map(
            (file) => base + path.relative("dist", file).split(path.sep).join("/"),
          );
          const types: Record<string, string> = {
            ".html": "text/html",
            ".js": "text/javascript",
            ".css": "text/css",
            ".jpg": "image/jpeg",
            ".json": "application/json",
            ".svg": "image/svg+xml",
            ".ttf": "font/ttf",
            ".woff2": "font/woff2",
            ".txt": "text/plain",
          };
          const assets = Object.fromEntries(
            await Promise.all(
              files.map(async (file, index) => {
                const bytes = await readFile(file);
                return [
                  urls[index],
                  {
                    sha256: createHash("sha256").update(bytes).digest("hex"),
                    bytes: bytes.length,
                    type: types[path.extname(file)] ?? "application/octet-stream",
                  },
                ];
              }),
            ),
          );
          const inventory = createHash("sha256").update(JSON.stringify(assets)).digest("hex");
          const config = { edition, cache: `grama-${edition}-${inventory}`, base, assets };
          const helper = (await readFile("src/core/verified-fetch.js", "utf8")).replace(
            /^export /gm,
            "",
          );
          const worker = await readFile("src/offline-worker.js", "utf8");
          await writeFile(
            "dist/sw.js",
            `/* Offline edition ${edition}. Exact retained bytes, current worker ownership and transfer inactivity deadlines. */\nconst CONFIG = ${JSON.stringify(config)};\n${helper}\n${worker}`,
          );
        },
      },
    ],
  };
});
