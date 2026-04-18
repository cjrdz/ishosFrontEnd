import type { Employee, Order, Product } from "../../../../../lib/api/admin";

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

export interface ManualOrderItemDraft {
  product_id: string;
  quantity: number;
  flavor_id?: string;
  included_addon_ids: string[];
  extra_addon_ids: string[];
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
  employees: Employee[];
  selectedOrder: Order | null;
  busy: boolean;
  moduleError: string;
  orderStatusFilter: string;
  onFilterChange: (status: string) => void;
  onReload: () => void;
  onOpenOrder: (id: string) => Promise<Order | null>;
  onApprove: (id: string, reason?: string) => void;
  onReject: (id: string, reason: string) => void;
  onStatusChange: (
    id: string,
    status: "recibida" | "en_proceso" | "lista" | "entregada",
  ) => Promise<Order | null>;
  onUpdateOrder: (
    id: string,
    payload: {
      customer_name: string;
      customer_phone: string;
      customer_email?: string;
      payment_method: "efectivo" | "tarjeta" | "transferencia" | "otro";
      order_type: "en_local" | "para_llevar";
      table_number?: number;
      notes?: string;
    },
  ) => Promise<Order | null>;
  onDelete: (id: string) => void;
  onCreate: (payload: CreateOrderPayload) => Promise<boolean>;
  saveUserFromOrder: (payload: {
    name: string;
    user_type: "user" | "company";
    phone: string;
    email?: string;
    status: "active" | "inactive";
  }) => Promise<boolean>;
}
