import {
  approveOrder,
  archiveOrder,
  createOrder,
  deleteOrder,
  getOrder,
  rejectOrder,
  updateOrder,
  updateOrderNotes,
  updateOrderStatus,
} from "./bff";
import type { Order } from "./api";
import type { RunModuleAction } from "./module-action";

interface OrderHandlerDeps {
  runModuleAction: RunModuleAction;
  loadOrders: () => Promise<void>;
  setNotice: (message: string) => void;
  setOrderModuleError: (message: string) => void;
  getSelectedOrder: () => Order | null;
  setSelectedOrder: (value: Order | null) => void;
}

const DETAIL_CACHE_TTL_MS = 10_000;

interface CachedOrder {
  order: Order;
  expiresAt: number;
}

const detailCache = new Map<string, CachedOrder>();

function getCachedOrder(orderId: string): Order | null {
  const entry = detailCache.get(orderId);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    detailCache.delete(orderId);
    return null;
  }
  return entry.order;
}

function setCachedOrder(order: Order) {
  detailCache.set(order.id, {
    order,
    expiresAt: Date.now() + DETAIL_CACHE_TTL_MS,
  });
}

function invalidateCachedOrder(orderId: string) {
  detailCache.delete(orderId);
}

function mergeSelectedOrder(
  deps: OrderHandlerDeps,
  orderId: string,
  updated: Order,
) {
  const selected = deps.getSelectedOrder();
  if (selected?.id === orderId) {
    deps.setSelectedOrder({ ...selected, ...updated });
  }
  setCachedOrder(updated);
}

export function createDashboardOrderHandlers(deps: OrderHandlerDeps) {
  const {
    runModuleAction,
    loadOrders,
    setNotice,
    setOrderModuleError,
    getSelectedOrder,
    setSelectedOrder,
  } = deps;

  async function handleCreateOrder(
    payload: Parameters<typeof createOrder>[0],
    idempotencyKey?: string,
  ) {
    return runModuleAction<boolean>({
      module: "ordenes",
      analyticsAction: "admin_order_create",
      errorMessage: "No se pudo crear la orden",
      action: async () => {
        await createOrder(payload, idempotencyKey);
        return true;
      },
      defaultValue: false,
      onSuccess: async () => {
        setNotice("Orden creada");
        await loadOrders();
      },
    });
  }

  async function handleDeleteOrder(orderId: string) {
    await runModuleAction<void>({
      module: "ordenes",
      requireAdmin: true,
      analyticsAction: "admin_order_delete",
      errorMessage: "No se pudo eliminar la orden",
      action: async () => {
        await deleteOrder(orderId);
      },
      defaultValue: undefined,
      onSuccess: async () => {
        invalidateCachedOrder(orderId);
        if (getSelectedOrder()?.id === orderId) {
          setSelectedOrder(null);
        }
        setNotice("Orden eliminada");
        await loadOrders();
      },
    });
  }

  async function handleOpenOrder(orderId: string) {
    const cached = getCachedOrder(orderId);
    if (cached) {
      setSelectedOrder(cached);
      return cached;
    }

    return runModuleAction<Order | null>({
      module: "ordenes",
      analyticsAction: "admin_order_open",
      errorMessage: "No se pudo cargar detalle de orden",
      action: async () => {
        const opened = await getOrder(orderId);
        setCachedOrder(opened);
        setSelectedOrder(opened);
        return opened;
      },
      defaultValue: null,
    });
  }

  async function handleApprove(orderId: string, reactivationReason?: string) {
    return runModuleAction<Order | null>({
      module: "ordenes",
      analyticsAction: "admin_order_approve",
      errorMessage: "No se pudo aprobar orden",
      action: async () => {
        const updated = await approveOrder(orderId);
        let finalUpdated = updated;

        if (reactivationReason?.trim()) {
          const normalizedReason = reactivationReason.trim();
          const currentNotes = updated.notes?.trim() || "";
          const reactivationEntry = `Reactivacion: ${normalizedReason}`;
          const mergedNotes = currentNotes
            ? `${currentNotes}\n\n${reactivationEntry}`
            : reactivationEntry;
          finalUpdated = await updateOrderNotes(orderId, mergedNotes);
        }

        mergeSelectedOrder(deps, orderId, finalUpdated);
        return finalUpdated;
      },
      defaultValue: null,
      onSuccess: async () => {
        setNotice(
          reactivationReason?.trim() ? "Orden reactivada" : "Orden aprobada",
        );
        await loadOrders();
      },
    });
  }

  async function handleReject(orderId: string, reason: string) {
    if (!reason.trim()) {
      setOrderModuleError("Debes indicar el motivo de rechazo");
      return null;
    }

    return runModuleAction<Order | null>({
      module: "ordenes",
      analyticsAction: "admin_order_reject",
      errorMessage: "No se pudo rechazar orden",
      action: async () => {
        const updated = await rejectOrder(orderId, reason);
        mergeSelectedOrder(deps, orderId, updated);
        return updated;
      },
      defaultValue: null,
      onSuccess: async () => {
        setNotice("Orden rechazada");
        await loadOrders();
      },
    });
  }

  async function handleStatusChange(
    orderId: string,
    status: "recibida" | "en_proceso" | "lista" | "entregada",
  ) {
    return runModuleAction<Order | null>({
      module: "ordenes",
      analyticsAction: "admin_order_status_change",
      errorMessage: "No se pudo actualizar estado",
      action: async () => {
        const updated = await updateOrderStatus(orderId, status);
        mergeSelectedOrder(deps, orderId, updated);
        return updated;
      },
      defaultValue: null,
      onSuccess: async () => {
        setNotice(`Estado actualizado a ${status}`);
        await loadOrders();
      },
    });
  }

  async function handleUpdateOrder(
    orderId: string,
    payload: Parameters<typeof updateOrder>[1],
  ) {
    return runModuleAction<Order | null>({
      module: "ordenes",
      analyticsAction: "admin_order_update",
      errorMessage: "No se pudo actualizar la orden",
      action: async () => {
        const updated = await updateOrder(orderId, payload);
        mergeSelectedOrder(deps, orderId, updated);
        return updated;
      },
      defaultValue: null,
      onSuccess: async () => {
        setNotice("Orden actualizada");
        await loadOrders();
      },
    });
  }

  async function handleArchiveOrder(orderId: string, archived: boolean) {
    return runModuleAction<Order | null>({
      module: "ordenes",
      requireAdmin: true,
      analyticsAction: archived
        ? "admin_order_archive"
        : "admin_order_unarchive",
      errorMessage: archived
        ? "No se pudo archivar la orden"
        : "No se pudo desarchivar la orden",
      action: async () => {
        const updated = await archiveOrder(orderId, archived);
        mergeSelectedOrder(deps, orderId, updated);
        return updated;
      },
      defaultValue: null,
      onSuccess: async () => {
        setNotice(archived ? "Orden archivada" : "Orden desarchivada");
        await loadOrders();
      },
    });
  }

  return {
    handleCreateOrder,
    handleDeleteOrder,
    handleOpenOrder,
    handleApprove,
    handleReject,
    handleStatusChange,
    handleUpdateOrder,
    handleArchiveOrder,
  };
}
