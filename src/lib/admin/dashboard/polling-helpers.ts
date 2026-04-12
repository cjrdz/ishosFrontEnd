export interface PollingController {
  cleanup: () => void;
}

export interface SessionRefreshController {
  cleanup: () => void;
  refresh: () => Promise<void>;
}

export function createPollingInterval(
  callback: () => void | Promise<void>,
  intervalMs: number,
): PollingController {
  const id = setInterval(() => {
    void Promise.resolve(callback()).catch((error: unknown) => {
      console.error("Polling callback error:", error);
    });
  }, intervalMs);

  return {
    cleanup: () => clearInterval(id),
  };
}

export function createSessionRefresh(
  refreshFn: () => void | Promise<void>,
  intervalMs: number,
): SessionRefreshController {
  let refreshTimer: ReturnType<typeof setTimeout> | null = null;

  async function refresh() {
    try {
      await Promise.resolve(refreshFn());
      scheduleNext();
    } catch (error: unknown) {
      console.error("Session refresh error:", error);
      scheduleNext();
    }
  }

  function scheduleNext() {
    if (refreshTimer) clearTimeout(refreshTimer);
    refreshTimer = setTimeout(() => {
      void refresh();
    }, intervalMs);
  }

  scheduleNext();

  return {
    cleanup: () => {
      if (refreshTimer) {
        clearTimeout(refreshTimer);
        refreshTimer = null;
      }
    },
    refresh,
  };
}
