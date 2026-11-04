import type { SoundEvent } from "./audio";
import { NOTICE } from "./notice";
import {
  cents,
  type Fraction,
  fraction,
  type Grama,
  incoming,
  intervalRatio,
  MODEL_NAMES,
  NOTES,
  outgoing,
  type PitchModel,
  type Pose,
  ratioText,
  times,
  value,
} from "./tuning";
export type Attachment = "arriving" | "leaving";
export function attachmentFromSearch(search: string): Attachment {
  const params = new URLSearchParams(search),
    entries = params.getAll("attachment");
  if (!entries.length) return "leaving";
  if (entries.length !== 1 || (entries[0] !== "arriving" && entries[0] !== "leaving"))
    throw new Error("Choose one incoming or following count placement.");
  return entries[0];
}
/** The leaving case is a deliberately wrong reading of the named-note counts.
 * Both preserve the group's multiset; only one obeys the printed Pa instruction. */
export function attachmentCounts(grama: Grama, attachment: Attachment): number[] {
  return attachment === "arriving" ? outgoing(grama) : incoming(grama);
}
export function attachmentRatios(grama: Grama, attachment: Attachment): Fraction[] {
  let pitch = fraction(1);
  return [
    pitch,
    ...attachmentCounts(grama, attachment).map((count) => {
      pitch = times(pitch, intervalRatio(count));
      return pitch;
    }),
  ];
}
export function attachmentFactors(
  grama: Grama,
  attachment: Attachment,
  model: PitchModel,
): number[] {
  if (model === "ratios") return attachmentRatios(grama, attachment).map(value);
  let total = 0;
  return [
    1,
    ...attachmentCounts(grama, attachment).map((count) => {
      total += count;
      return 2 ** (total / 22);
    }),
  ];
}
export function movedNotes(attachment: Attachment, model: PitchModel): number[] {
  const a = attachmentFactors("sadja", attachment, model),
    b = attachmentFactors("madhyama", attachment, model);
  return NOTES.flatMap((_, note) =>
    Math.abs((a[note] ?? 1) - (b[note] ?? 1)) > 1e-10 ? [note] : [],
  );
}
export function attachmentScore(pose: Pose, attachment: Attachment): SoundEvent[] {
  return (["sadja", "madhyama"] as const).flatMap((grama, lane) => {
    const pitches = attachmentFactors(grama, attachment, pose.model);
    return [3, 4, 5].map((note, index) => ({
      frequency: pose.base * (pitches[note] ?? 1),
      start: lane * 2.45 + index * 0.72,
      duration: 0.6,
      note,
      label: `${grama}: ${NOTES[note]?.short}`,
    }));
  });
}
export function attachmentCSV(pose: Pose, attachment: Attachment): string {
  const rows = [
    `# ${NOTICE}`,
    `# Count placement diagnostic: ${attachment}; ${MODEL_NAMES[pose.model]}; Sa=${pose.base} Hz. Leaving is a deliberate misreading, not an alternative ancient tuning.`,
    "grama,note,source_named_count,modeled_following_gap,frequency_hz,exact_ratio_if_assumed,change_cents",
  ];
  const initial = attachmentFactors("sadja", attachment, pose.model);
  for (const grama of ["sadja", "madhyama"] as const) {
    const factors = attachmentFactors(grama, attachment, pose.model),
      ratios = attachmentRatios(grama, attachment);
    for (let i = 0; i < 7; i++)
      rows.push(
        [
          grama,
          NOTES[i]?.short,
          incoming(grama)[i],
          attachmentCounts(grama, attachment)[i],
          ((factors[i] ?? 1) * pose.base).toFixed(9),
          pose.model === "ratios" ? ratioText(ratios[i] ?? fraction(1)) : "",
          cents((factors[i] ?? 1) / (initial[i] ?? 1)).toFixed(9),
        ].join(","),
      );
  }
  return `${rows.join("\n")}\n`;
}
