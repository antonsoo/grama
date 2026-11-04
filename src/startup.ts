/** Static controls cannot accept edits or lose clicks before their handlers exist.
 * Release them at the end of the synchronous entry module, then render applies
 * the experiment's own disabled states (locked gaps, unavailable answers, etc.). */
export function activateControls(): void {
  for (const node of document.querySelectorAll<
    HTMLButtonElement | HTMLInputElement | HTMLSelectElement
  >("[data-startup-control]")) {
    node.disabled = false;
    node.removeAttribute("data-startup-control");
  }
}
