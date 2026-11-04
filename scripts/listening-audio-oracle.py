"""Check actual browser exports without importing the TypeScript sound model."""
import csv
import io
import json
import math
from pathlib import Path
import struct
import sys
import wave

root = Path(sys.argv[1] if len(sys.argv) > 1 else "/tmp/claude-1000/grama-listening")
checks = []
for folder in sorted(root.iterdir()):
    if not folder.is_dir():
        continue
    assert (folder / "sound-4.wav").read_bytes() == (folder / "sound-5.wav").read_bytes()
    rows = list(csv.DictReader(line for line in (folder / "record.csv").read_text().splitlines() if not line.startswith("#")))
    for index, row in enumerate(rows):
        for lane_index, lane in enumerate(["A", "B"]):
            file = folder / f"sound-{2 * index + lane_index}.wav"
            raw = file.read_bytes()
            with wave.open(io.BytesIO(raw)) as audio:
                assert audio.getnchannels() == 1 and audio.getsampwidth() == 2
                rate = audio.getframerate()
                assert rate == 44100
                frames = audio.readframes(audio.getnframes())
            pcm = struct.unpack(f"<{len(frames)//2}h", frames)
            four, two = float(row[f"{lane}_four_cents"]), float(row[f"{lane}_two_cents"])
            # Independent closed forms for the changed-Pa row:
            # Ma=A+B+C=600-A/2; Pa=A+2B+C=1200-2A-C;
            # Dha=2A+2B+C=1200-A-C, where 3A+2B+2C=1200.
            pitches = [600-four/2] if row["stimulus"] == "ma" else [1200-2*four-two]
            if row["stimulus"] == "phrase":
                pitches = [600-four/2, 1200-2*four-two, 1200-four-two]
            expected = [0.0] * len(pcm)
            frequencies = []
            for note, pitch in enumerate(pitches):
                frequency = float(row["Sa_hz"]) * 2 ** (pitch/1200)
                frequencies.append(frequency)
                start, duration = note * .72, .6
                for sample in range(math.ceil(start * rate), math.ceil((start+duration) * rate)):
                    t = sample/rate-start
                    if 0 <= t < duration:
                        envelope = min(1, t/.012, (duration-t)/.04)
                        expected[sample] += .2 * math.sin(2*math.pi*frequency*t) * envelope
            worst = max(abs(actual - value*32767) for actual, value in zip(pcm, expected))
            assert worst < .501, (folder, index, lane, worst)
            assert b"PolyForm-Noncommercial-1.0.0" in raw
            if index == 0:
                native_bytes = (folder / f"native-{lane}.f32").read_bytes()
                native = struct.unpack(f"<{len(native_bytes)//4}f", native_bytes)
                assert len(native) == len(pcm)
                # JS Math.round rounds halfway towards +infinity.
                assert all(actual == math.floor(value*32767+.5) for actual, value in zip(pcm, native))
            checks.append({"configuration": folder.name, "attempt": index+1, "lane": lane, "frequencies_hz": frequencies, "samples": len(pcm), "max_pcm_unit_error": worst})
assert len(checks) == 24, len(checks)
print(json.dumps({"method": "Independent closed forms and per-sample Python sine/envelope; first trial's exported PCM also compared to captured native AudioBuffers", "waves": checks}, indent=2))
