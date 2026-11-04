import assert from "node:assert/strict";
import { test } from "node:test";
import {
  attachmentCounts,
  attachmentFactors,
  attachmentFromSearch,
  attachmentRatios,
  attachmentScore,
  movedNotes,
} from "../src/core/attachment";
import { comparisonJSON, parseComparison, parseComparisonRecord } from "../src/core/record";
import { DEFAULT, ratioText } from "../src/core/tuning";

test("the misreading preserves the count total, octave, fourth and fifth but moves Dha", () => {
  assert.deepEqual(attachmentCounts("sadja", "leaving"), [4, 3, 2, 4, 4, 3, 2]);
  assert.deepEqual(attachmentCounts("sadja", "arriving"), [3, 2, 4, 4, 3, 2, 4]);
  for (const placement of ["arriving", "leaving"] as const)
    for (const grama of ["sadja", "madhyama"] as const) {
      assert.equal(
        attachmentCounts(grama, placement).reduce((sum, n) => sum + n, 0),
        22,
      );
      assert.equal(ratioText(attachmentRatios(grama, placement)[7] ?? { n: 0, d: 1 }), "2/1");
    }
  assert.deepEqual(attachmentRatios("sadja", "leaving").map(ratioText), [
    "1/1",
    "9/8",
    "5/4",
    "4/3",
    "3/2",
    "27/16",
    "15/8",
    "2/1",
  ]);
  assert.deepEqual(attachmentRatios("madhyama", "leaving").map(ratioText), [
    "1/1",
    "9/8",
    "5/4",
    "4/3",
    "3/2",
    "5/3",
    "15/8",
    "2/1",
  ]);
  for (const placement of ["arriving", "leaving"] as const) {
    const row = attachmentRatios("sadja", placement);
    assert.equal(ratioText(row[3] ?? { n: 0, d: 1 }), "4/3");
    assert.equal(ratioText(row[4] ?? { n: 0, d: 1 }), "3/2");
  }
});
test("the two models expose the same misplaced note without changing their source counts", () => {
  for (const model of ["ratios", "equal"] as const) {
    assert.deepEqual(movedNotes("arriving", model), [4]);
    assert.deepEqual(movedNotes("leaving", model), [5]);
    for (const attachment of ["arriving", "leaving"] as const) {
      const score = attachmentScore({ ...DEFAULT, model, base: 220.5, start: 6 }, attachment);
      assert.equal(score.length, 6);
      assert.equal(score[0]?.frequency, score[3]?.frequency);
      assert.equal(score[1]?.frequency === score[4]?.frequency, attachment === "leaving");
      assert.equal(score[2]?.frequency === score[5]?.frequency, attachment === "arriving");
      assert.equal(attachmentFactors("madhyama", attachment, model).at(-1), 2);
    }
  }
});
test("comparison v3 keeps the placement, while both legacy formats still reopen", () => {
  for (const attachment of ["arriving", "leaving"] as const) {
    const json = comparisonJSON(DEFAULT, attachment);
    assert.equal(JSON.parse(json).format, "grama-comparison-v3");
    assert.deepEqual(parseComparisonRecord(json), { pose: DEFAULT, attachment });
    assert.deepEqual(parseComparison(json), DEFAULT);
    const wrong = JSON.parse(json);
    wrong.attachment = "constructor";
    assert.throws(() => parseComparisonRecord(JSON.stringify(wrong)));
  }
  for (const raw of [
    comparisonJSON(DEFAULT),
    JSON.stringify({ format: "grama-comparison-v1", pose: DEFAULT }),
  ])
    assert.deepEqual(parseComparisonRecord(raw), { pose: DEFAULT, attachment: "leaving" });
});
test("diagnostic links reject duplicate, empty or unknown placement values", () => {
  assert.equal(attachmentFromSearch(""), "leaving");
  assert.equal(attachmentFromSearch("?attachment=arriving"), "arriving");
  assert.equal(attachmentFromSearch("?attachment=leaving&other=kept"), "leaving");
  for (const search of [
    "?attachment=arriving&attachment=leaving",
    "?attachment=",
    "?attachment=other",
  ])
    assert.throws(() => attachmentFromSearch(search));
});
