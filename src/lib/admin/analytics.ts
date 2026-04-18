export function trackAction(
  action: string,
  metadata?: Record<string, unknown>,
) {
  const event = {
    timestamp: new Date().toISOString(),
    action,
    metadata,
  };

  console.debug("[admin-analytics]", event);
}

export function trackError(
  error: unknown,
  context: string,
  metadata?: Record<string, unknown>,
) {
  const normalized =
    error instanceof Error
      ? {
          message: error.message,
          stack: error.stack,
        }
      : {
          message: String(error),
        };

  trackAction("error", {
    context,
    ...normalized,
    ...metadata,
  });
}
