/**
 * App-wide toasts, including "undoable" actions with a delayed commit:
 * the UI change happens immediately, the server call only runs when the undo
 * window closes. Tapping "Deshacer" cancels it, so nothing is ever sent.
 * Toasts live in a module-level store, shared by every island on the page.
 */
import { writable } from "svelte/store";

export type ToastTone = "info" | "success" | "error";

export interface Toast {
  id: number;
  message: string;
  tone: ToastTone;
  actionLabel?: string;
  onAction?: () => void;
}

export const toasts = writable<Toast[]>([]);

let nextId = 1;
const timers = new Map<number, ReturnType<typeof setTimeout>>();

export function dismissToast(id: number): void {
  const timer = timers.get(id);
  if (timer) clearTimeout(timer);
  timers.delete(id);
  toasts.update((list) => list.filter((t) => t.id !== id));
}

export function showToast(
  message: string,
  options: {
    tone?: ToastTone;
    durationMs?: number;
    actionLabel?: string;
    onAction?: () => void;
  } = {},
): number {
  const id = nextId++;
  toasts.update((list) => [
    ...list.slice(-2), // keep at most three on screen
    {
      id,
      message,
      tone: options.tone ?? "info",
      actionLabel: options.actionLabel,
      onAction: options.onAction,
    },
  ]);
  timers.set(
    id,
    setTimeout(() => dismissToast(id), options.durationMs ?? 4000),
  );
  return id;
}

interface PendingAction {
  commit: () => Promise<void>;
  undo: () => void;
  failureMessage: string;
}

const pending = new Map<number, PendingAction>();

async function runCommit(id: number): Promise<void> {
  const action = pending.get(id);
  if (!action) return;
  pending.delete(id);
  dismissToast(id);
  try {
    await action.commit();
  } catch {
    action.undo();
    showToast(action.failureMessage, { tone: "error", durationMs: 6000 });
  }
}

/**
 * Shows `message` with a "Deshacer" button for `delayMs`, then calls
 * `commit`. Undo calls `undo` and nothing is sent. If `commit` fails, `undo`
 * restores the UI and an error toast explains it.
 */
export function undoableAction(options: {
  message: string;
  commit: () => Promise<void>;
  undo: () => void;
  delayMs?: number;
  failureMessage?: string;
}): number {
  const delayMs = options.delayMs ?? 5000;
  const id = nextId++;
  pending.set(id, {
    commit: options.commit,
    undo: options.undo,
    failureMessage:
      options.failureMessage ?? "No se pudo guardar el cambio. Se revirtió.",
  });
  toasts.update((list) => [
    ...list.slice(-2),
    {
      id,
      message: options.message,
      tone: "info",
      actionLabel: "Deshacer",
      onAction: () => {
        const action = pending.get(id);
        pending.delete(id);
        dismissToast(id);
        action?.undo();
      },
    },
  ]);
  timers.set(
    id,
    setTimeout(() => void runCommit(id), delayMs),
  );
  return id;
}

/** Commits every pending action now (e.g. the tab is being hidden or closed). */
export function flushPendingActions(): Promise<void[]> {
  return Promise.all([...pending.keys()].map((id) => runCommit(id)));
}

if (typeof document !== "undefined") {
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") void flushPendingActions();
  });
}
