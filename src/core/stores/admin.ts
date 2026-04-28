import { writable } from "svelte/store";
import type {
  Addon,
  AdminImage,
  Category,
  Employee,
  Flavor,
  Order,
  Product,
  User,
  UserOrderHistoryItem,
} from "@features/admin-management";

export const defaultAdminState = {
  busy: false,
  error: "",
  galleryBusy: false,
};

export const adminState = writable({ ...defaultAdminState });

export const defaultAdminData = {
  products: [] as Product[],
  orders: [] as Order[],
  categories: [] as Category[],
  employees: [] as Employee[],
  users: [] as User[],
  flavors: [] as Flavor[],
  addons: [] as Addon[],
  productImages: [] as AdminImage[],
};

export const adminData = writable({ ...defaultAdminData });

export const defaultAdminBusyState = {
  categorias: false,
  productos: false,
  sabores: false,
  complementos: false,
  ordenes: false,
  empleados: false,
  usuarios: false,
  configuracion: false,
};

export const defaultAdminModuleErrors = {
  ordenes: "",
  categorias: "",
  productos: "",
  sabores: "",
  complementos: "",
  empleados: "",
  usuarios: "",
  configuracion: "",
};

export const defaultAdminDashboardUi = {
  busy: { ...defaultAdminBusyState },
  moduleErrors: { ...defaultAdminModuleErrors },
  productGalleryBusy: false,
  usersHistoryBusy: false,
  orderStatusFilter: "",
  selectedUserOrders: [] as UserOrderHistoryItem[],
  selectedOrder: null as Order | null,
};

export const adminDashboardUi = writable({
  ...defaultAdminDashboardUi,
  busy: { ...defaultAdminDashboardUi.busy },
  moduleErrors: { ...defaultAdminDashboardUi.moduleErrors },
});
