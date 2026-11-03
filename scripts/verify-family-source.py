"""Re-render the eight retained Grosset pages from a supplied original PDF."""
import hashlib
import json
from pathlib import Path
import subprocess
import sys
import tempfile

pdf = Path(sys.argv[1])
manifest = json.loads(Path("public/sources/manifest.json").read_text())
edition = next(e for e in manifest["editions"] if e["id"] == "grosset1888")
digest = lambda data: hashlib.sha256(data).hexdigest()
assert digest(pdf.read_bytes()) == edition["pdfSha256"], "The supplied PDF is not the cited edition."
results = []
with tempfile.TemporaryDirectory(prefix="grama-source-") as tmp:
    for page in manifest["pages"]:
        if page["edition"] != "grosset1888":
            continue
        detailed = page["printed"] in [28, 29]
        scale, quality = (2200,88) if detailed else (1850,85)
        prefix = Path(tmp) / "page"
        command = ["pdftoppm", "-f", str(page["pdfPage"]), "-l", str(page["pdfPage"]),
                   "-singlefile", "-scale-to", str(scale), "-jpeg", "-jpegopt", f"quality={quality}",
                   str(pdf), str(prefix)]
        subprocess.run(command, check=True, capture_output=True)
        regenerated = prefix.with_suffix(".jpg").read_bytes()
        retained = (Path("public") / page["file"]).read_bytes()
        assert digest(regenerated) == digest(retained) == page["sha256"], page
        results.append({"printedPage":page["printed"], "physicalPdfPage":page["pdfPage"],
                        "scaleTo":scale, "jpegQuality":quality, "sha256":digest(regenerated),
                        "byteIdenticalToRetained":True})
print(json.dumps({"pdfURL":edition["pdf"], "pdfSha256":edition["pdfSha256"],
                  "method":"Poppler re-render from the downloaded primary edition; exact JPEG SHA-256 equality", "pages":results},indent=2))
