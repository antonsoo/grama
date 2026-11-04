import { FAMILY_NOTICE, type FamilyState, parseFamily } from "./family";
import {
  finishTrial,
  type ListeningResult,
  type ListeningTrial,
  SESSION_LIMIT,
  STIMULI,
  type Stimulus,
} from "./listening";

export const LISTENING_RECORD_LIMIT = 65536;
export interface ListeningSession {
  state: FamilyState;
  stimulus: Stimulus;
  results: ListeningResult[];
}
function object(input: unknown, keys: string, label: string): Record<string, unknown> {
  if (
    !input ||
    typeof input !== "object" ||
    Array.isArray(input) ||
    Object.keys(input).sort().join(",") !== keys
  )
    throw new Error(`Expected ${label} with exactly ${keys}.`);
  return input as Record<string, unknown>;
}
function stimulus(input: unknown): Stimulus {
  if (typeof input !== "string" || !Object.hasOwn(STIMULI, input))
    throw new Error("Choose lowered Pa, the three-note phrase or the Ma control.");
  return input as Stimulus;
}
function result(input: unknown): ListeningResult {
  const data = object(input, "completed,guess,state,stimulus,x", "a revealed attempt");
  if (
    (data.x !== "A" && data.x !== "B") ||
    (data.guess !== "A" && data.guess !== "B" && data.guess !== null)
  )
    throw new Error("X and scored answers must name A or B. A reveal has a null answer.");
  const completed = object(data.completed, "A,B,X", "recorded playback counts");
  const counts = { A: 0, B: 0, X: 0 };
  for (const key of ["A", "B", "X"] as const) {
    const value = completed[key];
    if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 0 || value > 1000000)
      throw new Error("Recorded playback counts must be integers from 0 to 1,000,000.");
    counts[key] = value;
  }
  const trial: ListeningTrial = {
    state: parseFamily(data.state),
    stimulus: stimulus(data.stimulus),
    x: data.x,
    completed: counts,
  };
  // Recompute identity and answer eligibility from the frozen pitches. Stored
  // scores, equality flags and supplied provenance are never accepted as proof.
  return { ...finishTrial(trial, data.guess), provenance: "reopened" };
}
export function parseListeningJSON(raw: string): ListeningSession {
  if (raw.length > LISTENING_RECORD_LIMIT)
    throw new Error("A listening record must be under 64 KB.");
  const data = object(
    JSON.parse(raw),
    "format,notice,results,state,stimulus",
    "a listening record",
  );
  if (data.format !== "grama-listening-v1" || data.notice !== FAMILY_NOTICE)
    throw new Error("Expected a grama-listening-v1 record with its original notice.");
  if (!Array.isArray(data.results) || data.results.length > SESSION_LIMIT)
    throw new Error(`A listening record can contain at most ${SESSION_LIMIT} revealed attempts.`);
  return {
    state: parseFamily(data.state),
    stimulus: stimulus(data.stimulus),
    results: data.results.map(result),
  };
}
export function listeningJSON(
  session: Omit<ListeningSession, "results"> & { results: readonly ListeningResult[] },
): string {
  // Only revealed attempts leave this tab. No pending X assignment is serialized.
  const data = {
    format: "grama-listening-v1",
    notice: FAMILY_NOTICE,
    state: session.state,
    stimulus: session.stimulus,
    results: session.results.map(({ state, stimulus, x, completed, guess }) => ({
      state,
      stimulus,
      x,
      completed,
      guess,
    })),
  };
  const raw = `${JSON.stringify(data, null, 2)}\n`;
  parseListeningJSON(raw);
  return raw;
}
