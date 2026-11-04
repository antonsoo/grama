import { attachmentDiagnostic } from "./attachment-ui";
import { parseComparisonRecord } from "./core/record";
import { readingSave } from "./reading-save";
import { recordOpen } from "./record-open";
import { SourcePlate } from "./source-plate";
import "./style.css";
import manifest from "virtual:grama-sources";
import { READINGS, WORDS } from "./content";
import { type Listening, score, wav } from "./core/audio";
import {
  csv,
  DEFAULT,
  fromHash,
  lowering,
  MODEL_NAMES,
  NOTES,
  outgoing,
  type Pose,
  parsePose,
  poseHash,
  sequence,
} from "./core/tuning";
import { comparisonTable, countFigure, htmlEscape, pitchFigure } from "./figures";
import { comparisonJSON, download, illustratedReading } from "./files";
import { offline } from "./offline";
import { ListeningPlayer } from "./player";

function element<T extends HTMLElement>(id: string): T {
  const node = document.getElementById(id);
  if (!node) throw new Error(`Missing ${id}`);
  return node as T;
}
const start = element<HTMLSelectElement>("start"),
  model = element<HTMLSelectElement>("model"),
  base = element<HTMLInputElement>("base");
const fileStatus = element("file-status"),
  soundStatus = element("sound-status");
let pose: Pose = { ...DEFAULT };
try {
  pose = fromHash(location.hash);
} catch {
  fileStatus.textContent =
    "This link has invalid comparison settings. The initial comparison is shown.";
}
let passageIndex = 2;
let editRevision = 0;
const player = new ListeningPlayer(soundStatus);
function stopSound(message = "Sound stopped.") {
  player.stop(message);
}
function listen(kind: Listening) {
  const captured = { ...pose };
  const message =
    kind === "scale"
      ? `Playing the ascent from ${NOTES[captured.start]?.short} in ${captured.grama === "sadja" ? "ṣaḍja" : "madhyama"}-grāma. ${MODEL_NAMES[captured.model]}.`
      : kind === "pa"
        ? `Playing initial Pa, lowered Pa, initial Pa, lowered Pa. ${MODEL_NAMES[captured.model]}.`
        : `Playing Ma–Pa–Dha in the initial tuning, then Ma–Pa–Dha with Pa lowered. ${MODEL_NAMES[captured.model]}.`;
  return player.play(
    score(captured, kind),
    message,
    "Finished. You can compare another order or pitch assumption.",
  );
}
start.innerHTML = NOTES.map(
  (n, i) => `<option value="${i}">${n.short} — ${htmlEscape(n.name)}</option>`,
).join("");
const passage = element<HTMLSelectElement>("passage"),
  page = element<HTMLSelectElement>("source-page");
passage.innerHTML = READINGS.map(
  (r, i) => `<option value="${i}">${i + 1}. ${htmlEscape(r.title)}</option>`,
).join("");
page.innerHTML = manifest.pages
  .map(
    (p) =>
      `<option value="${p.file}">${p.edition === "grosset1888" ? "Grosset 1888" : "Nāṭyaśāstra 1894"}, p.${p.printed}: ${htmlEscape(p.caption)}</option>`,
  )
  .join("");
const plate = new SourcePlate(
  element<HTMLImageElement>("scan"),
  element<HTMLAnchorElement>("scan-link"),
  element("scan-caption"),
);
function showPage(file: string) {
  const p = manifest.pages.find((p) => p.file === file);
  if (!p) return;
  page.value = file;
  void plate.show(
    file,
    `${p.edition === "grosset1888" ? "Grosset 1888" : "Nāṭyaśāstra 1894"}, printed p.${p.printed}: ${p.caption}`,
    `${p.caption}. Printed p.${p.printed}; physical PDF p.${p.pdfPage}.`,
  );
}
function showPassage() {
  const r = READINGS[passageIndex];
  if (!r) return;
  passage.value = String(passageIndex);
  element("passage-text").innerHTML =
    `<h3>${htmlEscape(r.title)}</h3><p class="reference">${htmlEscape(r.reference)}</p><p class="deva" lang="sa">${htmlEscape(r.deva)}</p><p class="iast" lang="sa-Latn">${htmlEscape(r.iast)}</p><p class="translation">${htmlEscape(r.english)}</p><p class="reading-note">${htmlEscape(r.note)}</p><div class="word-buttons" aria-label="Words in this passage">${r.words.map((w) => `<button type="button" data-word="${htmlEscape(w)}" aria-expanded="false" aria-controls="word-note" lang="sa-Latn">${htmlEscape(w)}</button>`).join("")}</div><div id="word-note" hidden></div>`;
  showPage(`sources/${r.pages[0]}`);
}
function figures() {
  const width = element("count-figure").clientWidth;
  element("count-figure").innerHTML = countFigure(pose, width);
  element("pitch-figure").innerHTML = pitchFigure(pose, width);
}
const diagnostic = attachmentDiagnostic(
  player,
  () => pose,
  (id) => {
    const index = READINGS.findIndex((reading) => reading.id === id);
    if (index < 0) return;
    passageIndex = index;
    showPassage();
    element("reading").scrollIntoView({ block: "start" });
  },
  () => {
    editRevision++;
  },
);
function render() {
  start.value = String(pose.start);
  model.value = pose.model;
  base.value = String(pose.base);
  document.querySelectorAll<HTMLInputElement>('input[name="grama"]').forEach((r) => {
    r.checked = r.value === pose.grama;
  });
  const tones = sequence(pose);
  element("order-description").textContent =
    `${tones.map((t) => `${NOTES[t.note]?.short}${t.octave ? "′" : ""}`).join(" – ")}. Ascending counts: ${outgoing(pose.grama, pose.start).join(" · ")}. Sa stays at ${pose.base} Hz.`;
  element("retune-result").innerHTML =
    pose.grama === "sadja"
      ? "<strong>Now lower Pa.</strong> Select madhyama-grāma: Ma–Pa contracts from 4 counts to 3, while Pa–Dha expands from 3 to 4. The other six notes stay fixed."
      : "<strong>Pa moved; the other six notes stayed.</strong> Ma–Pa now has 3 counts and Pa–Dha 4. Changing the first played note alone cannot do this retuning.";
  element("model-description").textContent =
    pose.model === "ratios"
      ? "Chosen for this lesson: a four-count gap = 9/8, three = 10/9, two = 16/15. The seven gaps multiply to exactly 2 (an octave). These ratios are an extra assumption, not a table quoted from the Sanskrit."
      : "A deliberate counterexample: every count = 1,200/22 cents. The same seven count groups close at an octave, but give different pitches. It illustrates the count row alone, without establishing how an ancient instrument was tuned.";
  element("lowering-comparison").textContent =
    `One counted śruti lowers Pa by ${lowering(pose.model).toFixed(3)} cents here. The ${pose.model === "ratios" ? "equal-division counterexample gives 54.545" : "ratio example gives 21.506"} cents for the same count change.`;
  element("comparison").innerHTML = comparisonTable(pose);
  figures();
  diagnostic.refresh();
}
function update(next: Pose) {
  editRevision++;
  stopSound("Sound stopped because the comparison changed.");
  pose = next;
  history.replaceState(null, "", poseHash(pose));
  render();
}
start.addEventListener("change", () => update({ ...pose, start: Number(start.value) }));
model.addEventListener("change", () => update({ ...pose, model: model.value as Pose["model"] }));
document.querySelectorAll<HTMLInputElement>('input[name="grama"]').forEach((r) => {
  r.addEventListener("change", () => {
    if (r.checked) update({ ...pose, grama: r.value as Pose["grama"] });
  });
});
const applyBase = () => {
  if (!base.reportValidity() || !base.value) return;
  try {
    update(parsePose({ ...pose, base: Number(base.value) }));
  } catch (e) {
    fileStatus.textContent = e instanceof Error ? e.message : "Sa could not be changed.";
  }
};
element("apply-base").addEventListener("click", applyBase);
base.addEventListener("keydown", (e) => {
  if (e.key === "Enter") applyBase();
});
base.addEventListener("input", () => {
  editRevision++;
  stopSound("Sound stopped while you edit Sa. Choose Set Sa to apply it.");
});
for (const kind of ["scale", "pa", "context"] as const)
  element(`hear-${kind}`).addEventListener("click", () => {
    void listen(kind);
  });
element("stop").addEventListener("click", () => stopSound());
passage.addEventListener("change", () => {
  stopSound();
  passageIndex = Number(passage.value);
  showPassage();
});
page.addEventListener("change", () => showPage(page.value));
element("passage-text").addEventListener("click", (e) => {
  const button = (e.target as Element).closest<HTMLButtonElement>("button[data-word]");
  if (!button) return;
  const key = button.dataset.word ?? "",
    word = WORDS[key];
  if (!word) return;
  const wasOpen = button.getAttribute("aria-expanded") === "true";
  element("passage-text")
    .querySelectorAll("button[data-word]")
    .forEach((b) => {
      b.setAttribute("aria-expanded", "false");
    });
  const note = element("word-note");
  note.hidden = wasOpen;
  if (!wasOpen) {
    button.setAttribute("aria-expanded", "true");
    note.innerHTML = `<p><span class="deva" lang="sa">${htmlEscape(word.deva)}</span> <strong lang="sa-Latn">${htmlEscape(key)}</strong>: ${htmlEscape(word.meaning)}.</p><p>${htmlEscape(word.reading)}</p>`;
  }
});
element("save-json").addEventListener("click", () =>
  download(
    "grama-comparison.json",
    comparisonJSON(pose, diagnostic.selected()),
    "application/json",
  ),
);
element("save-csv").addEventListener("click", () =>
  download("grama-pitch-comparison.csv", csv(pose), "text/csv;charset=utf-8"),
);
element("save-svg").addEventListener("click", () =>
  download("grama-counts.svg", countFigure(pose), "image/svg+xml"),
);
element("save-wav").addEventListener("click", () =>
  download("grama-modern-comparison.wav", wav(score(pose, "context")), "audio/wav"),
);
readingSave(
  element<HTMLButtonElement>("save-reading"),
  fileStatus,
  (options) => illustratedReading({ ...pose }, options, diagnostic.selected()),
  "grama-illustrated-reading.html",
  "Saved the illustrated reading, including all eleven source pages and the listening comparison, at the settings chosen when you clicked Save.",
);
recordOpen(element<HTMLInputElement>("open-json"), fileStatus, {
  fingerprint: () =>
    JSON.stringify({ pose, placement: diagnostic.selected(), baseDraft: base.value, editRevision }),
  parse: parseComparisonRecord,
  apply: (record) => {
    diagnostic.select(record.attachment);
    update(record.pose);
  },
  success:
    "Reopened the comparison. Sa, starting note, tuning and modern pitch assumption are restored.",
  kept: "Your current comparison was kept.",
});
element("share").addEventListener("click", async () => {
  const url = new URL(location.href);
  url.hash = poseHash(pose);
  url.searchParams.set("attachment", diagnostic.selected());
  const link = url.href;
  try {
    await navigator.clipboard.writeText(link);
    fileStatus.textContent = "Copied the comparison link.";
  } catch {
    fileStatus.replaceChildren(document.createTextNode("Copy this comparison link: "));
    const field = document.createElement("input");
    field.type = "text";
    field.value = link;
    field.setAttribute("aria-label", "Comparison link");
    fileStatus.append(field);
    field.focus();
    field.select();
  }
});
window.addEventListener("hashchange", () => {
  try {
    update(fromHash(location.hash));
  } catch {
    fileStatus.textContent = "Invalid comparison link. Your current comparison was kept.";
  }
});
document.querySelectorAll<HTMLAnchorElement>('a[href^="#"]').forEach((a) => {
  a.addEventListener("click", (e) => {
    const target = document.getElementById(a.hash.slice(1));
    if (target) {
      e.preventDefault();
      stopSound();
      target.scrollIntoView();
      if (a.classList.contains("skip")) {
        target.tabIndex = -1;
        target.focus();
      }
    }
  });
});
new ResizeObserver(figures).observe(element("count-figure"));
render();
showPassage();
void offline(element("offline-status"));
