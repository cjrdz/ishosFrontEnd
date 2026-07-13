import type {
  Addon,
  Category,
  Employee,
  Flavor,
  Order,
  Product,
} from "@features/admin-management";

export interface CreateOrderPayload {
  customer_name: string;
  customer_phone: string;
  customer_email?: string;
  payment_method: "efectivo" | "tarjeta" | "transferencia" | "otro";
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
  order_type: "en_local" | "para_llevar";
  table_number: "" | number;
  notes: string;
  product_id: string;
  quantity: number;
}

export interface OrdersTabProps {
  isAdmin: boolean;
  orders: Order[];
  products: Product[];
  categories: Category[];
  employees: Employee[];
  selectedOrder: Order | null;
  busy: boolean;
  moduleError: string;
  orderStatusFilter: string;
  showArchived: boolean;
  onFilterChange: (status: string) => void;
  onToggleArchivedView: () => void;
  onReload: () => void;
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
  onCreate: (
    payload: CreateOrderPayload,
    idempotencyKey?: string,
  ) => Promise<boolean>;
  onArchive: (id: string, archived: boolean) => Promise<Order | null>;
  saveUserFromOrder: (payload: {
    name: string;
    user_type: "user" | "company";
    phone: string;
    email?: string;
    status: "active" | "inactive";
  }) => Promise<boolean>;
}
