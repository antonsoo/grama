# Published listening and count-reading audit

The [listening exercise](https://antonsoo.github.io/grama/tuning.html#listening)
and [count-placement diagnostic](https://antonsoo.github.io/grama/?attachment=leaving#attachment)
are published. The [source audit](listening-audit.md) records the learner changes,
printed evidence, modern assumptions and reproduced defects.

| Boundary                | Verified result                                                                                                                                         |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Production code         | `cb42526542232f06f8806800cf84f8192f44cc5d`; subsequent evidence changes do not alter production inputs                                                  |
| Pages                   | `ff36dcf25db4ec2c8ba96025b5c7a184109e2aa6`; ordinary branch push retaining older hashed assets                                                          |
| Build                   | Node 24.22.1 strict checks and 29 core checks; its complete `npm run build` output byte-matches Node 26.7.0 output, in `dist/`                          |
| Printed sources         | Both complete primary PDFs downloaded again; eleven retained pages independently re-rendered and byte-compared                                          |
| Canonical public files  | All 28 current files match the captured build, including the directory index before and after; no query cache busting                                   |
| Native public workflows | Sixteen configurations: four workflows in Chromium and Firefox at 1440/375px; real controls, AudioBuffers, source pages and downloaded records/readings |
| Offline boundary        | Browser networking disabled after the complete current worker controls the page; the public origin remains available                                    |
| CI                      | The inspected CI and workflow-based Pages jobs recorded no executed steps; branch-based Pages delivery is verified separately                           |

[Hosted file identities](listening-publication/hosted-files.json) ·
[Listening](listening-publication/listening.json) ·
[Record recovery](listening-publication/record-recovery.json) ·
[Count placement](listening-publication/attachment.json) ·
[Original count bench](listening-publication/count-bench.json) ·
[Post-workflow entry and worker rechecks](listening-publication/entry-rechecks.json) ·
[Eight shared-budget cases on the final worker](listening-publication/shared-bandwidth.json) ·
[Twenty-five pinned source artifacts](listening-publication/source.json) ·
[Inspected workflow steps](listening-publication/workflows.json) ·
[Twenty-four independent listening WAV checks](listening-publication/listening-audio.json) ·
[Sixteen independent diagnostic WAV checks](listening-publication/attachment-audio.json).

Listening verifies actual X sample identity, stable replays, stopped and stale
resume requests, an intentionally matched and missed answer, and an identical
control. Recovery reopens actual JSON and study-contained records, keeps imported
claims distinct, rejects malformed imports and preserves newer edits. The count
exercise operates both readings and sound models, opens the exact printed pages,
and preserves the selected diagnosis in native files. The original bench still
operates all seven starts, all eight passages and all eleven source pages.

The downloadable [examples](../examples/) were generated through native browser
controls; their [byte inventory](artifacts.json) is checked independently. The
listening record is automated verification, not a human hearing result. The PDF
is Chromium output, not a physical print. Generated sine tones and declared
numerical models do not reconstruct an ancient instrument or performance.

The reviewed [desktop](assets/attachment-desktop.png) and
[phone](assets/attachment-mobile.png) screenshots show the source-reading
counterexample as an operated instrument, including its wrong-note marker. The
existing listening screenshots retain the same A/B/X design. Startup gating
changes availability while the entry module loads, without changing the ready
instrument's layout.

## Reproduce the public workflows

After `npm ci` and `npm run build`:

```sh
node scripts/publication.mjs https://antonsoo.github.io/grama/ cb42526542232f06f8806800cf84f8192f44cc5d ff36dcf25db4ec2c8ba96025b5c7a184109e2aa6 /tmp/grama-hosted.json
node scripts/listening-browser.mjs /tmp/grama-public-listening https://antonsoo.github.io/grama/
node scripts/listening-record-browser.mjs /tmp/grama-public-record https://antonsoo.github.io/grama/
node scripts/attachment-browser.mjs /tmp/grama-public-attachment https://antonsoo.github.io/grama/
node scripts/browser-review.mjs /tmp/grama-public-count https://antonsoo.github.io/grama/
```

The present repository description remains suitable: "Change a starting note,
lower one string, and read the Sanskrit behind the two ancient Indian gramas."
Its seven topics are `education`, `music-theory`, `offline`, `sanskrit`, `tuning`,
`web-audio`, and `history-of-music`.

The [separate Officina discovery record](https://github.com/antonsoo/officina/blob/9991237d690e93b550e5f3363559428f22b155f4/docs/grama-discovery-2026-11-04.md)
verifies all 122 catalogue files and four public journeys through both workshop
rows, their immutable review, actual native sounds, JSON reopening, the printed
source and complete study download. This discovery audit also exercises the
cold entry that originally lost its first setup click.

## Reviewed source history

The reviewed history through `cdf94ce`; the final evidence addition changes no
production inputs:

```text
cdf94ce docs: verify cold-start recovery and sixteen hosted instrument workflows
cb42526 fix: preserve first actions while the instrument loads
d97eaa8 docs: retain source audit, repaired workflows and current native studies
cb8b44b test: distinguish transfer queue cancellation from body expiry
7477b0f fix: keep Firefox source reads independent and available offline
341441f fix: bound retained transfers and bypass serialized HTTP revalidation
3294182 fix: distinguish saved audio comparisons for accessible playback and verification
a7ff8f4 feat: diagnose misplaced counts and preserve newer work during imports
1b27b23 feat: reopen listening records without granting new playback credit
7b5fc8c docs: retain listening studies and native browser verification
5082b35 feat: add frozen tuning comparisons with concealed listening and portable records
83e589a docs: verify public workshop, source evidence and Pages publication
```
