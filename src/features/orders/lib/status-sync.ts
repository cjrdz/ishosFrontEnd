const ORDER_STATUS_SYNC_KEY = "ishos.order.status.sync.v1";

export interface OrderStatusSyncEvent {
  orderId: string;
  orderNumber: string;
  status: string;
  at: number;
}

export function emitOrderStatusSync(event: Omit<OrderStatusSyncEvent, "at">) {
  if (typeof window === "undefined") return;
  const payload: OrderStatusSyncEvent = {
    ...event,
    at: Date.now(),
  };
  window.localStorage.setItem(ORDER_STATUS_SYNC_KEY, JSON.stringify(payload));
}

export function subscribeOrderStatusSync(
  onEvent: (event: OrderStatusSyncEvent) => void,
): () => void {
  if (typeof window === "undefined") return () => {};

  const listener = (storageEvent: StorageEvent) => {
    if (storageEvent.key !== ORDER_STATUS_SYNC_KEY || !storageEvent.newValue) {
      return;
    }

    try {
      const parsed = JSON.parse(storageEvent.newValue) as OrderStatusSyncEvent;
      if (!parsed.orderId || !parsed.orderNumber || !parsed.status) return;
      onEvent(parsed);
    } catch {
      // Ignore malformed storage payloads.
    }
  };

  window.addEventListener("storage", listener);
  return () => window.removeEventListener("storage", listener);
}
