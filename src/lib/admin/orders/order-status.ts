import type { Order } from "../../api/admin";

export type LinearOrderStatus = "pendiente_revision" | "recibida" | "en_proceso" | "lista" | "entregada";
export type CanceledOrderStatus = "pendiente_revision" | "cancelada";

export const linearStatuses: LinearOrderStatus[] = [
  "pendiente_revision",
  "recibida",
  "en_proceso",
  "lista",
  "entregada",
];

export const canceledFlow: CanceledOrderStatus[] = ["pendiente_revision", "cancelada"];

export const statusLabels: Record<Order["status"], string> = {
  pendiente_revision: "pendiente",
  recibida: "aceptada",
  en_proceso: "preparando",
  lista: "lista",
  entregada: "entregada",
  cancelada: "rechazada",
};

export const statusBadgeClass: Record<Order["status"], string> = {
  pendiente_revision: "badge-warning",
  recibida: "badge-success",
  en_proceso: "badge-info",
  lista: "badge-accent",
  entregada: "badge-primary",
  cancelada: "badge-error",
};

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

export function kitchenBadge(order: Order): { text: string; className: string } | null {
  if (order.status === "recibida") {
    return { text: "Nueva orden", className: "badge badge-success badge-outline" };
  }
  return null;
}

export function isStepReached(current: Order["status"], step: LinearOrderStatus): boolean {
  if (current === "cancelada") return false;
  return linearStatuses.indexOf(current as LinearOrderStatus) >= linearStatuses.indexOf(step);
}

export function canChangeToStep(order: Order, stepStatus: LinearOrderStatus): boolean {
  return order.status !== "cancelada" && order.status !== stepStatus && stepStatus !== "pendiente_revision";
}

export function amountColumnLabel(status: Order["status"]): string {
  return status === "lista" || status === "entregada" ? "Total" : "Subtotal";
}

export function orderTypeLabel(orderType: Order["order_type"]): string {
  return orderType === "en_local" ? "En local" : "Para llevar";
}

export function createdByLabel(order: Order, employeeById: Record<string, string>): string {
  const explicitName = order.created_by_name?.trim();
  if (explicitName) return explicitName;
  if (!order.created_by_user_id) return order.customer_name;
  return employeeById[order.created_by_user_id] || "Personal";
}
