/**
 * Admin dashboard types
 */

import type { Order } from './store';
import type { UserRole } from './auth';

/**
 * Employee record (admin/staff)
 */
export interface Employee {
  id: string;
  email: string;
  name: string;
  phone: string;
  role: UserRole;
  active: boolean;
  created_at: string;
}

/**
 * Employee create/update request
 */
export interface CreateEmployeeRequest {
  email: string;
  password: string;
  name: string;
  phone: string;
  role: UserRole;
}

/**
 * Employee update request (no password)
 */
export interface UpdateEmployeeRequest {
  name: string;
  phone: string;
  role: UserRole;
  active: boolean;
}

/**
 * Admin order view (with more details)
 */
export interface AdminOrder extends Order {
  prepared_by?: string;
  completed_at?: string;
}

/**
 * Dashboard statistics
 */
export interface DashboardStats {
  total_orders: number;
  total_revenue: number;
  orders_today: number;
  pending_orders: number;
  products_count: number;
  categories_count: number;
  employees_count: number;
}
