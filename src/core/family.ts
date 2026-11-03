import { type SoundEvent, wav } from "./audio";
import { cents, type Grama, NOTES, outgoing } from "./tuning";

/** Whole-gap sizes, in cents. This does not divide each gap into equal srutis. */
export interface Gaps {
  four: number;
  two: number;
}
export interface FamilyState {
  current: Gaps;
  reference: Gaps;
  base: number;
  locked: boolean;
}
export const PURE_FOUR = cents(9 / 8);
export const RATIO_GAPS: Gaps = { four: PURE_FOUR, two: cents(16 / 15) };
export const EQUAL_GAPS: Gaps = { four: 4800 / 22, two: 2400 / 22 };
export const OTHER_GAPS: Gaps = { four: 230, two: 90 };
export const FAMILY_NOTICE =
  "Copyright (c) 2026 Anthony Mercer. PolyForm-Noncommercial-1.0.0. Modern teaching model, not an ancient performance reconstruction.";
export const DEFAULT_FAMILY: FamilyState = {
  current: { ...RATIO_GAPS },
  reference: { ...RATIO_GAPS },
  base: 220,
  locked: true,
};
export function three(gaps: Gaps): number {
  // Each count row has three four-count gaps, two three-count and two two-count.
  return (1200 - 3 * gaps.four - 2 * gaps.two) / 2;
}
export function gapSize(count: number, gaps: Gaps): number {
  if (count === 4) return gaps.four;
  if (count === 3) return three(gaps);
  if (count === 2) return gaps.two;
  throw new Error("Only the printed 2-, 3- and 4-count gaps are supported.");
}
export function positions(gaps: Gaps, grama: Grama): number[] {
  let position = 0;
  return [0, ...outgoing(grama).map((count) => (position += gapSize(count, gaps)))];
}
export function assessment(gaps: Gaps) {
  const middle = three(gaps);
  return {
    three: middle,
    lowering: gaps.four - middle,
    lowers: gaps.four - middle > 1e-8,
    ordered: gaps.four - middle > 1e-8 && middle - gaps.two > 1e-8,
    octave: 3 * gaps.four + 2 * middle + 2 * gaps.two,
    maError: (positions(gaps, "sadja")[3] ?? 0) - cents(4 / 3),
    paError: (positions(gaps, "sadja")[4] ?? 0) - cents(3 / 2),
  };
}
function object(input: unknown): Record<string, unknown> {
  if (!input || typeof input !== "object" || Array.isArray(input))
    throw new Error("Expected tuning settings.");
  return input as Record<string, unknown>;
}
export function parseGaps(input: unknown): Gaps {
  const data = object(input);
  if (Object.keys(data).sort().join(",") !== "four,two")
    throw new Error("A tuning needs exactly four and two gap sizes.");
  if (
    typeof data.four !== "number" ||
    !Number.isFinite(data.four) ||
    data.four < 180 ||
    data.four > 260 ||
    typeof data.two !== "number" ||
    !Number.isFinite(data.two) ||
    data.two < 60 ||
    data.two > 150
  )
    throw new Error("Use 180–260 cents for four counts and 60–150 for two counts.");
  return { four: data.four, two: data.two };
}
export function parseFamily(input: unknown): FamilyState {
  const data = object(input);
  if (Object.keys(data).sort().join(",") !== "base,current,locked,reference")
    throw new Error("Expected base, current, locked and reference settings.");
  if (
    typeof data.base !== "number" ||
    !Number.isFinite(data.base) ||
    data.base < 110 ||
    data.base > 440
  )
    throw new Error("Sa must be between 110 and 440 Hz.");
  if (typeof data.locked !== "boolean")
    throw new Error("The consonance lock must be true or false.");
  const current = parseGaps(data.current),
    reference = parseGaps(data.reference);
  if (!assessment(reference).ordered)
    throw new Error(
      "The saved witness must have ordered whole gaps and a lower Pa. Keep a failed candidate in the current slot.",
    );
  if (data.locked && Math.abs(current.four - PURE_FOUR) > 1e-9)
    throw new Error("The locked fourth and fifth require the ratio example's four-count size.");
  return { current, reference, base: data.base, locked: data.locked };
}
export function familyHash(state: FamilyState): string {
  return `#${new URLSearchParams({
    a: String(state.current.four),
    c: String(state.current.two),
    ra: String(state.reference.four),
    rc: String(state.reference.two),
    hz: String(state.base),
    lock: state.locked ? "1" : "0",
  })}`;
}
export function familyFromHash(hash: string): FamilyState {
  if (!hash || hash === "#") return structuredClone(DEFAULT_FAMILY);
  const p = new URLSearchParams(hash.replace(/^#/, ""));
  // Section anchors remain usable; a settings link must contain the whole record.
  if (!p.has("a") && !hash.includes("=")) return structuredClone(DEFAULT_FAMILY);
  if (
    [...p.keys()].sort().join(",") !== "a,c,hz,lock,ra,rc" ||
    !["0", "1"].includes(p.get("lock") ?? "")
  )
    throw new Error("This tuning link is incomplete or has unrecognized settings.");
  for (const value of p.values())
    if (!value.trim()) throw new Error("Tuning settings cannot be empty.");
  return parseFamily({
    current: { four: Number(p.get("a")), two: Number(p.get("c")) },
    reference: { four: Number(p.get("ra")), two: Number(p.get("rc")) },
    base: Number(p.get("hz")),
    locked: p.get("lock") === "1",
  });
}
export function familyJSON(state: FamilyState): string {
  return `${JSON.stringify({ format: "grama-tuning-family-v1", notice: FAMILY_NOTICE, state: parseFamily(state) }, null, 2)}\n`;
}
export function parseFamilyJSON(raw: string): FamilyState {
  if (raw.length > 65536) throw new Error("Tuning JSON must be under 64 KB.");
  const data = object(JSON.parse(raw));
  if (
    Object.keys(data).sort().join(",") !== "format,notice,state" ||
    data.notice !== FAMILY_NOTICE ||
    data.format !== "grama-tuning-family-v1"
  )
    throw new Error("Expected a grama-tuning-family-v1 record.");
  return parseFamily(data.state);
}
export function familyCSV(state: FamilyState): string {
  const rows = [
    `# ${FAMILY_NOTICE} Numerical cents and Hz are approximate.`,
    "witness,grama,note,incoming_count,cents_from_Sa,frequency_hz,four_count_cents,three_count_cents,two_count_cents,ordered_gaps,Pa_lowers",
  ];
  for (const witness of ["reference", "current"] as const) {
    const gaps = state[witness],
      report = assessment(gaps);
    for (const grama of ["sadja", "madhyama"] as const) {
      const counts = [null, ...outgoing(grama)];
      positions(gaps, grama).forEach((pitch, i) => {
        rows.push(
          [
            witness,
            grama,
            i === 7 ? "Sa_octave" : NOTES[i]?.short,
            counts[i],
            pitch.toFixed(9),
            (state.base * 2 ** (pitch / 1200)).toFixed(9),
            gaps.four.toFixed(9),
            report.three.toFixed(9),
            gaps.two.toFixed(9),
            report.ordered,
            report.lowers,
          ].join(","),
        );
      });
    }
  }
  return `${rows.join("\n")}\n`;
}
export type FamilyListening = "reference" | "current" | "compare";
export function familyScore(state: FamilyState, kind: FamilyListening): SoundEvent[] {
  const witnesses = kind === "compare" ? (["reference", "current"] as const) : [kind];
  return witnesses.flatMap((witness, lane) => {
    const gaps = state[witness];
    return (["sadja", "madhyama"] as const).flatMap((grama, row) => {
      const pitches = positions(gaps, grama);
      return [3, 4, 5].map((note, i) => ({
        frequency: state.base * 2 ** ((pitches[note] ?? 0) / 1200),
        start: lane * 5.2 + row * 2.45 + i * 0.72,
        duration: 0.6,
        note,
        label: `${witness}: ${grama}; ${NOTES[note]?.short}`,
      }));
    });
  });
}

/** Standard RIFF INFO copyright chunk: keep attribution with the portable sound. */
export function familyWave(state: FamilyState): Uint8Array<ArrayBuffer> {
  const audio = wav(familyScore(state, "compare"));
  const notice = new TextEncoder().encode(`${FAMILY_NOTICE}\0`);
  const padded = notice.length + (notice.length % 2);
  const out = new Uint8Array(audio.length + 20 + padded);
  out.set(audio);
  const view = new DataView(out.buffer);
  const text = (offset: number, value: string) => out.set(new TextEncoder().encode(value), offset);
  const offset = audio.length;
  text(offset, "LIST");
  view.setUint32(offset + 4, 12 + padded, true);
  text(offset + 8, "INFO");
  text(offset + 12, "ICOP");
  view.setUint32(offset + 16, notice.length, true);
  out.set(notice, offset + 20);
  view.setUint32(4, out.length - 8, true);
  return out;
}
