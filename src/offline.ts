import { keepSaveAlive } from "./save-liveness";

/** Readiness belongs to this page's edition, not merely to any active worker. */
interface EditionReply {
  type: "GRAMA_EDITION";
  edition: string;
  complete: boolean;
  error?: string;
}

function inspectWorker(
  worker: ServiceWorker,
  repair = false,
  progress?: (text: string) => void,
): Promise<EditionReply | null> {
  return new Promise((resolve) => {
    const channel = new MessageChannel();
    const stopAcknowledging = repair ? keepSaveAlive(worker) : () => {};
    let settled = false;
    const finish = (reply: EditionReply | null) => {
      if (settled) return;
      settled = true;
      stopAcknowledging();
      clearTimeout(timeout);
      channel.port1.close();
      resolve(reply);
    };
    // Older published workers do not implement this message. Their silence is
    // not evidence that the newly loaded course has been cached.
    let timeout = setTimeout(() => finish(null), repair ? 20000 : 10000);
    channel.port1.onmessage = (event: MessageEvent<unknown>) => {
      const data = event.data;
      if (
        repair &&
        data &&
        typeof data === "object" &&
        "type" in data &&
        data.type === "GRAMA_PROGRESS" &&
        "edition" in data &&
        data.edition === __GRAMA_EDITION__ &&
        "checked" in data &&
        typeof data.checked === "number" &&
        "total" in data &&
        typeof data.total === "number" &&
        "received" in data &&
        typeof data.received === "number" &&
        "expected" in data &&
        typeof data.expected === "number" &&
        data.total > 0 &&
        data.checked >= 0 &&
        data.checked <= data.total &&
        data.received >= 0 &&
        data.received <= data.expected
      ) {
        clearTimeout(timeout);
        timeout = setTimeout(() => finish(null), 20000);
        progress?.(
          `Repairing saved edition · ${data.checked}/${data.total} files checked · ${Math.round(data.received / 1024)}/${Math.round(data.expected / 1024)} KiB of this file. Your experiment stays in this tab.`,
        );
        return;
      }
      if (
        data &&
        typeof data === "object" &&
        "type" in data &&
        data.type === "GRAMA_EDITION" &&
        "edition" in data &&
        typeof data.edition === "string" &&
        "complete" in data &&
        typeof data.complete === "boolean"
      )
        finish(data as EditionReply);
      else finish(null);
    };
    try {
      worker.postMessage(
        { type: repair ? "GRAMA_REPAIR" : "GRAMA_INSPECT", edition: __GRAMA_EDITION__ },
        [channel.port2],
      );
    } catch {
      finish(null);
    }
  });
}

export async function offline(status: HTMLElement): Promise<void> {
  const reload = document.createElement("button");
  reload.type = "button";
  reload.textContent = "Reload saved edition";
  reload.hidden = true;
  status.after(reload);
  if (import.meta.env.DEV) {
    status.textContent =
      "Development preview · offline saving is available in the production build.";
    reload.hidden = true;
    return;
  }
  if (!("serviceWorker" in navigator)) {
    status.textContent =
      "Offline saving is unavailable in this browser. You can save an illustrated reading.";
    reload.hidden = true;
    return;
  }
  const check = document.createElement("button"),
    repair = document.createElement("button");
  check.type = repair.type = "button";
  check.textContent = "Check saved edition";
  repair.textContent = "Repair saved edition";
  check.id = "check-offline";
  repair.id = "repair-offline";
  repair.hidden = true;
  status.after(check, repair);
  const container = navigator.serviceWorker;
  let registration: ServiceWorkerRegistration | undefined;
  let revision = 0;
  let installFailed = false;
  let repairing = false;
  const observedWorkers = new WeakSet<ServiceWorker>();
  const pending = () => {
    reload.hidden = true;
    repair.hidden = !installFailed && !!(registration?.installing || registration?.waiting);
    repair.textContent = "Retry offline save";
    status.textContent = installFailed
      ? "This edition could not be saved offline. Keep this tab open to continue reading."
      : !registration || registration.installing || registration.waiting
        ? "Saving this edition for offline reading…"
        : "This edition is not saved offline. Keep this tab open to continue reading.";
  };
  const refresh = async () => {
    if (repairing) return;
    const currentRevision = ++revision;
    if (registration?.installing || registration?.waiting) {
      pending();
      return;
    }
    const worker = container.controller;
    if (!worker) {
      pending();
      // A navigation can start during installation and finish after the
      // activation claim has already enumerated its clients. That tab then
      // has an activated registration but no controller or later statechange.
      // Ask the matching edition to claim again now that this document exists.
      if (registration?.active?.state === "activated")
        registration.active.postMessage({
          type: "GRAMA_CLAIM",
          edition: __GRAMA_EDITION__,
        });
      return;
    }
    status.textContent = "Checking the saved edition’s files and source identities…";
    const reply = await inspectWorker(worker);
    // Activation can replace the controller while the older worker is replying.
    if (currentRevision !== revision || worker !== container.controller) return;
    if (reply?.edition === __GRAMA_EDITION__ && reply.complete) {
      status.textContent = "Ready offline · the bench, reading, fonts & all source scans saved.";
      reload.hidden = true;
      repair.hidden = true;
    } else if (reply?.edition === __GRAMA_EDITION__ && !reply.complete) {
      status.textContent =
        "Offline copy is incomplete or damaged. Reconnect and repair the saved edition.";
      reload.hidden = true;
      repair.hidden = false;
      repair.textContent = "Repair saved edition";
    } else if (reply?.complete && reply.edition !== __GRAMA_EDITION__) {
      status.textContent = "A different edition is now saved offline. Reload to read that edition.";
      reload.hidden = false;
    } else {
      pending();
    }
  };
  check.addEventListener("click", () => {
    void refresh();
  });
  repair.addEventListener("click", async () => {
    const worker = container.controller;
    if (repairing) return;
    if (!worker) {
      installFailed = false;
      await register();
      return;
    }
    repairing = true;
    revision++;
    repair.disabled = true;
    check.disabled = true;
    status.textContent = "Repairing the saved edition. Your current experiment stays in this tab…";
    let failure: string | undefined;
    try {
      const reply = await inspectWorker(worker, true, (text) => {
        if (worker === container.controller) status.textContent = text;
      });
      if (!reply?.complete)
        failure =
          typeof reply?.error === "string"
            ? reply.error
            : "The connection stopped responding. Retry the offline save.";
    } finally {
      repairing = false;
      repair.disabled = false;
      check.disabled = false;
    }
    await refresh();
    if (failure && worker === container.controller)
      status.textContent += ` ${failure} Your experiment was kept.`;
  });
  window.addEventListener("focus", () => {
    void refresh();
  });
  window.addEventListener("offline", () => {
    void refresh();
  });
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) void refresh();
  });
  container.addEventListener("message", (event) => {
    if (event.data?.type === "GRAMA_CACHE_CHANGED") void refresh();
  });
  const observe = (worker: ServiceWorker | null) => {
    if (!worker || observedWorkers.has(worker)) return;
    observedWorkers.add(worker);
    let activated = worker.state === "activated";
    const stopAcknowledging = worker.state === "installing" ? keepSaveAlive(worker) : () => {};
    const changed = () => {
      if (worker.state !== "installing") stopAcknowledging();
      if (worker.state === "activated") activated = true;
      if (worker.state === "redundant" && !activated) installFailed = true;
      void refresh();
    };
    worker.addEventListener("statechange", changed);
    changed();
  };
  reload.addEventListener("click", () => location.reload());
  container.addEventListener("controllerchange", () => {
    void refresh();
  });
  const register = () =>
    container
      .register(`${import.meta.env.BASE_URL}sw.js`, {
        scope: import.meta.env.BASE_URL,
        updateViaCache: "none",
      })
      .then((result) => {
        if (registration !== result)
          result.addEventListener("updatefound", () => {
            installFailed = false;
            observe(result.installing);
          });
        registration = result;
        observe(result.installing);
        observe(result.waiting);
        // During a navigation the worker may already be activating, with no
        // installing worker left to observe and no controller assigned yet.
        observe(result.active);
        void refresh();
      })
      .catch(() => {
        installFailed = true;
        void refresh();
      });
  window.addEventListener("online", () => {
    installFailed = false;
    // A failed first installation has no active worker and can discard its
    // registration. update() on that old object cannot start a fresh install.
    if (registration?.active)
      registration.update().catch(() => {
        installFailed = true;
        void refresh();
      });
    else void register();
    void refresh();
  });
  void register();
}
