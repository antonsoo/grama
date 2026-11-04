import { type SoundEvent, samples } from "./audio";
import { assessment, type FamilyState, parseFamily, positions } from "./family";
import { NOTES } from "./tuning";

export type Lane = "A" | "B";
export type ListeningKey = Lane | "X";
export type Stimulus = "pa" | "phrase" | "ma";
export const STIMULI: Record<Stimulus, string> = {
  pa: "Lowered Pa",
  phrase: "Ma–Pa–Dha after retuning",
  ma: "Ma control",
};
export const SESSION_LIMIT = 12;
export interface ListeningTrial {
  state: FamilyState;
  stimulus: Stimulus;
  x: Lane;
  completed: Record<ListeningKey, number>;
}
export interface ListeningResult extends ListeningTrial {
  guess: Lane | null;
  identical: boolean;
  provenance: "this-tab" | "reopened";
}
export function startTrial(state: FamilyState, stimulus: Stimulus, x: Lane): ListeningTrial {
  if (!Object.hasOwn(STIMULI, stimulus) || !["A", "B"].includes(x))
    throw new Error("Choose a supported listening exercise.");
  return { state: parseFamily(state), stimulus, x, completed: { A: 0, B: 0, X: 0 } };
}
/** The same event sequence supplies live playback and portable WAVs. X has no
 * acoustic marker: its data is exactly A's or B's, including onset and duration. */
export function listeningScore(trial: ListeningTrial, key: ListeningKey): SoundEvent[] {
  const lane = key === "X" ? trial.x : key;
  const pitches = positions(trial.state[lane === "A" ? "reference" : "current"], "madhyama");
  const notes = trial.stimulus === "phrase" ? [3, 4, 5] : [trial.stimulus === "ma" ? 3 : 4];
  return notes.map((note, index) => ({
    // Cancellation in octave closure can leave sub-nanocent differences in a
    // fixed note. Canonicalize below the precision of this numerical model.
    frequency: trial.state.base * 2 ** (Math.round((pitches[note] ?? 0) * 1e9) / 1e9 / 1200),
    start: index * 0.72,
    duration: 0.6,
    note,
    label: NOTES[note]?.short ?? "",
  }));
}
export function identicalSound(trial: ListeningTrial): boolean {
  const a = samples(listeningScore(trial, "A")),
    b = samples(listeningScore(trial, "B"));
  return a.length === b.length && a.every((value, index) => value === b[index]);
}
export function completedPlayback(trial: ListeningTrial, key: ListeningKey): ListeningTrial {
  return { ...trial, completed: { ...trial.completed, [key]: trial.completed[key] + 1 } };
}
export function canAnswer(trial: ListeningTrial): boolean {
  return Object.values(trial.completed).every((count) => count > 0) && !identicalSound(trial);
}
export function finishTrial(trial: ListeningTrial, guess: Lane | null): ListeningResult {
  if (guess !== null && !canAnswer(trial))
    throw new Error("Hear A, B and X to the end before answering. Identical sounds are unscored.");
  return {
    ...structuredClone(trial),
    guess,
    identical: identicalSound(trial),
    provenance: "this-tab",
  };
}
export function pitchDifference(trial: ListeningTrial): number {
  const a = listeningScore(trial, "A"),
    b = listeningScore(trial, "B");
  return Math.max(
    ...a.map((tone, index) =>
      Math.abs(1200 * Math.log2((b[index]?.frequency ?? tone.frequency) / tone.frequency)),
    ),
  );
}
export function listeningCSV(results: readonly ListeningResult[]): string {
  const rows = [
    "# Grama listening practice. Copyright (c) 2026 Anthony Mercer. PolyForm-Noncommercial-1.0.0.",
    "# Descriptive attempts only; no hearing threshold or ancient tuning is established. No unfinished trial is exported.",
    "trial,stimulus,Sa_hz,A_four_cents,A_two_cents,B_four_cents,B_two_cents,B_lock,B_ordered_gaps,B_Pa_lowers,X,answer,outcome,A_completed,B_completed,X_completed,max_pitch_difference_cents,record_origin",
  ];
  results.forEach((r, index) => {
    rows.push(
      [
        index + 1,
        r.stimulus,
        r.state.base,
        r.state.reference.four,
        r.state.reference.two,
        r.state.current.four,
        r.state.current.two,
        r.state.locked,
        assessment(r.state.current).ordered,
        assessment(r.state.current).lowers,
        r.x,
        r.guess ?? "revealed",
        r.identical
          ? "identical_unscored"
          : r.guess === null
            ? "revealed_unscored"
            : r.guess === r.x
              ? "matched"
              : "missed",
        r.completed.A,
        r.completed.B,
        r.completed.X,
        pitchDifference(r).toFixed(9),
        r.provenance,
      ].join(","),
    );
  });
  return `${rows.join("\n")}\n`;
}
