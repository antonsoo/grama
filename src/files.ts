import manifest from "../public/sources/manifest.json";
import { READINGS, WORDS } from "./content";
import { score, wav } from "./core/audio";
import {
  csv,
  MODEL_NAMES,
  NOTES,
  outgoing,
  type Pose,
  parsePose,
  poseHash,
  sequence,
} from "./core/tuning";
import { comparisonTable, countFigure, htmlEscape, pitchFigure } from "./figures";
export function comparisonJSON(pose: Pose): string {
  return `${JSON.stringify({ format: "grama-comparison-v1", pose }, null, 2)}\n`;
}
export function parseComparison(raw: string): Pose {
  if (raw.length > 65536) throw new Error("Comparison JSON must be under 64 KB.");
  const input: unknown = JSON.parse(raw);
  if (!input || typeof input !== "object" || Array.isArray(input))
    throw new Error("Expected a saved Grama comparison.");
  const data = input as Record<string, unknown>;
  if (Object.keys(data).sort().join(",") !== "format,pose" || data.format !== "grama-comparison-v1")
    throw new Error("Expected the grama-comparison-v1 format and a pose.");
  return parsePose(data.pose);
}
export function download(name: string, body: string | Uint8Array<ArrayBuffer>, type: string): void {
  const blob = new Blob([body], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}
function base64(bytes: Uint8Array): string {
  let binary = "";
  for (let offset = 0; offset < bytes.length; offset += 16384)
    binary += String.fromCharCode(...bytes.subarray(offset, offset + 16384));
  return btoa(binary);
}
async function asset(file: string): Promise<Uint8Array<ArrayBuffer>> {
  const response = await fetch(`${import.meta.env.BASE_URL}${file}`);
  if (!response.ok)
    throw new Error(`Could not load ${file}. Keep the complete edition available and try again.`);
  const bytes = new Uint8Array(await response.arrayBuffer());
  const digest = [...new Uint8Array(await crypto.subtle.digest("SHA-256", bytes))]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  if (digest !== __ASSET_HASHES__[file])
    throw new Error(
      `The saved copy of ${file} differs from this edition. Reload the complete current edition before saving.`,
    );
  return bytes;
}
export const STUDY_ASSETS = [
  ...manifest.pages.map((p) => p.file),
  "fonts/IBMPlexSans-Regular.woff2",
  "fonts/IBMPlexSans-SemiBold.woff2",
  "fonts/NotoSerif-Regular.ttf",
  "fonts/NotoSerifDevanagari.ttf",
  "fonts/IBMPlex-OFL.txt",
  "fonts/NotoSerif-OFL.txt",
  "fonts/NotoSerifDevanagari-OFL.txt",
];
export async function illustratedReading(captured: Pose): Promise<string> {
  const pose = { ...captured };
  const loaded = new Map(
    await Promise.all(STUDY_ASSETS.map(async (file) => [file, await asset(file)] as const)),
  );
  const data = (file: string, type: string) => {
    const bytes = loaded.get(file);
    if (!bytes) throw new Error(`Missing ${file}`);
    return `data:${type};base64,${base64(bytes)}`;
  };
  const sourcePages = manifest.pages
    .map(
      (p) =>
        `<figure class="source-page"><img src="${data(p.file, "image/jpeg")}" alt="${htmlEscape(`${p.edition}, printed p.${p.printed}: ${p.caption}`)}"/><figcaption>${htmlEscape(`${p.edition}, printed p.${p.printed}, physical PDF p.${p.pdfPage}. ${p.caption}`)}<br/><small>SHA-256 ${p.sha256}</small></figcaption></figure>`,
    )
    .join("");
  const reading = READINGS.map(
    (r) =>
      `<article><h3>${htmlEscape(r.title)}</h3><p>${htmlEscape(r.reference)}</p><p class="deva" lang="sa">${htmlEscape(r.deva)}</p><p class="iast" lang="sa-Latn">${htmlEscape(r.iast)}</p><p>${htmlEscape(r.english)}</p><p class="note">${htmlEscape(r.note)}</p><dl>${r.words
        .map((key) => {
          const w = WORDS[key];
          return w
            ? `<dt><span lang="sa">${htmlEscape(w.deva)}</span> <span lang="sa-Latn">${htmlEscape(key)}</span></dt><dd>${htmlEscape(w.meaning)}. ${htmlEscape(w.reading)}</dd>`
            : "";
        })
        .join("")}</dl></article>`,
  ).join("");
  const wavBytes = wav(score(pose, "context"));
  const jsonURL = `data:application/json;base64,${base64(new TextEncoder().encode(comparisonJSON(pose)))}`;
  const licenses = ["IBMPlex", "NotoSerif", "NotoSerifDevanagari"]
    .map(
      (name) =>
        `<details><summary>${name} font license (OFL)</summary><pre>${htmlEscape(new TextDecoder().decode(loaded.get(`fonts/${name}-OFL.txt`)))}</pre></details>`,
    )
    .join("");
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/><title>Grāma: saved count and tuning comparison</title><style>
@font-face{font-family:GramaSans;src:url(${data("fonts/IBMPlexSans-Regular.woff2", "font/woff2")})}@font-face{font-family:GramaSans;font-weight:600;src:url(${data("fonts/IBMPlexSans-SemiBold.woff2", "font/woff2")})}@font-face{font-family:GramaSerif;src:url(${data("fonts/NotoSerif-Regular.ttf", "font/ttf")})}@font-face{font-family:GramaDeva;src:url(${data("fonts/NotoSerifDevanagari.ttf", "font/ttf")})}
body{font:17px/1.6 GramaSans,Arial,sans-serif;color:#173d50;max-width:960px;margin:32px auto;padding:0 20px}h1{font-size:38px;line-height:1.1}h2{margin-top:2.5em}a{color:#176477}p{max-width:74ch}svg{display:block;max-width:100%;height:auto}table{width:100%;border-collapse:collapse;font-size:14px}th,td{padding:10px;text-align:left;border-bottom:1px solid #a7bdc8}caption{text-align:left;padding:10px 0}.pa{color:#843e77}.deva{font-family:GramaDeva,serif;font-size:22px;white-space:pre-line;line-height:1.9}.iast{font-family:GramaSerif,serif;font-size:19px;white-space:pre-line}article{margin:3em 0;break-inside:avoid}.note{background:#edf4f7;padding:12px}dt{font-weight:600}dd{margin:0 0 12px}.source-page{margin:32px 0;break-before:page}.source-page img{display:block;max-width:100%;max-height:85vh;margin:auto}figcaption{font-size:13px;overflow-wrap:anywhere}pre{white-space:pre-wrap;overflow-wrap:anywhere;font-size:12px}audio{max-width:100%}@page{size:A4;margin:14mm}@media print{body{margin:0;padding:0;font-size:10pt}h1{font-size:26pt}.source-page img{max-height:235mm}.source-page{break-inside:avoid}audio,.continue{display:none}table{font-size:9pt}.deva{font-size:14pt}.iast{font-size:12pt}details{display:block}svg{max-height:90mm}}
</style></head><body><h1>One changed note.<br/>Two changed intervals.</h1><p>A saved Grāma comparison. The count rows come from chapter 28 of the <cite>Nāṭyaśāstra</cite>, attributed to Bharata. Sound requires a modern assumption beyond those counts.</p><p><strong>${htmlEscape(pose.grama === "sadja" ? "Ṣaḍja-grāma" : "Madhyama-grāma")}; begin at ${NOTES[pose.start]?.short}; Sa = ${pose.base} Hz; ${MODEL_NAMES[pose.model]}.</strong></p><p class="continue"><a href="https://antonsoo.github.io/grama/${htmlEscape(poseHash(pose))}">Continue this comparison in the app</a> · <a download="grama-comparison.json" href="${jsonURL}">Download editable comparison JSON</a></p><h2>The counted arrangement</h2>${countFigure(pose)}<p>Equal-width cells are ordinal counts, not equal pitch distances. Pa alone moves: the adjacent counts 4–3 become 3–4. The other six notes remain fixed. Starting the ascent at another note changes the order without retuning those notes.</p><p>Ordered ascent: ${sequence(
    pose,
  )
    .map((t) => `${NOTES[t.note]?.short}${t.octave ? "′" : ""} (${t.frequency.toFixed(3)} Hz)`)
    .join(
      "; ",
    )}. Its ascending gaps are ${outgoing(pose.grama, pose.start).join(", ")}.</p><h2>A chosen modern sound model</h2>${pitchFigure(pose)}<p>The ratio example assumes 9/8 for four counts, 10/9 for three and 16/15 for two. These seven gaps multiply to 2; pitches of internal count cells are not assigned. Pa then lowers by 81/80 (21.506 cents). The equal-division counterexample assumes 1,200/22 cents per count and lowers Pa by 54.545 cents. Both share this count row. Neither is asserted to reconstruct the ancient two-vīṇā experiment or satisfy all other ancient consonance requirements.</p>${comparisonTable(pose)}<h3>Hear Ma–Pa–Dha before and after lowering Pa</h3><p>Generated mono sine tones under the selected assumption, not an ancient performance or vīṇā timbre. The first three tones use ṣaḍja-grāma; the next three use madhyama-grāma. Only Pa changes.</p><audio controls preload="none" src="data:audio/wav;base64,${base64(wavBytes)}"></audio><p><a download="grama-modern-comparison.wav" href="data:audio/wav;base64,${base64(wavBytes)}">Download the listening WAV</a></p><details><summary>Both pitch rows as CSV</summary><pre>${htmlEscape(csv(pose))}</pre></details><h2>Sanskrit with IAST and new English</h2><p>Grosset's 1888 Roman Sanskrit is normalized to IAST; Devanagari renders that reading. The final half-verse definition is from Śivadatta and Parab's 1894 edition. Reference numbers distinguish the editions. The excerpts omit apparatus; all printed pages follow.</p>${reading}<h2>Where the model stops</h2><p>The text is composite and transmitted through differing manuscripts; we assign no exact date to this passage. Grosset p.21 says brackets mark doubtful text. The longer two-vīṇā demonstration on pp.28–29 is bracketed, and note 36 on p.86 calls its interpretation approximate and the reading unsatisfactory. This bench models the short lowering instruction and named count rows, without claiming to enact that entire experiment. Seven ascending rotations illustrate a distinction in ordering; they are not historical melodies, rāgas or a complete treatment of mūrchanās.</p><h2>Full printed evidence</h2><p>Joanny Grosset, <cite>Contribution à l’étude de la musique hindoue</cite>, in <cite>Mélanges de philologie indo-européenne</cite>, Bibliothèque de la Faculté des lettres de Lyon VI (Paris: Ernest Leroux, 1888). Śivadatta and Kāśīnāth Pāṇḍuraṅg Parab, eds., <cite>The Nāṭyaśāstra of Bharata Muni</cite>, Kāvyamālā 42 (Bombay: Tukārām Jāvajī, Nirṇaya-Sāgara Press, 1894).</p>${sourcePages}<h2>Source identities and licenses</h2><p>MIT code and new educational content, Copyright (c) 2026 Anton Soloviev. Printed editions are public domain; bundled font licenses follow. This document executes no scripts. Its images, fonts and listening WAV are embedded; outside links load only when followed.</p><details><summary>Source manifest</summary><pre>${htmlEscape(JSON.stringify(manifest, null, 2))}</pre></details>${licenses}</body></html>`;
}
