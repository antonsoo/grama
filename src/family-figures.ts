import { assessment, type FamilyState, type Gaps, positions, three } from "./core/family";
import { NOTES } from "./core/tuning";

export function familyMap(state: FamilyState): string {
  const x = (a: number) => 52 + (a - 180) * 3.4;
  const y = (c: number) => 222 - (c - 60) * 1.8;
  const polygon = [
    [216, 60],
    [260, 60],
    [260, 105],
    [200, 150],
    [180, 150],
  ]
    .map(([a, c]) => `${x(a ?? 0)},${y(c ?? 0)}`)
    .join(" ");
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 360 275" role="img" aria-labelledby="map-title map-desc"><title id="map-title">A region of different count-row tunings</title><desc id="map-desc">Horizontal: four-count gap, 180 to 260 cents. Vertical: two-count gap, 60 to 150 cents. The shaded region has four-count greater than three-count greater than two-count gaps. The filled point is your tuning; the ring is the saved witness.</desc>
  <rect x="52" y="60" width="272" height="162" fill="#e6e9e9"/>
  <polygon points="${polygon}" fill="#bddbd6"/>
  ${[180, 200, 220, 240, 260].map((a) => `<path d="M${x(a)} 60V222" stroke="#fff" stroke-width="1"/><text x="${x(a)}" y="242" text-anchor="middle">${a}</text>`).join("")}
  ${[60, 90, 120, 150].map((c) => `<path d="M52 ${y(c)}H324" stroke="#fff"/><text x="43" y="${y(c) + 4}" text-anchor="end">${c}</text>`).join("")}
  <text x="52" y="30">TWO-COUNT GAP / cents</text><text x="188" y="268" text-anchor="middle">FOUR-COUNT GAP / cents</text>
  ${state.locked ? `<path d="M${x(state.current.four)} 60V222" stroke="#176477" stroke-width="2" stroke-dasharray="4 4"/>` : ""}
  <circle cx="${x(state.reference.four)}" cy="${y(state.reference.two)}" r="8" fill="none" stroke="#173d50" stroke-width="2"/>
  <circle cx="${x(state.current.four)}" cy="${y(state.current.two)}" r="4.5" fill="#843e77" stroke="#fff" stroke-width="1.5"/>
  </svg>`;
}
export function familyRuler(state: FamilyState, narrow = false): string {
  const width = narrow ? 340 : 1000,
    left = narrow ? 22 : 38,
    right = width - left;
  const x = (c: number) => left + (c / 1200) * (right - left);
  const lanes = (["sadja", "madhyama"] as const)
    .map((grama, lane) => {
      const y = 64 + lane * 132,
        current = positions(state.current, grama),
        reference = positions(state.reference, grama);
      const change = assessment(state.current).lowering;
      const second =
        change > 1e-8
          ? "LOWERED Pa"
          : change < -1e-8
            ? "RAISED Pa (failed)"
            : "UNCHANGED Pa (failed)";
      return `<text x="${left}" y="${y - 30}" fill="#c3d8dd">${lane ? `${second} / second row` : "INITIAL / ṣaḍja"}</text><path d="M${left} ${y}H${right}" stroke="#69818a"/>
    ${current
      .map(
        (
          p,
          i,
        ) => `<path d="M${x(reference[i] ?? 0)} ${y - 13}V${y + 13}" stroke="#b4cbd0" stroke-width="1.5" stroke-dasharray="2 2"/>
    <circle cx="${x(p)}" cy="${y}" r="${i === 4 ? 5.5 : 4}" fill="${i === 4 ? "#eda8dc" : "#fff"}"/>
    <text x="${x(p)}" y="${y + 28 + (narrow && i % 2 ? 20 : 0)}" text-anchor="middle" fill="${i === 4 ? "#eda8dc" : "#fff"}">${i === 7 ? "Sa′" : NOTES[i]?.short}</text>`,
      )
      .join("")}`;
    })
    .join("");
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} 315" role="img" aria-labelledby="ruler-title ruler-desc"><title id="ruler-title">Your tuning and the saved witness at the same Sa</title><desc id="ruler-desc">Two logarithmic pitch rulers, initial and second row. Solid circles: your tuning. Dashed ticks: saved witness. Pa is the only note allowed to move; a failed candidate can leave it unchanged or raise it. An octave spans 1200 cents.</desc>
  ${[0, 200, 400, 600, 800, 1000, 1200].map((c) => `<path d="M${x(c)} 46V268" stroke="#345360"/><text x="${x(c)}" y="291" text-anchor="middle" fill="#c3d8dd">${c}</text>`).join("")}
  ${lanes}<text x="${width / 2}" y="312" text-anchor="middle" fill="#c3d8dd">CENTS ABOVE Sa</text></svg>`;
}
export function familyTable(state: FamilyState): string {
  const ref0 = positions(state.reference, "sadja"),
    ref1 = positions(state.reference, "madhyama");
  const now0 = positions(state.current, "sadja"),
    now1 = positions(state.current, "madhyama");
  const hz = (c: number | undefined) => (state.base * 2 ** ((c ?? 0) / 1200)).toFixed(3);
  return `<table><caption>Both witnesses, same Sa = ${state.base} Hz. Initial → second-row frequency. Six notes keep their frequencies within each witness; the witnesses can differ from each other.</caption><thead><tr><th scope="col">Note</th><th scope="col">Saved witness / Hz</th><th scope="col">Your tuning / Hz</th><th scope="col">Your initial / cents</th></tr></thead><tbody>${now0.map((pitch, i) => `<tr${i === 4 ? ' class="pa"' : ""}><th scope="row">${i === 7 ? "Sa′" : NOTES[i]?.short}</th><td>${hz(ref0[i])} → ${hz(ref1[i])}</td><td>${hz(pitch)} → ${hz(now1[i])}</td><td>${pitch.toFixed(3)}</td></tr>`).join("")}</tbody></table>`;
}
export function gapDescription(gaps: Gaps): string {
  const change = assessment(gaps).lowering;
  const operation =
    Math.abs(change) < 1e-8
      ? "Pa stays unchanged"
      : `Pa ${change > 0 ? "lowers" : "rises"} by ${Math.abs(change).toFixed(6)} cents`;
  return `four = ${gaps.four.toFixed(6)}, three = ${three(gaps).toFixed(6)}, two = ${gaps.two.toFixed(6)} cents; ${operation}`;
}
