"""Check the TS pitch walk against named-note closed forms and Decimal arithmetic."""
from decimal import Decimal, getcontext
import json
import math
import sys

getcontext().prec = 50
checked = valid = locked = 0
for line in sys.stdin:
    case = json.loads(line)
    a, c = [Decimal(str(case["gaps"][key])) for key in ("four", "two")]
    b = (Decimal(1200) - 3*a - 2*c)/2
    # Independent named-note expressions, rather than walking the product's count row.
    initial = [0, b, b+c, a+b+c, 2*a+b+c, 2*a+2*b+c, 2*a+2*b+2*c, 1200]
    lowered = initial.copy()
    lowered[4] = a+2*b+c
    for key, expected in [("initial", initial), ("lowered", lowered)]:
        for actual, want in zip(case[key], expected, strict=True):
            assert abs(actual-float(want)) < 1e-9, (case, key, want)
    report = case["report"]
    assert abs(report["three"]-float(b)) < 1e-10
    assert abs(report["lowering"]-float(a-b)) < 1e-9
    assert report["lowers"] == (a-b > Decimal("1e-8"))
    assert report["ordered"] == (a-b > Decimal("1e-8") and b-c > Decimal("1e-8"))
    assert abs(report["octave"]-1200) < 1e-9
    for index in [0, 1, 2, 3, 5, 6, 7]:
        assert abs(case["initial"][index]-case["lowered"][index]) < 1e-9
    if case.get("locked"):
        for note, ratio in [(3, Decimal(4)/3), (4, Decimal(3)/2)]:
            frequency_ratio = (Decimal(2).ln()*Decimal(str(case["initial"][note]))/1200).exp()
            assert abs(frequency_ratio-ratio) < Decimal("1e-14")
        locked += 1
    else:
        checked += 1
        valid += report["ordered"]
assert checked == 7371 and locked == 91
print(json.dumps({"method":"Independent named-note closed forms; 50-digit Decimal ratio checks", "gridCandidates":checked,"orderedWitnesses":valid,"lockedCandidates":locked,"withinWitnessOnlyPaChanges":True},indent=2))
