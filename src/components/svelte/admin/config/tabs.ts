export type TabKey = "ordenes" | "categorias" | "productos" | "empleados" | "usuarios" | "herramientas";

export const TAB_LABELS: Record<TabKey, string> = {
  ordenes: "Ordenes",
  categorias: "Categorias",
  productos: "Productos",
  empleados: "Empleados",
  usuarios: "Usuarios",
  herramientas: "Herramientas",
};

export const ADMIN_ONLY_TABS = new Set<TabKey>(["categorias", "productos", "empleados", "usuarios", "herramientas"]);

export const DEFAULT_TAB_ORDER: TabKey[] = ["ordenes", "categorias", "productos", "empleados", "usuarios", "herramientas"];
