import { wav } from "./core/audio";
import { assessment, FAMILY_NOTICE, familyHash } from "./core/family";
import {
  type ListeningResult,
  listeningCSV,
  listeningScore,
  pitchDifference,
  STIMULI,
} from "./core/listening";
import { familyReading } from "./family-export";
import { htmlEscape } from "./figures";
import { base64, type ReadOptions } from "./files";

export function resultText(result: ListeningResult): string {
  if (result.identical)
    return `Identical samples. X was assigned ${result.x}; either label describes the same sound. Unscored.`;
  if (result.guess === null) return `X repeats ${result.x}. Revealed without scoring.`;
  return `${result.guess === result.x ? "Matched" : "Missed"}: you chose ${result.guess}; X repeats ${result.x}.`;
}
export function resultEvidence(result: ListeningResult): string {
  const a = listeningScore(result, "A"),
    b = listeningScore(result, "B"),
    checks = assessment(result.state.current);
  return `<p>${htmlEscape(STIMULI[result.stimulus])}. Sa = ${result.state.base} Hz. Largest A/B pitch difference: ${pitchDifference(result).toFixed(6)} cents.</p><p>B’s count-row checks: lower Pa ${checks.lowers ? "passes" : "fails"}; ordered whole gaps ${checks.ordered ? "passes" : "fails"}. Both octaves close by construction. These are the displayed model conditions.</p><section class="table-scroll" tabindex="0" aria-label="Frozen post-retuning frequencies; scroll horizontally if needed"><table><caption>Frozen post-retuning pitches; rounded display</caption><thead><tr><th scope="col">Note</th><th scope="col">A, Hz</th><th scope="col">B, Hz</th><th scope="col">B − A, cents</th></tr></thead><tbody>${a.map((tone, i) => `<tr><th scope="row">${htmlEscape(tone.label)}</th><td>${tone.frequency.toFixed(6)}</td><td>${(b[i]?.frequency ?? 0).toFixed(6)}</td><td>${(1200 * Math.log2((b[i]?.frequency ?? tone.frequency) / tone.frequency)).toFixed(6)}</td></tr>`).join("")}</tbody></table></section>`;
}
export async function listeningReading(
  input: readonly ListeningResult[],
  options: ReadOptions = {},
): Promise<string> {
  const results = structuredClone(input),
    last = results.at(-1);
  if (!last) throw new Error("Reveal a listening attempt before saving its study.");
  const csv = `data:text/csv;base64,${base64(new TextEncoder().encode(listeningCSV(results)))}`;
  const record = `<section id="listening-record"><h2>Your revealed listening record</h2><p>Self-guided practice with immediate feedback and unlimited replay. This descriptive record does not measure a hearing threshold or establish an ancient tuning. Only completed digital playbacks are counted; physical sound delivery is not verified. Unfinished trials are omitted. The diagrams and editable tuning link above describe the last revealed attempt; each frozen pair is specified below.</p><p><a download="grama-listening-record.csv" href="${csv}">Download the complete attempt CSV</a></p>${results
    .map((r, i) => {
      const sounds = (["A", "B"] as const)
        .map((key) => {
          const uri = `data:audio/wav;base64,${base64(wav(listeningScore(r, key), FAMILY_NOTICE))}`;
          return `<p><strong>${key}</strong> (${key === "A" ? "saved witness" : "candidate"})</p><audio controls preload="none" src="${uri}"></audio><p><a download="grama-trial-${i + 1}-${key}.wav" href="${uri}">Download ${key} WAV</a></p>`;
        })
        .join("");
      return `<article><h3>Attempt ${i + 1}: ${htmlEscape(resultText(r))}</h3>${resultEvidence(r)}<p>A whole gaps: four = ${r.state.reference.four}, two = ${r.state.reference.two} cents. B whole gaps: four = ${r.state.current.four}, two = ${r.state.current.two} cents. B fourth/fifth lock: ${r.state.locked ? "on" : "off"}. Each three-count gap = (1,200 − 3 × four − 2 × two)/2. Completed playbacks: A ${r.completed.A}, B ${r.completed.B}, X ${r.completed.X}. X uses exactly ${r.x}'s sound.</p><p><a href="https://antonsoo.github.io/grama/tuning.html${htmlEscape(familyHash(r.state))}">Reopen this frozen tuning pair</a></p>${sounds}</article>`;
    })
    .join(
      "",
    )}<p>The count rows alone do not choose these frequencies. The Sanskrit and full printed evidence follow in the reading.</p></section>`;
  return familyReading(last.state, options, record);
}
