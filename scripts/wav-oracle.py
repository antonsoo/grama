"""Measure exported PCM zero crossings against literal, independent pitch tables."""
import array
import json
import math
from pathlib import Path
import statistics
import sys
import wave

folder = Path(sys.argv[1])
results = []
for model, frequencies in [
    ("ratio", [220 * 4 / 3, 330, 220 * 5 / 3, 220 * 4 / 3, 220 * 40 / 27, 220 * 5 / 3]),
    ("equal", [220 * 2 ** (k / 22) for k in [9, 13, 16, 9, 12, 16]]),
]:
    file = folder / f"{model}-comparison.wav"
    with wave.open(str(file), "rb") as w:
        assert w.getnchannels() == 1 and w.getsampwidth() == 2 and w.getframerate() == 44100
        rate = w.getframerate()
        pcm = array.array("h", w.readframes(w.getnframes()))
        if sys.byteorder != "little":
            pcm.byteswap()
    assert max(abs(v) for v in pcm) <= 6554
    measurements = []
    for index, expected in enumerate(frequencies):
        start = index * .72 + (.3 if index >= 3 else 0)
        # Stay within the flat part of the attack/release envelope.
        a, b = math.ceil((start + .08) * rate), math.floor((start + .48) * rate)
        crossings = []
        for sample in range(a, b - 1):
            if pcm[sample] <= 0 < pcm[sample + 1]:
                crossings.append(sample + (-pcm[sample]) / (pcm[sample + 1] - pcm[sample]))
        measured = rate / statistics.mean(y - x for x, y in zip(crossings, crossings[1:]))
        assert abs(measured - expected) < .002, (file, index, expected, measured)
        measurements.append({"tone": index + 1, "expectedHz": expected, "measuredHz": measured, "absoluteErrorHz": abs(measured - expected)})
    results.append({"file": file.name, "frames": len(pcm), "sampleRate": rate, "tones": measurements})
print(json.dumps({"method": "Linear-interpolated positive zero crossings in actual downloaded 16-bit PCM; independent literal frequency tables", "referenceSaHz": 220, "results": results}, indent=2))
