import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { get } from "svelte/store";
import { flushPendingActions, toasts, undoableAction } from "./toast";

beforeEach(() => vi.useFakeTimers());
afterEach(() => {
  vi.useRealTimers();
  toasts.set([]);
});

describe("undoableAction", () => {
  it("commits after the undo window", async () => {
    const commit = vi.fn().mockResolvedValue(undefined);
    const undo = vi.fn();
    undoableAction({ message: "Orden rechazada", commit, undo, delayMs: 5000 });
    expect(commit).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(5000);
    expect(commit).toHaveBeenCalledOnce();
    expect(undo).not.toHaveBeenCalled();
    expect(get(toasts)).toHaveLength(0);
  });

  it("never sends anything when undone", async () => {
    const commit = vi.fn().mockResolvedValue(undefined);
    const undo = vi.fn();
    undoableAction({ message: "Orden rechazada", commit, undo });
    get(toasts)[0].onAction?.();
    await vi.advanceTimersByTimeAsync(10_000);
    expect(undo).toHaveBeenCalledOnce();
    expect(commit).not.toHaveBeenCalled();
  });

  it("reverts and reports when the commit fails", async () => {
    const undo = vi.fn();
    undoableAction({
      message: "x",
      commit: () => Promise.reject(new Error("409")),
      undo,
      failureMessage: "No se pudo",
    });
    await vi.advanceTimersByTimeAsync(5000);
    expect(undo).toHaveBeenCalledOnce();
    expect(get(toasts).map((t) => t.message)).toContain("No se pudo");
  });

  it("flushes pending actions immediately (tab hidden)", async () => {
    const commit = vi.fn().mockResolvedValue(undefined);
    undoableAction({ message: "x", commit, undo: vi.fn() });
    await flushPendingActions();
    expect(commit).toHaveBeenCalledOnce();
    await vi.advanceTimersByTimeAsync(10_000);
    expect(commit).toHaveBeenCalledOnce();
  });
});
