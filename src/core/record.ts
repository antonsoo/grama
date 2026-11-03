import { type Pose, parsePose } from "./tuning";
export function comparisonJSON(pose: Pose): string {
  return `${JSON.stringify({ format: "grama-comparison-v1", pose }, null, 2)}\n`;
}
export function parseComparison(raw: string): Pose {
  if (raw.length > 65536) throw new Error("Comparison JSON must be under 64 KB.");
  const input: unknown = JSON.parse(raw);
  if (!input || typeof input !== "object" || Array.isArray(input))
    throw new Error("Expected a saved Grama comparison.");
  const data = input as Record<string, unknown>;
  if (Object.keys(data).sort().join(",") !== "format,pose" || data.format !== "grama-comparison-v1")
    throw new Error("Expected the grama-comparison-v1 format and a pose.");
  return parsePose(data.pose);
}
