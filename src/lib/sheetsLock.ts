// Guards long-running Sheets/Drive operations (sync, reset, rebuild).
//
// - Web Locks keeps a second browser tab of the same app from starting an overlapping
//   operation (each tab has its own React state, so the in-app "isExporting" flag can't).
// - `isBusy()` lets the PWA updater skip its automatic reload while one is in flight.

let activeCount = 0;

export function isBusy(): boolean {
  return activeCount > 0;
}

// Runs `fn` while holding the lock. Resolves false (without running `fn`) when another
// tab already holds it.
export async function runExclusive(fn: () => Promise<void>): Promise<boolean> {
  activeCount++;
  try {
    if (!("locks" in navigator)) {
      await fn();
      return true;
    }
    return await navigator.locks.request("qicau-sheets", { ifAvailable: true }, async (lock) => {
      if (!lock) return false;
      await fn();
      return true;
    });
  } finally {
    activeCount--;
  }
}
