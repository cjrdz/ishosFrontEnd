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

// Images
export async function listAdminImages() {
  const response = await bffRequest<{ images?: any[] }>('/api/admin/images');
  return response;
}

export async function uploadAdminImage(file: File, folder = 'menu'): Promise<{ path: string; message: string }> {
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
