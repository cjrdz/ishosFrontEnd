import { apiRequest } from "./client";

export interface PublicCategory {
  id: string;
  name: string;
  slug: string;
  description: string;
  image_path?: string | null;
  display_order: number;
  is_active: boolean;
}

export interface PublicProduct {
  id: string;
  name: string;
  description: string;
  price: number;
  category_id?: string;
  category_name?: string;
  image_url?: string | null;
  image_path?: string | null;
  is_available: boolean;
  stock_status: "in_stock" | "out_of_stock" | "discontinued";
}

export type PublicOrderStatus =
  | "pendiente_revision"
  | "recibida"
  | "en_proceso"
  | "lista"
  | "entregada"
  | "cancelada";

export interface PublicOrderCreatePayload {
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

export interface PublicOrderCreateResponse {
  order_number: string;
  status: PublicOrderStatus;
  total: number;
  message: string;
}

export interface PublicOrderTrackingResponse {
  order_number: string;
  status: PublicOrderStatus;
  updated_at: string;
  created_at: string;
  total_amount: number;
  order_type: "en_local" | "para_llevar";
}

export async function listPublicCategories(): Promise<PublicCategory[]> {
  return apiRequest<PublicCategory[]>("/categories");
}

export async function listPublicProducts(): Promise<PublicProduct[]> {
  return apiRequest<PublicProduct[]>("/products");
}

export async function createPublicOrder(
  payload: PublicOrderCreatePayload,
): Promise<PublicOrderCreateResponse> {
  return apiRequest<PublicOrderCreateResponse>("/orders", {
    method: "POST",
    body: payload,
  });
}

export async function trackPublicOrder(
  orderNumber: string,
  customerPhone: string,
): Promise<PublicOrderTrackingResponse> {
  const query = new URLSearchParams({
    order_number: orderNumber,
    customer_phone: customerPhone,
  });

  return apiRequest<PublicOrderTrackingResponse>(`/orders/track?${query.toString()}`);
}
