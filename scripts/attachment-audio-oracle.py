"""Independent literal note tables, count positions and captured native audio."""
import csv
from fractions import Fraction
import io
import json
import math
from pathlib import Path
import struct
import sys
import wave
root=Path(sys.argv[1] if len(sys.argv)>1 else "/tmp/claude-1000/grama-attachment")
ratio_rows={
    "arriving": [["1","10/9","32/27","4/3","3/2","5/3","16/9"],["1","10/9","32/27","4/3","40/27","5/3","16/9"]],
    "leaving": [["1","9/8","5/4","4/3","3/2","27/16","15/8"],["1","9/8","5/4","4/3","3/2","5/3","15/8"]],
}
count_rows={"arriving":[[0,3,5,9,13,16,18],[0,3,5,9,12,16,18]],"leaving":[[0,4,7,9,13,17,20],[0,4,7,9,13,16,20]]}
checks=[]
for folder in sorted(root.iterdir()):
    if not folder.is_dir(): continue
    for attachment in ["arriving","leaving"]:
        for model in ["ratios","equal"]:
            label=f"{attachment}-{model}"
            record=json.loads((folder/f"{label}.json").read_text())
            base=record["pose"]["base"]
            assert base==220.5 and record["attachment"]==attachment
            factors=[[float(Fraction(v)) for v in row] for row in ratio_rows[attachment]] if model=="ratios" else [[2**(v/22) for v in row] for row in count_rows[attachment]]
            rows=list(csv.DictReader(line for line in (folder/f"{label}.csv").read_text().splitlines() if not line.startswith("#")))
            assert len(rows)==14
            for i,row in enumerate(rows):
                assert math.isclose(float(row["frequency_hz"]),base*factors[i//7][i%7],abs_tol=1e-8)
            raw=(folder/f"{label}.wav").read_bytes()
            with wave.open(io.BytesIO(raw)) as stream:
                assert stream.getframerate()==44100 and stream.getsampwidth()==2 and stream.getnchannels()==1
                frames=stream.readframes(stream.getnframes())
            pcm=struct.unpack(f"<{len(frames)//2}h",frames)
            floats=(folder/f"{label}.f32").read_bytes()
            native=struct.unpack(f"<{len(floats)//4}f",floats)
            assert len(native)==len(pcm)
            assert all(a==math.floor(v*32767+.5) for a,v in zip(pcm,native))
            expected=[0.0]*len(pcm)
            frequencies=[]
            for lane in range(2):
                for i,note in enumerate([3,4,5]):
                    f=base*factors[lane][note];start=lane*2.45+i*.72;duration=.6
                    frequencies.append(f)
                    for sample in range(math.ceil(start*44100),math.ceil((start+duration)*44100)):
                        t=sample/44100-start
                        if 0<=t<duration: expected[sample]+=.2*math.sin(2*math.pi*f*t)*min(1,t/.012,(duration-t)/.04)
            worst=max(abs(actual-value*32767) for actual,value in zip(pcm,expected))
            assert worst<.501,(folder,label,worst)
            assert b"PolyForm Noncommercial" in raw
            checks.append({"configuration":folder.name,"attachment":attachment,"model":model,"base_hz":base,"frequencies_hz":frequencies,"frames":len(pcm),"native_quantization_matches":True,"max_pcm_unit_error":worst})
assert len(checks)==16,len(checks)
print(json.dumps({"method":"Independent literal Fraction note tables and literal equal-count positions; analytical sine/envelope for every sample, plus actual captured AudioBuffer quantization","waves":checks},indent=2))
