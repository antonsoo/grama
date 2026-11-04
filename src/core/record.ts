import type { Attachment } from "./attachment";
import { NOTICE } from "./notice";
import { type Pose, parsePose } from "./tuning";
export function comparisonJSON(pose: Pose, attachment?: Attachment): string {
  return `${JSON.stringify(attachment === undefined ? { format: "grama-comparison-v2", notice: NOTICE, pose } : { format: "grama-comparison-v3", notice: NOTICE, pose, attachment }, null, 2)}\n`;
}
export function parseComparisonRecord(raw: string): { pose: Pose; attachment: Attachment } {
  if (raw.length > 65536) throw new Error("Comparison JSON must be under 64 KB.");
  const input: unknown = JSON.parse(raw);
  if (!input || typeof input !== "object" || Array.isArray(input))
    throw new Error("Expected a saved Grama comparison.");
  const data = input as Record<string, unknown>;
  const keys = Object.keys(data).sort().join(",");
  const legacy = data.format === "grama-comparison-v1" && keys === "format,pose";
  const current =
    data.format === "grama-comparison-v2" &&
    keys === "format,notice,pose" &&
    data.notice === NOTICE;
  const diagnostic =
    data.format === "grama-comparison-v3" &&
    keys === "attachment,format,notice,pose" &&
    data.notice === NOTICE &&
    (data.attachment === "arriving" || data.attachment === "leaving");
  if (!legacy && !current && !diagnostic)
    throw new Error("Expected a Grāma comparison (v1, v2 or v3) with its required fields.");
  return {
    pose: parsePose(data.pose),
    attachment: diagnostic ? (data.attachment as Attachment) : "leaving",
  };
}

export function parseComparison(raw: string): Pose {
  return parseComparisonRecord(raw).pose;
}
