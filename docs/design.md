# Design before implementation

A bench for an English-speaking reader who is beginning Sanskrit. The central
object is a seven-note count rail: its 22 cells record interval counts, while
a separate cents ruler records pitches under an explicitly modern assumption.
No ancient instrument rendering or equal-pitch 22-key keyboard is implied.

| Role                       | Token               |
| -------------------------- | ------------------- |
| Page                       | white `#ffffff`     |
| Bench surround             | pale blue `#edf4f7` |
| Text                       | deep blue `#173d50` |
| Source and unchanged notes | ocean `#176477`     |
| Retuned Pa                 | plum `#843e77`      |
| Rules                      | blue grey `#a7bdc8` |

IBM Plex Sans carries controls and English. Noto Serif carries IAST, with full
Latin diacritics. Noto Serif Devanagari carries Sanskrit script. All are local
OFL assets. Text is left aligned; prose stays under 72 characters per line.

```text
Grama                     Bench / Sanskrit / Save
Change the first note. Then change one string.
[ starting note ] [ lower Pa ] [ hear ] [ stop ]
 +-- seven named interval groups; 22 count cells --+
 | Sa  Re   Ga      Ma      Pa     Dha   Ni  Sa    |
 +-- separate pitch ruler, with before/after Pa ---+
 [same count row: choose a modern pitch assumption]
 [exact intervals and frequencies; save comparison]
 Sanskrit / IAST / English   | full printed page
```

On phones the count rail stays a compact full-width figure, labels below it
use ordinary text, and the controls and exact table remain native and usable.
The source reading is sequential, with page images below each excerpt.

Critique: a dark 'audio lab' with neon waveform would resemble generic music
software. A sepia manuscript with ornamental Indian motifs would obscure the
operation and pretend to a material artifact we do not model. The chosen
figure instead gives colour a stable role: plum is always the one retuned note,
including its two changed interval counts. No decorative waveform or cards.
