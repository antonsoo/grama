/** Readiness belongs to this page's edition, not merely to any active worker. */
interface EditionReply {
  type: "GRAMA_EDITION";
  edition: string;
  complete: boolean;
}

function inspectWorker(worker: ServiceWorker): Promise<EditionReply | null> {
  return new Promise((resolve) => {
    const channel = new MessageChannel();
    const finish = (reply: EditionReply | null) => {
      clearTimeout(timeout);
      channel.port1.close();
      resolve(reply);
    };
    // Older published workers do not implement this message. Their silence is
    // not evidence that the newly loaded course has been cached.
    const timeout = setTimeout(() => finish(null), 2000);
    channel.port1.onmessage = (event: MessageEvent<unknown>) => {
      const data = event.data;
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
      worker.postMessage({ type: "GRAMA_INSPECT" }, [channel.port2]);
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
  const container = navigator.serviceWorker;
  let registration: ServiceWorkerRegistration | undefined;
  let revision = 0;
  let verifiedCurrent = false;
  let installFailed = false;
  const observedWorkers = new WeakSet<ServiceWorker>();
  const pending = () => {
    reload.hidden = true;
    status.textContent = installFailed
      ? "This edition could not be saved offline. Keep this tab open to continue reading."
      : !registration || registration.installing || registration.waiting
        ? "Saving this edition for offline reading…"
        : "This edition is not saved offline. Keep this tab open to continue reading.";
  };
  const refresh = async () => {
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
    const reply = await inspectWorker(worker);
    // Activation can replace the controller while the older worker is replying.
    if (currentRevision !== revision || worker !== container.controller) return;
    if (reply?.edition === __GRAMA_EDITION__ && reply.complete) {
      verifiedCurrent = true;
      status.textContent = "Ready offline · the bench, reading, fonts & all source scans saved.";
      reload.hidden = true;
    } else if (reply?.edition === __GRAMA_EDITION__ && !reply.complete) {
      status.textContent = "Offline copy is incomplete. Keep this tab open to continue reading.";
      reload.hidden = true;
    } else if (verifiedCurrent && reply?.complete && reply.edition !== __GRAMA_EDITION__) {
      status.textContent = "A different edition is now saved offline. Reload to read that edition.";
      reload.hidden = false;
    } else {
      pending();
    }
  };
  const observe = (worker: ServiceWorker | null) => {
    if (!worker || observedWorkers.has(worker)) return;
    observedWorkers.add(worker);
    let activated = worker.state === "activated";
    const changed = () => {
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
