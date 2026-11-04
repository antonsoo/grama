import assert from "node:assert/strict";
import { test } from "node:test";
import { samples } from "../src/core/audio";
import { DEFAULT_FAMILY, EQUAL_GAPS, RATIO_GAPS } from "../src/core/family";
import {
  canAnswer,
  completedPlayback,
  finishTrial,
  identicalSound,
  listeningCSV,
  listeningScore,
  pitchDifference,
  startTrial,
} from "../src/core/listening";

const pair = () => ({
  ...structuredClone(DEFAULT_FAMILY),
  current: { ...RATIO_GAPS, two: RATIO_GAPS.two + 10 },
});
test("X duplicates all A or B samples, including timing, for every stimulus", () => {
  for (const stimulus of ["pa", "phrase", "ma"] as const)
    for (const x of ["A", "B"] as const) {
      const trial = startTrial(pair(), stimulus, x);
      assert.deepEqual(samples(listeningScore(trial, "X")), samples(listeningScore(trial, x)));
    }
});
test("locked Ma is sample-identical while lowered Pa differs by ten cents", () => {
  assert.equal(identicalSound(startTrial(pair(), "ma", "A")), true);
  assert.equal(pitchDifference(startTrial(pair(), "ma", "A")), 0);
  assert.equal(identicalSound(startTrial(pair(), "pa", "B")), false);
  assert.ok(Math.abs(pitchDifference(startTrial(pair(), "pa", "B")) - 10) < 1e-8);
  const free = pair();
  free.locked = false;
  free.current = { ...EQUAL_GAPS };
  assert.equal(identicalSound(startTrial(free, "ma", "B")), false);
});
test("incomplete or identical listening cannot acquire a scored answer", () => {
  let trial = startTrial(pair(), "pa", "A");
  assert.throws(() => finishTrial(trial, "A"), /Hear A, B and X/);
  trial = completedPlayback(completedPlayback(trial, "A"), "B");
  assert.equal(canAnswer(trial), false);
  trial = completedPlayback(trial, "X");
  assert.equal(canAnswer(trial), true);
  assert.equal(finishTrial(trial, "B").guess, "B");
  let control = startTrial(pair(), "ma", "B");
  for (const key of ["A", "B", "X"] as const) control = completedPlayback(control, key);
  assert.equal(canAnswer(control), false);
  assert.throws(() => finishTrial(control, "B"));
  assert.equal(finishTrial(control, null).identical, true);
});
test("trial and reveal capture settings independently, retaining failed candidates", () => {
  const state = pair(),
    trial = startTrial(state, "pa", "B");
  state.current.two = 140;
  assert.notEqual(state.current.two, trial.state.current.two);
  const result = finishTrial(trial, null);
  trial.state.current.two = 100;
  assert.notEqual(trial.state.current.two, result.state.current.two);
  const failed = pair();
  failed.locked = false;
  failed.current = { four: 200, two: 100 };
  assert.equal(startTrial(failed, "pa", "A").state.current.four, 200);
});
test("CSV keeps misses, unscored reveals, settings and completed plays", () => {
  let trial = startTrial(pair(), "pa", "B");
  for (const key of ["A", "B", "X"] as const) trial = completedPlayback(trial, key);
  const csv = listeningCSV([
    finishTrial(trial, "A"),
    finishTrial(trial, null),
    finishTrial(startTrial(pair(), "ma", "A"), null),
  ]);
  assert.match(csv, /,B,A,missed,1,1,1,10\.000000000/);
  assert.match(csv, /revealed_unscored/);
  assert.match(csv, /identical_unscored/);
});
