/**
 * BFF Client for Admin Dashboard
 *
 * This module provides type-safe wrappers around the BFF endpoints.
 * All requests automatically use HttpOnly cookies for auth.
 */

import { ApiError } from "@core/errors";
import { getAdminImageUploadMaxMB } from "@core/config";
import type {
  AdminImage,
  Employee as LocalEmployee,
  Order as LocalOrder,
  User as LocalUser,
  UserOrderHistoryItem as LocalUserOrder,
} from "./api";
import type {
  Addon,
  ArchiveOrderRequest,
  Category,
  CreateAddonRequest,
  CreateCategoryRequest,
  CreateEmployeeRequest,
  CreateFlavorRequest,
  CreateOrderRequest,
  CreateUserRequest,
  Flavor,
  MessageResponse,
  PaginatedList,
  PaginationInfo,
  Product,
  ProductCreatePayload,
  ProductUpdatePayload,
  RejectOrderRequest,
  UpdateAddonRequest,
  UpdateCategoryRequest,
  UpdateEmployeeRequest,
  UpdateFlavorRequest,
  UpdateOrderNotesRequest,
  UpdateOrderRequest,
  UpdateOrderStatusRequest,
  UpdateUserRequest,
} from "@api-types/api";
import type { PanelConfigValues } from "../types/settings";

export interface AnalyticsPaymentMethodSummary {
  revenue: number;
  count: number;
}

export interface AnalyticsOverview {
  period: "week" | "month" | "year" | "custom";
  total_orders: number;
  total_revenue: number;
  avg_order_value: number;
  status_breakdown: Record<string, number>;
  payment_method_breakdown?: Record<string, AnalyticsPaymentMethodSummary>;
}

export interface AnalyticsTimelinePoint {
  date: string;
  count: number;
  revenue: number;
}

export interface AnalyticsTopProduct {
  name: string;
  total_sold: number;
  total_value: number;
}

export type OrderStatus =
  | "pendiente_revision"
  | "recibida"
  | "en_proceso"
  | "lista"
  | "entregada"
  | "cancelada";

type ParsedResponseBody = Record<string, unknown> | string | null;

const ADMIN_IMAGE_UPLOAD_MAX_MB = getAdminImageUploadMaxMB();
const ADMIN_IMAGE_UPLOAD_MAX_BYTES = ADMIN_IMAGE_UPLOAD_MAX_MB * 1024 * 1024;

async function parseResponseBody(
  response: Response,
): Promise<ParsedResponseBody> {
  const contentType = response.headers.get("content-type") ?? "";
  if (contentType.includes("application/json")) {
    try {
      return (await response.json()) as Record<string, unknown>;
    } catch {
      return null;
    }
  }

  try {
    const text = await response.text();
    return text.trim() || null;
  } catch {
    return null;
  }
}

function responseErrorMessage(
  body: ParsedResponseBody,
  fallback: string,
): string {
  if (!body) return fallback;
  if (typeof body === "string") {
    if (body.includes("FUNCTION_PAYLOAD_TOO_LARGE")) {
      return `La imagen excede el limite del servidor proxy. Usa un archivo de maximo ${ADMIN_IMAGE_UPLOAD_MAX_MB} MB.`;
    }
    return body;
  }

  const error = body.error;
  if (typeof error === "string" && error.trim()) return error;

  const message = body.message;
  if (typeof message === "string" && message.trim()) return message;

  return fallback;
}

function responseErrorCode(body: ParsedResponseBody, fallback: string): string {
  if (
    body &&
    typeof body !== "string" &&
    typeof body.code === "string" &&
    body.code.trim()
  ) {
    return body.code;
  }
  return fallback;
}

async function bffRequest<T>(
  path: string,
  options: {
    method?: "GET" | "POST" | "PATCH" | "DELETE";
    body?: unknown;
    query?: Record<string, string | number | boolean>;
    headers?: Record<string, string>;
    timeoutMs?: number;
  } = {},
): Promise<T> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...options.headers,
  };

  let fullPath = path;
  if (options.query) {
    const params = new URLSearchParams();
    Object.entries(options.query).forEach(([key, value]) => {
      params.set(key, String(value));
    });
    fullPath = `${path}?${params.toString()}`;
  }

  const url = new URL(fullPath, window.location.origin);

  const controller = new AbortController();
  const timeoutMs = options.timeoutMs ?? 12000;
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url.toString(), {
      method: options.method ?? "GET",
      headers,
      body: options.body ? JSON.stringify(options.body) : undefined,
      credentials: "include",
      signal: controller.signal,
    });

    const body = await parseResponseBody(response);

    if (!response.ok) {
      throw new ApiError(
        responseErrorMessage(body, "Request failed"),
        response.status,
        responseErrorCode(body, "BFF_ERROR"),
      );
    }

    if (!body || typeof body === "string") {
      return {} as T;
    }

    return body as T;
  } catch (error) {
    if (error instanceof ApiError) throw error;
    if (error instanceof DOMException && error.name === "AbortError") {
      throw new ApiError("Request timed out", 504, "TIMEOUT");
    }
    throw new ApiError(
      error instanceof Error ? error.message : "BFF request failed",
      0,
      "BFF_ERROR",
    );
  } finally {
    clearTimeout(timeout);
  }
}

// Orders
export async function listOrders(
  status?: string,
  archived = false,
  page = 1,
  perPage = 20,
) {
  const query: Record<string, string> = { lite: "true" };
  if (status) query.status = status;
  if (archived) query.archived = "true";
  query.page = String(page);
  query.per_page = String(perPage);

  const res = await bffRequest<PaginatedList<LocalOrder>>("/api/admin/orders", {
    query,
  });

  if (Array.isArray(res)) {
    return {
      orders: res,
      pagination: {
        page: 1,
        perPage: res.length,
        total: res.length,
        totalPages: 1,
      },
    };
  }

  const data = res?.data ?? [];
  const pg = res?.pagination;
  return {
    orders: data,
    pagination: pg
      ? {
          page: pg.page ?? 1,
          perPage: pg.per_page ?? perPage,
          total: pg.total ?? data.length,
          totalPages: pg.total_pages ?? 1,
        }
      : {
          page: 1,
          perPage,
          total: data.length,
          totalPages: 1,
        },
  };
}

export async function pollOrders(
  status?: string,
  archived = false,
  page = 1,
  perPage = 20,
  lastModified?: string | null,
): Promise<{
  notModified: boolean;
  orders: LocalOrder[];
  pagination: PaginationInfo;
  lastModified: string | null;
}> {
  const query: Record<string, string> = { lite: "true" };
  if (status) query.status = status;
  if (archived) query.archived = "true";
  query.page = String(page);
  query.per_page = String(perPage);

  const headers: Record<string, string> = {};
  if (lastModified) {
    headers["If-Modified-Since"] = lastModified;
  }

  const url = new URL("/api/admin/orders", window.location.origin);
  Object.entries(query).forEach(([key, value]) => {
    url.searchParams.set(key, value);
  });

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30_000);

  try {
    const response = await fetch(url.toString(), {
      method: "GET",
      headers,
      credentials: "include",
      signal: controller.signal,
    });

    const responseLastModified = response.headers.get("last-modified");

    if (response.status === 304) {
      return {
        notModified: true,
        orders: [],
        pagination: { page, perPage, total: 0, totalPages: 1 },
        lastModified: responseLastModified ?? lastModified ?? null,
      };
    }

    const body = await parseResponseBody(response);

    if (!response.ok) {
      throw new ApiError(
        responseErrorMessage(body, "Request failed"),
        response.status,
        responseErrorCode(body, "BFF_ERROR"),
      );
    }

    const res = body as PaginatedList<LocalOrder>;
    if (Array.isArray(res)) {
      return {
        notModified: false,
        orders: res,
        pagination: {
          page: 1,
          perPage: res.length,
          total: res.length,
          totalPages: 1,
        },
        lastModified: responseLastModified ?? lastModified ?? null,
      };
    }

    const data = res?.data ?? [];
    const pg = res?.pagination;
    return {
      notModified: false,
      orders: data,
      pagination: pg
        ? {
            page: pg.page ?? 1,
            perPage: pg.per_page ?? perPage,
            total: pg.total ?? data.length,
            totalPages: pg.total_pages ?? 1,
          }
        : { page: 1, perPage, total: data.length, totalPages: 1 },
      lastModified: responseLastModified ?? lastModified ?? null,
    };
  } catch (error) {
    if (error instanceof ApiError) throw error;
    if (error instanceof DOMException && error.name === "AbortError") {
      throw new ApiError("Request timed out", 504, "TIMEOUT");
    }
    throw new ApiError(
      error instanceof Error ? error.message : "BFF request failed",
      0,
      "BFF_ERROR",
    );
  } finally {
    clearTimeout(timeout);
  }
}

export async function archiveOrder(id: string, archived: boolean) {
  return bffRequest<LocalOrder>(`/api/admin/orders/${id}/archive`, {
    method: "PATCH",
    body: { archived } satisfies ArchiveOrderRequest,
  });
}

export async function runArchive() {
  return bffRequest<{ archived: number; message: string }>(
    "/api/admin/orders/archive/run",
    {
      method: "POST",
      body: {},
    },
  );
}

export async function getOrder(id: string) {
  return bffRequest<LocalOrder>(`/api/admin/orders/${id}`);
}

export async function createOrder(
  payload: CreateOrderRequest,
  idempotencyKey?: string,
) {
  const headers: Record<string, string> = {};
  if (idempotencyKey) {
    headers["Idempotency-Key"] = idempotencyKey;
  }
  return bffRequest<LocalOrder>("/api/admin/orders", {
    method: "POST",
    headers,
    body: payload,
  });
}

export async function updateOrder(id: string, payload: UpdateOrderRequest) {
  return bffRequest<LocalOrder>(`/api/admin/orders/${id}`, {
    method: "PATCH",
    body: payload,
  });
}

export async function approveOrder(id: string) {
  return bffRequest<LocalOrder>(`/api/admin/orders/${id}`, {
    method: "POST",
    body: {},
    query: { action: "approve" },
  });
}

export async function rejectOrder(id: string, reason: string) {
  return bffRequest<LocalOrder>(`/api/admin/orders/${id}`, {
    method: "POST",
    body: { reason } satisfies RejectOrderRequest,
    query: { action: "reject" },
  });
}

export async function updateOrderStatus(id: string, status: string) {
  return bffRequest<LocalOrder>(`/api/admin/orders/${id}`, {
    method: "PATCH",
    body: { status } satisfies UpdateOrderStatusRequest,
    query: { action: "status" },
  });
}

export async function updateOrderNotes(id: string, notes: string | null) {
  return bffRequest<LocalOrder>(`/api/admin/orders/${id}`, {
    method: "PATCH",
    body: { notes } satisfies UpdateOrderNotesRequest,
    query: { action: "notes" },
  });
}

export async function deleteOrder(id: string) {
  return bffRequest<MessageResponse>(`/api/admin/orders/${id}`, {
    method: "DELETE",
  });
}

// Categories
export async function listCategories(includeAll = false) {
  const query = includeAll ? { all: true } : undefined;
  const res = await bffRequest<PaginatedList<Category>>(
    "/api/admin/categories",
    {
      query,
    },
  );
  return Array.isArray(res) ? res : (res?.data ?? []);
}

export async function createCategory(payload: CreateCategoryRequest) {
  return bffRequest<Category>("/api/admin/categories", {
    method: "POST",
    body: payload,
  });
}

export async function updateCategory(
  id: string,
  payload: UpdateCategoryRequest,
) {
  return bffRequest<Category>(`/api/admin/categories/${id}`, {
    method: "PATCH",
    body: payload,
  });
}

export async function deleteCategory(id: string) {
  return bffRequest<MessageResponse>(`/api/admin/categories/${id}`, {
    method: "DELETE",
  });
}

// Products
export async function listProducts(
  options: { page?: number; perPage?: number; all?: boolean } = {},
) {
  const { page = 1, perPage = 20, all = false } = options;
  const query: Record<string, string | boolean> = { all };
  if (!all) {
    query.page = String(page);
    query.per_page = String(perPage);
  }

  const res = await bffRequest<PaginatedList<Product>>("/api/admin/products", {
    query,
  });

  if (Array.isArray(res)) {
    return {
      products: res,
      pagination: {
        page: 1,
        perPage: res.length,
        total: res.length,
        totalPages: 1,
      },
    };
  }

  const data = res?.data ?? [];
  const pg = res?.pagination;
  return {
    products: data,
    pagination: pg
      ? {
          page: pg.page ?? 1,
          perPage: pg.per_page ?? perPage,
          total: pg.total ?? data.length,
          totalPages: pg.total_pages ?? 1,
        }
      : {
          page: 1,
          perPage,
          total: data.length,
          totalPages: 1,
        },
  };
}

export async function createProduct(payload: ProductCreatePayload) {
  return bffRequest<Product>("/api/admin/products", {
    method: "POST",
    body: payload,
  });
}

export async function updateProduct(id: string, payload: ProductUpdatePayload) {
  return bffRequest<Product>(`/api/admin/products/${id}`, {
    method: "PATCH",
    body: payload,
  });
}

export async function deleteProduct(id: string) {
  return bffRequest<MessageResponse>(`/api/admin/products/${id}`, {
    method: "DELETE",
  });
}

// Product Flavors and Addons
export async function linkProductFlavor(productId: string, flavorId: string) {
  return bffRequest<MessageResponse>(
    `/api/admin/products/${productId}/flavors/${flavorId}`,
    {
      method: "POST",
    },
  );
}

export async function unlinkProductFlavor(productId: string, flavorId: string) {
  return bffRequest<MessageResponse>(
    `/api/admin/products/${productId}/flavors/${flavorId}`,
    {
      method: "DELETE",
    },
  );
}

export async function linkProductAddon(productId: string, addonId: string) {
  return bffRequest<MessageResponse>(
    `/api/admin/products/${productId}/addons/${addonId}`,
    {
      method: "POST",
    },
  );
}

export async function unlinkProductAddon(productId: string, addonId: string) {
  return bffRequest<MessageResponse>(
    `/api/admin/products/${productId}/addons/${addonId}`,
    {
      method: "DELETE",
    },
  );
}

// Images
export async function listAdminImages() {
  const response = await bffRequest<{ images?: AdminImage[] }>(
    "/api/admin/images",
  );
  return response;
}

export async function uploadAdminImage(
  file: File,
  folder = "",
): Promise<{ path: string; message: string }> {
  if (file.size > ADMIN_IMAGE_UPLOAD_MAX_BYTES) {
    throw new ApiError(
      `La imagen es demasiado grande. Tamano maximo: ${ADMIN_IMAGE_UPLOAD_MAX_MB} MB.`,
      413,
      "UPLOAD_TOO_LARGE",
    );
  }

  const formData = new FormData();
  formData.append("image", file);
  if (folder.trim()) {
    formData.append("folder", folder.trim());
  }

  try {
    const response = await fetch("/api/admin/images", {
      method: "POST",
      body: formData,
      credentials: "include",
    });

    const body = await parseResponseBody(response);

    if (!response.ok) {
      throw new ApiError(
        responseErrorMessage(body, "Upload failed"),
        response.status,
      );
    }

    if (!body || typeof body === "string") {
      throw new ApiError(
        "Upload failed: invalid response",
        response.status,
        "UPLOAD_ERROR",
      );
    }

    return body as { path: string; message: string };
  } catch (error) {
    if (error instanceof ApiError) throw error;
    throw new ApiError(
      error instanceof Error ? error.message : "Upload failed",
      0,
      "UPLOAD_ERROR",
    );
  }
}

export async function deleteAdminImage(path: string) {
  return bffRequest<MessageResponse>("/api/admin/images", {
    method: "DELETE",
    body: { path },
  });
}

// Employees
export async function listEmployees() {
  const res = await bffRequest<PaginatedList<LocalEmployee>>(
    "/api/admin/employees",
  );
  return Array.isArray(res) ? res : (res?.data ?? []);
}

export async function createEmployee(payload: CreateEmployeeRequest) {
  return bffRequest<LocalEmployee>("/api/admin/employees", {
    method: "POST",
    body: payload,
  });
}

export async function updateEmployee(
  id: string,
  payload: UpdateEmployeeRequest,
) {
  return bffRequest<LocalEmployee>(`/api/admin/employees/${id}`, {
    method: "PATCH",
    body: payload,
  });
}

export async function deleteEmployee(id: string) {
  return bffRequest<MessageResponse>(`/api/admin/employees/${id}`, {
    method: "DELETE",
  });
}

export async function deactivateEmployee(id: string) {
  return bffRequest<MessageResponse>(`/api/admin/employees/${id}`, {
    method: "DELETE",
    query: { action: "deactivate" },
  });
}

export async function resetLoginLockout(payload: {
  employee_id?: string;
  email?: string;
}) {
  return bffRequest<MessageResponse>("/api/admin/auth/lockout/reset", {
    method: "POST",
    body: payload,
  });
}

// Users (customer directory)
export async function listUsers(status?: string, search?: string) {
  const query: Record<string, string> = {};
  if (status) query.status = status;
  if (search) query.search = search;
  const res = await bffRequest<PaginatedList<LocalUser>>("/api/admin/users", {
    query: Object.keys(query).length > 0 ? query : undefined,
  });
  return Array.isArray(res) ? res : (res?.data ?? []);
}

export async function getUser(id: string) {
  return bffRequest<LocalUser>(`/api/admin/users/${id}`);
}

export async function createUser(payload: CreateUserRequest) {
  return bffRequest<LocalUser>("/api/admin/users", {
    method: "POST",
    body: payload,
  });
}

export async function upsertUser(payload: CreateUserRequest) {
  return bffRequest<LocalUser>("/api/admin/users/upsert", {
    method: "POST",
    body: payload,
  });
}

export async function updateUser(id: string, payload: UpdateUserRequest) {
  return bffRequest<LocalUser>(`/api/admin/users/${id}`, {
    method: "PATCH",
    body: payload,
  });
}

export async function deleteUser(id: string) {
  return bffRequest<MessageResponse>(`/api/admin/users/${id}`, {
    method: "DELETE",
  });
}

export async function listUserOrders(id: string, limit = 50) {
  return bffRequest<{ orders: LocalUserOrder[] }>(
    `/api/admin/users/${id}/orders`,
    {
      query: { limit },
    },
  );
}

// Admin settings
export async function getAdminTabsSettings() {
  return bffRequest<{ tab_order: string[] }>("/api/admin/settings/tabs");
}

export async function updateAdminTabsSettings(tabOrder: string[]) {
  return bffRequest<{ tab_order: string[] }>("/api/admin/settings/tabs", {
    method: "PATCH",
    body: { tab_order: tabOrder },
  });
}

export async function getAdminPanelConfig() {
  return bffRequest<PanelConfigValues>("/api/admin/settings/panel-config");
}

export async function updateAdminPanelConfig(payload: PanelConfigValues) {
  return bffRequest<PanelConfigValues>("/api/admin/settings/panel-config", {
    method: "PATCH",
    body: payload,
  });
}

// Flavors
export async function listFlavors(includeAll = false) {
  const query = includeAll ? { all: true } : undefined;
  const res = await bffRequest<PaginatedList<Flavor>>("/api/admin/flavors", {
    query,
  });
  return Array.isArray(res) ? res : (res?.data ?? []);
}

export async function createFlavor(payload: CreateFlavorRequest) {
  return bffRequest<Flavor>("/api/admin/flavors", {
    method: "POST",
    body: payload,
  });
}

export async function updateFlavor(id: string, payload: UpdateFlavorRequest) {
  return bffRequest<Flavor>(`/api/admin/flavors/${id}`, {
    method: "PATCH",
    body: payload,
  });
}

export async function deleteFlavor(id: string) {
  return bffRequest<MessageResponse>(`/api/admin/flavors/${id}`, {
    method: "DELETE",
  });
}

// Addons
export async function listAddons(includeAll = false) {
  const query = includeAll ? { all: true } : undefined;
  const res = await bffRequest<PaginatedList<Addon>>("/api/admin/addons", {
    query,
  });
  return Array.isArray(res) ? res : (res?.data ?? []);
}

export async function createAddon(payload: CreateAddonRequest) {
  return bffRequest<Addon>("/api/admin/addons", {
    method: "POST",
    body: payload,
  });
}

export async function updateAddon(id: string, payload: UpdateAddonRequest) {
  return bffRequest<Addon>(`/api/admin/addons/${id}`, {
    method: "PATCH",
    body: payload,
  });
}

export async function deleteAddon(id: string) {
  return bffRequest<MessageResponse>(`/api/admin/addons/${id}`, {
    method: "DELETE",
  });
}

// Analytics
const ANALYTICS_TIMEOUT_MS = 60_000;
const EXPORT_TIMEOUT_MS = 120_000;

export async function getAnalyticsDashboard(
  start: string,
  end: string,
  groupBy: "day" | "week" | "month" = "day",
  limit = 10,
) {
  return bffRequest<{
    overview: AnalyticsOverview;
    orders_over_time: AnalyticsTimelinePoint[];
    top_products: AnalyticsTopProduct[];
  }>("/api/admin/analytics/dashboard", {
    query: { start, end, groupBy, limit },
    timeoutMs: ANALYTICS_TIMEOUT_MS,
  });
}

// Export
export async function exportOrders(
  start: string,
  end: string,
  format: "csv" | "json",
  statuses?: OrderStatus[],
): Promise<Blob> {
  const url = new URL("/api/admin/export/orders", window.location.origin);
  url.searchParams.set("start", start);
  url.searchParams.set("end", end);
  url.searchParams.set("format", format);
  if (statuses && statuses.length > 0) {
    url.searchParams.set("statuses", statuses.join(","));
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), EXPORT_TIMEOUT_MS);

  try {
    const response = await fetch(url.toString(), {
      method: "GET",
      credentials: "include",
      signal: controller.signal,
    });

    if (!response.ok) {
      let message = "Export failed";
      const body = await parseResponseBody(response);
      message = responseErrorMessage(body, message);
      throw new ApiError(message, response.status, "EXPORT_ERROR");
    }

    return response.blob();
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      throw new ApiError("Export timed out", 504, "TIMEOUT");
    }
    if (error instanceof ApiError) throw error;
    throw new ApiError(
      error instanceof Error ? error.message : "Export failed",
      0,
      "EXPORT_ERROR",
    );
  } finally {
    clearTimeout(timeout);
  }
}

export async function purgeOrdersByStatuses(
  start: string,
  end: string,
  statuses: OrderStatus[],
) {
  return bffRequest<{
    message: string;
    archived_count?: number;
    deleted_count?: number;
    deleted_items_count?: number;
    statuses?: string[];
  }>("/api/admin/export/orders", {
    method: "DELETE",
    query: {
      start,
      end,
      statuses: statuses.join(","),
    },
    timeoutMs: EXPORT_TIMEOUT_MS,
  });
}

// ── Store Settings (kill switch + offers) ────────────────────────────

export interface StoreOfferItem {
  product_id: string;
  label: string;
  note?: string;
  discount_price?: number;
  flavor_id?: string;
  flavor_ids?: string[];
  expires_at: string;
}

export async function getAdminStoreSettings() {
  return bffRequest<{ orders_enabled: boolean; offers: StoreOfferItem[] }>(
    "/api/admin/settings/store",
  );
}

export async function updateAdminStoreSettings(payload: {
  orders_enabled: boolean;
  offers: StoreOfferItem[];
}) {
  return bffRequest<{ orders_enabled: boolean; offers: StoreOfferItem[] }>(
    "/api/admin/settings/store",
    {
      method: "PATCH",
      body: payload,
    },
  );
}

// ── Order Archive Settings ───────────────────────────────────────────

export interface OrderArchiveConfig {
  enabled: boolean;
  age_days: number;
  interval_minutes: number;
}

export async function getOrderArchiveConfig() {
  return bffRequest<OrderArchiveConfig>("/api/admin/settings/archive");
}

export async function updateOrderArchiveConfig(payload: OrderArchiveConfig) {
  return bffRequest<OrderArchiveConfig>("/api/admin/settings/archive", {
    method: "PATCH",
    body: payload,
  });
}

// ── Inventory ──────────────────────────────────────────────────────

export interface InventoryItem {
  id: string;
  name: string;
  type: "ball_based" | "unit_based";
  current_stock: number;
  low_stock_threshold: number;
  product_id?: string;
  product?: { id: string; name: string };
  flavor_id?: string;
  flavor?: { id: string; name: string };
  created_at: string;
  updated_at: string;
}

export interface StockMovement {
  id: string;
  inventory_item_id: string;
  type: "entry" | "sale" | "adjustment";
  quantity: number;
  quantity_containers?: number;
  container_type_id?: string;
  flavor_id?: string;
  order_id?: string;
  reason?: string;
  created_by_user_id?: string;
  created_at: string;
}

export interface InventoryStats {
  total_items: number;
  ball_based_items: number;
  unit_based_items: number;
  out_of_stock_items: number;
  low_stock_items: number;
  healthy_items: number;
}

export async function listInventoryItems() {
  const res = await bffRequest<PaginatedList<InventoryItem>>(
    "/api/admin/inventory",
  );
  if (Array.isArray(res)) {
    return {
      items: res,
      pagination: { page: 1, limit: 50, total: res.length, totalPages: 1 },
    };
  }
  const data = res?.data ?? [];
  const pg = res?.pagination;
  return {
    items: data,
    pagination: pg
      ? {
          page: pg.page ?? 1,
          limit: pg.per_page ?? 50,
          total: pg.total ?? data.length,
          totalPages: pg.total_pages ?? 1,
        }
      : { page: 1, limit: 50, total: data.length, totalPages: 1 },
  };
}

export async function getInventoryItem(id: string) {
  return bffRequest<InventoryItem>(`/api/admin/inventory/${id}`);
}

export async function recordInventoryEntry(
  flavorId: string,
  payload: {
    container_type_id: string;
    quantity_containers: number;
    balls_per_container?: number;
  },
) {
  return bffRequest<StockMovement>(`/api/admin/inventory/${flavorId}/entries`, {
    method: "POST",
    body: payload,
  });
}

export async function recordInventoryAdjustment(
  id: string,
  payload: {
    quantity: number;
    reason: string;
  },
) {
  return bffRequest<StockMovement>(`/api/admin/inventory/${id}/adjustments`, {
    method: "POST",
    body: payload,
  });
}

export async function getInventoryDashboard() {
  return bffRequest<{
    flavor_items: InventoryItem[];
    unit_items: InventoryItem[];
    stats: InventoryStats;
  }>("/api/admin/inventory/dashboard");
}

export async function getLowStockItems() {
  const res = await bffRequest<PaginatedList<InventoryItem>>(
    "/api/admin/inventory/low-stock",
  );
  return Array.isArray(res) ? res : (res?.data ?? []);
}

export async function getInventoryMovements(
  id: string,
  limit = 50,
  offset = 0,
) {
  const res = await bffRequest<{
    data: StockMovement[];
    total: number;
    limit: number;
    offset: number;
    total_pages: number;
  }>(`/api/admin/inventory/${id}/movements`, {
    query: { limit, offset },
  });
  return {
    movements: Array.isArray(res) ? res : (res?.data ?? []),
    total: res?.total ?? 0,
    limit: res?.limit ?? limit,
    offset: res?.offset ?? offset,
    totalPages: res?.total_pages ?? 1,
  };
}

export async function getInventoryStats() {
  return bffRequest<InventoryStats>("/api/admin/inventory/stats");
}

export async function recordUnitInventoryEntry(
  inventoryId: string,
  payload: {
    quantity: number;
  },
) {
  return bffRequest<StockMovement>(
    `/api/admin/inventory/${inventoryId}/unit-entries`,
    {
      method: "POST",
      body: payload,
    },
  );
}

// ── Container Types ─────────────────────────────────────────────────

export interface ContainerType {
  id: string;
  name: string;
  balls_per_container: number;
  is_custom: boolean;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export async function listContainerTypes() {
  const res = await bffRequest<PaginatedList<ContainerType>>(
    "/api/admin/container-types",
  );
  return Array.isArray(res) ? res : (res?.data ?? []);
}

export async function createContainerType(payload: {
  name: string;
  balls_per_container: number;
  is_custom: boolean;
}) {
  return bffRequest<ContainerType>("/api/admin/container-types", {
    method: "POST",
    body: payload,
  });
}

export async function updateContainerType(
  id: string,
  payload: {
    name?: string;
    balls_per_container?: number;
    is_custom?: boolean;
    is_active?: boolean;
  },
) {
  return bffRequest<ContainerType>(`/api/admin/container-types/${id}`, {
    method: "PATCH",
    body: payload,
  });
}

export async function deleteContainerType(id: string) {
  return bffRequest<MessageResponse>(`/api/admin/container-types/${id}`, {
    method: "DELETE",
  });
}
