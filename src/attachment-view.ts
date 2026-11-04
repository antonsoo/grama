import {
  type Attachment,
  attachmentFactors,
  attachmentRatios,
  movedNotes,
} from "./core/attachment";
import { cents, MODEL_NAMES, NOTES, type Pose, ratioText } from "./core/tuning";
import { htmlEscape } from "./figures";
export function attachmentFinding(pose: Pose, attachment: Attachment): string {
  const name = movedNotes(attachment, pose.model)
    .map((i) => NOTES[i]?.short)
    .join(", ");
  return attachment === "arriving"
    ? `${name} moves. This placement agrees with the printed instruction to lower Pa.`
    : `${name} moves; Pa stays fixed. This placement contradicts the printed instruction to lower Pa.`;
}
export function attachmentChecks(pose: Pose, attachment: Attachment): string {
  const initial = attachmentFactors("sadja", attachment, pose.model),
    ratios = attachmentRatios("sadja", attachment);
  return `Both rows still total 22 counts and close at an octave under ${MODEL_NAMES[pose.model]}. ${pose.model === "ratios" ? `The initial Sa–Ma remains ${ratioText(ratios[3] ?? { n: 1, d: 1 })} and Sa–Pa ${ratioText(ratios[4] ?? { n: 1, d: 1 })}. Both placements give these same two pure intervals. They cannot decide which note-count reading is correct.` : `Initial Sa–Ma = ${cents(initial[3] ?? 1).toFixed(3)} cents; Sa–Pa = ${cents(initial[4] ?? 1).toFixed(3)} cents. Neither is claimed pure in this counterexample.`}`;
}
export function attachmentTable(pose: Pose, attachment: Attachment): string {
  const a = attachmentFactors("sadja", attachment, pose.model),
    b = attachmentFactors("madhyama", attachment, pose.model);
  return `<table><caption>${attachment === "arriving" ? "Incoming count placement" : "Deliberately wrong following count placement"}; Sa fixed at ${pose.base} Hz. Modern pitches, rounded display.</caption><thead><tr><th scope="col">Note</th><th scope="col">Initial, Hz</th><th scope="col">Second row, Hz</th><th scope="col">Change, cents</th></tr></thead><tbody>${NOTES.map((n, i) => `<tr${Math.abs((a[i] ?? 1) - (b[i] ?? 1)) > 1e-10 ? ' class="pa"' : ""}><th scope="row">${htmlEscape(n.short)}</th><td>${(pose.base * (a[i] ?? 1)).toFixed(3)}</td><td>${(pose.base * (b[i] ?? 1)).toFixed(3)}</td><td>${cents((b[i] ?? 1) / (a[i] ?? 1)).toFixed(3)}</td></tr>`).join("")}</tbody></table>`;
}
