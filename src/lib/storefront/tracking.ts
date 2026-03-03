const TRACKING_KEY = "ishos_public_order_tracker";

export function saveTracking(orderNumber: string, phone: string) {
  if (typeof window === "undefined") return;
  localStorage.setItem(
    TRACKING_KEY,
    JSON.stringify({
      orderNumber,
      phone,
    }),
  );
}

export function getTracking(): { orderNumber: string; phone: string } | null {
  if (typeof window === "undefined") return null;
  const raw = localStorage.getItem(TRACKING_KEY);
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw) as { orderNumber?: string; phone?: string };
    if (!parsed.orderNumber || !parsed.phone) return null;
    return { orderNumber: parsed.orderNumber, phone: parsed.phone };
  } catch {
    return null;
  }
}
