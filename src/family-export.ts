import manifest from "virtual:grama-sources";
import { READINGS, WORDS } from "./content";
import {
  assessment,
  type FamilyState,
  familyCSV,
  familyHash,
  familyJSON,
  familyWave,
} from "./core/family";
import { familyMap, familyRuler, familyTable, gapDescription } from "./family-figures";
import { htmlEscape } from "./figures";
import { asset, base64, STUDY_ASSETS } from "./files";

/** Capture before any await: source fetching must not change the saved experiment. */
export async function familyReading(input: FamilyState): Promise<string> {
  const state = structuredClone(input);
  const loaded = new Map(
    await Promise.all(STUDY_ASSETS.map(async (file) => [file, await asset(file)] as const)),
  );
  const data = (file: string, mime: string) => {
    const bytes = loaded.get(file);
    if (!bytes) throw new Error(`The reading is missing ${file}.`);
    return `data:${mime};base64,${base64(bytes)}`;
  };
  const wave = `data:audio/wav;base64,${base64(familyWave(state))}`;
  const record = `data:application/json;base64,${base64(new TextEncoder().encode(familyJSON(state)))}`;
  const report = assessment(state.current);
  const passages = READINGS.map(
    (r) =>
      `<article><h3>${htmlEscape(r.title)}</h3><p>${htmlEscape(r.reference)}</p><p class="deva" lang="sa">${htmlEscape(r.deva)}</p><p class="iast" lang="sa-Latn">${htmlEscape(r.iast)}</p><p>${htmlEscape(r.english)}</p><p>${htmlEscape(r.note)}</p><dl>${r.words
        .map((key) => {
          const word = WORDS[key];
          return word
            ? `<dt>${htmlEscape(word.deva)} · ${htmlEscape(key)}</dt><dd>${htmlEscape(word.meaning)}. ${htmlEscape(word.reading)}</dd>`
            : "";
        })
        .join("")}</dl></article>`,
  ).join("");
  const sources = manifest.pages
    .map(
      (p) =>
        `<figure class="source-page"><img src="${data(p.file, "image/jpeg")}" alt="${htmlEscape(`${p.edition}, printed p.${p.printed}: ${p.caption}`)}"/><figcaption>${htmlEscape(`${p.edition}, printed p.${p.printed}, physical PDF p.${p.pdfPage}. ${p.caption}`)}<br/>SHA-256 ${p.sha256}</figcaption></figure>`,
    )
    .join("");
  const licenses = ["IBMPlex", "NotoSerif", "NotoSerifDevanagari"]
    .map(
      (name) =>
        `<details><summary>${name} font license</summary><pre>${htmlEscape(new TextDecoder().decode(loaded.get(`fonts/${name}-OFL.txt`)))}</pre></details>`,
    )
    .join("");
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/><title>Grāma: twenty-two counts, different tunings</title><style>
@font-face{font-family:GramaSans;src:url(${data("fonts/IBMPlexSans-Regular.woff2", "font/woff2")})}@font-face{font-family:GramaSans;font-weight:600;src:url(${data("fonts/IBMPlexSans-SemiBold.woff2", "font/woff2")})}@font-face{font-family:GramaSerif;src:url(${data("fonts/NotoSerif-Regular.ttf", "font/ttf")})}@font-face{font-family:GramaDeva;src:url(${data("fonts/NotoSerifDevanagari.ttf", "font/ttf")})}
body{font:17px/1.6 GramaSans,Arial,sans-serif;color:#173d50;max-width:1000px;margin:32px auto;padding:0 20px}h1{font-size:40px;line-height:1.15}h2{margin-top:2em}p{max-width:76ch}a{color:#176477}svg{display:block;width:100%;height:auto}#map{max-width:400px}#map svg{font-size:12px;fill:#173d50}.instrument{background:#173d50;padding:16px;color:#fff}.instrument svg{font:14px GramaSans,sans-serif}.table-scroll{max-width:100%;overflow:auto}table{border-collapse:collapse;min-width:650px;width:100%;font-size:14px}th,td{border-bottom:1px solid #a7bdc8;padding:10px;text-align:left}caption{text-align:left;margin:15px 0}.pa{color:#843e77}.deva{font:22px/1.9 GramaDeva,serif;white-space:pre-line}.iast{font:19px/1.8 GramaSerif,serif;white-space:pre-line}dt{font-weight:600}dd{margin-bottom:12px}article{margin:2em 0}.source-page{margin:30px 0;break-before:page}.source-page img{display:block;max-width:100%;max-height:85vh;margin:auto}figcaption,pre{font-size:12px;overflow-wrap:anywhere}pre{white-space:pre-wrap}audio{max-width:100%}.failed{color:#843e77;font-weight:600}@page{size:A4;margin:14mm}@media(max-width:600px){h1{font-size:32px}.instrument{padding:4px}.instrument svg{min-width:650px}.instrument{overflow:auto}}@media print{body{font-size:10pt;margin:0;padding:0}h1{font-size:26pt}audio,.continue{display:none}.source-page img{max-height:235mm}.instrument{print-color-adjust:exact}.instrument svg{min-width:0}table{min-width:0;font-size:8pt}.table-scroll{overflow:visible}.deva{font-size:14pt}.iast{font-size:12pt}details{display:block}}
</style></head><body><h1>Twenty-two counts.<br/>More than one tuning.</h1><p>A saved experiment from Grāma. The count rows and lowering instruction come from chapter 28 of the <cite>Nāṭyaśāstra</cite>, attributed to Bharata. The whole-gap sizes, cents and optional pure ratios are modern assumptions. This is not an ancient performance reconstruction.</p>
<p><strong>Sa = ${state.base} Hz in both witnesses. Fourth/fifth lock: ${state.locked ? "on for your candidate" : "off"}.</strong></p><p>Saved witness: ${gapDescription(state.reference)}.</p><p>Your candidate: ${gapDescription(state.current)}.</p>
<p class="${report.ordered ? "" : "failed"}">${report.ordered ? "Your candidate meets the displayed count-row conditions." : "Your candidate fails the displayed count-row conditions; it is retained as a failed candidate."} Pa-lowering test: ${report.lowers ? "passes" : "fails"}. Ordered whole-gap test: ${report.ordered ? "passes" : "fails"}. Both rows close at 1,200 cents by construction.</p>
<p class="continue"><a href="https://antonsoo.github.io/grama/tuning.html${htmlEscape(familyHash(state))}">Continue this experiment in the app</a> · <a download="grama-tuning-family.json" href="${record}">Download editable tuning JSON</a></p>
<h2>Two free choices, one octave equation</h2><p>Let A be the whole 4-count gap, B the 3-count gap, C the 2-count gap. The ascending count row is 3–2–4–4–3–2–4; therefore 3A + 2B + 2C = 1,200 cents and B = (1,200 − 3A − 2C)/2. Repeated groups of the same count are assumed to share a size. No internal śruti pitches are assigned. Ordered sizes A &gt; B &gt; C &gt; 0 are an extra condition of this model.</p><div id="map">${familyMap(state)}</div><p>Shaded region: ordered whole gaps. Ring: saved witness. Filled point: current candidate.</p><div class="instrument">${familyRuler(state)}</div><p>Circles: your candidate. Dashed ticks: saved witness. Rows: initial and changed Pa. Six notes stay fixed inside each witness.</p>
<div class="table-scroll">${familyTable(state)}</div><h2>Why the pure fourth and fifth do not finish the problem</h2><p>In the initial row, Sa–Ma = A + B + C = 600 − A/2; Sa–Pa = 2A + B + C = 600 + A/2. Fixing these at 4/3 and 3/2 fixes A at 1,200 log₂(9/8), but leaves C free while B compensates. Pa’s change is A − B. It still varies. These two ratio conditions do not represent the text’s complete consonance theory.</p>
<h2>Listen at one reference pitch</h2><p>First the saved witness, then your candidate. Each plays Ma–Pa–Dha in the initial row, then in the changed-Pa row. Sine synthesis is a modern teaching aid. If the candidate fails to lower Pa, that failed operation remains audible.</p><audio controls preload="none" src="${wave}"></audio><p><a download="grama-two-witnesses.wav" href="${wave}">Download both listening examples</a></p><details><summary>Both witnesses as CSV</summary><pre>${htmlEscape(familyCSV(state))}</pre></details>
<h2>Sanskrit and new English</h2><p>Grosset’s 1888 Roman Sanskrit is normalized to IAST; Devanagari renders that reading. The final half-verse definition comes from Śivadatta and Parab’s 1894 edition. The editions’ different verse numbering is preserved.</p>${passages}
<h2>Where this experiment stops</h2><p>Meeting the displayed checks does not establish a historically used tuning, equal sizes for individual śrutis, or satisfaction of all additional ancient interval relations. Grosset brackets the longer two-vīṇā passage on pp.28–29; note 36 on p.86 describes his interpretation as approximate. This family does not resolve that passage. The text is composite; no exact date is assigned to it here. All displayed cents and Hz are numerical approximations.</p>
<h2>Full printed evidence</h2><p>Joanny Grosset, <cite>Contribution à l’étude de la musique hindoue</cite> (1888); Śivadatta and Kāśīnāth Pāṇḍuraṅg Parab, eds., <cite>The Nāṭyaśāstra of Bharata Muni</cite>, Kāvyamālā 42 (1894). Full edition and scan identities are retained below.</p>${sources}
<h2>Identities and licenses</h2><p>Code and new content: PolyForm Noncommercial, Copyright (c) 2026 Anthony Mercer. Printed editions are public domain; font licenses follow. This file executes no scripts. Images, fonts and sound are embedded; outside links load only when followed.</p><details><summary>Source manifest</summary><pre>${htmlEscape(JSON.stringify(manifest, null, 2))}</pre></details>${licenses}</body></html>`;
}
