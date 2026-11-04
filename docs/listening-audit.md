# Auditing the listening bench and the count reading

The audit began from a fresh checkout of `7b5fc8c`, rather than its recorded
progress. Both complete primary PDFs were downloaded again; all eleven retained
pages were independently re-rendered and byte-compared. The original numerical
models, source page identities and core listening behavior survived that audit.
A separate clean Node 24.22.1 installation passed strict checks and the build.

## What changed for a learner

### A record can be reopened

Previously the revealed attempts could be read as CSV or HTML, but could not be
restored to the instrument. **Save reopenable record (JSON)** now preserves the
current tuning pair and stimulus alongside every revealed attempt's own frozen
pair, X assignment, answer and recorded completed-playback counts.

Opening it restores the current controls and the earlier attempt buttons.
Replaying an earlier attempt uses its frozen sound, not the newer controls.
Reopened counts and answers are labeled as file claims, including in CSV and the
illustrated study; the current tab has not verified those past playbacks. A new
trial starts with no completion credit. The complete script-free study contains
a native download of this same reopenable record.

The importer bounds size and count, validates all nested settings and notices,
and recomputes sample identity and answer eligibility. It refuses a scored guess
without completed A/B/X, a scored identical control, supplied equality/provenance
flags, invalid note selections, malformed counts, and more than twelve attempts.
Nothing is silently evicted. Empty records can preserve a tuning setup without
inventing attempts. A failed current tuning candidate remains failed.

### A late file cannot overwrite newer work

I reproduced this defect in both original JSON importers:

```text
select a file containing Sa = 330 Hz
              |
apply a newer Sa = 220.5 Hz
              |
the older file finishes -> silently resets Sa to 330 Hz
```

The new guarded import path compares the selected experiment with the current
one before applying a completely validated record. New applied edits,
unsubmitted drafts, placement changes, newer files and navigation all take
precedence over a stale completion. Invalid imports preserve the existing
experiment. The [before receipt](listening-audit/open-race-before.json) records
both lost edits; the [after matrix](listening-audit/open-race-after.json) exercises
both rooms in Chromium and Firefox at 1440/375px. File-read delays and pagehide
are deliberate lifecycle injections, not claims about a measured slow disk or
physical OS interruption.

### A healthy shared connection no longer looks like a silent server

The previous slow-source checks throttled one response at a time. A new test
shared a single 64 KiB/s budget across _all_ retained image/font bodies. The
foreground export failed after 17.279 s with a missing-headers message even
though 1,126,280 bytes had crossed the connection and three responses remained
active. The whole source bundle had been issued simultaneously; requests waiting
for an HTTP connection consumed the same deadline as a silent server.

The reader now runs two source readers. Identified transfers coordinate two
origin-wide permits through Web Locks when available, including the worker,
so queue waiting precedes the network deadline. A displayed source can use an
available second permit while another transfer runs. Queued operations honor
cancellation. Without Web Locks, the foreground batch remains bounded to two.
The actual dispatched read still verifies length, SHA-256 and body progress;
its header and inactivity deadlines are unchanged. Each foreground read uses a
unique HTTP cache key while the worker resolves its canonical pathname; a
revalidating Firefox request must not wait invisibly behind another source read.
A first attempted `no-store` change fixed that wait but failed the Firefox offline
export audit. The final reader keeps `no-cache` and the isolated key, preserving
worker delivery offline. Edition headers let the
worker forward identified foreground streams without taking a nested permit.

The shared-budget audit covers foreground export, two exporting tabs during
worker installation, an unavailable-Web-Locks fallback, and cancellation while
other tabs own the permits. The cancellation case sends one source byte per
second, with fast bootstrap/fonts: it tests cancellation independently of a
body-inactivity timeout. It also checks that the original two clients keep
their permits. The baseline failure and final receipts are retained
separately: [baseline failure](listening-audit/shared-bandwidth-before.json) and
[final shared-transfer matrix](listening-audit/shared-bandwidth.json).
This is a real HTTP/1.1 response scheduler with shared capacity, not
a per-response speed setting or a throughput claim about the public host.

### The octave can close while the wrong note moves

Open **Check the counts** in the count bench, or
`http://127.0.0.1:4394/grama/?attachment=leaving#attachment` locally.
The named counts Sa 4, Re 3, Ga 2… can be mistakenly copied as the gaps _after_
those notes. This diagnostic deliberately makes that error. Both count rows
still total twenty-two. In the modern ratio example they still close at 2:1
and preserve the initial 4:3 fourth and 3:2 fifth. Yet the retuning moves Dha;
Pa stays fixed. Grosset's short instruction explicitly names Pa.

| Check in the modern ratio model         | Following-gap misreading | Preceding-gap reading |
| --------------------------------------- | ------------------------ | --------------------- |
| Total counts in each row                | 22                       | 22                    |
| Octave ratio                            | 2/1                      | 2/1                   |
| Initial Sa–Ma                           | 4/3                      | 4/3                   |
| Initial Sa–Pa                           | 3/2                      | 3/2                   |
| Changed named note                      | Dha                      | Pa                    |
| Agrees with the Pa-lowering instruction | No                       | Yes                   |
1. Keep **Following interval (misreading)**. Inspect the plum Dha arrow and hear
   Ma–Pa–Dha in each row. The third tone changes; the second does not.
2. Select **Preceding interval (text)**. The diagram and sound now move Pa.
3. Open **Read Lower Pa on page 28**, then the named counts on page 29. The
   reader retains complete pages, apparatus and the existing word notes.
4. Inspect frequencies, save CSV, SVG or WAV, or keep the choice in the complete
   illustrated reading. Comparison JSON v3 and shared links preserve it; v1/v2
   comparisons still reopen with the diagnostic's default misreading selected.

The main bench always uses the preceding-interval reading. This separate
exercise diagnoses a misplaced count, not a competing ancient tuning. It keeps
Sa fixed even when the main ascent begins at another note. Its frequencies use
the existing declared ratio or equal-division assumptions. The tuning-family
bench fixes the named count reading first, then explores numerical freedom
inside that reading. None of these exercises resolves the bracketed longer
two-vīṇā passage or establishes historical frequencies.

The printed fragment is _śrutyapakṛṣṭaḥ pañcamaḥ kāryaḥ_: Pa is to be made lower
by a śruti. No new source transcription or translation was introduced. The
[numerical tests](../tests/attachment.test.ts) compare against literal note
ratios, and the [audio oracle](listening-audit/attachment-audio.json) checks
sixteen downloaded WAVs against independent Fraction/count-position tables,
an analytical sine/envelope and the actual captured native AudioBuffers.

## Evidence and boundaries

- [Primary editions and eleven page renders](listening-audit/primary-pages.json):
  complete PDF hashes match the retained manifest, and every rendered JPEG
  byte-matches. I also inspected the title leaves, count verses, p.21's bracket
  policy, p.28's instruction and p.86's qualification. This verifies the retained
  witnesses and the particular claims used here, not a new critical edition.
- [Original count-bench matrix](listening-audit/count-bench.json) and
  [independent count WAV checks](listening-audit/count-audio.json): the original
  starts, models, reader, native files and offline comparison still operate.
- [Four listening configurations](listening-audit/listening.json) and
  [twenty-four independent WAV checks](listening-audit/listening-audio.json):
  native X identity, replay stability, an intentional match/miss, identical Ma,
  frozen history, actual downloads and origin-refused offline operation.
- [Four record-recovery configurations](listening-audit/record-recovery.json):
  native JSON and study-contained JSON roundtrips, original frozen PCM,
  malformed-file preservation, conflicting file reads, stale audio resumes,
  full/empty records and offline restoration. Imported history is never
  relabeled as freshly heard.
- [Count-placement configurations](listening-audit/attachment.json): both
  models and placements, native sounds/files, actual p.28/p.29 hashes, v3 JSON,
  a study frozen through a stalled source response, keyboard table access and
  offline reopening/export. The audited WCAG A/AA tag sets reported no violations.
- [Slow source installation](listening-audit/cold-transfer.json): a cold
  foreground read concurrent with worker installation, both at 4,000 bytes/s
  per response. Chromium/Firefox completed after approximately 118.3/121.7 s;
  header stalls timed out and same-tab retries recovered.
- [Network failures](listening-audit/network.json): continuous transfer can
  continue beyond 100 seconds; silent bodies release repair controls. HTTP 503
  falls back to verified saved documents. Wrong source bytes are hidden and
  prevent export. Retry restores the exact retained page.
- [Two-edition replacement](listening-audit/upgrade.json): an old repair response
  released after new activation cannot recreate the old cache. Both stale tabs
  withdraw readiness, preserve settings and reopen the new edition offline.
- [Original audio interaction matrix](listening-audit/interactions.json) and
  [slow-save audit](listening-audit/save.json): native resume/context ownership,
  interrupted audio, source-save cancellation and captured inputs survive.

The current cold-transfer, edition-replacement and build receipts identify the
final production worker; earlier interaction receipts remain explicitly dated.
[Final build identities](listening-audit/build.json) record all retained files.
They are local real-origin fault tests, not an outage of the public host.
Hosted bytes, public browser operation, remote synchronization and CI execution
are separate claims, recorded only after those checks actually run.

## Reproduce

```sh
npm ci
npm run check
npm run verify:oracle
npm run verify:family
npm run test:listening
npm run verify:listening-audio
npm run test:listening-record
npm run test:listening-save
npm run test:attachment
npm run verify:attachment-audio
npm run test:record-open
npm run test:interactions
npm run test:cold-save
npm run test:network
npm run test:shared-network
```

For the source check, download the two exact PDF URLs in
`public/sources/manifest.json`, then pass their paths to
`scripts/verify-family-source.py`. For the upgrade check, supply two independently
built editions to `npm run test:upgrade -- <old-dist> <new-dist> <receipt-dir>`.
The CI workflow now includes the listening, reopenable-record, placement,
independent-audio and stale-file checks. Workflow configuration is not proof of
an executed CI job.
