import { DEFAULT_FAMILY, type FamilyState } from "./core/family";
import {
  canAnswer,
  completedPlayback,
  finishTrial,
  identicalSound,
  type Lane,
  type ListeningResult,
  type ListeningTrial,
  listeningCSV,
  listeningScore,
  SESSION_LIMIT,
  STIMULI,
  type Stimulus,
  startTrial,
} from "./core/listening";
import { LISTENING_RECORD_LIMIT, listeningJSON, parseListeningJSON } from "./core/listening-record";
import { download } from "./files";
import { listeningReading, resultEvidence, resultText } from "./listening-export";
import type { ListeningPlayer } from "./player";
import { readingSave } from "./reading-save";

export function listeningExercise(
  player: ListeningPlayer,
  getState: () => FamilyState,
  setState: (state: FamilyState) => void,
): { invalidate: () => void; refreshControls: () => void } {
  const el = <T extends HTMLElement = HTMLElement>(id: string) => {
    const node = document.getElementById(`listening-${id}`);
    if (!node) throw new Error(`Missing listening-${id}`);
    return node as T;
  };
  const button = (id: string) => el<HTMLButtonElement>(id);
  const stimulus = el<HTMLSelectElement>("stimulus");
  let active: ListeningTrial | null = null;
  let revealed: ListeningResult | null = null;
  let results: ListeningResult[] = [];
  let revision = 0;
  function controls() {
    const mayAnswer = active !== null && canAnswer(active);
    button("answer-a").disabled = !mayAnswer;
    button("answer-b").disabled = !mayAnswer;
    button("reveal").disabled = active === null;
    button("start").disabled = results.length >= SESSION_LIMIT;
    for (const name of ["csv", "clear"]) button(name).disabled = results.length === 0;
    button("reading").disabled = results.length === 0 || savingReading();
    for (const key of ["A", "B", "X"] as const) {
      button(key.toLowerCase()).disabled = active === null && revealed === null;
      const trial = active ?? revealed;
      const count = trial?.completed[key] ?? 0;
      el(`${key.toLowerCase()}-count`).textContent =
        !active && revealed?.provenance === "reopened"
          ? `${count} recorded in file`
          : count
            ? `${count} completed`
            : "Not completed";
    }
  }
  function invalidate() {
    if (!active) return;
    player.stop();
    active = null;
    el("desk").hidden = true;
    revision++;
    controls();
    el("status").textContent =
      "Settings changed. The unrevealed trial was discarded. Begin again to freeze this pair; revealed attempts were kept.";
  }
  button("example").addEventListener("click", () => {
    const next = structuredClone(DEFAULT_FAMILY);
    next.base = getState().base;
    next.current.two += 10;
    stimulus.value = "pa";
    setState(next);
    el("status").textContent =
      "A ratio witness and a candidate ten cents apart at lowered Pa are ready. Freeze them to begin.";
  });
  button("start").addEventListener("click", () => {
    if (results.length >= SESSION_LIMIT) return;
    player.stop();
    revision++;
    revealed = null;
    const bit = crypto.getRandomValues(new Uint8Array(1))[0] ?? 0;
    active = startTrial(getState(), stimulus.value as Stimulus, bit & 1 ? "A" : "B");
    el("desk").hidden = false;
    el("result").hidden = true;
    el("capture").textContent =
      `Attempt ${results.length + 1} · ${STIMULI[active.stimulus]} · Sa ${active.state.base} Hz · frozen until reveal. Replaying X keeps the same assignment.`;
    el("status").textContent = identicalSound(active)
      ? "A and B generate identical samples for this selection. Replay the control and reveal; it will remain unscored. Change the pair or stimulus for a distinction."
      : "Hear A, B and X to the end. Replay in any order, then choose which example X repeats.";
    controls();
  });
  stimulus.addEventListener("change", invalidate);
  for (const key of ["A", "B", "X"] as const)
    button(key.toLowerCase()).addEventListener("click", () => {
      const trial = active ?? revealed;
      if (!trial) return;
      const capturedRevision = revision;
      void player.play(
        listeningScore(trial, key),
        `Playing ${key}.`,
        `${key} finished.`,
        () => {
          if (!active || revision !== capturedRevision) return;
          active = completedPlayback(active, key);
          controls();
          if (canAnswer(active))
            el("status").textContent =
              "A, B and X have each completed. Choose your answer, or replay any example.";
        },
        el("status"),
      );
    });
  function showRevealed(result: ListeningResult, number: number) {
    revealed = result;
    el("desk").hidden = false;
    el("capture").textContent =
      `Attempt ${number} · ${STIMULI[result.stimulus]} · Sa ${result.state.base} Hz · revealed and frozen. Replay A, B or X, or begin a new attempt with the current settings.`;
    el("status").textContent =
      `${resultText(result)}${result.provenance === "reopened" ? " Reopened record; past playback and answers are not verified here." : ""}`;
    el("result").innerHTML =
      `<h3>The pitches behind the answer</h3><p>${resultText(result)}</p>${resultEvidence(result)}`;
    el("result").hidden = false;
  }
  function appendAttempt(result: ListeningResult, number: number) {
    const row = document.createElement("li");
    const revisit = document.createElement("button");
    revisit.type = "button";
    revisit.textContent = `${STIMULI[result.stimulus]} · ${resultText(result)}${result.provenance === "reopened" ? " Reopened record." : ""}`;
    const attemptNumber = number;
    revisit.addEventListener("click", () => {
      player.stop();
      active = null;
      revealed = result;
      revision++;
      showRevealed(result, attemptNumber);
      el("capture").scrollIntoView({ block: "start" });
      controls();
    });
    row.append(revisit);
    el("history").append(row);
  }
  function summary() {
    const scored = results.filter((r) => r.guess !== null && !r.identical);
    const matches = scored.filter((r) => r.guess === r.x).length;
    const reopened = results.filter((r) => r.provenance === "reopened").length;
    el("summary").textContent =
      `${results.length} revealed; ${scored.length} scored; ${matches} matched. ${reopened ? `${reopened} reopened from a file; their recorded playbacks and answers are not verified in this tab. ` : ""}Descriptive practice only.${results.length >= SESSION_LIMIT ? " This twelve-attempt record is full. Save it, then clear to continue." : " Changes above affect only new attempts."}`;
  }
  function reveal(guess: Lane | null) {
    if (!active || (guess !== null && !canAnswer(active))) return;
    player.stop();
    const result = finishTrial(active, guess);
    results.push(result);
    active = null;
    revealed = result;
    revision++;
    showRevealed(result, results.length);
    appendAttempt(result, results.length);
    summary();
    controls();
  }
  button("answer-a").addEventListener("click", () => reveal("A"));
  button("answer-b").addEventListener("click", () => reveal("B"));
  button("reveal").addEventListener("click", () => reveal(null));
  button("stop").addEventListener("click", () => player.stop());
  button("csv").addEventListener("click", () =>
    download("grama-listening-record.csv", listeningCSV(results), "text/csv;charset=utf-8"),
  );
  button("clear").addEventListener("click", () => {
    // The unrevealed trial is independent of already revealed records.
    results = [];
    revealed = null;
    if (!active) {
      player.stop();
      el("desk").hidden = true;
    }
    el("history").replaceChildren();
    el("result").hidden = true;
    el("summary").textContent = "Revealed record cleared. New attempts start a fresh record.";
    if (active)
      el("capture").textContent =
        `Attempt 1 · ${STIMULI[active.stimulus]} · Sa ${active.state.base} Hz · frozen until reveal.`;
    controls();
  });
  const fingerprint = () =>
    JSON.stringify({
      record: session(),
      baseDraft: (document.getElementById("base") as HTMLInputElement).value,
    });
  const session = () => ({ state: getState(), stimulus: stimulus.value as Stimulus, results });
  button("json").addEventListener("click", () =>
    download("grama-listening-record.json", listeningJSON(session()), "application/json"),
  );
  let openRevision = 0;
  el<HTMLInputElement>("open").addEventListener("change", async (event) => {
    const input = event.target as HTMLInputElement,
      file = input.files?.[0];
    if (!file) return;
    el("open-status").textContent = "Opening listening record…";
    const request = ++openRevision,
      before = fingerprint(),
      trialRevision = revision;
    try {
      if (file.size > LISTENING_RECORD_LIMIT)
        throw new Error("A listening record must be under 64 KB.");
      const raw = await file.text();
      if (request !== openRevision || trialRevision !== revision || before !== fingerprint())
        throw new Error(
          "The experiment changed while the file was opening. Select the file again to replace the current record.",
        );
      const restored = parseListeningJSON(raw);
      // Everything is validated before any live state, record or sound changes.
      player.stop();
      setState(restored.state);
      revision++;
      active = null;
      revealed = null;
      results = restored.results;
      stimulus.value = restored.stimulus;
      el("history").replaceChildren();
      results.forEach((result, index) => {
        appendAttempt(result, index + 1);
      });
      el("desk").hidden = true;
      el("result").hidden = true;
      const last = results.at(-1);
      if (last) showRevealed(last, results.length);
      summary();
      el("open-status").textContent =
        "Reopened the tuning pair and revealed record. Past playback counts and answers come from this file; they are not verified in this tab. New trials begin with no playback credit.";
      controls();
    } catch (error) {
      if (request === openRevision)
        el("open-status").textContent =
          `${error instanceof Error ? error.message : "Could not read this record."} Your current experiment was kept.`;
    } finally {
      if (request === openRevision) input.value = "";
    }
  });
  const savingReading = readingSave(
    button("reading"),
    el("file-status"),
    (options) =>
      listeningReading(results, options, {
        state: getState(),
        stimulus: stimulus.value as Stimulus,
      }),
    "grama-listening-study.html",
    "Saved the revealed attempts, their frozen sounds and the full Sanskrit/source study.",
    () => results.length > 0,
  );
  controls();
  return { invalidate, refreshControls: controls };
}
