import { getApiBaseUrl } from "../config";
import { ApiError, apiRequest } from "./client";

export type UserRole = "admin" | "employee";

export interface Category {
  id: string;
  name: string;
  slug: string;
  description: string;
  image_path?: string | null;
  display_order: number;
  is_active: boolean;
  created_at?: string;
}

export interface Product {
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
  created_at?: string;
}

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
  created_at?: string;
  updated_at?: string;
  items?: OrderItem[];
}

export interface OrderItem {
  id: string;
  product_name: string;
  quantity: number;
  unit_price: number;
  subtotal: number;
  customizations?: Record<string, unknown> | null;
}

export interface Employee {
  id: string;
  email: string;
  name?: string;
  phone?: string;
  role: UserRole;
  state?: "active" | "inactive";
}

export interface OrdersPaginatedResponse {
  orders: Order[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export async function listCategories(token: string, includeAll = false): Promise<Category[]> {
  const suffix = includeAll ? "?all=true" : "";
  return apiRequest<Category[]>(`/categories${suffix}`, { token });
}

export async function createCategory(
  token: string,
  payload: {
    name: string;
    slug: string;
    description?: string;
    image_path?: string;
    display_order?: number;
  },
): Promise<Category> {
  return apiRequest<Category>("/categories", {
    method: "POST",
    token,
    body: payload,
  });
}

export async function updateCategory(
  token: string,
  id: string,
  payload: Partial<{
    name: string;
    slug: string;
    description: string;
    image_path: string;
    display_order: number;
    is_active: boolean;
  }>,
): Promise<Category> {
  return apiRequest<Category>(`/categories/${id}`, {
    method: "PATCH",
    token,
    body: payload,
  });
}

export async function deleteCategory(token: string, id: string): Promise<{ message: string }> {
  return apiRequest<{ message: string }>(`/categories/${id}`, {
    method: "DELETE",
    token,
  });
}

export async function listProducts(token: string, includeAll = true): Promise<Product[]> {
  const suffix = includeAll ? "?all=true" : "";
  return apiRequest<Product[]>(`/products${suffix}`, { token });
}

export async function createProduct(
  token: string,
  payload: {
    name: string;
    description: string;
    price: number;
    category_id: string;
    image_path?: string;
    stock_status?: Product["stock_status"];
  },
): Promise<Product> {
  return apiRequest<Product>("/products", {
    method: "POST",
    token,
    body: payload,
  });
}

export async function updateProduct(
  token: string,
  id: string,
  payload: Partial<{
    name: string;
    description: string;
    price: number;
    image_path: string;
    is_available: boolean;
    stock_status: Product["stock_status"];
  }>,
): Promise<Product> {
  return apiRequest<Product>(`/products/${id}`, {
    method: "PATCH",
    token,
    body: payload,
  });
}

export async function deleteProduct(token: string, id: string): Promise<{ message: string }> {
  return apiRequest<{ message: string }>(`/products/${id}`, {
    method: "DELETE",
    token,
  });
}

export async function listOrders(
  token: string,
  status = "",
): Promise<OrdersPaginatedResponse> {
  const query = status ? `?status=${encodeURIComponent(status)}` : "";
  return apiRequest<OrdersPaginatedResponse>(`/orders${query}`, { token });
}

export async function getOrder(token: string, id: string): Promise<Order> {
  return apiRequest<Order>(`/orders/${id}`, { token });
}

export async function createOrder(
  token: string,
  payload: {
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
  },
): Promise<{ order_number: string; status: string; total: number; message: string }> {
  return apiRequest<{ order_number: string; status: string; total: number; message: string }>("/orders", {
    method: "POST",
    token,
    body: payload,
  });
}

export async function approveOrder(token: string, id: string): Promise<Order> {
  return apiRequest<Order>(`/orders/${id}/approve`, {
    method: "POST",
    token,
  });
}

export async function rejectOrder(token: string, id: string, reason: string): Promise<Order> {
  return apiRequest<Order>(`/orders/${id}/reject`, {
    method: "POST",
    token,
    body: { reason },
  });
}

export async function updateOrderStatus(
  token: string,
  id: string,
  status: "recibida" | "en_proceso" | "lista" | "entregada",
): Promise<Order> {
  return apiRequest<Order>(`/orders/${id}/status`, {
    method: "PATCH",
    token,
    body: { status },
  });
}

export async function updateOrder(
  token: string,
  id: string,
  payload: {
    customer_name: string;
    customer_phone: string;
    customer_email?: string;
    payment_method: "efectivo" | "tarjeta" | "transferencia" | "otro";
    order_type: "en_local" | "para_llevar";
    table_number?: number;
    notes?: string;
    items?: Array<{
      product_id: string;
      quantity: number;
      customizations?: Record<string, unknown>;
    }>;
  },
): Promise<Order> {
  return apiRequest<Order>(`/orders/${id}`, {
    method: "PATCH",
    token,
    body: payload,
  });
}

export async function updateOrderNotes(
  token: string,
  id: string,
  notes: string | null,
): Promise<Order> {
  return apiRequest<Order>(`/orders/${id}/notes`, {
    method: "PATCH",
    token,
    body: { notes },
  });
}

export async function deleteOrder(token: string, id: string): Promise<{ message: string }> {
  return apiRequest<{ message: string }>(`/orders/${id}`, {
    method: "DELETE",
    token,
  });
}

export async function listEmployees(token: string): Promise<Employee[]> {
  return apiRequest<Employee[]>("/employees", { token });
}

export async function createEmployee(
  token: string,
  payload: {
    email: string;
    password: string;
    name?: string;
    phone?: string;
    role: UserRole;
    state?: "active" | "inactive";
  },
): Promise<Employee> {
  return apiRequest<Employee>("/employees", {
    method: "POST",
    token,
    body: payload,
  });
}

export async function deactivateEmployee(token: string, id: string): Promise<{ message: string }> {
  return apiRequest<{ message: string }>(`/employees/${id}/deactivate`, {
    method: "POST",
    token,
  });
}

export async function updateEmployee(
  token: string,
  id: string,
  payload: Partial<{
    email: string;
    password: string;
    name: string;
    phone: string;
    role: UserRole;
    state: "active" | "inactive";
  }>,
): Promise<Employee> {
  return apiRequest<Employee>(`/employees/${id}`, {
    method: "PATCH",
    token,
    body: payload,
  });
}

export async function deleteEmployee(token: string, id: string): Promise<{ message: string }> {
  return apiRequest<{ message: string }>(`/employees/${id}`, {
    method: "DELETE",
    token,
  });
}

export async function listAdminImages(token: string): Promise<AdminImage[]> {
  const response = await apiRequest<{ images?: AdminImage[] }>("/upload/images", { token });
  return response.images ?? [];
}

export async function uploadAdminImage(
  token: string,
  file: File,
  folder = "menu",
): Promise<{ path: string; message: string }> {
  const formData = new FormData();
  formData.append("image", file);
  if (folder.trim()) {
    formData.append("folder", folder.trim());
  }

  const response = await fetch(`${getApiBaseUrl()}/upload/image`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
    },
    body: formData,
  });

  if (!response.ok) {
    let message = "Request failed";
    try {
      const payload = (await response.json()) as { error?: string; message?: string };
      message = payload.error ?? payload.message ?? message;
    } catch {
      message = response.statusText || message;
    }
    throw new ApiError(message, response.status);
  }

  return (await response.json()) as { path: string; message: string };
}

export async function deleteAdminImage(token: string, path: string): Promise<{ message: string }> {
  return apiRequest<{ message: string }>("/upload/image", {
    method: "DELETE",
    token,
    body: { path },
  });
}
