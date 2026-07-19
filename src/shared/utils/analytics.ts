export function trackAction(
  action: string,
  metadata?: Record<string, unknown>,
) {
  if (!import.meta.env.DEV) return;
  console.debug("[analytics]", action, metadata ?? {});
}

export function trackError(
  error: unknown,
  context: string,
  metadata?: Record<string, unknown>,
) {
  if (!import.meta.env.DEV) return;
  const normalized =
    error instanceof Error
      ? { message: error.message }
      : { message: String(error) };
  console.error("[analytics]", context, {
    ...normalized,
    ...(metadata ?? {}),
  });
}

export type TrackActionFn = typeof trackAction;
export type TrackErrorFn = typeof trackError;
