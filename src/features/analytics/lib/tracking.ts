import type { PublicOrderStatus } from "@features/catalog";

const TRACKING_KEY = "ishos_public_order_tracker";
const RECENT_TRACKING_KEY = "ishos_public_order_recent_tracker";
const TRACKING_REMEMBER_PREFERENCE_KEY = "ishos_public_order_remember_tracker";
const RECENT_TRACKING_MAX_ORDERS = 30;
const RECENT_TRACKING_TTL_MS = 30 * 24 * 60 * 60 * 1000;

export interface RecentTrackingOrder {
  orderNumber: string;
  token: string;
  status: PublicOrderStatus;
  totalAmount: number;
  updatedAt: string;
  savedAt: number;
}

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

export const TRACKING_STATUS_FLOW: PublicOrderStatus[] = [
  "pendiente_revision",
  "recibida",
  "en_proceso",
  "lista",
  "entregada",
];

export const TRACKING_STATUS_LABELS: Record<PublicOrderStatus, string> = {
  pendiente_revision: "Pendiente",
  recibida: "Aceptada",
  en_proceso: "Preparando",
  lista: "Lista",
  entregada: "Entregada",
  cancelada: "Cancelada",
};

export const TRACKING_STATUS_ICONS_ACTIVE: Record<PublicOrderStatus, string> = {
  pendiente_revision: "line-md:watch-loop",
  recibida: "line-md:confirm-circle",
  en_proceso: "line-md:loading-twotone-loop",
  lista: "line-md:bell-loop",
  entregada: "line-md:check-all",
  cancelada: "line-md:close-circle",
};

export const TRACKING_STATUS_ICONS_STATIC: Record<PublicOrderStatus, string> = {
  pendiente_revision: "lucide:clock",
  recibida: "lucide:check-circle",
  en_proceso: "lucide:loader",
  lista: "lucide:bell",
  entregada: "lucide:check-check",
  cancelada: "lucide:x-circle",
};

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

function pruneRecentTrackingOrders(
  orders: RecentTrackingOrder[],
): RecentTrackingOrder[] {
  const now = Date.now();
  return orders
    .filter((entry) => {
      if (!entry.orderNumber || !entry.token || !entry.status) return false;
      if (typeof entry.totalAmount !== "number") return false;
      if (!entry.updatedAt) return false;
      if (typeof entry.savedAt !== "number") return false;
      return now - entry.savedAt <= RECENT_TRACKING_TTL_MS;
    })
    .sort((a, b) => b.savedAt - a.savedAt)
    .slice(0, RECENT_TRACKING_MAX_ORDERS);
}

export function saveRecentTrackingOrder(
  order: Omit<RecentTrackingOrder, "savedAt">,
) {
  if (typeof window === "undefined") return;

  const existing = getRecentTrackingOrders();
  const deduped = existing.filter(
    (entry) =>
      !(entry.orderNumber === order.orderNumber && entry.token === order.token),
  );

  const next = pruneRecentTrackingOrders([
    {
      ...order,
      savedAt: Date.now(),
    },
    ...deduped,
  ]);

  localStorage.setItem(RECENT_TRACKING_KEY, JSON.stringify(next));
}

export function getRecentTrackingOrders(): RecentTrackingOrder[] {
  if (typeof window === "undefined") return [];
  const raw = localStorage.getItem(RECENT_TRACKING_KEY);
  if (!raw) return [];

  try {
    const parsed = JSON.parse(raw) as RecentTrackingOrder[];
    if (!Array.isArray(parsed)) return [];
    const cleaned = pruneRecentTrackingOrders(parsed);
    localStorage.setItem(RECENT_TRACKING_KEY, JSON.stringify(cleaned));
    return cleaned;
  } catch {
    return [];
  }
}

export function clearRecentTrackingOrders() {
  if (typeof window === "undefined") return;
  localStorage.removeItem(RECENT_TRACKING_KEY);
}

export function getRememberTrackingPreference(): boolean {
  if (typeof window === "undefined") return true;
  const raw = localStorage.getItem(TRACKING_REMEMBER_PREFERENCE_KEY);
  if (raw === "false") return false;
  return true;
}

export function saveRememberTrackingPreference(enabled: boolean) {
  if (typeof window === "undefined") return;
  localStorage.setItem(
    TRACKING_REMEMBER_PREFERENCE_KEY,
    enabled ? "true" : "false",
  );
}
