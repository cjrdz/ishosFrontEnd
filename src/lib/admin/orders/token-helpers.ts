/** Token visibility and clipboard helpers */

export type TokenCopyKind = "token" | "both" | "link" | "";

/** Copies text to clipboard and returns the copy kind for UI feedback */
export async function copyToClipboard(
  text: string,
  kind: "token" | "both" | "link",
): Promise<TokenCopyKind> {
  try {
    await navigator.clipboard.writeText(text);
    return kind;
  } catch {
    // clipboard not available (e.g. insecure context) — silently ignore
    return "";
  }
}

/** Clears clipboard feedback after a timeout (usually 2 seconds) */
export function clearClipboardFeedback(
  currentKind: TokenCopyKind,
  onClear: () => void,
  delayMs: number = 2000,
): () => void {
  if (!currentKind) return () => {};
  const timer = setTimeout(onClear, delayMs);
  return () => clearTimeout(timer);
}

/**
 * Resets token reveal state when a different order is selected.
 * Call this in an effect when selectedOrder changes.
 */
export function resetTokenState(): {
  tokenVisible: boolean;
  tokenCopied: TokenCopyKind;
} {
  return {
    tokenVisible: false,
    tokenCopied: "",
  };
}
