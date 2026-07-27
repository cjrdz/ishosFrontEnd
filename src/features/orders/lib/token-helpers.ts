/** Token visibility and clipboard helpers */

export type TokenCopyKind = "token" | "both" | "link" | "";

/** Copies text to clipboard and returns the copy kind for UI feedback */
export async function copyToClipboard(
  text: string,
  kind: "token" | "both" | "link",
): Promise<TokenCopyKind> {
  try {
    if (navigator?.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return kind;
    }
  } catch {
    // Fallback to legacy
  }

  // Fallback for insecure contexts (like dev over local IP)
  try {
    const textArea = document.createElement("textarea");
    textArea.value = text;
    // Avoid scrolling to bottom
    textArea.style.top = "0";
    textArea.style.left = "0";
    textArea.style.position = "fixed";
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    const successful = document.execCommand("copy");
    document.body.removeChild(textArea);
    return successful ? kind : "";
  } catch {
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
