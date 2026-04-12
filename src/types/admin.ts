/**
 * Admin dashboard types
 */

import type { Order } from './store';
import type { UserRole } from './auth';
import type {
  Category,
  Employee as ApiEmployee,
  User,
  UserOrderHistoryItem,
} from '../lib/api/admin';
import type { TabKey } from '../components/svelte/admin/config/tabs';
import type { OrdersTabProps } from '../components/svelte/admin/tabs/types/orders-tab';
import type { ProductsTabProps } from '../components/svelte/admin/tabs/types/products-tab';

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

export interface AdminBusyState {
  categorias: boolean;
  productos: boolean;
  sabores: boolean;
  complementos: boolean;
  ordenes: boolean;
  empleados: boolean;
  usuarios: boolean;
  configuracion: boolean;
}

export interface AdminModuleErrors {
  ordenes: string;
  categorias: string;
  productos: string;
  sabores: string;
  complementos: string;
  empleados: string;
  usuarios: string;
  configuracion: string;
}

export interface TabPanelSharedProps {
  isAdmin: boolean;
  activeTab: TabKey;
  busy: AdminBusyState;
  moduleErrors: AdminModuleErrors;
  lazyTabState: {
    categorias: { loading: boolean; hydrated: boolean };
    productos: { loading: boolean; hydrated: boolean };
    empleados: { loading: boolean; hydrated: boolean };
    usuarios: { loading: boolean; hydrated: boolean };
    herramientas: { loading: boolean; hydrated: boolean };
  };
}

export interface OrdersPanelProps extends OrdersTabProps {}

export interface ProductsPanelProps extends ProductsTabProps {}

export interface CategoriesPanelProps {
  categories: Category[];
  onCreate: (payload: {
    name: string;
    slug: string;
    description?: string;
    image_path?: string;
    display_order?: number;
    is_active?: boolean;
  }) => void;
  onUpdate: (id: string, payload: {
    name?: string;
    slug?: string;
    description?: string;
    image_path?: string;
    display_order?: number;
    is_active?: boolean;
  }) => void;
  onDelete: (id: string) => void;
}

export interface EmployeesPanelProps {
  employees: ApiEmployee[];
  onCreate: (payload: { email: string; password: string; name?: string; phone?: string; role?: 'employee' | 'admin' }) => void;
  onUpdate: (id: string, payload: { email?: string; password?: string; name?: string; phone?: string; role?: 'employee' | 'admin' }) => void;
  onDelete: (id: string) => void;
}

export interface UsersPanelProps {
  users: User[];
  selectedUserOrders: UserOrderHistoryItem[];
  usersHistoryBusy: boolean;
  onCreate: (payload: {
    name: string;
    user_type: 'user' | 'company';
    phone: string;
    email?: string;
    status: 'active' | 'inactive';
  }) => void;
  onUpdate: (id: string, payload: {
    name?: string;
    user_type?: 'user' | 'company';
    phone?: string;
    email?: string;
    status?: 'active' | 'inactive';
  }) => void;
  onDelete: (id: string) => void;
  onLoadUserOrders: (userId: string) => void;
}

export interface AdminTabsProps {
  shared: TabPanelSharedProps;
  orders: OrdersPanelProps;
  products: ProductsPanelProps;
  categories: CategoriesPanelProps;
  employees: EmployeesPanelProps;
  users: UsersPanelProps;
}
