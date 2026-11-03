"""Re-render retained pages from the supplied Grosset and optional 1894 PDFs."""
import hashlib
import json
from pathlib import Path
import subprocess
import sys
import tempfile

pdfs = {"grosset1888": Path(sys.argv[1])}
if len(sys.argv) > 2:
    pdfs["natya1894"] = Path(sys.argv[2])
manifest = json.loads(Path("public/sources/manifest.json").read_text())
editions = {e["id"]:e for e in manifest["editions"]}
digest = lambda data: hashlib.sha256(data).hexdigest()
for key, pdf in pdfs.items():
    assert digest(pdf.read_bytes()) == editions[key]["pdfSha256"], "The supplied PDF is not the cited edition."
results = []
with tempfile.TemporaryDirectory(prefix="grama-source-") as tmp:
    for page in manifest["pages"]:
        if page["edition"] not in pdfs:
            continue
        pdf = pdfs[page["edition"]]
        if page["edition"] == "grosset1888":
            scale, quality = (2200,88) if page["printed"] in [28, 29] else (1850,85)
        else:
            scale, quality = {"title":(1700,85),301:(2200,88),302:(2000,88)}[page["printed"]]
        prefix = Path(tmp) / "page"
        command = ["pdftoppm", "-f", str(page["pdfPage"]), "-l", str(page["pdfPage"]),
                   "-singlefile", "-scale-to", str(scale), "-jpeg", "-jpegopt", f"quality={quality}",
                   str(pdf), str(prefix)]
        subprocess.run(command, check=True, capture_output=True)
        regenerated = prefix.with_suffix(".jpg").read_bytes()
        retained = (Path("public") / page["file"]).read_bytes()
        assert digest(regenerated) == digest(retained) == page["sha256"], page
        results.append({"edition":page["edition"],"printedPage":page["printed"], "physicalPdfPage":page["pdfPage"],
                        "scaleTo":scale, "jpegQuality":quality, "sha256":digest(regenerated),
                        "byteIdenticalToRetained":True})
print(json.dumps({"editions":[editions[key] for key in pdfs],
                  "method":"Poppler re-render from the downloaded primary edition; exact JPEG SHA-256 equality", "pages":results},indent=2))
