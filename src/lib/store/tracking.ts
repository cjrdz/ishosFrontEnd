const TRACKING_KEY = "ishos_public_order_tracker";

export function saveTracking(orderNumber: string, token: string) {
  if (typeof window === "undefined") return;
  localStorage.setItem(
    TRACKING_KEY,
    JSON.stringify({
      orderNumber,
      token,
    }),
  );
}

export function getTracking(): { orderNumber: string; token: string } | null {
  if (typeof window === "undefined") return null;
  const raw = localStorage.getItem(TRACKING_KEY);
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw) as { orderNumber?: string; token?: string };
    if (!parsed.orderNumber || !parsed.token) return null;
    return { orderNumber: parsed.orderNumber, token: parsed.token };
  } catch {
    return null;
  }
}
