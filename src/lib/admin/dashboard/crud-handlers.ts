import {
  createAddon,
  createCategory,
  createEmployee,
  createFlavor,
  createProduct,
  createUser,
  deleteAddon,
  deleteCategory,
  deleteEmployee,
  deleteFlavor,
  deleteProduct,
  deleteUser,
  updateAddon,
  updateCategory,
  updateEmployee,
  updateFlavor,
  updateProduct,
  updateUser,
} from "../../bff/admin";
import type { RunModuleAction } from "./module-action";

interface CrudHandlerDeps {
  runModuleAction: RunModuleAction;
  loadCategories: () => Promise<void>;
  loadProducts: () => Promise<void>;
  loadFlavors: () => Promise<void>;
  loadAddons: () => Promise<void>;
  loadEmployees: () => Promise<void>;
  loadUsers: () => Promise<void>;
  setNotice: (message: string) => void;
  trackAction: (action: string, metadata?: Record<string, unknown>) => void;
  trackError: (error: unknown, context: string, metadata?: Record<string, unknown>) => void;
}

export function createDashboardCrudHandlers(deps: CrudHandlerDeps) {
  const {
    runModuleAction,
    loadCategories,
    loadProducts,
    loadFlavors,
    loadAddons,
    loadEmployees,
    loadUsers,
    setNotice,
    trackAction,
    trackError,
  } = deps;

  async function handleCreateCategory(payload: Parameters<typeof createCategory>[0]) {
    await runModuleAction<void>({
      module: "categorias",
      requireAdmin: true,
      errorMessage: "No se pudo guardar categoria",
      action: async () => {
        await createCategory(payload);
      },
      defaultValue: undefined,
      onSuccess: async () => {
        setNotice("Categoria creada");
        await loadCategories();
      },
    });
  }

  async function handleUpdateCategory(id: string, payload: Parameters<typeof updateCategory>[1]) {
    await runModuleAction<void>({
      module: "categorias",
      requireAdmin: true,
      errorMessage: "No se pudo guardar categoria",
      action: async () => {
        await updateCategory(id, payload);
      },
      defaultValue: undefined,
      onSuccess: async () => {
        setNotice("Categoria actualizada");
        await loadCategories();
      },
    });
  }

  async function handleDeleteCategory(id: string) {
    await runModuleAction<void>({
      module: "categorias",
      requireAdmin: true,
      errorMessage: "No se pudo eliminar categoria",
      action: async () => {
        await deleteCategory(id);
      },
      defaultValue: undefined,
      onSuccess: async () => {
        setNotice("Categoria eliminada");
        await loadCategories();
      },
    });
  }

  async function handleCreateProduct(payload: Parameters<typeof createProduct>[0]) {
    await runModuleAction<void>({
      module: "productos",
      requireAdmin: true,
      errorMessage: "No se pudo guardar producto",
      action: async () => {
        await createProduct(payload);
      },
      defaultValue: undefined,
      onSuccess: async () => {
        trackAction("admin_product_create_success", { name: payload.name });
        setNotice("Producto creado");
        await loadProducts();
      },
      onError: (requestError) => {
        trackError(requestError, "AdminDashboard.handleCreateProduct", { name: payload.name });
      },
    });
  }

  async function handleUpdateProduct(id: string, payload: Parameters<typeof updateProduct>[1]) {
    await runModuleAction<void>({
      module: "productos",
      requireAdmin: true,
      errorMessage: "No se pudo guardar producto",
      action: async () => {
        await updateProduct(id, payload);
      },
      defaultValue: undefined,
      onSuccess: async () => {
        trackAction("admin_product_update_success", { id });
        setNotice("Producto actualizado");
        await loadProducts();
      },
      onError: (requestError) => {
        trackError(requestError, "AdminDashboard.handleUpdateProduct", { id });
      },
    });
  }

  async function handleDeleteProduct(id: string) {
    await runModuleAction<void>({
      module: "productos",
      requireAdmin: true,
      errorMessage: "No se pudo eliminar producto",
      action: async () => {
        await deleteProduct(id);
      },
      defaultValue: undefined,
      onSuccess: async () => {
        trackAction("admin_product_delete_success", { id });
        setNotice("Producto eliminado");
        await loadProducts();
      },
      onError: (requestError) => {
        trackError(requestError, "AdminDashboard.handleDeleteProduct", { id });
      },
    });
  }

  async function handleCreateFlavor(payload: Parameters<typeof createFlavor>[0]) {
    await runModuleAction<void>({
      module: "sabores",
      requireAdmin: true,
      errorMessage: "No se pudo crear sabor",
      action: async () => {
        await createFlavor(payload);
      },
      defaultValue: undefined,
      onSuccess: async () => {
        setNotice("Sabor creado");
        await loadFlavors();
      },
    });
  }

  async function handleUpdateFlavor(id: string, payload: Parameters<typeof updateFlavor>[1]) {
    await runModuleAction<void>({
      module: "sabores",
      requireAdmin: true,
      errorMessage: "No se pudo actualizar sabor",
      action: async () => {
        await updateFlavor(id, payload);
      },
      defaultValue: undefined,
      onSuccess: async () => {
        setNotice("Sabor actualizado");
        await loadFlavors();
      },
    });
  }

  async function handleDeleteFlavor(id: string) {
    await runModuleAction<void>({
      module: "sabores",
      requireAdmin: true,
      errorMessage: "No se pudo eliminar sabor",
      action: async () => {
        await deleteFlavor(id);
      },
      defaultValue: undefined,
      onSuccess: async () => {
        setNotice("Sabor eliminado");
        await loadFlavors();
      },
    });
  }

  async function handleCreateAddon(payload: Parameters<typeof createAddon>[0]) {
    await runModuleAction<void>({
      module: "complementos",
      requireAdmin: true,
      errorMessage: "No se pudo crear complemento",
      action: async () => {
        await createAddon(payload);
      },
      defaultValue: undefined,
      onSuccess: async () => {
        setNotice("Complemento creado");
        await loadAddons();
      },
    });
  }

  async function handleUpdateAddon(id: string, payload: Parameters<typeof updateAddon>[1]) {
    await runModuleAction<void>({
      module: "complementos",
      requireAdmin: true,
      errorMessage: "No se pudo actualizar complemento",
      action: async () => {
        await updateAddon(id, payload);
      },
      defaultValue: undefined,
      onSuccess: async () => {
        setNotice("Complemento actualizado");
        await loadAddons();
      },
    });
  }

  async function handleDeleteAddon(id: string) {
    await runModuleAction<void>({
      module: "complementos",
      requireAdmin: true,
      errorMessage: "No se pudo eliminar complemento",
      action: async () => {
        await deleteAddon(id);
      },
      defaultValue: undefined,
      onSuccess: async () => {
        setNotice("Complemento eliminado");
        await loadAddons();
      },
    });
  }

  async function handleCreateEmployee(payload: Parameters<typeof createEmployee>[0]) {
    await runModuleAction<void>({
      module: "empleados",
      requireAdmin: true,
      errorMessage: "No se pudo crear empleado",
      action: async () => {
        await createEmployee(payload);
      },
      defaultValue: undefined,
      onSuccess: async () => {
        setNotice("Empleado creado");
        await loadEmployees();
      },
    });
  }

  async function handleUpdateEmployee(id: string, payload: Parameters<typeof updateEmployee>[1]) {
    await runModuleAction<void>({
      module: "empleados",
      requireAdmin: true,
      errorMessage: "No se pudo actualizar empleado",
      action: async () => {
        await updateEmployee(id, payload);
      },
      defaultValue: undefined,
      onSuccess: async () => {
        setNotice("Empleado actualizado");
        await loadEmployees();
      },
    });
  }

  async function handleDeleteEmployee(id: string) {
    await runModuleAction<void>({
      module: "empleados",
      requireAdmin: true,
      errorMessage: "No se pudo eliminar empleado",
      action: async () => {
        await deleteEmployee(id);
      },
      defaultValue: undefined,
      onSuccess: async () => {
        setNotice("Empleado eliminado permanentemente");
        await loadEmployees();
      },
    });
  }

  async function handleCreateUser(payload: Parameters<typeof createUser>[0]) {
    await runModuleAction<void>({
      module: "usuarios",
      requireAdmin: true,
      errorMessage: "No se pudo crear usuario",
      action: async () => {
        await createUser(payload);
      },
      defaultValue: undefined,
      onSuccess: async () => {
        setNotice("Usuario creado");
        await loadUsers();
      },
    });
  }

  async function handleUpdateUser(id: string, payload: Parameters<typeof updateUser>[1]) {
    await runModuleAction<void>({
      module: "usuarios",
      requireAdmin: true,
      errorMessage: "No se pudo actualizar usuario",
      action: async () => {
        await updateUser(id, payload);
      },
      defaultValue: undefined,
      onSuccess: async () => {
        setNotice("Usuario actualizado");
        await loadUsers();
      },
    });
  }

  async function handleDeleteUser(id: string) {
    await runModuleAction<void>({
      module: "usuarios",
      requireAdmin: true,
      errorMessage: "No se pudo eliminar usuario",
      action: async () => {
        await deleteUser(id);
      },
      defaultValue: undefined,
      onSuccess: async () => {
        setNotice("Usuario eliminado");
        await loadUsers();
      },
    });
  }

  async function handleSaveUserFromOrder(payload: Parameters<typeof createUser>[0]) {
    return runModuleAction<boolean>({
      module: "usuarios",
      requireAdmin: true,
      errorMessage: "No se pudo guardar usuario desde la orden",
      action: async () => {
        await createUser(payload);
        return true;
      },
      defaultValue: false,
      onSuccess: async () => {
        setNotice("Usuario guardado desde la orden");
        await loadUsers();
      },
    });
  }

  return {
    handleCreateCategory,
    handleUpdateCategory,
    handleDeleteCategory,
    handleCreateProduct,
    handleUpdateProduct,
    handleDeleteProduct,
    handleCreateFlavor,
    handleUpdateFlavor,
    handleDeleteFlavor,
    handleCreateAddon,
    handleUpdateAddon,
    handleDeleteAddon,
    handleCreateEmployee,
    handleUpdateEmployee,
    handleDeleteEmployee,
    handleCreateUser,
    handleUpdateUser,
    handleDeleteUser,
    handleSaveUserFromOrder,
  };
}
