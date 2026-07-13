import { ApiError } from "@core/api";

async function bffRequest<T>(path: string, options?: RequestInit): Promise<T> {
  let response: Response;
  try {
    response = await fetch(path, options);
  } catch {
    throw new ApiError("Network request failed", 0, "NETWORK_ERROR");
  }
  if (!response.ok) {
    let message = "Request failed";
    try {
      const data = (await response.json()) as Record<string, unknown>;
      if (typeof data?.error === "string") message = data.error;
    } catch {
      /* ignore */
    }
    throw new ApiError(message, response.status, "API_ERROR");
  }
  return response.json() as Promise<T>;
}

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
  ball_based?: boolean;
  ball_quantity?: number;
  allows_mixed_flavors?: boolean;
  stock_status?: "in_stock" | "low_stock" | "out_of_stock" | "not_tracked";
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
  customer_name?: string;
  customer_phone?: string;
  status: PublicOrderStatus;
  updated_at: string;
  created_at: string;
  total_amount: number;
  order_type: "en_local" | "para_llevar";
  status_timestamps?: Record<string, string>;
  items: Array<{
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
    };
  }>;
}

export interface PublicOrderTrackingHistoryResponse {
  orders: PublicOrderTrackingResponse[];
}

export async function listPublicCategories(): Promise<PublicCategory[]> {
  const res = await bffRequest<{ data: PublicCategory[] } | PublicCategory[]>(
    "/api/store/categories",
  );
  return Array.isArray(res)
    ? res
    : ((res as { data: PublicCategory[] }).data ?? []);
}

export async function listPublicProducts(): Promise<PublicProduct[]> {
  const res = await bffRequest<{ data: PublicProduct[] } | PublicProduct[]>(
    "/api/store/products",
  );
  return Array.isArray(res)
    ? res
    : ((res as { data: PublicProduct[] }).data ?? []);
}

export async function createPublicOrder(
  payload: PublicOrderCreatePayload,
  idempotencyKey?: string,
): Promise<PublicOrderCreateResponse> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (idempotencyKey) {
    headers["Idempotency-Key"] = idempotencyKey;
  }
  return bffRequest<PublicOrderCreateResponse>("/api/store/orders", {
    method: "POST",
    headers,
    body: JSON.stringify(payload),
  });
}

export async function trackPublicOrder(
  orderNumber: string,
  trackingToken: string,
): Promise<PublicOrderTrackingResponse> {
  const response = await bffRequest<PublicOrderTrackingResponse>(
    `/api/store/tracking/${encodeURIComponent(orderNumber)}?tracking_token=${encodeURIComponent(trackingToken)}`,
  );

  return {
    ...response,
    items: Array.isArray(response.items)
      ? response.items.map((item) => ({
          ...item,
          customizations: item.customizations
            ? {
                ...item.customizations,
                addon_names: item.customizations.addon_names ?? [],
                included_addon_names:
                  item.customizations.included_addon_names ?? [],
                extra_addon_names: item.customizations.extra_addon_names ?? [],
              }
            : undefined,
        }))
      : [],
  };
}

// ── Public Store Settings ────────────────────────────────────────────

export interface StoreOfferItem {
  product_id: string;
  label: string;
  note?: string;
  discount_price?: number;
  flavor_id?: string;
  flavor_ids?: string[];
  expires_at: string;
}

export interface StorePublicSettings {
  orders_enabled: boolean;
  offers: StoreOfferItem[];
}

export async function fetchStoreSettings(): Promise<StorePublicSettings> {
  return bffRequest<StorePublicSettings>("/api/store/settings");
}
