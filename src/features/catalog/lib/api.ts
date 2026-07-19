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

interface PublicOrderCreatePayload {
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

interface PublicOrderCreateResponse {
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

export interface PaginationMetadata {
  page: number;
  per_page: number;
  total: number;
  total_pages: number;
}

interface PaginatedResponse<T> {
  data: T[];
  pagination: PaginationMetadata;
}

type ListProductsParams = {
  category?: string;
  all?: boolean;
  page?: number;
  perPage?: number;
};

type ListCategoriesParams = {
  all?: boolean;
  page?: number;
  perPage?: number;
};

// ── Client-side cache for public catalog requests ─────────────────────

type CacheEntry<T> = { value: T; expiresAt: number };
const catalogCache = new Map<string, CacheEntry<unknown>>();
const DEFAULT_CACHE_TTL_MS = 60_000;

function cacheKey(path: string, params: Record<string, string>): string {
  const search = new URLSearchParams(params).toString();
  return search ? `${path}?${search}` : path;
}

function getCached<T>(key: string): T | undefined {
  const entry = catalogCache.get(key);
  if (!entry) return undefined;
  if (Date.now() > entry.expiresAt) {
    catalogCache.delete(key);
    return undefined;
  }
  return entry.value as T;
}

function setCached<T>(
  key: string,
  value: T,
  ttlMs = DEFAULT_CACHE_TTL_MS,
): void {
  catalogCache.set(key, { value, expiresAt: Date.now() + ttlMs });
}

function buildQueryParams(
  params: ListProductsParams | ListCategoriesParams,
): Record<string, string> {
  const query: Record<string, string> = {};
  if ("category" in params && params.category) {
    query.category = params.category;
  }
  if (params.all) {
    query.all = "true";
  } else {
    if (params.page !== undefined) query.page = String(params.page);
    if (params.perPage !== undefined) query.per_page = String(params.perPage);
  }
  return query;
}

function extractData<T>(res: { data: T[] } | T[] | PaginatedResponse<T>): T[] {
  if (Array.isArray(res)) return res;
  return res.data ?? [];
}

// ── Public catalog endpoints ──────────────────────────────────────────

export async function listPublicCategories(
  params: ListCategoriesParams = { all: true },
): Promise<PublicCategory[]> {
  const query = buildQueryParams(params);
  const key = cacheKey("/api/store/categories", query);
  const cached = getCached<PublicCategory[]>(key);
  if (cached) return cached;

  const search = new URLSearchParams(query).toString();
  const path = `/api/store/categories${search ? `?${search}` : ""}`;
  const res = await bffRequest<
    | { data: PublicCategory[] }
    | PublicCategory[]
    | PaginatedResponse<PublicCategory>
  >(path);
  const data = extractData(res);
  setCached(key, data);
  return data;
}

export async function listPublicProducts(
  params: ListProductsParams = { all: true },
): Promise<PublicProduct[]> {
  const query = buildQueryParams(params);
  const key = cacheKey("/api/store/products", query);
  const cached = getCached<PublicProduct[]>(key);
  if (cached) return cached;

  const search = new URLSearchParams(query).toString();
  const path = `/api/store/products${search ? `?${search}` : ""}`;
  const res = await bffRequest<
    | { data: PublicProduct[] }
    | PublicProduct[]
    | PaginatedResponse<PublicProduct>
  >(path);
  const data = extractData(res);
  setCached(key, data);
  return data;
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

interface StorePublicSettings {
  orders_enabled: boolean;
  offers: StoreOfferItem[];
}

export async function fetchStoreSettings(): Promise<StorePublicSettings> {
  return bffRequest<StorePublicSettings>("/api/store/settings");
}
