# Grāma

Change a starting note, lower one string, and read the Sanskrit behind the two grāmas.

[![License: MIT](https://img.shields.io/badge/license-MIT-176477)](LICENSE)

![Two count arrangements: Pa moves while six other named notes stay fixed](docs/assets/bench.png)

A different first note can make a scale sound different without retuning a
single note. Early Indian music theory also describes a different operation:
lower Pa by one śruti. Its two adjacent interval groups exchange a count,
from 4–3 to 3–4. Grāma lets you distinguish those actions, read their Sanskrit
instructions, and inspect what the count twenty-two does and does not tell us.

This is a local source edition until its separate publication record is added.
The intended public route is `https://antonsoo.github.io/grama/`.

## Try the bench

With Node 24 or later:

```sh
npm ci
npm run dev
```

Open `http://127.0.0.1:4394/grama/`. No API key, account or external service is
needed. `npm run build` writes the complete static site to `dist/`;
`npm run preview` serves that production build on the same local port.
1. Begin at Re. The ascent changes order; Sa remains 220 Hz.
2. Select **Madhyama-grāma: lower Pa**. Ma–Pa loses a count, Pa–Dha gains one,
   and the other six notes keep their pitches.
3. Hear Pa before and after, or hear Ma–Pa–Dha in both tunings.
4. Switch the stated pitch assumption. The same count change gives a different
   numerical lowering, exposing the extra assumption needed to make sound.
5. Read **Lower Pa**, then the named count verses, with Sanskrit word notes and
   the full printed pages alongside them.

The two rows show the exact distinction:

```text
                    Ma          Pa          Dha
Sadja-grama           o---4--------o---3-------o
                                  |
                                  v lower Pa
Madhyama-grama        o---3-----o------4-------o
                     fixed     Pa           fixed
```

Diagram spacing counts ordinal groups, not equal pitch steps or string lengths.
The app has a separate logarithmic pitch ruler.

## A count is not yet a tuning

The named-note verses assign the arriving interval four counts to Sa, three to
Re, two to Ga, four to Ma, four to Pa, three to Dha and two to Ni. Ascending
from Sa therefore gives **3, 2, 4, 4, 3, 2, 4**, rather than beginning with four.
The second grāma changes only Pa and Dha's assigned counts.

The numerical examples deliberately add modern assumptions:

| Whole gap count | Modern ratio example      | Equal-division counterexample |
| --------------- | ------------------------- | ----------------------------- |
| 4               | 9/8                       | 4 × 1,200/22 cents            |
| 3               | 10/9                      | 3 × 1,200/22 cents            |
| 2               | 16/15                     | 2 × 1,200/22 cents            |
| Pa lowering     | 81/80, about 21.506 cents | 1,200/22, about 54.545 cents  |

Both close the selected count row at an octave. The ratio example assigns
sizes to whole gaps; it does not locate every internal count cell. Neither
sound model is attributed to Bharata, asserted to resolve the full two-vīṇā
experiment or offered as a reconstruction of ancient performance. The
counterexample does not establish that ancient śrutis were equal divisions.

[Source, exact ratios, count convention and limits](docs/source-and-model.md).

## Read and keep the evidence

Eight selected passages have Sanskrit, normalized IAST and new English, with
contextual word notes. Eleven full pages include the Sanskrit, French
translation, the 1894 Devanagari witness, edition titles, editorial explanation
of brackets and the note identifying difficulties in the two-vīṇā passage.
The two editions' differing verse numbers remain explicit.
- **Illustrated HTML:** the comparison, both pitch rows, ordered ascent, all
  readings, word notes, source pages, fonts and a listening WAV in one file.
  No scripts or automatic remote requests. Its editable JSON can be reopened.
- **JSON:** the chosen grāma, starting note, modern pitch assumption and reference
  Sa, strictly validated before replacing the current comparison.
- **SVG / CSV / WAV:** the count diagram, both numeric pitch rows, and the
  synthetic before/after listening comparison.
- **Share link:** restores the same comparison. In-page reading navigation keeps it.
- **Offline edition:** bench, reader, fonts and all scans after a complete,
  integrity-checked installation. A failed or pending source download cannot
  produce a ready claim. A substituted source blocks the illustrated export.

[Saved reading](examples/grama-illustrated-reading.html) ·
[Printable PDF](examples/grama-illustrated-reading.pdf) ·
[Comparison JSON](examples/grama-comparison.json) ·
[Count diagram](examples/grama-counts.svg) ·
[Pitch rows](examples/grama-pitch-comparison.csv) ·
[Listening WAV](examples/grama-modern-comparison.wav).

## Sources and limits

The lesson reads chapter 28 of the _Nāṭyaśāstra_, attributed to Bharata. The
work is composite and manuscript readings differ; no exact date for this
passage is asserted. Primary printed witnesses are Joanny Grosset's 1888
_Contribution à l'étude de la musique hindoue_, pp.28–29, and Śivadatta and
Parab's 1894 _Nāṭyaśāstra_, p.302. The [manifest](public/sources/manifest.json)
identifies the public-domain scans, physical PDF pages and every bundled hash.

Grosset brackets the longer two-vīṇā demonstration as doubtful and calls his
interpretation approximate. We model the clearly stated single-note operation
and count assignments, while preserving that textual boundary. Seven ascending
rotations illustrate order versus tuning; they are not historical melodies,
named mūrchanās, rāgas, ornaments or a full course in Indian music. Sine tones
supply a modern auditory aid, with no claim to vīṇā timbre or measured ancient
instruments. Browser audio output depends on the device; physical listening
and printing are not claimed by the automated review.

## How it is checked

```sh
npm run check
npm run verify:oracle
npm run test:browser -- /tmp/grama-browser-review
python3 scripts/wav-oracle.py /tmp/grama-browser-review/chromium-1440
node scripts/offline-failure.mjs /tmp/grama-offline-failure
```

The pure model tests compare exact fractions against a separately specified
note table. Python's `Fraction` and literal count-position tables independently
check all 28 grāma / pitch-assumption / starting-note cases and 224 ordered
pitches. The browser review operates the real controls and native downloads in
Chromium and Firefox, at desktop and 375 px, including origin-disabled offline
use. It compares live AudioBuffer PCM with exported WAV data. A separate Python
waveform check measures the twelve actual downloaded tone frequencies using
interpolated zero crossings.

[Direct review and retained evidence](docs/review.md). CI workflows are supplied;
local, public and CI verification remain separate claims.

## Contributing and license

See [CONTRIBUTING.md](CONTRIBUTING.md). Code and new educational content are
MIT, Copyright (c) 2026 Anton Soloviev. Printed source editions are public domain;
fonts are under their bundled OFL licenses. No telemetry or hosted runtime
services are used.
