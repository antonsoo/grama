import assert from "node:assert/strict";
import { test } from "node:test";
import { SAMPLE_RATE, samples, score, wav } from "../src/core/audio";
import {
  csv,
  DEFAULT,
  exactNotes,
  fraction,
  fromHash,
  incoming,
  lowering,
  noteFactors,
  outgoing,
  parsePose,
  poseHash,
  sequence,
} from "../src/core/tuning";
import { comparisonJSON, parseComparison } from "../src/files";

test("the named assignments and ascending gaps preserve their different conventions", () => {
  assert.deepEqual(incoming("sadja"), [4, 3, 2, 4, 4, 3, 2]);
  assert.deepEqual(incoming("madhyama"), [4, 3, 2, 4, 3, 4, 2]);
  assert.deepEqual(outgoing("sadja"), [3, 2, 4, 4, 3, 2, 4]);
  assert.deepEqual(outgoing("madhyama"), [3, 2, 4, 3, 4, 2, 4]);
  assert.equal(
    outgoing("sadja").reduce((a, b) => a + b),
    22,
  );
  assert.equal(
    outgoing("madhyama").reduce((a, b) => a + b),
    22,
  );
});
test("exact modern ratios agree with an independently specified note table", () => {
  assert.deepEqual(
    exactNotes("sadja"),
    [
      [1, 1],
      [10, 9],
      [32, 27],
      [4, 3],
      [3, 2],
      [5, 3],
      [16, 9],
      [2, 1],
    ].map(([n, d]) => fraction(n ?? 1, d)),
  );
  assert.deepEqual(
    exactNotes("madhyama"),
    [
      [1, 1],
      [10, 9],
      [32, 27],
      [4, 3],
      [40, 27],
      [5, 3],
      [16, 9],
      [2, 1],
    ].map(([n, d]) => fraction(n ?? 1, d)),
  );
  assert.ok(Math.abs(lowering("ratios") - 1200 * Math.log2(81 / 80)) < 1e-10);
  assert.ok(Math.abs(lowering("equal") - 1200 / 22) < 1e-10);
});
test("only Pa changes in either pitch assumption, regardless of the chosen start", () => {
  for (const model of ["ratios", "equal"] as const) {
    const a = noteFactors("sadja", model),
      b = noteFactors("madhyama", model);
    assert.deepEqual(
      a.map((v, i) => v === (b[i] ?? 0)),
      [true, true, true, true, false, true, true, true],
    );
    for (let start = 0; start < 7; start++) {
      const tones = sequence({ ...DEFAULT, model, start });
      assert.equal(tones.length, 8);
      assert.ok(Math.abs((tones[7]?.frequency ?? 0) / (tones[0]?.frequency ?? 1) - 2) < 1e-14);
      assert.equal(tones[0]?.frequency, (a[start] ?? 1) * 220);
      assert.ok(tones.slice(1).every((t, i) => t.frequency > (tones[i]?.frequency ?? 0)));
    }
  }
});
test("strict saved comparisons reject supplied or nonfinite pitch data atomically", () => {
  assert.deepEqual(parseComparison(comparisonJSON(DEFAULT)), DEFAULT);
  for (const bad of [
    null,
    [],
    { ...DEFAULT, start: 7 },
    { ...DEFAULT, start: 1.5 },
    { ...DEFAULT, base: NaN },
    { ...DEFAULT, base: 0 },
    { ...DEFAULT, grama: "gandhara" },
    { ...DEFAULT, frequencies: [220, 440] },
    { ...DEFAULT, model: "ancient" },
  ])
    assert.throws(() => parsePose(bad));
  assert.throws(() =>
    parseComparison(JSON.stringify({ format: "grama-comparison-v1", pose: DEFAULT, pitches: [] })),
  );
  assert.throws(() => parseComparison(" ".repeat(65537)));
  assert.throws(() => parseComparison('{"format":"grama-comparison-v1","pose":'));
});
test("share links retain the tuning, start, reference and explicit assumption", () => {
  const p = { grama: "madhyama", start: 6, model: "equal", base: 432 } as const;
  assert.deepEqual(fromHash(poseHash(p)), p);
  assert.throws(() => fromHash("#g=madhyama&s=3&m=equal&hz=no"));
  assert.deepEqual(fromHash(""), DEFAULT);
});
test("audio scores compare fixed Ma and Dha around the two Pa pitches", () => {
  const events = score(DEFAULT, "context");
  assert.deepEqual(
    events.map((e) => e.note),
    [3, 4, 5, 3, 4, 5],
  );
  assert.deepEqual(
    events.map((e) => e.frequency),
    [(220 * 4) / 3, 330, (220 * 5) / 3, (220 * 4) / 3, (220 * 40) / 27, (220 * 5) / 3],
  );
  assert.ok(
    events
      .slice(1)
      .every((e, i) => e.start >= (events[i]?.start ?? 0) + (events[i]?.duration ?? 0)),
  );
});
test("the listening WAV preserves sample rate, bounded PCM and the shared render", () => {
  const events = score(DEFAULT, "context"),
    pcm = samples(events),
    bytes = wav(events),
    v = new DataView(bytes.buffer);
  assert.equal(new TextDecoder().decode(bytes.slice(0, 4)), "RIFF");
  assert.equal(v.getUint32(4, true), bytes.length - 8);
  assert.equal(v.getUint16(22, true), 1);
  assert.equal(v.getUint32(24, true), SAMPLE_RATE);
  assert.equal(v.getUint16(34, true), 16);
  assert.equal(v.getUint32(40, true), pcm.length * 2);
  for (let i = 0; i < pcm.length; i++)
    assert.equal(v.getInt16(44 + i * 2, true), Math.round((pcm[i] ?? 0) * 32767) || 0);
  assert.equal(pcm[0], 0);
  assert.equal(pcm.at(-1), 0);
  assert.ok(pcm.every((x) => Number.isFinite(x) && Math.abs(x) <= 0.201));
  assert.throws(() => samples([{ frequency: NaN, start: 0, duration: 1, note: 0, label: "" }]));
  assert.throws(() => samples([{ frequency: 220, start: 31, duration: 1, note: 0, label: "" }]));
});
test("CSV contains both complete pitch rows and labels the added assumption", () => {
  const rows = csv(DEFAULT).trim().split("\n");
  assert.equal(rows.length, 17);
  assert.match(rows[0] ?? "", /modern pitch assumption/);
  assert.ok(rows.includes("madhyama,Pa,3,325.92592593,680.44871127,40/27"));
  assert.ok(!csv({ ...DEFAULT, model: "equal" }).includes("40/27"));
});
