export type Poller = {
  stop: () => Promise<void>;
};

// Runs `task` now and then again `intervalMs` after each run ends, so runs never overlap.
// A failed run is logged and the next one tries again.
export function startPolling(name: string, task: () => Promise<unknown>, intervalMs: number): Poller {
  let stopped = false;
  let timer: NodeJS.Timeout | undefined;
  let running: Promise<unknown> = Promise.resolve();

  const tick = () => {
    running = task()
      .catch((error) => console.error(`${name} failed, retrying in ${intervalMs} ms`, error))
      .finally(() => {
        if (!stopped) timer = setTimeout(tick, intervalMs);
      });
  };
  tick();

  return {
    stop: async () => {
      stopped = true;
      clearTimeout(timer);
      await running;
    },
  };
}
