import type { CreatedOrder } from "@features/admin-management/lib/order-handlers";
import type {
  Category,
  Employee,
  Order,
  Product,
} from "@features/admin-management";
import type { PaginationInfo } from "@api-types/api";

export interface CreateOrderPayload {
  customer_name: string;
  customer_phone: string;
  customer_email?: string;
  payment_method: "efectivo" | "tarjeta" | "transferencia" | "otro";
  amount_received?: number;
  order_type: "en_local" | "para_llevar";
  table_number?: number;
  notes?: string;
  items: Array<{
    product_id: string;
    quantity: number;
    customizations?: Record<string, unknown>;
  }>;
}

export type OrderUpdateItemPayload = {
  product_id: string;
  quantity: number;
  customizations?: Record<string, unknown>;
};

export interface OrderUpdatePayload {
  customer_name: string;
  customer_phone: string;
  customer_email?: string;
  payment_method: "efectivo" | "tarjeta" | "transferencia" | "otro";
  amount_received?: number;
  order_type: "en_local" | "para_llevar";
  table_number?: number;
  notes: string;
  items: OrderUpdateItemPayload[];
}

export interface ManualOrderItemDraft {
  product_id: string;
  quantity: number;
  flavor_id?: string;
  flavor_ids?: string[];
  included_addon_ids: string[];
  extra_addon_ids: string[];
  topping_selection?: "none" | "selected";
  jalea_selection?: "none" | "selected";
}

export interface OrderFormState {
  customer_name: string;
  customer_phone: string;
  customer_email: string;
  payment_method: "efectivo" | "tarjeta" | "transferencia" | "otro";
  amount_received: "" | number;
  order_type: "en_local" | "para_llevar";
  table_number: "" | number;
  notes: string;
  product_id: string;
  quantity: number;
}

export interface OrdersTabProps {
  isAdmin: boolean;
  /**
   * Admins and managers may cancel accepted orders (and those in
   * preparation, giving their stock back). The backend enforces it too.
   */
  canCancelOrders?: boolean;
  orders: Order[];
  products: Product[];
  allProducts?: Product[];
  categories: Category[];
  employees: Employee[];
  selectedOrder: Order | null;
  busy: boolean;
  moduleError: string;
  orderStatusFilter: string;
  showArchived: boolean;
  pagination: PaginationInfo;
  onFilterChange: (status: string) => void;
  onToggleArchivedView: () => void;
  onReload: () => void;
  onPageChange: (page: number) => void;
  onPerPageChange: (perPage: number) => void;
  onOpenOrder: (id: string) => Promise<Order | null>;
  onClearSelectedOrder: () => void;
  onApprove: (id: string, reason?: string) => Promise<Order | null>;
  onReject: (id: string, reason: string) => Promise<Order | null>;
  onStatusChange: (
    id: string,
    status: "recibida" | "en_proceso" | "lista" | "entregada",
  ) => Promise<Order | null>;
  onUpdateOrder: (
    id: string,
    payload: OrderUpdatePayload,
  ) => Promise<Order | null>;
  onDelete: (id: string) => void;
  /** Resolves null when the order was not created. */
  onCreate: (
    payload: CreateOrderPayload,
    idempotencyKey?: string,
  ) => Promise<CreatedOrder | null>;
  onArchive: (id: string, archived: boolean) => Promise<Order | null>;
  saveUserFromOrder: (payload: {
    name: string;
    user_type: "user" | "company";
    phone: string;
    email?: string;
    status: "active" | "inactive";
  }) => Promise<boolean>;
}

/** What prints automatically when a counter order is created. */
export type AutoPrintMode = "none" | "kitchen" | "both";
