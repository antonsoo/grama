import { NOTICE } from "./notice";
import { type Pose, parsePose } from "./tuning";
export function comparisonJSON(pose: Pose): string {
  return `${JSON.stringify({ format: "grama-comparison-v2", notice: NOTICE, pose }, null, 2)}\n`;
}
export function parseComparison(raw: string): Pose {
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
  if (!legacy && !current)
    throw new Error("Expected a Grāma comparison (v1 or v2) with its required fields.");
  return parsePose(data.pose);
}
