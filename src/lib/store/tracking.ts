import type { PublicOrderStatus } from "../api/store";

const TRACKING_KEY = "ishos_public_order_tracker";

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
