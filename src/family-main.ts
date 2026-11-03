import "./style.css";
import "./family.css";
import { READINGS, WORDS } from "./content";
import { SAMPLE_RATE, samples, wav } from "./core/audio";
import {
  assessment,
  DEFAULT_FAMILY,
  EQUAL_GAPS,
  type FamilyListening,
  type FamilyState,
  familyCSV,
  familyFromHash,
  familyHash,
  familyJSON,
  familyScore,
  type Gaps,
  OTHER_GAPS,
  PURE_FOUR,
  parseFamily,
  parseFamilyJSON,
  RATIO_GAPS,
} from "./core/family";
import { familyReading } from "./family-export";
import { familyMap, familyRuler, familyTable, gapDescription } from "./family-figures";
import { htmlEscape } from "./figures";
import { download } from "./files";
import { offline } from "./offline";

function element<T extends HTMLElement>(id: string): T {
  const node = document.getElementById(id);
  if (!node) throw new Error(`Missing ${id}`);
  return node as T;
}
const four = element<HTMLInputElement>("four"),
  two = element<HTMLInputElement>("two"),
  lock = element<HTMLInputElement>("lock"),
  base = element<HTMLInputElement>("base"),
  status = element("file-status"),
  sound = element("sound-status");
let state: FamilyState = structuredClone(DEFAULT_FAMILY);
try {
  state = familyFromHash(location.hash);
} catch {
  status.textContent = "Invalid tuning link. The initial examples are shown.";
}
let context: AudioContext | null = null,
  playing: AudioBufferSourceNode | null = null,
  revision = 0;
function stop(message = "Sound stopped.") {
  revision++;
  if (playing) {
    playing.onended = null;
    playing.stop();
    playing.disconnect();
    playing = null;
  }
  sound.textContent = message;
}
async function listen(kind: FamilyListening) {
  stop();
  const captured = structuredClone(state),
    ticket = revision;
  try {
    if (!context) {
      context = new AudioContext({ sampleRate: SAMPLE_RATE });
      context.addEventListener("statechange", () => {
        if (context?.state !== "running" && playing)
          stop("Audio was interrupted. Choose a listening button to start again.");
      });
    }
    await context.resume();
    if (ticket !== revision || document.hidden) return;
    const pcm = samples(familyScore(captured, kind)),
      buffer = context.createBuffer(1, pcm.length, SAMPLE_RATE);
    buffer.copyToChannel(pcm, 0);
    const source = context.createBufferSource();
    source.buffer = buffer;
    source.connect(context.destination);
    playing = source;
    source.onended = () => {
      if (playing !== source) return;
      source.disconnect();
      playing = null;
      sound.textContent = "Finished. Change a whole gap and compare again.";
    };
    source.start();
    sound.textContent = `${kind === "compare" ? "Saved witness first, then your candidate." : kind === "current" ? "Playing your candidate." : "Playing the saved witness."} Ma–Pa–Dha initially, then with Pa changed. Sa = ${captured.base} Hz.${kind !== "reference" && !assessment(captured.current).lowers ? " This candidate does not lower Pa." : ""}`;
  } catch {
    if (ticket === revision)
      stop("Audio could not start. Try again, or save the WAV for another player.");
  }
}
function figures() {
  element("family-map").innerHTML = familyMap(state);
  element("family-ruler").innerHTML = familyRuler(state, element("family-ruler").clientWidth < 600);
}
function render() {
  four.value = String(state.current.four);
  two.value = String(state.current.two);
  four.disabled = state.locked;
  lock.checked = state.locked;
  base.value = String(state.base);
  const report = assessment(state.current),
    reference = assessment(state.reference);
  element("four-value").textContent = `${state.current.four.toFixed(3)} cents`;
  element("two-value").textContent = `${state.current.two.toFixed(3)} cents`;
  element("three-value").textContent = `${report.three.toFixed(3)} cents`;
  for (const [id, value] of [
    ["four", state.current.four],
    ["three", report.three],
    ["two", state.current.two],
  ] as const)
    element(`equation-${id}`).textContent = value.toFixed(3);
  const verdict = element("verdict");
  verdict.dataset.pass = String(report.ordered);
  verdict.textContent = report.ordered
    ? "This candidate fits the count-row exercise. It does not establish an ancient tuning."
    : "This candidate fails a displayed condition. The octave alone is not enough.";
  element("constraints").innerHTML =
    `<li data-pass="true"><strong>Octave: closes</strong>1,200 cents, in both rows, by construction.</li><li data-pass="${report.lowers}"><strong>Lower Pa: ${report.lowers ? "yes" : "no"}</strong>${report.lowers ? `Pa falls ${report.lowering.toFixed(3)} cents.` : Math.abs(report.lowering) < 1e-8 ? "Pa stays put: the two whole gaps are equal." : `Pa rises ${(-report.lowering).toFixed(3)} cents; that contradicts the lowering instruction.`}</li><li data-pass="${report.ordered}"><strong>Ordered whole gaps: ${report.ordered ? "yes" : "no"}</strong>4-count &gt; 3-count &gt; 2-count: a condition of this modern model.</li>`;
  element("movement").textContent =
    `Within your candidate, only Pa changes between the rows. Initial Sa–Ma differs from 4/3 by ${report.maError.toFixed(3)} cents; Sa–Pa differs from 3/2 by ${report.paError.toFixed(3)} cents. Dashed ticks mark the saved witness, not a second set of counts.`;
  const difference = Math.max(
    Math.abs(state.current.four - state.reference.four),
    Math.abs(state.current.two - state.reference.two),
  );
  element("comparison-summary").textContent =
    difference < 1e-8
      ? "Your candidate matches the saved witness. Move the 2-count gap to create a different one."
      : `Same count rows and reference pitch. Saved Pa lowering: ${reference.lowering.toFixed(3)} cents. Your candidate’s change: ${report.lowering.toFixed(3)} cents downward${report.lowers ? "." : " (zero or negative: failed lowering)."} ${state.locked ? "Your initial fourth and fifth remain at the locked pure ratios." : "The initial fourth and fifth are free to change."}`;
  element<HTMLButtonElement>("pin").disabled = !report.ordered;
  element("family-table").innerHTML = familyTable(state);
  figures();
}
function update(next: FamilyState) {
  state = parseFamily(next);
  stop("Sound stopped because the tuning changed.");
  history.replaceState(null, "", familyHash(state));
  render();
}
for (const [input, key] of [
  [four, "four"],
  [two, "two"],
] as const) {
  // An explicit keyboard increment works even with step=any, while presets and
  // shared links retain their full floating-point values.
  input.addEventListener("keydown", (event) => {
    if (!["ArrowLeft", "ArrowDown", "ArrowRight", "ArrowUp"].includes(event.key)) return;
    event.preventDefault();
    const delta = ["ArrowLeft", "ArrowDown"].includes(event.key) ? -1 : 1;
    const value = Math.max(
      Number(input.min),
      Math.min(Number(input.max), state.current[key] + delta * (event.shiftKey ? 10 : 1)),
    );
    update({ ...state, current: { ...state.current, [key]: value } });
  });
  input.addEventListener("input", () =>
    update({ ...state, current: { ...state.current, [key]: Number(input.value) } }),
  );
}
lock.addEventListener("change", () =>
  update({
    ...state,
    locked: lock.checked,
    current: { ...state.current, four: lock.checked ? PURE_FOUR : state.current.four },
  }),
);
for (const [name, gaps, locked] of [
  ["ratios", RATIO_GAPS, true],
  ["equal", EQUAL_GAPS, false],
  ["other", OTHER_GAPS, false],
  ["failed", { four: 200, two: 100 }, false],
] as const)
  element(`preset-${name}`).addEventListener("click", () =>
    update({ ...state, current: { ...gaps } as Gaps, locked }),
  );
element("pin").addEventListener("click", () => {
  if (!assessment(state.current).ordered) return;
  update({ ...state, reference: { ...state.current } });
  status.textContent = `Saved witness replaced: ${gapDescription(state.reference)}.`;
});
const setBase = () => {
  stop();
  if (!base.value || !base.reportValidity()) return;
  try {
    update({ ...state, base: Number(base.value) });
  } catch (error) {
    status.textContent = error instanceof Error ? error.message : "Sa could not be set.";
  }
};
base.addEventListener("input", () =>
  stop("Sound stopped while you edit Sa. Choose Set Sa to apply it."),
);
base.addEventListener("keydown", (event) => {
  if (event.key === "Enter") setBase();
});
element("set-base").addEventListener("click", setBase);
for (const kind of ["reference", "current", "compare"] as const)
  element(`hear-${kind}`).addEventListener("click", () => {
    void listen(kind);
  });
element("stop").addEventListener("click", () => stop());
element("save-json").addEventListener("click", () =>
  download("grama-tuning-family.json", familyJSON(state), "application/json"),
);
element("save-csv").addEventListener("click", () =>
  download("grama-two-witnesses.csv", familyCSV(state), "text/csv;charset=utf-8"),
);
element("save-wav").addEventListener("click", () =>
  download("grama-two-witnesses.wav", wav(familyScore(state, "compare")), "audio/wav"),
);
element("save-reading").addEventListener("click", async () => {
  const captured = structuredClone(state),
    button = element<HTMLButtonElement>("save-reading");
  button.disabled = true;
  status.textContent = "Preparing your reading and verifying its source pages and fonts…";
  try {
    download(
      "grama-tuning-family-reading.html",
      await familyReading(captured),
      "text/html;charset=utf-8",
    );
    status.textContent =
      "Saved both witnesses at the settings chosen when you clicked Save, with sound, source pages and their identities.";
  } catch (error) {
    status.textContent = error instanceof Error ? error.message : "The reading could not be saved.";
  } finally {
    button.disabled = false;
  }
});
element<HTMLInputElement>("open-json").addEventListener("change", async (event) => {
  const input = event.target as HTMLInputElement,
    file = input.files?.[0];
  if (!file) return;
  stop();
  try {
    if (file.size > 65536) throw new Error("Tuning JSON must be under 64 KB.");
    update(parseFamilyJSON(await file.text()));
    status.textContent = "Reopened both witnesses and their tuning settings.";
  } catch (error) {
    status.textContent = `${error instanceof Error ? error.message : "Could not read this file."} Your current experiment was kept.`;
  } finally {
    input.value = "";
  }
});
element("share").addEventListener("click", async () => {
  const link = new URL(familyHash(state), location.href).href;
  try {
    await navigator.clipboard.writeText(link);
    status.textContent = "Copied the tuning link, including both witnesses.";
  } catch {
    const input = document.createElement("input");
    input.type = "text";
    input.value = link;
    input.setAttribute("aria-label", "Tuning link");
    status.replaceChildren(document.createTextNode("Copy this tuning link: "), input);
    input.focus();
    input.select();
  }
});
const passages = READINGS.filter((r) => ["count", "lower"].includes(r.id));
element("family-reading").innerHTML = passages
  .map(
    (r) =>
      `<article><h3>${htmlEscape(r.title)}</h3><p class="reference">${htmlEscape(r.reference)}</p><p class="deva" lang="sa">${htmlEscape(r.deva)}</p><p class="iast" lang="sa-Latn">${htmlEscape(r.iast)}</p><p class="translation">${htmlEscape(r.english)}</p><p class="reading-note">${htmlEscape(r.note)}</p><details><summary>Read the words</summary><dl>${r.words
        .map((key) => {
          const word = WORDS[key];
          return word
            ? `<dt><span lang="sa">${htmlEscape(word.deva)}</span> · <span lang="sa-Latn">${htmlEscape(key)}</span></dt><dd>${htmlEscape(word.meaning)}. ${htmlEscape(word.reading)}</dd>`
            : "";
        })
        .join("")}</dl></details></article>`,
  )
  .join("");
element<HTMLSelectElement>("source-page").addEventListener("change", (event) => {
  const page = (event.target as HTMLSelectElement).value;
  if (!["28", "29", "86"].includes(page)) return;
  const image = element<HTMLImageElement>("scan");
  image.src = `${import.meta.env.BASE_URL}sources/grosset-${page}.jpg`;
  image.alt = `Grosset 1888, full printed page ${page}`;
  element<HTMLAnchorElement>("scan-link").href = image.src;
  element("scan-caption").textContent =
    `Grosset 1888, printed p.${page}. Open to enlarge the full page.`;
});
for (const anchor of document.querySelectorAll<HTMLAnchorElement>('a[href^="#"]')) {
  anchor.addEventListener("click", (event) => {
    const target = document.getElementById(anchor.hash.slice(1));
    if (!target) return;
    event.preventDefault();
    stop();
    target.scrollIntoView();
    if (anchor.classList.contains("skip")) {
      target.tabIndex = -1;
      target.focus();
    }
  });
}
window.addEventListener("hashchange", () => {
  stop();
  try {
    update(familyFromHash(location.hash));
  } catch {
    status.textContent = "Invalid tuning link. Your current experiment was kept.";
  }
});
document.addEventListener("visibilitychange", () => {
  if (document.hidden) stop();
});
window.addEventListener("pagehide", () => stop());
new ResizeObserver(figures).observe(element("family-ruler"));
render();
void offline(element("offline-status"));
