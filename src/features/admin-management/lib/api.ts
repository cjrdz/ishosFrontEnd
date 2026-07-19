import type { Addon, Category, Flavor, Product } from "@api-types/api";

export type UserRole = "admin" | "employee";

export type { Addon, Category, Flavor, Product };

export interface AdminImage {
  name: string;
  url: string;
  size?: number;
  mime_type?: string;
  created_at?: string;
}

export interface Order {
  id: string;
  order_number: string;
  customer_id?: string | null;
  customer_name: string;
  customer_phone: string;
  customer_email?: string | null;
  order_type: "en_local" | "para_llevar";
  table_number?: number | null;
  status:
    | "pendiente_revision"
    | "recibida"
    | "en_proceso"
    | "lista"
    | "entregada"
    | "cancelada";
  payment_method: "efectivo" | "tarjeta" | "transferencia" | "otro";
  payment_status: "pendiente" | "confirmado";
  total_amount: number;
  notes?: string | null;
  rejection_reason?: string | null;
  created_by_user_id?: string | null;
  created_by_name?: string | null;
  created_by_role?: "customer" | UserRole | null;
  created_at?: string;
  updated_at?: string;
  items?: OrderItem[];
  tracking_token?: string | null;
  tracking_token_expires_at?: string | null;
  tracking_url?: string | null;
  status_timestamps?: Record<string, string>;
  is_archived?: boolean;
}

interface OrderItem {
  id: string;
  product_id: string;
  product_name: string;
  quantity: number;
  unit_price: number;
  subtotal: number;
  customizations?: {
    flavor_name?: string;
    flavor_names?: string[];
    addon_names?: string[];
    included_addon_names?: string[];
    extra_addon_names?: string[];
    notes?: string;
    [key: string]: unknown;
  } | null;
}

export interface Employee {
  id: string;
  email: string;
  name?: string;
  phone?: string;
  role: UserRole;
  state?: "active" | "inactive";
}

export interface User {
  id: string;
  name: string;
  user_type: "user" | "company";
  phone: string;
  email?: string | null;
  status: "active" | "inactive";
  created_at: string;
  updated_at: string;
}

export interface UserOrderHistoryItem {
  id: string;
  order_number: string;
  customer_name: string;
  customer_phone: string;
  total_amount: number;
  status: string;
  created_at: string;
}
