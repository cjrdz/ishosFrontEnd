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

export interface PublicFlavor {
  id: string;
  name: string;
  display_order: number;
  is_seasonal: boolean;
  is_active: boolean;
}

export interface PublicAddon {
  id: string;
  name: string;
  price: number;
  group_name: string;
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
  flavors?: PublicFlavor[];
  addons?: PublicAddon[];
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
  tracking_token: string;
  tracking_expires_at: string;
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

export interface PublicOrderTrackingHistoryResponse {
  orders: PublicOrderTrackingResponse[];
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
  trackingToken: string,
): Promise<PublicOrderTrackingResponse> {
  const query = new URLSearchParams({
    order_number: orderNumber,
    tracking_token: trackingToken,
  });

  return apiRequest<PublicOrderTrackingResponse>(`/orders/track?${query.toString()}`);
}
