import type { Order } from "@features/admin-management";

export type LinearOrderStatus =
  "pendiente_revision" | "recibida" | "en_proceso" | "lista" | "entregada";
type CanceledOrderStatus = "pendiente_revision" | "cancelada";

export const linearStatuses: LinearOrderStatus[] = [
  "pendiente_revision",
  "recibida",
  "en_proceso",
  "lista",
  "entregada",
];

export const canceledFlow: CanceledOrderStatus[] = [
  "pendiente_revision",
  "cancelada",
];

// Staff-facing names. "Por revisar" (not "Recibida") makes clear an order
// still needs someone to accept it; the customer's tracking page says
// "Recibida" for the same state.
export const statusLabels: Record<Order["status"], string> = {
  pendiente_revision: "Por revisar",
  recibida: "Aceptada",
  en_proceso: "Preparando",
  lista: "Lista",
  entregada: "Entregada",
  cancelada: "Rechazada",
};

/** Board column titles (plural). */
export const statusPluralLabels: Record<Order["status"], string> = {
  pendiente_revision: "Por revisar",
  recibida: "Aceptadas",
  en_proceso: "Preparando",
  lista: "Listas",
  entregada: "Entregadas",
  cancelada: "Rechazadas",
};

/** Each state also has its own icon, so staff never rely on colour alone.
 *  (Icons, not glyphs: Roboto lacks ◐ and fallbacks render it clipped.) */
export const statusIcons: Record<Order["status"], string> = {
  pendiente_revision: "lucide:circle-dot",
  recibida: "lucide:check",
  en_proceso: "lucide:chef-hat",
  lista: "lucide:bell",
  entregada: "lucide:check-check",
  cancelada: "lucide:x",
};

/** Chip colours from the --st-* tokens (brand.css); AA in both themes. */
export const statusChipClass: Record<Order["status"], string> = {
  pendiente_revision: "status-chip status-chip--review",
  recibida: "status-chip status-chip--accepted",
  en_proceso: "status-chip status-chip--preparing",
  lista: "status-chip status-chip--ready",
  entregada: "status-chip status-chip--done",
  cancelada: "status-chip status-chip--rejected",
};

// Kept for callers that prefix "badge": the chip classes override its colours.
export const statusBadgeClass: Record<Order["status"], string> =
  statusChipClass;

export const statusStepIconsActive: Record<LinearOrderStatus, string> = {
  pendiente_revision: "line-md:watch-loop",
  recibida: "line-md:confirm-circle",
  en_proceso: "line-md:loading-twotone-loop",
  lista: "line-md:bell-loop",
  entregada: "line-md:check-all",
};

export const statusStepIconsStatic: Record<LinearOrderStatus, string> = {
  pendiente_revision: "lucide:clock",
  recibida: "lucide:check-circle",
  en_proceso: "lucide:loader",
  lista: "lucide:bell",
  entregada: "lucide:check-check",
};

export const canceledStepLabels: Record<CanceledOrderStatus, string> = {
  pendiente_revision: "pendiente",
  cancelada: "denegada",
};

export const canceledStepIconsActive: Record<CanceledOrderStatus, string> = {
  pendiente_revision: "line-md:watch-loop",
  cancelada: "line-md:close-circle",
};

export const canceledStepIconsStatic: Record<CanceledOrderStatus, string> = {
  pendiente_revision: "lucide:clock",
  cancelada: "lucide:x-circle",
};

export function kitchenBadge(
  order: Order,
): { text: string; className: string } | null {
  if (order.status === "recibida") {
    return {
      text: "Nueva orden",
      className: "status-chip status-chip--sm status-chip--accepted",
    };
  }
  return null;
}

export function isStepReached(
  current: Order["status"],
  step: LinearOrderStatus,
): boolean {
  if (current === "cancelada") return false;
  return (
    linearStatuses.indexOf(current as LinearOrderStatus) >=
    linearStatuses.indexOf(step)
  );
}

export function canChangeToStep(
  order: Order,
  stepStatus: LinearOrderStatus,
): boolean {
  return (
    order.status !== "cancelada" &&
    order.status !== stepStatus &&
    stepStatus !== "pendiente_revision"
  );
}

export function suggestedNextStep(
  status: Order["status"],
): LinearOrderStatus | null {
  if (status === "cancelada" || status === "entregada") return null;
  const idx = linearStatuses.indexOf(status as LinearOrderStatus);
  if (idx === -1 || idx >= linearStatuses.length - 1) return null;
  return linearStatuses[idx + 1];
}

export function amountColumnLabel(status: Order["status"]): string {
  return status === "lista" || status === "entregada" ? "Total" : "Subtotal";
}

/**
 * Whether staff may still edit an order. Accepted orders are locked, except
 * counter orders (created by staff): they start accepted while the customer
 * is still at the counter. Mirrors the backend rule.
 */
export function isOrderEditable(
  order: Pick<Order, "status"> & { created_by_user_id?: string | null },
): boolean {
  if (order.status === "recibida" && order.created_by_user_id) return true;
  return !["recibida", "lista", "entregada", "cancelada"].includes(
    order.status,
  );
}

export function orderTypeLabel(orderType: Order["order_type"]): string {
  return orderType === "en_local" ? "En local" : "Para llevar";
}

export function createdByLabel(
  order: Order,
  employeeById: Record<string, string>,
): string {
  const explicitName = order.created_by_name?.trim();
  const creatorRole = order.created_by_role ?? null;
  const creatorId = order.created_by_user_id?.trim() || "";

  if (creatorRole === "customer") {
    return order.customer_name;
  }

  if (creatorRole === "admin" || creatorRole === "employee") {
    if (creatorId && employeeById[creatorId]) return employeeById[creatorId];
    if (explicitName && explicitName !== order.customer_name)
      return explicitName;
    return "Personal";
  }

  if (explicitName) return explicitName;
  if (!creatorId) return order.customer_name;
  return employeeById[creatorId] || explicitName || "Personal";
}
