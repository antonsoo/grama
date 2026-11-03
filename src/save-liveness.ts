const active = new WeakMap<
  ServiceWorker,
  { users: number; interval: ReturnType<typeof setInterval> }
>();

/** A live document acknowledges work it is awaiting; never schedules background work. */
export function keepSaveAlive(worker: ServiceWorker): () => void {
  let lease = active.get(worker);
  if (!lease) {
    lease = {
      users: 0,
      interval: setInterval(() => {
        try {
          worker.postMessage({ type: "GRAMA_SAVE_ACK", edition: __GRAMA_EDITION__ });
        } catch {
          /* Activation may have replaced the worker. */
        }
      }, 5000),
    };
    active.set(worker, lease);
  }
  lease.users++;
  let released = false;
  return () => {
    if (released) return;
    released = true;
    if (--lease.users === 0) {
      clearInterval(lease.interval);
      active.delete(worker);
    }
  };
}
