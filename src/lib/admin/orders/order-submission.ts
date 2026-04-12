import type { Order } from "../../../lib/api/admin";
import type { CreateOrderPayload, ManualOrderItemDraft } from "../../../components/svelte/admin/tabs/types/orders-tab";
import { buildCustomizationsFromDraft } from "./manual-item-helpers";

/** Prepares items for order creation by converting draft items */
export function prepareOrderItems(
  manualItems: ManualOrderItemDraft[],
  fallbackItem: ManualOrderItemDraft | null,
): CreateOrderPayload["items"] | null {
  const itemsToCreate = manualItems.length > 0
    ? manualItems
    : fallbackItem
      ? [fallbackItem]
      : [];

  if (itemsToCreate.length === 0) {
    return null;
  }

  return itemsToCreate.map((item) => ({
    product_id: item.product_id,
    quantity: item.quantity,
    customizations: buildCustomizationsFromDraft(item),
  }));
}

/** Validates and normalizes order update payload */
export interface OrderUpdatePayload {
  customer_name: string;
  customer_phone: string;
  customer_email?: string;
  payment_method: "efectivo" | "tarjeta" | "transferencia" | "otro";
  order_type: "en_local" | "para_llevar";
  table_number?: number;
  notes?: string;
}

export function buildOrderUpdatePayload(
  customerName: string,
  customerPhone: string,
  customerEmail: string,
  paymentMethod: "efectivo" | "tarjeta" | "transferencia" | "otro",
  orderType: "en_local" | "para_llevar",
  tableNumber: string | number,
  notes: string,
): OrderUpdatePayload {
  const normalizedTableNumber =
    orderType === "en_local" && tableNumber !== ""
      ? Number(tableNumber)
      : undefined;

  return {
    customer_name: customerName.trim(),
    customer_phone: customerPhone.trim(),
    customer_email: customerEmail.trim() || undefined,
    payment_method: paymentMethod,
    order_type: orderType,
    table_number: Number.isFinite(normalizedTableNumber) ? normalizedTableNumber : undefined,
    notes: notes.trim() || undefined,
  };
}

/** Builds a complete create order payload */
export function buildCreateOrderPayload(
  customerName: string,
  customerPhone: string,
  customerEmail: string,
  paymentMethod: "efectivo" | "tarjeta" | "transferencia" | "otro",
  orderType: "en_local" | "para_llevar",
  tableNumber: string | number,
  notes: string,
  items: CreateOrderPayload["items"],
): CreateOrderPayload {
  return {
    customer_name: customerName.trim(),
    customer_phone: customerPhone.trim(),
    customer_email: customerEmail.trim() || undefined,
    payment_method: paymentMethod,
    order_type: orderType,
    table_number: orderType === "en_local" && tableNumber !== ""
      ? Number(tableNumber)
      : undefined,
    notes: notes.trim() || undefined,
    items,
  };
}
