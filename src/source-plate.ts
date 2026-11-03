import { asset } from "./files";

/** Never label a previously displayed or unverified image as the selected page. */
export class SourcePlate {
  private active: AbortController | undefined;
  private url: string | undefined;
  private selected: { file: string; description: string; caption: string } | undefined;
  private retry = document.createElement("button");

  constructor(
    private image: HTMLImageElement,
    private link: HTMLAnchorElement,
    private caption: HTMLElement,
  ) {
    this.retry.type = "button";
    this.retry.textContent = "Retry source page";
    this.retry.hidden = true;
    caption.after(this.retry);
    this.retry.addEventListener("click", () => {
      if (this.selected)
        void this.show(this.selected.file, this.selected.description, this.selected.caption);
    });
    window.addEventListener("pagehide", () => {
      this.active?.abort();
      if (this.url) URL.revokeObjectURL(this.url);
    });
    window.addEventListener("pageshow", (event) => {
      if (event.persisted && this.selected)
        void this.show(this.selected.file, this.selected.description, this.selected.caption);
    });
  }

  async show(file: string, description: string, caption: string): Promise<void> {
    this.selected = { file, description, caption };
    this.active?.abort();
    const controller = new AbortController();
    this.active = controller;
    this.image.hidden = this.link.hidden = true;
    this.image.removeAttribute("src");
    this.link.removeAttribute("href");
    if (this.url) URL.revokeObjectURL(this.url);
    this.url = undefined;
    this.retry.hidden = true;
    this.caption.textContent = "Loading and verifying the selected printed page…";
    try {
      const bytes = await asset(file, { signal: controller.signal });
      controller.signal.throwIfAborted();
      const url = URL.createObjectURL(new Blob([bytes], { type: "image/jpeg" }));
      this.url = url;
      this.image.src = this.link.href = url;
      this.image.alt = description;
      await this.image.decode();
      controller.signal.throwIfAborted();
      this.image.hidden = this.link.hidden = false;
      this.caption.textContent = caption;
    } catch (error) {
      if (controller.signal.aborted) return;
      this.caption.textContent = `Source page unavailable. ${error instanceof Error ? error.message : "Retry when connected."}`;
      this.retry.hidden = false;
    }
  }
}
