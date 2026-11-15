/**
 * "Modo mostrador" (counter mode): a per-device switch for the tablet at the
 * counter that only watches incoming orders. It disables the client-side
 * inactivity logout on that device, so a screen nobody touches keeps polling
 * orders. The backend session still expires with the auth cookie, and other
 * devices keep the configured inactivity timeout.
 */

const COUNTER_MODE_KEY = "ishos_admin_counter_mode";

export function isCounterModeEnabled(): boolean {
  try {
    return window.localStorage.getItem(COUNTER_MODE_KEY) === "on";
  } catch {
    return false;
  }
}

export function setCounterModeEnabled(enabled: boolean): void {
  try {
    if (enabled) {
      window.localStorage.setItem(COUNTER_MODE_KEY, "on");
    } else {
      window.localStorage.removeItem(COUNTER_MODE_KEY);
    }
  } catch {
    // Storage unavailable: the mode just won't persist across reloads.
  }
}
