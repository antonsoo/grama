# Contributing

Use Node 24 or later. Run `npm ci`, `npm run check`, then `npm run verify:oracle`.
The independent oracle uses Python 3's standard library. The browser review
needs the Chromium and Firefox versions matching the locked Playwright release.

Source corrections should identify the printed edition, page, reading and
apparatus. Keep Sanskrit, normalized IAST, new English and editorial inference
distinguishable. Never turn a modern numerical example into an ancient tuning
claim. Do not infer equal śrutis from the number twenty-two.

The pure model belongs in `src/core/`. Sound playback and WAV export share a
renderer. A tuning change must preserve the six fixed notes; a new starting
note must preserve the tuning. A saved reading must capture its click-time state
and verify every embedded source asset before downloading it.

For visible changes, inspect real screenshots at desktop and 375 px, both
browsers, keyboard use, actual file downloads and offline reload with the origin
disabled. Keep evidence scoped to what was actually run. Source pushes, Pages
commits, public bytes and browser behavior are separate claims.
