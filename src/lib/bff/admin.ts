/**
 * BFF Client for Admin Dashboard
 *
 * This module provides type-safe wrappers around the BFF endpoints.
 * All requests automatically use HttpOnly cookies for auth.
 */

import { ApiError } from '../errors/api';

export interface BFFResponse<T> {
  data?: T;
  error?: string;
  code?: string;
}

export interface AnalyticsOverview {
  period: 'week' | 'month' | 'year';
  total_orders: number;
  total_revenue: number;
  avg_order_value: number;
  status_breakdown: Record<string, number>;
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
  | 'pendiente_revision'
  | 'recibida'
  | 'en_proceso'
  | 'lista'
  | 'entregada'
  | 'cancelada';

async function bffRequest<T>(
  path: string,
  options: {
    method?: 'GET' | 'POST' | 'PATCH' | 'DELETE';
    body?: unknown;
    query?: Record<string, string | number | boolean>;
  } = {},
): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
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

  try {
    const response = await fetch(url.toString(), {
      method: options.method ?? 'GET',
      headers,
      body: options.body ? JSON.stringify(options.body) : undefined,
      credentials: 'include',
    });

    const data = (await response.json()) as BFFResponse<T> & T;

    if (!response.ok) {
      const message = (data as any)?.error || (data as any)?.message || 'Request failed';
      throw new ApiError(message, response.status, (data as any)?.code || 'BFF_ERROR');
    }

    return data;
  } catch (error) {
    if (error instanceof ApiError) throw error;
    throw new ApiError(
      error instanceof Error ? error.message : 'BFF request failed',
      0,
      'BFF_ERROR'
    );
  }
}

// Orders
export async function listOrders(status?: string) {
  const query = status ? { status } : undefined;
  return bffRequest<any>('/api/admin/orders', { query });
}

export async function getOrder(id: string) {
  return bffRequest<any>(`/api/admin/orders/${id}`);
}

export async function createOrder(payload: any) {
  return bffRequest<any>('/api/admin/orders', {
    method: 'POST',
    body: payload,
  });
}

export async function updateOrder(id: string, payload: any) {
  return bffRequest<any>(`/api/admin/orders/${id}`, {
    method: 'PATCH',
    body: payload,
  });
}

export async function approveOrder(id: string) {
  return bffRequest<any>(`/api/admin/orders/${id}`, {
    method: 'POST',
    body: {},
    query: { action: 'approve' },
  });
}

export async function rejectOrder(id: string, reason: string) {
  return bffRequest<any>(`/api/admin/orders/${id}`, {
    method: 'POST',
    body: { reason },
    query: { action: 'reject' },
  });
}

export async function updateOrderStatus(id: string, status: string) {
  return bffRequest<any>(`/api/admin/orders/${id}`, {
    method: 'PATCH',
    body: { status },
    query: { action: 'status' },
  });
}

export async function updateOrderNotes(id: string, notes: string | null) {
  return bffRequest<any>(`/api/admin/orders/${id}`, {
    method: 'PATCH',
    body: { notes },
    query: { action: 'notes' },
  });
}

export async function deleteOrder(id: string) {
  return bffRequest<any>(`/api/admin/orders/${id}`, {
    method: 'DELETE',
  });
}

// Categories
export async function listCategories(includeAll = false) {
  const query = includeAll ? { all: true } : undefined;
  return bffRequest<any>('/api/admin/categories', { query });
}

export async function createCategory(payload: any) {
  return bffRequest<any>('/api/admin/categories', {
    method: 'POST',
    body: payload,
  });
}

export async function updateCategory(id: string, payload: any) {
  return bffRequest<any>(`/api/admin/categories/${id}`, {
    method: 'PATCH',
    body: payload,
  });
}

export async function deleteCategory(id: string) {
  return bffRequest<any>(`/api/admin/categories/${id}`, {
    method: 'DELETE',
  });
}

// Products
export async function listProducts() {
  return bffRequest<any>('/api/admin/products', { query: { all: true } });
}

export async function createProduct(payload: any) {
  return bffRequest<any>('/api/admin/products', {
    method: 'POST',
    body: payload,
  });
}

export async function updateProduct(id: string, payload: any) {
  return bffRequest<any>(`/api/admin/products/${id}`, {
    method: 'PATCH',
    body: payload,
  });
}

export async function deleteProduct(id: string) {
  return bffRequest<any>(`/api/admin/products/${id}`, {
    method: 'DELETE',
  });
}

// Product Flavors and Addons
export async function linkProductFlavor(productId: string, flavorId: string) {
  return bffRequest<any>(`/api/admin/products/${productId}/flavors/${flavorId}`, {
    method: 'POST',
  });
}

export async function unlinkProductFlavor(productId: string, flavorId: string) {
  return bffRequest<any>(`/api/admin/products/${productId}/flavors/${flavorId}`, {
    method: 'DELETE',
  });
}

export async function linkProductAddon(productId: string, addonId: string) {
  return bffRequest<any>(`/api/admin/products/${productId}/addons/${addonId}`, {
    method: 'POST',
  });
}

export async function unlinkProductAddon(productId: string, addonId: string) {
  return bffRequest<any>(`/api/admin/products/${productId}/addons/${addonId}`, {
    method: 'DELETE',
  });
}

// Images
export async function listAdminImages() {
  const response = await bffRequest<{ images?: any[] }>('/api/admin/images');
  return response;
}

export async function uploadAdminImage(file: File, folder = ''): Promise<{ path: string; message: string }> {
  const formData = new FormData();
  formData.append('image', file);
  if (folder.trim()) {
    formData.append('folder', folder.trim());
  }

  try {
    const response = await fetch('/api/admin/images', {
      method: 'POST',
      body: formData,
      credentials: 'include',
    });

    const data = await response.json();

    if (!response.ok) {
      throw new ApiError(data.error || 'Upload failed', response.status);
    }

    return data;
  } catch (error) {
    if (error instanceof ApiError) throw error;
    throw new ApiError(
      error instanceof Error ? error.message : 'Upload failed',
      0,
      'UPLOAD_ERROR'
    );
  }
}

export async function deleteAdminImage(path: string) {
  return bffRequest<any>('/api/admin/images', {
    method: 'DELETE',
    body: { path },
  });
}

// Employees
export async function listEmployees() {
  return bffRequest<any>('/api/admin/employees');
}

export async function createEmployee(payload: any) {
  return bffRequest<any>('/api/admin/employees', {
    method: 'POST',
    body: payload,
  });
}

export async function updateEmployee(id: string, payload: any) {
  return bffRequest<any>(`/api/admin/employees/${id}`, {
    method: 'PATCH',
    body: payload,
  });
}

export async function deleteEmployee(id: string) {
  return bffRequest<any>(`/api/admin/employees/${id}`, {
    method: 'DELETE',
  });
}

export async function deactivateEmployee(id: string) {
  return bffRequest<any>(`/api/admin/employees/${id}`, {
    method: 'DELETE',
    query: { action: 'deactivate' },
  });
}

// Users (customer directory)
export async function listUsers(status?: string, search?: string) {
  const query: Record<string, string> = {};
  if (status) query.status = status;
  if (search) query.search = search;
  return bffRequest<any>('/api/admin/users', {
    query: Object.keys(query).length > 0 ? query : undefined,
  });
}

export async function getUser(id: string) {
  return bffRequest<any>(`/api/admin/users/${id}`);
}

export async function createUser(payload: any) {
  return bffRequest<any>('/api/admin/users', {
    method: 'POST',
    body: payload,
  });
}

export async function updateUser(id: string, payload: any) {
  return bffRequest<any>(`/api/admin/users/${id}`, {
    method: 'PATCH',
    body: payload,
  });
}

export async function deleteUser(id: string) {
  return bffRequest<any>(`/api/admin/users/${id}`, {
    method: 'DELETE',
  });
}

export async function listUserOrders(id: string, limit = 50) {
  return bffRequest<{ orders: any[] }>(`/api/admin/users/${id}/orders`, {
    query: { limit },
  });
}

// Admin settings
export async function getAdminTabsSettings() {
  return bffRequest<{ tab_order: string[] }>('/api/admin/settings/tabs');
}

export async function updateAdminTabsSettings(tabOrder: string[]) {
  return bffRequest<{ tab_order: string[] }>('/api/admin/settings/tabs', {
    method: 'PATCH',
    body: { tab_order: tabOrder },
  });
}

export type AdminPanelConfig = {
  auth_cookie_ttl_hours: number;
  auth_token_ttl_hours: number;
  tracking_token_ttl_hours: number;
};

export async function getAdminPanelConfig() {
  return bffRequest<AdminPanelConfig>('/api/admin/settings/panel-config');
}

export async function updateAdminPanelConfig(payload: AdminPanelConfig) {
  return bffRequest<AdminPanelConfig>('/api/admin/settings/panel-config', {
    method: 'PATCH',
    body: payload,
  });
}

// Flavors
export async function listFlavors(includeAll = false) {
  const query = includeAll ? { all: true } : undefined;
  return bffRequest<any>('/api/admin/flavors', { query });
}

export async function createFlavor(payload: any) {
  return bffRequest<any>('/api/admin/flavors', {
    method: 'POST',
    body: payload,
  });
}

export async function updateFlavor(id: string, payload: any) {
  return bffRequest<any>(`/api/admin/flavors/${id}`, {
    method: 'PATCH',
    body: payload,
  });
}

export async function deleteFlavor(id: string) {
  return bffRequest<any>(`/api/admin/flavors/${id}`, {
    method: 'DELETE',
  });
}

// Addons
export async function listAddons(includeAll = false) {
  const query = includeAll ? { all: true } : undefined;
  return bffRequest<any>('/api/admin/addons', { query });
}

export async function createAddon(payload: any) {
  return bffRequest<any>('/api/admin/addons', {
    method: 'POST',
    body: payload,
  });
}

export async function updateAddon(id: string, payload: any) {
  return bffRequest<any>(`/api/admin/addons/${id}`, {
    method: 'PATCH',
    body: payload,
  });
}

export async function deleteAddon(id: string) {
  return bffRequest<any>(`/api/admin/addons/${id}`, {
    method: 'DELETE',
  });
}

// Analytics
export async function getAnalyticsOverview(period: 'week' | 'month' | 'year') {
  return bffRequest<AnalyticsOverview>('/api/admin/analytics/overview', {
    query: { period },
  });
}

export async function getAnalyticsOrdersOverTime(
  start: string,
  end: string,
  groupBy: 'day' | 'week' | 'month' = 'day',
) {
  return bffRequest<AnalyticsTimelinePoint[]>('/api/admin/analytics/orders-over-time', {
    query: { start, end, groupBy },
  });
}

export async function getAnalyticsTopProducts(limit = 10, start?: string, end?: string) {
  const query: Record<string, string | number> = { limit };
  if (start) query.start = start;
  if (end) query.end = end;

  return bffRequest<AnalyticsTopProduct[]>('/api/admin/analytics/top-products', {
    query,
  });
}

// Export
export async function exportOrders(
  start: string,
  end: string,
  format: 'csv' | 'json',
  statuses?: OrderStatus[],
): Promise<Blob> {
  const url = new URL('/api/admin/export/orders', window.location.origin);
  url.searchParams.set('start', start);
  url.searchParams.set('end', end);
  url.searchParams.set('format', format);
  if (statuses && statuses.length > 0) {
    url.searchParams.set('statuses', statuses.join(','));
  }

  const response = await fetch(url.toString(), {
    method: 'GET',
    credentials: 'include',
  });

  if (!response.ok) {
    let message = 'Export failed';
    try {
      const payload = await response.json();
      message = payload?.error || payload?.message || message;
    } catch {
    }
    throw new ApiError(message, response.status, 'EXPORT_ERROR');
  }

  return response.blob();
}

export async function archiveExportedOrders(start: string, end: string) {
  return bffRequest<{
    message: string;
    archived_count?: number;
    deleted_count?: number;
    deleted_items_count?: number;
    statuses?: string[];
  }>('/api/admin/export/orders', {
    method: 'DELETE',
    query: {
      start,
      end,
    },
  });
}

export async function purgeOrdersByStatuses(start: string, end: string, statuses: OrderStatus[]) {
  return bffRequest<{
    message: string;
    archived_count?: number;
    deleted_count?: number;
    deleted_items_count?: number;
    statuses?: string[];
  }>('/api/admin/export/orders', {
    method: 'DELETE',
    query: {
      start,
      end,
      statuses: statuses.join(','),
    },
  });
}
