import { noteFactors, type Pose, sequence } from "./tuning";
export interface SoundEvent {
  frequency: number;
  start: number;
  duration: number;
  note: number;
  label: string;
}
export type Listening = "scale" | "pa" | "context";
export function score(pose: Pose, kind: Listening): SoundEvent[] {
  if (kind === "scale")
    return sequence(pose).map((tone, i) => ({
      frequency: tone.frequency,
      start: i * 0.55,
      duration: 0.48,
      note: tone.note,
      label: `${tone.note}`,
    }));
  const before = noteFactors("sadja", pose.model);
  const after = noteFactors("madhyama", pose.model);
  const notes = kind === "pa" ? [4, 4, 4, 4] : [3, 4, 5, 3, 4, 5];
  return notes.map((note, i) => {
    const changed = kind === "pa" ? i % 2 === 1 : i >= 3;
    return {
      frequency: (changed ? (after[note] ?? 1) : (before[note] ?? 1)) * pose.base,
      start: i * 0.72 + (kind === "context" && i >= 3 ? 0.3 : 0),
      duration: 0.6,
      note,
      label: changed ? "Lowered Pa tuning" : "Initial tuning",
    };
  });
}
export const SAMPLE_RATE = 44100;
export function envelope(t: number, duration: number): number {
  if (t < 0 || t >= duration) return 0;
  return Math.min(1, t / 0.012, (duration - t) / 0.04);
}
/** Shared mono sine rendering for live playback and the explicitly labelled WAV. */
export function samples(events: SoundEvent[], rate = SAMPLE_RATE): Float32Array<ArrayBuffer> {
  if (!Number.isInteger(rate) || rate < 8000 || rate > 96000 || events.length > 32)
    throw new Error("Unsupported audio bounds.");
  let end = 0;
  for (const e of events) {
    if (
      ![e.frequency, e.start, e.duration].every(Number.isFinite) ||
      e.frequency < 20 ||
      e.frequency > rate / 3 ||
      e.start < 0 ||
      e.duration <= 0 ||
      e.duration > 2 ||
      e.start + e.duration > 30
    )
      throw new Error("Unsupported audio event.");
    end = Math.max(end, e.start + e.duration);
  }
  const out = new Float32Array(Math.ceil((end + 0.12) * rate));
  for (const e of events) {
    const first = Math.ceil(e.start * rate);
    const last = Math.min(out.length, Math.ceil((e.start + e.duration) * rate));
    for (let i = first; i < last; i++) {
      const t = i / rate - e.start;
      out[i] =
        (out[i] ?? 0) + 0.2 * Math.sin(2 * Math.PI * e.frequency * t) * envelope(t, e.duration);
    }
  }
  // Scores are sequential. Keep the function safe if a caller supplies overlap.
  for (let i = 0; i < out.length; i++) out[i] = Math.max(-0.95, Math.min(0.95, out[i] ?? 0));
  return out;
}
export function wav(events: SoundEvent[]): Uint8Array<ArrayBuffer> {
  const pcm = samples(events);
  const bytes = new Uint8Array(44 + pcm.length * 2);
  const view = new DataView(bytes.buffer);
  const text = (offset: number, s: string) =>
    [...s].forEach((c, i) => {
      view.setUint8(offset + i, c.charCodeAt(0));
    });
  text(0, "RIFF");
  view.setUint32(4, bytes.length - 8, true);
  text(8, "WAVE");
  text(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, SAMPLE_RATE, true);
  view.setUint32(28, SAMPLE_RATE * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  text(36, "data");
  view.setUint32(40, pcm.length * 2, true);
  pcm.forEach((sample, i) => {
    view.setInt16(44 + 2 * i, Math.round(sample * 32767), true);
  });
  return bytes;
}
