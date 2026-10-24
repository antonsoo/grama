/** A count-row experiment, not a reconstruction of every Natya-shastra constraint. */
export type Grama = "sadja" | "madhyama";
export type PitchModel = "ratios" | "equal";
export interface Pose {
  grama: Grama;
  start: number;
  model: PitchModel;
  base: number;
}
export interface Fraction {
  n: number;
  d: number;
}
export const NOTES = [
  { short: "Sa", name: "ṣaḍja", deva: "षड्ज" },
  { short: "Re", name: "ṛṣabha", deva: "ऋषभ" },
  { short: "Ga", name: "gāndhāra", deva: "गान्धार" },
  { short: "Ma", name: "madhyama", deva: "मध्यम" },
  { short: "Pa", name: "pañcama", deva: "पञ्चम" },
  { short: "Dha", name: "dhaivata", deva: "धैवत" },
  { short: "Ni", name: "niṣāda", deva: "निषाद" },
] as const;
export const DEFAULT: Pose = { grama: "sadja", start: 0, model: "ratios", base: 220 };
export const MODEL_NAMES: Record<PitchModel, string> = {
  ratios: "Modern ratio example",
  equal: "22 equal divisions (counterexample)",
};
export function fraction(n: number, d = 1): Fraction {
  if (!Number.isSafeInteger(n) || !Number.isSafeInteger(d) || n < 1 || d < 1)
    throw new Error("Ratios require positive safe integers.");
  let a = n;
  let b = d;
  while (b) {
    const r = a % b;
    a = b;
    b = r;
  }
  return { n: n / a, d: d / a };
}
export const times = (a: Fraction, b: Fraction): Fraction => fraction(a.n * b.n, a.d * b.d);
export const divided = (a: Fraction, b: Fraction): Fraction => fraction(a.n * b.d, a.d * b.n);
export const value = (r: Fraction): number => r.n / r.d;
export const ratioText = (r: Fraction): string => `${r.n}/${r.d}`;
export const cents = (r: number): number => 1200 * Math.log2(r);
/** Counts assigned to the interval arriving at each named note, Sa through Ni. */
export function incoming(grama: Grama): number[] {
  return grama === "sadja" ? [4, 3, 2, 4, 4, 3, 2] : [4, 3, 2, 4, 3, 4, 2];
}
export function outgoing(grama: Grama, start = 0): number[] {
  const row = incoming(grama);
  return Array.from({ length: 7 }, (_, i) => row[(start + i + 1) % 7] ?? 0);
}
/** These three ratios are an explicit additional assumption for this example. */
export function intervalRatio(count: number): Fraction {
  if (count === 4) return fraction(9, 8);
  if (count === 3) return fraction(10, 9);
  if (count === 2) return fraction(16, 15);
  throw new Error("This experiment supports the printed 2, 3 and 4 counts only.");
}
export function exactNotes(grama: Grama): Fraction[] {
  const pitches = [fraction(1)];
  for (const count of outgoing(grama))
    pitches.push(times(pitches.at(-1) ?? fraction(1), intervalRatio(count)));
  return pitches;
}
export function noteFactors(grama: Grama, model: PitchModel): number[] {
  if (model === "ratios") return exactNotes(grama).map(value);
  let position = 0;
  return [
    1,
    ...outgoing(grama).map((count) => {
      position += count;
      return 2 ** (position / 22);
    }),
  ];
}
export interface Tone {
  note: number;
  octave: number;
  frequency: number;
  factor: number;
  count: number | null;
}
/** Changing the start rotates an existing tuning; it never reassigns Sa's Hz. */
export function sequence(pose: Pose): Tone[] {
  const factors = noteFactors(pose.grama, pose.model);
  const counts = incoming(pose.grama);
  return Array.from({ length: 8 }, (_, step) => {
    const unwrapped = pose.start + step;
    const note = unwrapped % 7;
    const octave = Math.floor(unwrapped / 7);
    const factor = (factors[note] ?? 1) * 2 ** octave;
    return {
      note,
      octave,
      frequency: factor * pose.base,
      factor,
      count: step === 0 ? null : (counts[note] ?? 0),
    };
  });
}
export function lowering(model: PitchModel): number {
  return cents((noteFactors("sadja", model)[4] ?? 1) / (noteFactors("madhyama", model)[4] ?? 1));
}
export function parsePose(input: unknown): Pose {
  if (!input || typeof input !== "object" || Array.isArray(input))
    throw new Error("Expected a Grama comparison object.");
  const data = input as Record<string, unknown>;
  if (Object.keys(data).sort().join(",") !== "base,grama,model,start")
    throw new Error("Expected exactly grama, start, model and base.");
  if (data.grama !== "sadja" && data.grama !== "madhyama")
    throw new Error("Choose one of the two gramas.");
  if (data.model !== "ratios" && data.model !== "equal")
    throw new Error("Choose one of the two stated pitch assumptions.");
  if (
    typeof data.start !== "number" ||
    !Number.isInteger(data.start) ||
    data.start < 0 ||
    data.start > 6
  )
    throw new Error("Starting note must be 0 through 6.");
  if (
    typeof data.base !== "number" ||
    !Number.isFinite(data.base) ||
    data.base < 110 ||
    data.base > 440
  )
    throw new Error("Sa must be between 110 and 440 Hz.");
  return { grama: data.grama, model: data.model, start: data.start, base: data.base };
}
export function poseHash(pose: Pose): string {
  return `#g=${pose.grama}&s=${pose.start}&m=${pose.model}&hz=${pose.base}`;
}
export function fromHash(hash: string): Pose {
  const p = new URLSearchParams(hash.replace(/^#/, ""));
  if (!p.has("g")) return { ...DEFAULT };
  return parsePose({
    grama: p.get("g"),
    start: Number(p.get("s")),
    model: p.get("m"),
    base: Number(p.get("hz")),
  });
}
export function csv(pose: Pose): string {
  const head = [
    "# Grama: count-row experiment; modern pitch assumption, not an ancient performance reconstruction",
    `# model=${pose.model}; Sa=${pose.base} Hz; start=${NOTES[pose.start]?.short}`,
    "grama,note,incoming_count,frequency_hz,cents_from_Sa,exact_ratio_if_assumed",
  ];
  for (const grama of ["sadja", "madhyama"] as const) {
    const factors = noteFactors(grama, pose.model);
    const ratios = exactNotes(grama);
    for (let i = 0; i < 7; i++)
      head.push(
        [
          grama,
          NOTES[i]?.short,
          incoming(grama)[i],
          ((factors[i] ?? 1) * pose.base).toFixed(8),
          cents(factors[i] ?? 1).toFixed(8),
          pose.model === "ratios" ? ratioText(ratios[i] ?? fraction(1)) : "",
        ].join(","),
      );
  }
  return `${head.join("\n")}\n`;
}
