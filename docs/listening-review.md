# Same counts. Concealed sound.

The whole-gap bench already made a mathematical counterexample operable: leave
the initial fourth/fifth fixed while changing a two-count gap. Its playback
always announced which witness was sounding. The new exercise lets a learner
ask a separate question: can I identify a concealed repeat of these sounds?

This is an addition to `tuning.html`, reached from **Can you hear which tuning?**
on the count bench, or **Listening** in the tuning bench's navigation.

## An actual exercise

1. Choose **Set up a 10-cent comparison**, then **Freeze tunings & begin**.
   A is the ratio witness; B moves its two-count gap by ten cents, with the
   fourth/fifth lock retained. Both use the same Sa.
2. Listen to A, B and X. A completed playback earns one visible count. Replaying
   X keeps the same assignment and exact sample data. Stop, interrupted audio
   and a stale resume do not earn completion credit.
3. Choose **X repeats A** or **X repeats B**. The revealed pitch table shows the
   note frequencies and signed differences. This pair differs by ten cents at
   lowered Pa. A miss remains a miss in the record.
4. Switch to **Ma control**, freeze again, and listen. Under this shared lock,
   the two gap settings give exactly the same Ma samples. The exercise explains
   that either label describes the same sound and withholds scoring.
5. Return to the three-note phrase or your own gap pair. A record button reopens
   an earlier revealed attempt, including its original playback, even after the
   live bench changes. New trials use the current bench settings.
6. Save CSV or a complete illustrated study. The latter retains every revealed
   pair's settings, A/B sounds, answers, completion counts, per-attempt reopening
   links, Sanskrit, word notes, eleven complete printed pages, fonts and notices.
   It opens from disk without scripts or a connection. X's revealed assignment
   points to exactly A's or B's sound; there is no separately altered X file.

```text
current tuning pair
        |
        v
freeze A and B ----> choose X once
        |                 |
        +---- listen -----+
                 |
          answer or reveal
                 |
       immutable attempt record
          |             |
       replay       CSV / full study
```

No trial answer is added to shared tuning links. CSV and studies export only
revealed attempts. Changing settings or beginning another trial discards an
unfinished attempt. Records are tab-local and limited to twelve revealed
attempts; a full record requires saving/clearing before another trial. No result
is silently evicted. Clearing the record does not alter an export already being
prepared from its captured input.

## Historical and numerical boundary

The source is the existing retained reading of the _Nāṭyaśāstra_, through Grosset
1888 pp.28–29. I inspected those whole page images for the count verse, short
lowering instruction and named-note counts. The Sanskrit, translation and
retained source bytes are unchanged. No new ancient interval values are asserted.
See [source and model](source-and-model.md) and [whole-gap review](tuning-review.md).

The free whole-gap sizes, cents, sine tones and optional pure fourth/fifth lock
are declared modern assumptions. With four-count size A, three-count size B and
two-count size C, octave closure gives `3A + 2B + 2C = 1200`. In the changed-Pa row:

| Note | Cents above Sa  |
| ---- | --------------- |
| Ma   | `600 - A/2`     |
| Pa   | `1200 - 2A - C` |
| Dha  | `1200 - A - C`  |

Holding A fixed therefore fixes Ma while a ten-cent increase in C lowers both
Pa and Dha by ten cents. This is a comparison _between two tuning witnesses_;
the source's single-Pa operation _inside each witness_ remains a different
comparison. The phrase exercise uses the changed-Pa row throughout.

The score rounds cents to 1e-9 before generating samples to remove arithmetic
cancellation below the model's numerical precision. Identical means equal
Float32 sample sequences, not nearby screen values. X uses the very same event
sequence as its assigned lane, with the same amplitude, envelope and timing.
A cryptographically generated random byte supplies one unbiased assignment bit.
The UI conceals the answer, but inspecting the program can reveal it.

This is self-guided practice, with optional reveals, immediate feedback,
unlimited replay and freely chosen settings. Counts of matches are descriptive;
they establish neither a hearing threshold nor ancient pitch sizes. Native audio
completion verifies digital delivery only, not a listener's speakers or ears.
No population, significance or historical-performance claim is made.

## Verification results

- `npm ci`, lint, strict application/worker typechecks, all 21 tests and the
  production build passed. The original exact-ratio oracle checked 28 cases
  and 224 pitches; the whole-gap oracle checked 7,371 grid candidates.
- [Four production browser configurations](listening-browser.json) passed:
  Chromium and Firefox, each at 1440px and 375px. Each operated real playback,
  answered a match and a miss, checked identical Ma, replayed an old frozen
  attempt, reopened downloads, tested the twelve-attempt limit and operated
  with the actual origin refusing connections. Each reported zero page errors
  and zero violations in the audited WCAG A/AA tag sets.
- [Independent audio checks](listening-audio.json) passed for 24 WAVs, with
  deviation below 0.500216 of one signed 16-bit PCM unit from the analytical
  waveform (quantization contributes up to half a unit). X's sample identity
  and the unchanged control were checked directly in native buffers.
- [Slow-save checks](listening-save.json) passed in Chromium and Firefox,
  including capture preservation, cancellation, busy-button eligibility and
  visible failures for a candidate that does not lower Pa.
- [Eight original-room interaction journeys](listening-regression.json) passed
  across the same browsers and widths, covering pending audio resumes, native
  context recovery, strict links and exported figure access. The failure-label
  flag applies only to family-room rows; false in bench rows means untested there.
- [Documented local commands](listening-local-commands.json) were actually
  started: both `npm run dev` and `npm run preview` followed the count-bench
  link through a frozen identical-Ma trial and displayed the source scan.
- The [build inventory](listening-build.json) identifies 28 built files;
  [retained artifact identities](listening-artifacts.json) identify the example
  study, CSV and PDF. The final repeat build must match that inventory.

Screenshots: [frozen desk](assets/listening-desktop.png),
[phone desk](assets/listening-mobile.png), and
[revealed frequencies](assets/listening-revealed-desktop.png). I inspected these
and the saved phone reading, plus the PDF page with the listening record. The
native keys and source reading retain the established restrained bench design;
small-screen tables scroll within their own regions.

## Reproduce

```sh
npm ci
npm run check
npm run verify:oracle
npm run verify:family
npm run test:listening
npm run verify:listening-audio > /tmp/grama-listening-audio.json
npm run test:interactions -- /tmp/claude-1000/grama-listening-regression-final
node scripts/listening-save-review.mjs
```

`npm run build` produces the complete static site in `dist/`. `npm run preview`
serves it at `http://127.0.0.1:4394/grama/`. The listening exercise opens at
`http://127.0.0.1:4394/grama/tuning.html#listening`.

The browser audit uses actual AudioBufferSourceNodes and captures their buffers.
It identifies X from its buffer rather than the random assignment code, verifies
identical X replays, answers once correctly and once incorrectly, and checks the
Ma control, frozen history, stopped playback and delayed resume. It exercises
keyboard controls, downloads/reopens the study, plays its embedded audio and
checks all eleven images with HTTP requests blocked. Finally it refuses the
actual local origin and uses the saved worker edition to reload, operate and
export again. Chromium/Firefox and 1440/375px are distinct configurations.

The independent Python oracle imports no app model: it derives pitches from the
closed forms above, checks every exported PCM sample against sine synthesis and
its envelope, and compares the first attempt's WAV quantization with captured
native Float32 buffers. It also checks the identical control's complete WAV
bytes and required notices. The existing interaction audit covers both original
rooms' resume ownership, source recovery, strict links and portable readings.

The save audit stalls a real foreground source response at 128 bytes. It clears
the log, creates another attempt while saving, and verifies that the downloaded
study still contains the original attempt. It also checks cancellation without
a file and that clearing during a save leaves export disabled after completion.

Visual review found a mobile saved-file overflow in the revealed pitch table;
the final export contains the table in its own named keyboard-scrollable region.
The audit checks both the page width and scrolling with ArrowRight at 375px.

The [retained study](../examples/listening/study.html.gz),
[CSV](../examples/listening/record.csv) and [21-page PDF](../examples/listening/study.pdf)
are actual native browser exports. The sample answers were generated by the
browser audit from captured digital buffers, including an intentional miss;
they are not human listening observations. Decompress the HTML before opening
it. The PDF is a printed companion; use the HTML for sound and native downloads.

The evidence here concerns the local production build. Existing public-delivery
receipts predate this change. This work does not claim a push, deployment, remote
synchronization or CI run.

Suggested repository description: "Operate ancient Indian count rows, build alternative tunings, and test concealed listening comparisons."

Topics: `sanskrit`, `music-theory`, `natya-shastra`, `tuning`, `ear-training`, `history-of-music`, `offline-first`.
