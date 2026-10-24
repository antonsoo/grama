import { cents, incoming, NOTES, noteFactors, outgoing, type Pose } from "./core/tuning";
export const htmlEscape = (text: string): string =>
  text.replace(
    /[&<>"']/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] ?? c,
  );
const f = (n: number) => n.toFixed(2);
export function countFigure(pose: Pose, width = 920): string {
  const w = Math.max(320, width);
  const left = 16;
  const span = w - 32;
  const unit = span / 22;
  const x = (slot: number) => left + unit * slot;
  const positions = (g: "sadja" | "madhyama") => {
    let n = 0;
    return [
      0,
      ...outgoing(g).map((c) => {
        n += c;
        return n;
      }),
    ];
  };
  const before = positions("sadja");
  const after = positions("madhyama");
  let body = `<title>One retuned note exchanges two adjacent counts</title><desc>Counts arriving at Pa change from four to three; counts arriving at Dha change from three to four. Sa, Re, Ga, Ma, Dha and Ni keep their positions. Equal cell widths show ordinal counts, not equal pitch distances.</desc>`;
  for (let i = 0; i <= 7; i++) {
    const p = before[i] ?? 0;
    const q = after[i] ?? 0;
    body +=
      i === 4
        ? `<path d="M${f(x(p))} 100 L${f(x(q))} 178" stroke="#843e77" stroke-width="2" fill="none"/><path d="M${f(x(q) - 4)} 170 L${f(x(q))} 178 L${f(x(q) + 5)} 172" stroke="#843e77" stroke-width="2" fill="none"/>`
        : `<path d="M${f(x(p))} 100 V194" stroke="#a7bdc8" stroke-dasharray="2 6"/>`;
  }
  for (const [row, g] of (["sadja", "madhyama"] as const).entries()) {
    const pos = g === "sadja" ? before : after;
    const y = 72 + row * 142;
    body += `<text x="16" y="${y - 54}" font-size="16" fill="#173d50">${g === "sadja" ? "Ṣaḍja-grāma" : "Madhyama-grāma"}${pose.grama === g ? " · selected" : ""}</text>`;
    for (let i = 0; i < 7; i++) {
      const from = pos[i] ?? 0;
      const to = pos[i + 1] ?? 0;
      const changed = i === 3 || i === 4;
      for (let j = from; j < to; j++)
        body += `<rect x="${f(x(j))}" y="${y + 9}" width="${f(unit)}" height="18" fill="${changed ? "#eee0eb" : "#e2eef2"}" stroke="white" stroke-width="2"/>`;
      body += `<text x="${f(x((from + to) / 2))}" y="${y + 47}" text-anchor="middle" fill="${changed ? "#843e77" : "#173d50"}" font-size="14">${to - from}</text>`;
    }
    body += `<path d="M${left} ${y} H${w - left}" stroke="#176477" stroke-width="1.5"/>`;
    for (let i = 0; i <= 7; i++) {
      const px = x(pos[i] ?? 0);
      const pa = i === 4;
      body += `<circle cx="${f(px)}" cy="${y}" r="${pa ? 5 : 3}" fill="${pa ? "#843e77" : "#176477"}"/><text x="${f(px)}" y="${y - 15}" text-anchor="middle" font-size="14" fill="${pa ? "#843e77" : "#173d50"}">${i === 7 ? "Sa′" : NOTES[i]?.short}</text>`;
    }
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" role="img" viewBox="0 0 ${w} 272" width="${w}" height="272" style="font-family:GramaSans,Arial,sans-serif;background:white;max-width:100%;height:auto">${body}</svg>`;
}
export function pitchFigure(pose: Pose, width = 920): string {
  const w = Math.max(320, width);
  const x = (c: number) => 16 + (c / 1200) * (w - 32);
  let body = `<title>Pitch positions under ${pose.model === "ratios" ? "the modern ratio example" : "the equal-division counterexample"}</title><desc>Two logarithmic pitch rows from Sa to its octave. Only Pa moves. These frequencies require an extra modern assumption, beyond the count row.</desc>`;
  for (const tick of [0, 400, 800, 1200])
    body += `<path d="M${f(x(tick))} 18 V151" stroke="#c9d9df"/><text x="${f(x(tick))}" y="177" text-anchor="${tick === 0 ? "start" : tick === 1200 ? "end" : "middle"}" font-size="12" fill="#173d50">${tick}${tick === 1200 ? " cents" : ""}</text>`;
  for (const [i, g] of (["sadja", "madhyama"] as const).entries()) {
    const y = 52 + 80 * i;
    body += `<path d="M16 ${y} H${w - 16}" stroke="#176477"/>`;
    noteFactors(g, pose.model).forEach((factor, j) => {
      const px = x(cents(factor));
      body += `<circle cx="${f(px)}" cy="${y}" r="${j === 4 ? 5 : 3}" fill="${j === 4 ? "#843e77" : "#176477"}"/><text x="${f(px)}" y="${y - 12}" font-size="14" text-anchor="middle" fill="${j === 4 ? "#843e77" : "#173d50"}">${j === 7 ? "Sa′" : NOTES[j]?.short}</text>`;
    });
  }
  const pa0 = cents(noteFactors("sadja", pose.model)[4] ?? 1),
    pa1 = cents(noteFactors("madhyama", pose.model)[4] ?? 1);
  body += `<path d="M${f(x(pa0))} 61 L${f(x(pa1))} 123" stroke="#843e77" stroke-width="2"/>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" role="img" viewBox="0 0 ${w} 190" width="${w}" height="190" style="font-family:GramaSans,Arial,sans-serif;background:white;max-width:100%;height:auto">${body}</svg>`;
}
export function comparisonTable(pose: Pose): string {
  const a = noteFactors("sadja", pose.model),
    b = noteFactors("madhyama", pose.model);
  return `<table><caption>Both tunings, with Sa fixed at ${pose.base} Hz. Counts belong to the interval arriving at the note.</caption><thead><tr><th scope="col">Note</th><th scope="col">Arriving count<br/>Ṣaḍja / Madhyama</th><th scope="col">Pitch, Hz<br/>Ṣaḍja / Madhyama</th><th scope="col">Change, cents</th></tr></thead><tbody>${NOTES.map((n, i) => `<tr${i === 4 ? ' class="pa"' : ""}><th scope="row"><span lang="sa-Latn">${n.name}</span> (${n.short})</th><td>${incoming("sadja")[i]} / ${incoming("madhyama")[i]}</td><td>${((a[i] ?? 1) * pose.base).toFixed(3)} / ${((b[i] ?? 1) * pose.base).toFixed(3)}</td><td>${i === 4 ? cents((b[i] ?? 1) / (a[i] ?? 1)).toFixed(3) : "0.000"}</td></tr>`).join("")}</tbody></table>`;
}
