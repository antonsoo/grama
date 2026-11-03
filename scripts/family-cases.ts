import { assessment, PURE_FOUR, positions } from "../src/core/family";

for (let four = 180; four <= 260; four++)
  for (let two = 60; two <= 150; two++) {
    const gaps = { four, two };
    console.log(
      JSON.stringify({
        gaps,
        initial: positions(gaps, "sadja"),
        lowered: positions(gaps, "madhyama"),
        report: assessment(gaps),
      }),
    );
  }
for (let two = 60; two <= 150; two++) {
  const gaps = { four: PURE_FOUR, two };
  console.log(
    JSON.stringify({
      gaps,
      initial: positions(gaps, "sadja"),
      lowered: positions(gaps, "madhyama"),
      report: assessment(gaps),
      locked: true,
    }),
  );
}
