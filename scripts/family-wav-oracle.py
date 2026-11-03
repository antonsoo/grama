"""Measure the actual downloaded WAV; expected pitches are independent literal tables."""
import array
import json
import math
from pathlib import Path
import statistics
import sys
import wave

root = Path(sys.argv[1])
results = []
for folder in sorted(root.glob("*-*")):
    file = folder / "two-witnesses.wav"
    if not file.exists():
        continue
    with wave.open(str(file), "rb") as w:
        assert (w.getnchannels(), w.getsampwidth(), w.getframerate()) == (1,2,44100)
        pcm = array.array("h",w.readframes(w.getnframes()))
    if sys.byteorder != "little":
        pcm.byteswap()
    assert max(abs(v) for v in pcm) <= 6554
    reference = [220*4/3,330,220*5/3,220*4/3,220*40/27,220*5/3]
    candidate = [220*2**(c/1200) for c in [485,715,880,485,650,880]]
    errors = []
    for i, expected in enumerate(reference+candidate):
        start=(i//6)*5.2+((i%6)//3)*2.45+(i%3)*.72
        crossings=[]
        for sample in range(math.ceil((start+.08)*44100),math.floor((start+.48)*44100)):
            if pcm[sample] <= 0 < pcm[sample+1]:
                crossings.append(sample-pcm[sample]/(pcm[sample+1]-pcm[sample]))
        measured=44100/statistics.mean(y-x for x,y in zip(crossings,crossings[1:]))
        assert abs(measured-expected)<.002,(folder,i,expected,measured)
        errors.append(abs(measured-expected))
    results.append({"configuration":folder.name,"measuredTones":12,"maxAbsoluteErrorHz":max(errors),"frames":len(pcm)})
assert len(results)==4
print(json.dumps({"method":"Positive zero crossings in native downloaded 16-bit PCM; literal ratio and cent pitch tables", "results":results},indent=2))
