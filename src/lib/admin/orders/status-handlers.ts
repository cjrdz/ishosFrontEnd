import type { Order } from "../../../lib/api/admin";
import type { LinearOrderStatus } from "./order-status";

/** Pending status change (used during print prompt flow) */
export interface PendingStatusChange {
  id: string;
  status: "recibida" | "en_proceso" | "lista" | "entregada";
}

/** Handles direct status change triggered from the order list */
export async function handleStatusChangeFromList(
  orderId: string,
  status: "recibida" | "en_proceso" | "lista" | "entregada",
  onStatusChange: (
    id: string,
    status: "recibida" | "en_proceso" | "lista" | "entregada",
  ) => Promise<boolean | Order | null>,
  onOpenOrder: (id: string) => Promise<Order | null>,
): Promise<void> {
  const updated = await onStatusChange(orderId, status);
  if (!updated) return;
  await onOpenOrder(orderId);
}

/**
 * Handles step click from order detail view.
 * For "lista" status, opens the print prompt instead of immediately changing status.
 */
export function handleStepClick(
  order: Order,
  stepStatus: LinearOrderStatus,
  onPrintPrompt: (order: Order) => void,
  onStatusChange: (
    orderId: string,
    status: "recibida" | "en_proceso" | "lista" | "entregada",
  ) => Promise<boolean | Order | null>,
  canChangeToStep: (fromStatus: string, toStatus: LinearOrderStatus) => boolean,
): void {
  if (order.status === "cancelada" || order.status === stepStatus) return;

  if (stepStatus === "lista") {
    onPrintPrompt(order);
    return;
  }

  const nextStatus =
    stepStatus === "pendiente_revision" ? "en_proceso" : stepStatus;
  void handleStatusChangeFromList(
    order.id,
    nextStatus as "recibida" | "en_proceso" | "lista" | "entregada",
    onStatusChange,
    async () => order,
  );
}

/**
 * Apply a pending status change after print confirmation.
 * Typically called from the print prompt dialog.
 */
export async function applyStatusChange(
  pendingStatusChange: PendingStatusChange | null,
  onStatusChange: (
    id: string,
    status: "recibida" | "en_proceso" | "lista" | "entregada",
  ) => Promise<boolean | Order | null>,
  onOpenOrder: (id: string) => Promise<Order | null>,
  onClosePrintPrompt: () => void,
): Promise<void> {
  if (!pendingStatusChange) return;
  const { id, status } = pendingStatusChange;
  onClosePrintPrompt();
  const updated = await onStatusChange(id, status);
  if (!updated) return;
  await onOpenOrder(id);
}

/** Resets pending status change state */
export function resetPendingStatusChange(): PendingStatusChange | null {
  return null;
}
