/**
 * Idempotency key management for order creation.
 *
 * A key is generated once per logical order attempt and reused across retries
 * and resubmits for the same cart. This prevents double-clicks or flaky
 * network retries from creating duplicate orders. The key is cleared once the
 * order succeeds or the cart is abandoned/cleared.
 */

const IDEMPOTENCY_KEY = "ishos_order_idempotency_key";

function generateUUID(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  // Fallback for environments without crypto.randomUUID.
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export function generateIdempotencyKey(): string {
  return generateUUID();
}

export function getIdempotencyKey(): string {
  if (typeof sessionStorage === "undefined") {
    return generateUUID();
  }

  let key = sessionStorage.getItem(IDEMPOTENCY_KEY);
  if (!key) {
    key = generateUUID();
    sessionStorage.setItem(IDEMPOTENCY_KEY, key);
  }
  return key;
}

export function clearIdempotencyKey(): void {
  if (typeof sessionStorage === "undefined") {
    return;
  }
  sessionStorage.removeItem(IDEMPOTENCY_KEY);
}
