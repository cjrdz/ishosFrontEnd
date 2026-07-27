/**
 * Admin dashboard types
 */

import type {
  Category,
  Employee as ApiEmployee,
  Product,
  User,
  UserOrderHistoryItem,
  TabKey,
} from "@features/admin-management";
import type { OrdersTabProps } from "@features/orders";
import type { ProductsTabProps } from "@features/products";

interface AdminBusyState {
  categorias: boolean;
  productos: boolean;
  inventario: boolean;
  sabores: boolean;
  complementos: boolean;
  ordenes: boolean;
  empleados: boolean;
  usuarios: boolean;
  configuracion: boolean;
}

interface AdminModuleErrors {
  ordenes: string;
  categorias: string;
  productos: string;
  inventario: string;
  sabores: string;
  complementos: string;
  empleados: string;
  usuarios: string;
  configuracion: string;
}

interface TabPanelSharedProps {
  isAdmin: boolean;
  activeTab: TabKey;
  busy: AdminBusyState;
  moduleErrors: AdminModuleErrors;
  lazyTabState: {
    categorias: { loading: boolean; hydrated: boolean };
    productos: { loading: boolean; hydrated: boolean };
    inventario: { loading: boolean; hydrated: boolean };
    personas: { loading: boolean; hydrated: boolean };
  };
}

interface OrdersPanelProps extends OrdersTabProps {
  allProducts: Product[];
}

interface ProductsPanelProps extends ProductsTabProps {}

interface CategoriesPanelProps {
  categories: Category[];
  onCreate: (payload: {
    name: string;
    slug: string;
    description?: string;
    image_path?: string;
    display_order?: number;
    is_active?: boolean;
  }) => void;
  onUpdate: (
    id: string,
    payload: {
      name?: string;
      slug?: string;
      description?: string;
      image_path?: string;
      display_order?: number;
      is_active?: boolean;
    },
  ) => void;
  onDelete: (id: string) => void;
}

interface EmployeesPanelProps {
  employees: ApiEmployee[];
  onCreate: (payload: {
    email: string;
    password: string;
    name?: string;
    phone?: string;
    role?: "employee" | "admin";
  }) => void;
  onUpdate: (
    id: string,
    payload: {
      email?: string;
      password?: string;
      name?: string;
      phone?: string;
      role?: "employee" | "admin";
    },
  ) => void;
  onDelete: (id: string) => void;
  resetLoginLockout: (payload: {
    employee_id?: string;
    email?: string;
  }) => void;
}

interface UsersPanelProps {
  users: User[];
  selectedUserOrders: UserOrderHistoryItem[];
  usersHistoryBusy: boolean;
  onCreate: (payload: {
    name: string;
    user_type: "user" | "company";
    phone: string;
    email?: string;
    status: "active" | "inactive";
  }) => void;
  onUpdate: (
    id: string,
    payload: {
      name?: string;
      user_type?: "user" | "company";
      phone?: string;
      email?: string;
      status?: "active" | "inactive";
    },
  ) => void;
  onDelete: (id: string) => void;
  onLoadUserOrders: (userId: string) => void;
}

interface InventoryPanelProps {
  busy: boolean;
  moduleError: string;
  flavors: import("@features/admin-management").Flavor[];
  addons: import("@features/admin-management").Addon[];
  flavorBusy: boolean;
  addonBusy: boolean;
  flavorError: string;
  addonError: string;
  onCreateFlavor: (payload: { name: string; is_seasonal: boolean }) => void;
  onUpdateFlavor: (
    id: string,
    payload: {
      name: string;
      display_order: number;
      is_seasonal: boolean;
      is_active: boolean;
    },
  ) => void;
  onDeleteFlavor: (id: string) => void;
  onCreateAddon: (payload: {
    name: string;
    price: number;
    group_name: string;
  }) => void;
  onUpdateAddon: (
    id: string,
    payload: {
      name: string;
      price: number;
      group_name: string;
      display_order: number;
      is_active: boolean;
    },
  ) => void;
  onDeleteAddon: (id: string) => void;
}

export interface AdminTabsProps {
  shared: TabPanelSharedProps;
  orders: OrdersPanelProps;
  products: ProductsPanelProps;
  inventory: InventoryPanelProps;
  categories: CategoriesPanelProps;
  employees: EmployeesPanelProps;
  users: UsersPanelProps;
}
