# Direct review

This record concerns the local production edition and its native files. It is
not a deployment claim. The source, any public publication, and later hosted
browser reviews receive separate identities.

## What changed for a learner

The bench separates two operations that a generic scale keyboard conflates:
rotating a fixed tuning's ascent and retuning one of its notes. Both count rows
remain visible, with Pa's displacement and its two changed adjacent groups.
A distinct pitch ruler prevents the equal-width count cells from silently
claiming equal pitch distances. Two deliberately explicit modern pitch
assumptions make that distinction audible and measurable.

The Sanskrit reader has eight excerpts, normalized IAST, new English and
contextual word notes. The reader can inspect all eleven full source pages,
including the note explaining why the longer two-vīṇā demonstration is not
claimed as a completed reconstruction. Source URLs, page mappings, original
PDF identities and rendered image hashes are in the manifest.

## Evidence

| Boundary                          | Actual result                                                                                                                                                                                                                                                                                                                        |
| --------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Working checkout, Node 26.7.0     | `npm run check`: lint, strict typecheck, eight model/audio/file tests and production build pass                                                                                                                                                                                                                                      |
| Isolated checkout, Node 24.22.0   | Independent `npm ci`, `npm run check` and `npm run verify:oracle` pass; all 24 production files are byte identical to the working build                                                                                                                                                                                              |
| Independent arithmetic            | Python `Fraction` and literal note/count-position tables agree for 28 grāma/model/start cases and 224 ordered pitches                                                                                                                                                                                                                |
| Chromium 153 and Firefox 155      | Actual controls at 1440 and 375 px: all seven starts, retuning, both pitch assumptions, reference Hz validation, JSON native reopen and rejected extra fields, preserved share URL, all eight readings and keyboard word notes                                                                                                       |
| Printed pages                     | Eleven decoded images per configuration match the bundled manifest SHA-256; no external request or page exception                                                                                                                                                                                                                    |
| Audio                             | The PCM recorded from the actual live browser AudioBuffer matches the 16-bit PCM in its native downloaded WAV; editing a control stops the actual source node                                                                                                                                                                        |
| Independent exported sound        | Python `wave` decodes the downloaded ratio and equal-division WAVs and measures all twelve tone frequencies using interpolated zero crossings. Maximum absolute frequency error is about 0.000051 Hz against the independent literal tables. This checks rendered samples, not the device's physical output or a listener's hearing. |
| Click-time export                 | Save at madhyama/Re/equal/220, then immediately change to ratios/Ni. The downloaded HTML preserves the earlier pose, with its JSON and selected WAV, all eight excerpts and eleven correctly hashed source images                                                                                                                    |
| Portable local HTML               | Both browsers at both widths decode all images and fonts, preserve the two diagrams, and make no automatic remote request. No script or event handler is embedded. The document fits the viewport.                                                                                                                                   |
| Offline with origin disabled      | After readiness, the local server destroys connections and browser networking is disabled. Reload, reading/source changes, changed comparison and native WAV/complete HTML downloads still work in all four configurations                                                                                                           |
| Initial incomplete installs       | Hold the last source response, or substitute bytes that fail integrity. Chromium and Firefox never report ready prematurely; releasing or correcting the response and reloading recovers                                                                                                                                             |
| Export integrity failure          | Substitute a cached printed page: no illustrated file is downloaded, and a specific edition-mismatch message is shown. Restore the verified bytes; complete offline export works again                                                                                                                                               |
| Accessibility                     | Axe reports no violations in the reviewed passage state at either width in both browsers. Real native selectors, keyboard word-note buttons and the scrollable exact table were exercised. This is not a complete assistive-technology audit.                                                                                        |
| Documented development quickstart | Node 24 isolated installation running actual `npm run dev`: both browsers at both widths operate the controls, passage change and native JSON download; status correctly identifies development as not an offline installation                                                                                                       |

[Browser receipt](browser-review.json) · [Build identities](build-identity.json) ·
[Wave measurements](wav-oracle.json) · [Offline fault/recovery](offline-failure.json) ·
[Development quickstart](development-review.json) · [Native artifact identities](artifacts.json).

## Inspection and boundaries

The full source pages were visually inspected. Grosset p.28 supplies the short
lowering instruction; p.29 names both sets of counts. His p.21 explains brackets,
and p.86 note 36 retains the uncertainty in the longer demonstration. The 1894
printed p.302 gives the ṣaḍja count verses and mūrchanā half-verse with its own
numbering. No OCR output is used as an authoritative transcription.

Real desktop, 375 px and Sanskrit-reader screenshots were inspected. The main
figure has an explicit ordinal-cell caption; the Pa arrow stops above its label
so it does not obscure the word at phone width. The saved reading's diagrams,
Sanskrit text, exact table and source captions were checked in rendered Chromium
PDF pages and text extraction. The native PDF has 22 A4 pages and no JavaScript.
Physical printing and listening remain unverified.

The scope of the arithmetic is the selected count row and Pa operation. We do
not infer the text's entire tuning, instrumental practice, every internal śruti
position, historical melodies or a performance from these examples. Both modern
pitch assumptions remain labelled in the live UI, saved HTML, CSV and WAV filename.
The WAV's verbal context is in its accompanying reading, not spoken into the file.
