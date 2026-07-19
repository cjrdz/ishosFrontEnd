/**
 * Client-side inactivity tracking for admin pages.
 *
 * Mirrors the backend InactivityMiddleware semantics: after
 * `getTimeoutSeconds()` seconds without user activity, `onTimeout` fires.
 * A warning countdown is emitted `warningSeconds` before the timeout, and an
 * optional throttled `onActivity` hook lets pages keep the backend session
 * alive while the user is actively working.
 */

interface InactivityTrackingOptions {
  /**
   * Return the inactivity timeout in seconds, or null when tracking should
   * stay idle (e.g. there is no authenticated session yet).
   */
  getTimeoutSeconds: () => number | null;
  /** Seconds before logout when the warning countdown starts. Defaults to 30. */
  warningSeconds?: number;
  /** Called whenever the warning countdown changes; null hides the warning. */
  onWarningChange?: (secondsRemaining: number | null) => void;
  /** Called when the inactivity timeout elapses. */
  onTimeout: () => void;
  /**
   * Optional hook called on user activity, throttled to at most once per
   * `activityThrottleMs`. Useful to ping a protected endpoint so the backend
   * inactivity tracker stays fresh while the user is active.
   */
  onActivity?: () => void;
  /** Minimum milliseconds between `onActivity` calls. Defaults to 60_000. */
  activityThrottleMs?: number;
}

interface InactivityTrackingController {
  /** Attach activity listeners (once) and (re)schedule the timers. */
  start: () => void;
  /** (Re)schedule the timers, e.g. after the timeout config changes. */
  schedule: () => void;
  /** Clear timers, hide the warning, and detach listeners. */
  stop: () => void;
}

const ACTIVITY_EVENTS = [
  "mousemove",
  "mousedown",
  "keydown",
  "scroll",
  "touchstart",
] as const;

const DEFAULT_WARNING_SECONDS = 30;
const DEFAULT_ACTIVITY_THROTTLE_MS = 60_000;

export function createInactivityTracking(
  options: InactivityTrackingOptions,
): InactivityTrackingController {
  const warningSeconds = options.warningSeconds ?? DEFAULT_WARNING_SECONDS;
  const activityThrottleMs =
    options.activityThrottleMs ?? DEFAULT_ACTIVITY_THROTTLE_MS;

  let logoutTimer: ReturnType<typeof setTimeout> | null = null;
  let warningTimer: ReturnType<typeof setTimeout> | null = null;
  let countdownTimer: ReturnType<typeof setInterval> | null = null;
  let listenersAttached = false;
  let lastActivityAt = 0;

  function clearTimers() {
    if (logoutTimer) {
      clearTimeout(logoutTimer);
      logoutTimer = null;
    }
    if (warningTimer) {
      clearTimeout(warningTimer);
      warningTimer = null;
    }
    if (countdownTimer) {
      clearInterval(countdownTimer);
      countdownTimer = null;
    }
  }

  function notifyWarning(secondsRemaining: number | null) {
    options.onWarningChange?.(secondsRemaining);
  }

  function schedule() {
    if (typeof window === "undefined") return;
    const timeoutValue = options.getTimeoutSeconds();
    if (timeoutValue === null) return;

    const timeoutSeconds = Math.max(1, timeoutValue);
    const timeoutMs = timeoutSeconds * 1000;

    clearTimers();
    notifyWarning(null);

    if (timeoutSeconds > warningSeconds) {
      warningTimer = setTimeout(
        () => {
          warningTimer = null;
          let remaining = warningSeconds;
          notifyWarning(remaining);
          countdownTimer = setInterval(() => {
            if (remaining <= 1) {
              if (countdownTimer) {
                clearInterval(countdownTimer);
                countdownTimer = null;
              }
              return;
            }
            remaining -= 1;
            notifyWarning(remaining);
          }, 1000);
        },
        timeoutMs - warningSeconds * 1000,
      );
    }

    logoutTimer = setTimeout(() => {
      clearTimers();
      notifyWarning(null);
      options.onTimeout();
    }, timeoutMs);
  }

  function handleActivity() {
    schedule();
    if (!options.onActivity) return;
    const timeoutValue = options.getTimeoutSeconds();
    if (timeoutValue === null) return;
    // Ping often enough to keep the backend inactivity tracker alive: never
    // exceed half the configured timeout so at least one ping lands per window.
    const effectiveThrottle = Math.min(
      activityThrottleMs,
      (Math.max(1, timeoutValue) * 1000) / 2,
    );
    const now = Date.now();
    if (now - lastActivityAt < effectiveThrottle) return;
    lastActivityAt = now;
    options.onActivity();
  }

  function start() {
    if (typeof window === "undefined") return;
    if (!listenersAttached) {
      for (const eventName of ACTIVITY_EVENTS) {
        window.addEventListener(eventName, handleActivity, true);
      }
      listenersAttached = true;
    }
    schedule();
  }

  function stop() {
    clearTimers();
    notifyWarning(null);
    if (typeof window !== "undefined" && listenersAttached) {
      for (const eventName of ACTIVITY_EVENTS) {
        window.removeEventListener(eventName, handleActivity, true);
      }
      listenersAttached = false;
    }
  }

  return { start, schedule, stop };
}
