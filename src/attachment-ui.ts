import { attachmentChecks, attachmentFinding, attachmentTable } from "./attachment-view";
import {
  type Attachment,
  attachmentCSV,
  attachmentFromSearch,
  attachmentScore,
} from "./core/attachment";
import { wav } from "./core/audio";
import type { Pose } from "./core/tuning";
import { countFigure } from "./figures";
import { download } from "./files";
import type { ListeningPlayer } from "./player";

export function attachmentDiagnostic(
  player: ListeningPlayer,
  getPose: () => Pose,
  openPassage: (id: string) => void,
  changed: () => void,
): { refresh: () => void; selected: () => Attachment; select: (value: Attachment) => void } {
  const el = <T extends HTMLElement = HTMLElement>(id: string) => {
    const node = document.getElementById(`attachment-${id}`);
    if (!node) throw new Error(`Missing attachment-${id}`);
    return node as T;
  };
  let selected: Attachment = "leaving";
  try {
    selected = attachmentFromSearch(location.search);
  } catch {
    el("status").textContent =
      "This link's count placement is invalid. The deliberate misreading is shown.";
  }
  const select = el<HTMLSelectElement>("select");
  function refresh() {
    select.value = selected;
    el("finding").textContent = attachmentFinding(getPose(), selected);
    el("checks").textContent = attachmentChecks(getPose(), selected);
    el("figure").innerHTML = countFigure(
      getPose(),
      Math.max(320, el("figure").clientWidth),
      selected,
    );
    el("table").innerHTML = attachmentTable(getPose(), selected);
  }
  function set(value: Attachment) {
    player.stop();
    selected = value;
    changed();
    const url = new URL(location.href);
    url.searchParams.set("attachment", selected);
    history.replaceState(null, "", url);
    refresh();
  }
  select.addEventListener("change", () => set(select.value as Attachment));
  el("hear").addEventListener("click", () => {
    const pose = { ...getPose() },
      attachment = selected;
    void player.play(
      attachmentScore(pose, attachment),
      "Playing Ma–Pa–Dha, then the same names in the second count row.",
      attachmentFinding(pose, attachment),
      undefined,
      el("sound"),
    );
  });
  el("stop").addEventListener("click", () => player.stop());
  el("csv").addEventListener("click", () =>
    download(
      "grama-count-placement.csv",
      attachmentCSV(getPose(), selected),
      "text/csv;charset=utf-8",
    ),
  );
  el("svg").addEventListener("click", () =>
    download("grama-count-placement.svg", countFigure(getPose(), 920, selected), "image/svg+xml"),
  );
  el("wav").addEventListener("click", () =>
    download("grama-count-placement.wav", wav(attachmentScore(getPose(), selected)), "audio/wav"),
  );
  el("instruction").addEventListener("click", () => {
    player.stop();
    openPassage("lower");
  });
  el("source").addEventListener("click", () => {
    player.stop();
    openPassage("madhyama1");
  });
  new ResizeObserver(refresh).observe(el("figure"));
  return { refresh, selected: () => selected, select: set };
}
