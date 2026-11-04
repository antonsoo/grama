import assert from "node:assert/strict";
import { test } from "node:test";
import { DEFAULT_FAMILY, FAMILY_NOTICE, RATIO_GAPS } from "../src/core/family";
import { completedPlayback, finishTrial, startTrial } from "../src/core/listening";
import { listeningJSON, parseListeningJSON } from "../src/core/listening-record";

const state = () => ({
  ...structuredClone(DEFAULT_FAMILY),
  current: { ...RATIO_GAPS, two: RATIO_GAPS.two + 10 },
});
function answered() {
  let trial = startTrial(state(), "pa", "A");
  for (const key of ["A", "B", "X"] as const) trial = completedPlayback(trial, key);
  return finishTrial(trial, "B");
}
const record = () =>
  JSON.parse(listeningJSON({ state: state(), stimulus: "pa", results: [answered()] }));
test("portable records preserve frozen pairs and live settings but label reopened claims", () => {
  const original = record();
  original.state.base = 220.5;
  const restored = parseListeningJSON(JSON.stringify(original));
  assert.equal(restored.state.base, 220.5);
  assert.equal(restored.results[0]?.state.base, 220);
  assert.equal(restored.results[0]?.guess, "B");
  assert.equal(restored.results[0]?.provenance, "reopened");
  assert.equal(restored.results[0]?.identical, false);
  assert.equal(restored.results[0]?.completed.X, 1);
  assert.equal(JSON.parse(listeningJSON(restored)).results[0].provenance, undefined);
});
test("contradictory scores, impossible completion counts and supplied derived evidence fail", () => {
  for (const mutate of [
    (r: ReturnType<typeof record>) => {
      r.results[0].completed.X = 0;
    },
    (r: ReturnType<typeof record>) => {
      r.results[0].completed.A = -1;
    },
    (r: ReturnType<typeof record>) => {
      r.results[0].completed.B = 0.5;
    },
    (r: ReturnType<typeof record>) => {
      r.results[0].completed.X = 1000001;
    },
    (r: ReturnType<typeof record>) => {
      r.results[0].identical = false;
    },
    (r: ReturnType<typeof record>) => {
      r.results[0].provenance = "this-tab";
    },
    (r: ReturnType<typeof record>) => {
      r.results[0].stimulus = "ma";
    },
    (r: ReturnType<typeof record>) => {
      r.results[0].guess = "C";
    },
    (r: ReturnType<typeof record>) => {
      r.results[0].x = "X";
    },
    (r: ReturnType<typeof record>) => {
      r.results[0].stimulus = "constructor";
    },
    (r: ReturnType<typeof record>) => {
      r.results[0].state.base = null;
    },
  ]) {
    const input = record();
    mutate(input);
    assert.throws(() => parseListeningJSON(JSON.stringify(input)));
  }
});
test("an identical control or a failed candidate remains explicitly unscored on reopen", () => {
  const control = finishTrial(startTrial(state(), "ma", "B"), null);
  const failed = state();
  failed.locked = false;
  failed.current = { four: 200, two: 100 };
  const reading = parseListeningJSON(
    listeningJSON({
      state: failed,
      stimulus: "phrase",
      results: [control, finishTrial(startTrial(failed, "phrase", "A"), null)],
    }),
  );
  assert.equal(reading.results[0]?.identical, true);
  assert.equal(reading.results[0]?.guess, null);
  assert.equal(reading.results[1]?.state.current.four, 200);
});
test("records bound size and length and reject replaced notices and unrelated objects", () => {
  assert.throws(() => parseListeningJSON(" ".repeat(65537)), /64 KB/);
  for (const input of [
    null,
    [],
    { format: "grama-listening-v1" },
    { ...record(), notice: "changed" },
    { ...record(), results: Array(13).fill(record().results[0]) },
    { ...record(), activeX: "A" },
    { ...record(), stimulus: "__proto__" },
    { ...record(), state: { ...state(), locked: "yes" } },
  ])
    assert.throws(() => parseListeningJSON(JSON.stringify(input)));
  assert.equal(record().notice, FAMILY_NOTICE);
  assert.equal(
    parseListeningJSON(listeningJSON({ state: state(), stimulus: "pa", results: [] })).results
      .length,
    0,
  );
});
