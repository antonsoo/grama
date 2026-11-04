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
[Post-workflow entry and worker rechecks](listening-publication/entry-rechecks.json).

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
