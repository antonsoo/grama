"""Independent literal pitch tables; no import or reimplementation of the TS product walk."""
import sys
import json
import math
from fractions import Fraction

ratios = {
    "sadja": [Fraction(x) for x in ["1", "10/9", "32/27", "4/3", "3/2", "5/3", "16/9", "2"]],
    "madhyama": [Fraction(x) for x in ["1", "10/9", "32/27", "4/3", "40/27", "5/3", "16/9", "2"]],
}
slots = {"sadja": [0, 3, 5, 9, 13, 16, 18, 22], "madhyama": [0, 3, 5, 9, 12, 16, 18, 22]}
named = {"sadja": [4, 3, 2, 4, 4, 3, 2], "madhyama": [4, 3, 2, 4, 3, 4, 2]}
seen = set()
for line in sys.stdin:
    case = json.loads(line)
    grama, model, start = case["grama"], case["model"], case["start"]
    key = grama, model, start
    assert key not in seen
    seen.add(key)
    assert case["incoming"] == named[grama]
    expected = [float(r) if model == "ratios" else 2 ** (slot / 22) for r, slot in zip(ratios[grama], slots[grama])]
    for actual, want in zip(case["factors"], expected, strict=True):
        assert math.isclose(actual, want, rel_tol=1e-14)
    assert [Fraction(r["n"], r["d"]) for r in case["ratios"]] == ratios[grama]
    expected_order = [(start + k) % 7 for k in range(8)]
    assert [t["note"] for t in case["sequence"]] == expected_order
    for k, t in enumerate(case["sequence"]):
        pitch = expected[expected_order[k]] * (2 if start + k >= 7 else 1) * 220
        assert math.isclose(t["frequency"], pitch, rel_tol=1e-14)
    assert case["outgoing"] == [named[grama][(start + k + 1) % 7] for k in range(7)]
assert len(seen) == 28, f"Missing cases: {len(seen)}"
print("28 distinct grama/model/start cases; 224 ordered pitches agree with literal Fraction and count-position tables.")
