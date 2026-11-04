/** A file read may finish after another file, a control edit or navigation.
 * Validate and commit only against the exact experiment the user selected. */
export function recordOpen<T>(
  input: HTMLInputElement,
  status: HTMLElement,
  options: {
    fingerprint: () => string;
    parse: (raw: string) => T;
    apply: (record: T) => void;
    success: string;
    kept: string;
  },
): void {
  let request = 0;
  window.addEventListener("pagehide", () => {
    request++;
    if (input.value)
      status.textContent = `File opening was interrupted by navigation. ${options.kept}`;
    input.value = "";
  });
  input.addEventListener("change", async () => {
    const file = input.files?.[0];
    if (!file) return;
    const selected = ++request,
      before = options.fingerprint();
    status.textContent = "Opening the saved comparison…";
    try {
      if (file.size > 65536) throw new Error("Comparison JSON must be under 64 KB.");
      const raw = await file.text();
      if (selected !== request) return;
      if (before !== options.fingerprint())
        throw new Error(
          "The comparison changed while the file was opening. Select the file again to replace the current settings.",
        );
      const record = options.parse(raw);
      options.apply(record);
      status.textContent = options.success;
    } catch (error) {
      if (selected === request)
        status.textContent = `${error instanceof Error ? error.message : "Could not open that file."} ${options.kept}`;
    } finally {
      if (selected === request) input.value = "";
    }
  });
}
