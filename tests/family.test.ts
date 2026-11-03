import assert from "node:assert/strict";
import { test } from "node:test";
import {
  assessment,
  DEFAULT_FAMILY,
  EQUAL_GAPS,
  FAMILY_NOTICE,
  familyFromHash,
  familyHash,
  familyJSON,
  familyScore,
  familyWave,
  OTHER_GAPS,
  parseFamily,
  parseFamilyJSON,
  positions,
  RATIO_GAPS,
} from "../src/core/family";
import { exactNotes, value } from "../src/core/tuning";
import { familyRuler, gapDescription } from "../src/family-figures";

test("failed candidate diagrams and descriptions report a raised or unchanged Pa", () => {
  const raised = { four: 180, two: 60 },
    unchanged = { four: 200, two: 100 };
  assert.match(
    familyRuler({ ...DEFAULT_FAMILY, current: raised, locked: false }),
    /RAISED Pa \(failed\)/,
  );
  assert.match(
    familyRuler({ ...DEFAULT_FAMILY, current: unchanged, locked: false }),
    /UNCHANGED Pa \(failed\)/,
  );
  assert.match(gapDescription(raised), /Pa rises by 90\.000000 cents/);
  assert.match(gapDescription(unchanged), /Pa stays unchanged/);
});

test("both existing sound models remain members of the whole-gap family", () => {
  for (const grama of ["sadja", "madhyama"] as const) {
    const expected = exactNotes(grama).map(value);
    positions(RATIO_GAPS, grama).forEach((c, i) => {
      assert(Math.abs(2 ** (c / 1200) - (expected[i] ?? 0)) < 1e-14);
    });
    const slots = grama === "sadja" ? [0, 3, 5, 9, 13, 16, 18, 22] : [0, 3, 5, 9, 12, 16, 18, 22];
    positions(EQUAL_GAPS, grama).forEach((c, i) => {
      assert(Math.abs(c - (1200 * (slots[i] ?? 0)) / 22) < 1e-10);
    });
  }
});

test("portable WAV keeps standard PCM and includes an even-padded RIFF copyright notice", () => {
  const bytes = familyWave(DEFAULT_FAMILY),
    view = new DataView(bytes.buffer);
  assert.equal(view.getUint32(4, true), bytes.length - 8);
  const end = 44 + view.getUint32(40, true),
    decode = (a: number, b: number) => new TextDecoder().decode(bytes.subarray(a, b));
  assert.equal(decode(end, end + 4), "LIST");
  assert.equal(decode(end + 8, end + 16), "INFOICOP");
  assert.equal(end + 8 + view.getUint32(end + 4, true), bytes.length);
  assert.equal(decode(end + 20, end + 20 + view.getUint32(end + 16, true)), `${FAMILY_NOTICE}\0`);
  assert.equal(bytes.length % 2, 0);
  assert(familyJSON(DEFAULT_FAMILY).includes("PolyForm-Noncommercial-1.0.0"));
});
test("a changed two-count gap preserves the locked fourth/fifth, but changes Pa's lowering", () => {
  const changed = { ...RATIO_GAPS, two: RATIO_GAPS.two + 10 };
  for (const note of [3, 4])
    assert(
      Math.abs(
        (positions(changed, "sadja")[note] ?? 0) - (positions(RATIO_GAPS, "sadja")[note] ?? 0),
      ) < 1e-10,
    );
  assert(Math.abs(assessment(changed).lowering - assessment(RATIO_GAPS).lowering - 10) < 1e-10);
  assert(assessment(changed).ordered);
});
test("closing the octave can fail the source lowering instruction or the chosen gap ordering", () => {
  const unmoved = assessment({ four: 200, two: 100 });
  assert.equal(unmoved.octave, 1200);
  assert.equal(unmoved.lowering, 0);
  assert(!unmoved.lowers);
  assert(!unmoved.ordered);
  const reversed = assessment({ four: 180, two: 60 });
  assert.equal(reversed.octave, 1200);
  assert(reversed.lowering < 0);
  assert(!reversed.lowers);
  const crossed = assessment({ four: 260, two: 150 });
  assert(crossed.lowers);
  assert(!crossed.ordered);
});
test("URL and JSON records retain both witnesses, including a failed current candidate", () => {
  const state = {
    ...structuredClone(DEFAULT_FAMILY),
    current: { four: 200, two: 100 },
    locked: false,
    base: 432,
  };
  assert.deepEqual(familyFromHash(familyHash(state)), state);
  assert.deepEqual(parseFamilyJSON(familyJSON(state)), state);
  assert.throws(() => parseFamily({ ...state, reference: state.current }));
  assert.throws(() => parseFamily({ ...state, locked: true }));
  assert.throws(() => parseFamily({ ...state, current: { four: NaN, two: 100 } }));
  assert.throws(() => parseFamily({ ...state, current: { four: 230, two: 150.1 } }));
  assert.throws(() =>
    parseFamilyJSON(JSON.stringify({ format: "grama-tuning-family-v1", state, frequencies: [] })),
  );
  assert.throws(() => familyFromHash(`${familyHash(state)}&a=200`));
  assert.throws(() => familyFromHash("#a=&c=100&ra=200&rc=120&hz=220&lock=0"));
});
test("the two-witness listening score uses the same reference pitch and only retunes Pa in each witness", () => {
  const state = { ...DEFAULT_FAMILY, current: OTHER_GAPS, locked: false };
  const events = familyScore(state, "compare");
  assert.equal(events.length, 12);
  // Literal modern example: A=230, C=90, B=165. Initial Ma=485,
  // Pa=715, Dha=880; lowering Pa by 65 cents puts it at 650.
  const expected = [485, 715, 880, 485, 650, 880];
  events.slice(6).forEach((event, i) => {
    assert(Math.abs(event.frequency - 220 * 2 ** ((expected[i] ?? 0) / 1200)) < 1e-10);
  });
  for (const offset of [0, 6]) {
    assert.equal(events[offset]?.frequency, events[offset + 3]?.frequency);
    assert.equal(events[offset + 2]?.frequency, events[offset + 5]?.frequency);
  }
});
