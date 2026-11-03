# Twenty-two counts, more than one tuning

This local addition makes a learner construct a counterexample to a tempting
inference: a count of twenty-two does not, by itself, choose a set of musical
frequencies. The existing bench supplied two presets. `tuning.html` opens the
numerical assumption so the learner can change it, preserve selected conditions,
keep a witness and inspect a failed attempt.

It is not published. The older [publication record](publication.md) describes an
earlier edition. No remote, hosted-file, deployment or CI success is claimed for
this addition.

## An actual exercise

1. Start at the ratio example with the fourth/fifth lock on.
2. Focus the 2-count slider and press Shift + Right: add ten cents.
3. The 3-count gap loses ten cents. The initial Sa–Ma and Sa–Pa stay at
   4/3 and 3/2. Pa's lowering changes from about 21.506 to 31.506 cents.
4. Keep this as a saved witness, then choose a different candidate. The saved
   witness remains independent. Hear both at the same Sa and inspect all notes.
5. Try the failed candidate: four = 200, two = 100. Octave closure forces
   three = 200. Pa does not move. The source's lowering instruction fails even
   though the octave closes. Failed checks survive in saved work.

```
given counts + chosen whole-gap sizes
                  |
                  v
        compute the 3-count size
                  |
                  v
     check lowering and gap ordering
                  |
          +-------+-------+
          |               |
       witness      failed candidate
          |               |
          +-------+-------+
                  |
                  v
       hear / compare / save / reopen
```

## What the model assumes

Use cents, a modern logarithmic pitch measure. Let A, B and C be the sizes of
whole 4-, 3- and 2-count gaps. Repeated gaps with the same count are assigned
the same size. This is an additional restriction, not a proof that every
individual śruti has the same pitch size, and not the complete space of
possible interpretations.

The ascending row `3,2,4,4,3,2,4` has three A gaps, two B gaps and two C gaps.
Modern octave closure gives:

```
3A + 2B + 2C = 1200
B = (1200 - 3A - 2C) / 2
```

In the second row Ma–Pa contracts from A to B and Pa–Dha expands from B to A.
Their sum is unchanged; the six other named notes stay fixed. Pa lowers by
A − B, which must be positive to meet the lowering instruction. The optional
condition A > B > C > 0 belongs to this model. Values on a region boundary can
make two gap sizes equal and fail its strict ordering test.

| Initial interval | Whole-gap expression | After eliminating B |
| ---------------- | -------------------- | ------------------- |
| Sa–Ma            | A + B + C            | 600 − A/2           |
| Sa–Pa            | 2A + B + C           | 600 + A/2           |

Holding these at 4/3 and 3/2 fixes A at `1200 log2(9/8)`. C is still free;
B compensates. Thus these two consonances, the displayed count row, the
single-Pa operation and octave closure still leave freedom. This does not
claim that all the text's other interval relations leave the same freedom.
The control rectangle is a bounded teaching domain, not historical limits.

The original exact-fraction presets remain unchanged. The new family uses
floating-point cents and frequencies; displayed values are rounded. A saved
record retains full numerical control values, the lock and both witnesses.
JSON and CSV carry the current attribution/license notice; WAV retains it in a
standard RIFF INFO copyright chunk after the PCM data.
A failed candidate can occupy the editable slot. A saved witness must meet
the displayed conditions. JSON and links reject unknown, missing, duplicate
link keys, nonfinite, out-of-bounds and inconsistent lock settings.

## Printed evidence

The new page uses the existing normalized Sanskrit, IAST and new English for
Grosset p.28 verse 25 and the following short Pa-lowering instruction. The
full p.29 makes both named count rows inspectable. Grosset brackets the longer
two-vīṇā passage and describes his interpretation as approximate in note 36
on p.86. This workshop leaves that philological problem open.

The original 1888 PDF was downloaded again. Its SHA-256 equals the cited
manifest identity. All eight retained Grosset pages were re-rendered from
their exact physical PDF pages using Poppler and matched the retained JPEGs
byte for byte. The page-28, page-29 and page-86 images were visually inspected.
[Primary-edition re-render receipt](tuning-source-review.json).
The three 1894 images in the complete reading retain their previous provenance;
the browser review verifies their embedded bytes against the manifest. This
addition does not claim a fresh download of that second PDF.

To repeat the source re-render with a downloaded original:

```sh
python3 scripts/verify-family-source.py /path/to/grosset.pdf
```

The [manifest](../public/sources/manifest.json) supplies the PDF URL and hash.
No third-party scan has been generated or repaired.

## Operated behavior

The workspace follows Grāma's existing typefaces and ocean/plum palette. Its
dark pitch instrument makes logarithmic distance distinct from the pale count
rail in the original lesson. A bounded parameter map shows the ordered-gap
region, a separate saved witness and the optional lock. Standard range controls
support mouse/touch, one-cent arrow changes and ten-cent Shift-arrow changes.
The pointer can move continuously; named presets retain their full values.
No random hearing grade or claim about human audibility is assigned.

Playback captures settings at the click, shares the sine renderer with WAV,
and stops on edits, explicit Stop, page hiding or audio-context interruption.
A delayed `resume()` cannot start a sound after it has been cancelled. The
reading captures settings before source fetching, verifies every asset, embeds
its audio/fonts/images, and executes no scripts. It can be opened from a local
file without automatic network requests. It includes an editable JSON download.

Both pages share one complete offline inventory. Readiness checks cached bytes
against their SHA-256 identities. A repair fetches only damaged/missing files,
verifies replacement bytes and announces the result to other tabs. An offline
repair failure keeps the current experiment and offers a retry. The original
development import of the raw public JSON was also reproduced in an isolated
copy and replaced by a watched virtual module. Controlled source edits and
restoration update the UI and raw download together.
[Development receipt](tuning-development-review.json).

## Local verification

```sh
npm ci
npm run check
npm run verify:oracle
npm run verify:family
npm run test:browser -- /tmp/claude-1000/grama-bench-review
python3 scripts/wav-oracle.py /tmp/claude-1000/grama-bench-review/chromium-1440
node scripts/offline-failure.mjs /tmp/claude-1000/grama-offline-failure
npm run test:family -- /tmp/claude-1000/grama-family-browser
npm run verify:family-audio -- /tmp/claude-1000/grama-family-browser
npm run test:source-json
```

The independent Python check uses named-note closed forms rather than the
product's count walk. It checks 7,371 integer-grid candidates (4,267 satisfy the
strict gap ordering) and 91 settings on the fixed-fourth/fifth line. The latter
uses 50-digit Decimal calculations to check the pure frequency ratios.
Fourteen unit tests cover the existing exact examples and the new family.

Chromium and Firefox at 1440 and 375 pixels operate the actual controls,
pinning, keyboard interaction, strict reopening, shared links, delayed audio
cancellation, native downloads, source scans and script-free local reading.
Actual live AudioBuffer PCM equals the downloaded WAV. A separate Python
zero-crossing measurement checks its twelve tones against literal independent
pitch tables. No physical listening or printing is claimed.

The cache exercise substitutes source bytes, deletes a saved workshop page,
rejects source export, fails repair with the origin disabled, restores the
origin, repairs without losing either candidate, checks the other tab and
then disables the origin again. The offline WAV and complete reading must
equal their online counterparts byte for byte. All canonical local HTTP
responses are compared with the reviewed build. Automated accessibility checks
and page-error/external-request monitoring accompany the operated workflows.

Build command: `npm run build`; output: `dist/`. Browsers are exercised against
that output, independently of Vite development behavior. Source, local build,
local HTTP delivery, physical output, public delivery and CI remain separate
claims.
