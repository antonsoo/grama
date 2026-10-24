# One changed note, two changed intervals

This project reads a small, consequential distinction in early Indian music
theory: the two grāmas differ in tuning, while changing the starting note of a
succession can leave its tuning intact. It uses chapter 28 of the Nāṭyaśāstra,
attributed to Bharata. The text is composite and transmitted through differing
manuscripts; no exact date for this passage or ancient performance is asserted.

## What is transcribed

Joanny Grosset, _Contribution à l'étude de la musique hindoue_, in _Mélanges de
philologie indo-européenne_, Bibliothèque de la Faculté des lettres de Lyon VI
(Paris: Ernest Leroux, 1888), printed pp.28–29: introductory grāma prose,
verse 25, the first Pa-lowering sentence, and verses 26–29. The application
provides a normalized IAST transcription, a Devanagari rendering of that text
and new English translations. Grosset's Roman Sanskrit typography (including
ç for ś, and his vowel/cerebral diacritics) becomes current IAST. Printed line
wrapping, apparatus and page line numbers are not reproduced in the excerpts.
Full pages keep them inspectable. Devanagari is a rendering of the chosen
reading, not a claim that Grosset printed Devanagari.

The first half of the mūrchanā definition comes from Śivadatta and Kāśīnāth
Pāṇḍuraṅg Parab, eds., _The Nāṭyaśāstra of Bharata Muni_, Kāvyamālā 42
(Bombay: Tukārām Jāvajī, Nirṇaya-Sāgara Press, 1894), printed p.302, verse 8.
Its preceding count verses 2–3 correspond to Grosset's 26–27. The different
numbering is preserved. This edition lacks much of the opening chapter material
in Grosset. It is a second printed witness, not a silently combined text.

The [manifest](../public/sources/manifest.json) gives original PDF URLs, whole
PDF SHA-256, exact physical and printed pages, and every bundled image's hash.
The scans are of 1888 and 1894 public-domain editions. The 1894 PDF has repeated
and out-of-order pages, so physical page numbers are mapped individually.
Images are full pages rendered by Poppler; they are neither generated nor
repaired. SanskritDocuments' digital chapter helped locate the passage, but its
text and modern English translations are not vendored.

## A textual limit that changes the product

Grosset p.21 explicitly says brackets mark doubtful passages. His pp.28–29
bracket the longer two-vīṇā experiment after the short Pa-lowering instruction.
His note 36 on p.86 calls the demonstration obscure, its translation approximate
and the manuscript reading unsatisfactory. The bench therefore does not pretend
to enact all four stages of that experiment or resolve its philology. Readers
can inspect both the brackets and the note. His French count diagrams on p.58
and explanation on pp.85–86 are editorial witnesses, distinguished from the
Sanskrit. We do not adopt all his nineteenth-century historical and linguistic
claims (including the etymological speculation in note 32).

## Count convention

Counts arriving at each named note:

| Grāma    |  Sa |  Re |  Ga |  Ma |  Pa | Dha |  Ni | Total |
| -------- | --: | --: | --: | --: | --: | --: | --: | ----: |
| Ṣaḍja    |   4 |   3 |   2 |   4 |   4 |   3 |   2 |    22 |
| Madhyama |   4 |   3 |   2 |   4 |   3 |   4 |   2 |    22 |

Thus ascending gaps starting at Sa are `3,2,4,4,3,2,4`, not
`4,3,2,4,4,3,2`. Grosset's verse 25 gives the former, verses 26–27 the latter
attached to named notes. Lower Pa while keeping the other six pitches fixed:
Ma–Pa contracts from four counts to three; Pa–Dha expands from three to four.
The fixed Ma–Dha span has seven counts in both cases.

The count rail is ordinal. Equal cell widths do not represent equal cents,
string distances or equal ancient frequency steps. There are seven named notes,
not twenty-two equal-pitch piano keys. The separate pitch ruler is logarithmic
and explicitly belongs to a selected modern assumption.

## Two modern numerical witnesses

The text's count row alone is insufficient to determine frequency ratios. The
bench makes that underdetermination audible with two deliberately explicit
assumptions. They are not presented as equally plausible reconstructions of
all Nāṭyaśāstra music theory or as satisfying its additional consonance rules.

| Count | Modern ratio example |   Cents | Equal-division counterexample |
| ----- | -------------------- | ------: | ----------------------------- |
| 4     | 9/8                  | 203.910 | 4 × 1200/22 = 218.182 cents   |
| 3     | 10/9                 | 182.404 | 3 × 1200/22 = 163.636 cents   |
| 2     | 16/15                | 111.731 | 2 × 1200/22 = 109.091 cents   |

The first assumption has `3×log2(9/8) + 2×log2(10/9) +
2×log2(16/15) = 1`; its seven gaps close exactly at the octave. Starting at Sa,
its ṣaḍja-grāma ratios are `1,10/9,32/27,4/3,3/2,5/3,16/9,2`.
Madhyama-grāma changes only Pa from `3/2` to `40/27`, lowering it by `81/80`
(21.506 cents). In 22 equal divisions it changes Pa from count position 13 to
12, a lowering of 54.545 cents. The same count change gives different numerical
pitch changes. Neither number is extracted from the Sanskrit count alone.

The ratio example gives sizes to whole 2-, 3- and 4-count gaps; it does not
assign a frequency to every internal cell. The ratio example is our chosen
calculation, not attributed to Bharata or
Grosset. The equal-division example is a counterexample to inferring tuning
from the count alone, not an ancient tuning claim. Repeating intervals are
multiplicative in frequency, additive in cents; the renderer computes exact
reduced fractions before converting them for sound.

Sa is an arbitrary modern reference, default 220 Hz, adjustable 110–440 Hz.
Changing the starting note rotates the ascent through the fixed tuning; notes
that wrap the octave double their frequency. We never move all notes to bring
the new first note back to 220 Hz. The seven ascending rotations illustrate an
ordering principle, not named historical mūrchanās, melodies, rāgas or ornaments.
The two grāmas keep Sa in the same place in the display for comparison.

## Sound and saved work

Playback and WAV export share mono sine synthesis at 44,100 samples/second,
12 ms attack, 40 ms release and peak nominal amplitude 0.2. Sound is a modern
auditory aid, with no vīṇā timbre, measured instrument, performance or tuning
practice implied. Output depends on the device and listener; audibility is not
assessed clinically. A control change, navigation or hidden tab cancels old sound.

Saved HTML contains the selected comparison, both numeric rows, ordered ascent,
all eight excerpts, word notes, all eleven full source pages, fonts, source
identities and the listening WAV. It runs no scripts and makes no automatic
remote request. The included comparison JSON can be reopened in the app. The
snapshot is captured at the click before assets are fetched and verified.
