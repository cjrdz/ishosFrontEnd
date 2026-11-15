import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createInactivityTracking } from "./inactivity-tracking";

describe("createInactivityTracking", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("logs out after the timeout without activity", () => {
    const onTimeout = vi.fn();
    const tracking = createInactivityTracking({
      getTimeoutSeconds: () => 60,
      onTimeout,
    });
    tracking.start();
    vi.advanceTimersByTime(61_000);
    expect(onTimeout).toHaveBeenCalledOnce();
    tracking.stop();
  });

  it("cancels a pending logout when tracking becomes idle (counter mode)", () => {
    let timeout: number | null = 60;
    const onTimeout = vi.fn();
    const onWarningChange = vi.fn();
    const tracking = createInactivityTracking({
      getTimeoutSeconds: () => timeout,
      onTimeout,
      onWarningChange,
    });
    tracking.start();
    vi.advanceTimersByTime(45_000); // inside the 30s warning window

    timeout = null;
    tracking.schedule();
    vi.advanceTimersByTime(10 * 60_000);

    expect(onTimeout).not.toHaveBeenCalled();
    expect(onWarningChange).toHaveBeenLastCalledWith(null);
    tracking.stop();
  });

  it("logs out on return when the device slept past the timeout", () => {
    const onTimeout = vi.fn();
    const tracking = createInactivityTracking({
      getTimeoutSeconds: () => 60,
      onTimeout,
    });
    tracking.start();
    // Timers do not run while asleep, but the clock moves on.
    vi.setSystemTime(Date.now() + 5 * 60_000);
    expect(onTimeout).not.toHaveBeenCalled();
    window.dispatchEvent(new Event("focus"));
    expect(onTimeout).toHaveBeenCalledOnce();
    tracking.stop();
  });

  it("activity restarts the countdown", () => {
    const onTimeout = vi.fn();
    const tracking = createInactivityTracking({
      getTimeoutSeconds: () => 60,
      onTimeout,
    });
    tracking.start();
    vi.advanceTimersByTime(50_000);
    window.dispatchEvent(new Event("keydown"));
    vi.advanceTimersByTime(50_000);
    expect(onTimeout).not.toHaveBeenCalled();
    vi.advanceTimersByTime(11_000);
    expect(onTimeout).toHaveBeenCalledOnce();
    tracking.stop();
  });
});
