export type ModuleKey =
  | "categorias"
  | "productos"
  | "sabores"
  | "complementos"
  | "ordenes"
  | "empleados"
  | "usuarios"
  | "configuracion";

export type RunModuleAction = <T>(params: {
  module: ModuleKey;
  requireAdmin?: boolean;
  errorMessage: string;
  action: () => Promise<T>;
  defaultValue: T;
  analyticsAction?: string;
  analyticsMeta?: Record<string, unknown>;
  onSuccess?: (result: T) => void | Promise<void>;
  onError?: (error: unknown) => void;
}) => Promise<T>;
