import { download, type ReadOptions } from "./files";

/** One captured experiment per save, with an explicit way to stop a slow read. */
export function readingSave(
  button: HTMLButtonElement,
  status: HTMLElement,
  prepare: (options: ReadOptions) => Promise<string>,
  name: string,
  success: string,
): void {
  const cancel = document.createElement("button");
  cancel.type = "button";
  cancel.textContent = "Cancel reading save";
  cancel.hidden = true;
  button.after(cancel);
  let active: AbortController | undefined;
  cancel.addEventListener("click", () => active?.abort());
  window.addEventListener("pagehide", () => active?.abort());
  button.addEventListener("click", async () => {
    if (active) return;
    const controller = new AbortController();
    active = controller;
    button.disabled = true;
    cancel.hidden = false;
    status.textContent = "Preparing the complete reading and verifying its source pages and fonts…";
    try {
      const html = await prepare({
        signal: controller.signal,
        onProgress(received, total) {
          status.textContent = `Preparing the reading · ${Math.round(received / 1024)}/${Math.round(total / 1024)} KiB received. Source identities are checked before saving.`;
        },
      });
      controller.signal.throwIfAborted();
      download(name, html, "text/html;charset=utf-8");
      status.textContent = success;
    } catch (error) {
      status.textContent = controller.signal.aborted
        ? "Reading save cancelled. Your current experiment was kept."
        : error instanceof Error
          ? error.message
          : "The reading could not be saved. Try again.";
    } finally {
      active = undefined;
      button.disabled = false;
      cancel.hidden = true;
    }
  });
}
