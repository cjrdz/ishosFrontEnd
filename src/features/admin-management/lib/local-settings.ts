import { DEFAULT_TAB_ORDER, normalizeTabOrder, type TabKey } from "./tabs";
import type { PanelConfigValues } from "../types/settings";
import type { StoreOfferItem } from "./bff";

const STORAGE_KEY_PREFIX = "ishos.admin.local-settings.v1";
const CURRENT_ADMIN_ID_KEY = "ishos.admin.current-id";
const CURRENT_ROWS_PER_TABLE_KEY = "ishos.admin.current-rows-per-table";
const ROWS_PER_TABLE_OPTIONS = [5, 10, 25, 50, 100] as const;

export type RowsPerTableTabKey =
  | "ordenes"
  | "categorias"
  | "productos"
  | "usuarios"
  | "empleados"
  | "inventario";

export type RowsPerTableConfig = {
  default: number;
  ordenes: number;
  categorias: number;
  productos: number;
  usuarios: number;
  empleados: number;
  inventario: number;
};

export type InventoryStockFilter = "all" | "ok" | "low-stock" | "out-of-stock";
export type InventoryTypeFilter = "all" | "flavor" | "unit";

type InventoryFilterState = {
  stockFilter: InventoryStockFilter;
  typeFilter: InventoryTypeFilter;
};

export const DEFAULT_PANEL_CONFIG: PanelConfigValues = {
  auth_cookie_ttl_hours: 24,
  auth_token_ttl_hours: 168,
  tracking_token_ttl_hours: 720,
  inactivity_logout_seconds: 900,
};

const DEFAULT_STORE_SETTINGS: {
  orders_enabled: boolean;
  offers: StoreOfferItem[];
} = {
  orders_enabled: true,
  offers: [],
};

const DEFAULT_ROWS_PER_TABLE = 5;

export const DEFAULT_ROWS_PER_TABLE_CONFIG: RowsPerTableConfig = {
  default: DEFAULT_ROWS_PER_TABLE,
  ordenes: DEFAULT_ROWS_PER_TABLE,
  categorias: DEFAULT_ROWS_PER_TABLE,
  productos: DEFAULT_ROWS_PER_TABLE,
  usuarios: DEFAULT_ROWS_PER_TABLE,
  empleados: DEFAULT_ROWS_PER_TABLE,
  inventario: DEFAULT_ROWS_PER_TABLE,
};

const DEFAULT_INVENTORY_FILTER_STATE: InventoryFilterState = {
  stockFilter: "all",
  typeFilter: "all",
};

type AdminLocalSettings = {
  tab_order: TabKey[];
  store_settings: {
    orders_enabled: boolean;
    offers: StoreOfferItem[];
  };
  rows_per_table: RowsPerTableConfig;
  inventory_filter_state: InventoryFilterState;
};

function getStorageKey(adminId: string): string {
  return `${STORAGE_KEY_PREFIX}.${adminId}`;
}

function cloneDefaults(): AdminLocalSettings {
  return {
    tab_order: [...DEFAULT_TAB_ORDER],
    store_settings: {
      orders_enabled: DEFAULT_STORE_SETTINGS.orders_enabled,
      offers: [...DEFAULT_STORE_SETTINGS.offers],
    },
    rows_per_table: { ...DEFAULT_ROWS_PER_TABLE_CONFIG },
    inventory_filter_state: { ...DEFAULT_INVENTORY_FILTER_STATE },
  };
}

function isObject(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function normalizeStoreSettings(value: unknown): {
  orders_enabled: boolean;
  offers: StoreOfferItem[];
} {
  if (!isObject(value)) return { ...DEFAULT_STORE_SETTINGS };

  const offersRaw = Array.isArray(value.offers) ? value.offers : [];
  const offers = offersRaw
    .filter(isObject)
    .map((offer) => ({
      product_id:
        typeof offer.product_id === "string" ? offer.product_id.trim() : "",
      label: typeof offer.label === "string" ? offer.label.trim() : "",
      note:
        typeof offer.note === "string" && offer.note.trim().length > 0
          ? offer.note.trim()
          : undefined,
      discount_price:
        typeof offer.discount_price === "number" && offer.discount_price > 0
          ? offer.discount_price
          : undefined,
      expires_at:
        typeof offer.expires_at === "string"
          ? offer.expires_at
          : new Date().toISOString(),
    }))
    .filter((offer) => offer.product_id.length > 0 && offer.label.length > 0);

  return {
    orders_enabled: Boolean(value.orders_enabled),
    offers,
  };
}

function normalizeRowsPerTableValue(value: unknown): number {
  const numeric = Number(value);
  return ROWS_PER_TABLE_OPTIONS.includes(
    numeric as (typeof ROWS_PER_TABLE_OPTIONS)[number],
  )
    ? numeric
    : DEFAULT_ROWS_PER_TABLE;
}

function normalizeRowsPerTableConfig(value: unknown): RowsPerTableConfig {
  if (typeof value === "number" || typeof value === "string") {
    const normalized = normalizeRowsPerTableValue(value);
    return {
      default: normalized,
      ordenes: normalized,
      categorias: normalized,
      productos: normalized,
      usuarios: normalized,
      empleados: normalized,
      inventario: normalized,
    };
  }

  if (!isObject(value)) {
    return { ...DEFAULT_ROWS_PER_TABLE_CONFIG };
  }

  const defaultValue = normalizeRowsPerTableValue(value.default);
  return {
    default: defaultValue,
    ordenes: normalizeRowsPerTableValue(value.ordenes ?? defaultValue),
    categorias: normalizeRowsPerTableValue(value.categorias ?? defaultValue),
    productos: normalizeRowsPerTableValue(value.productos ?? defaultValue),
    usuarios: normalizeRowsPerTableValue(value.usuarios ?? defaultValue),
    empleados: normalizeRowsPerTableValue(value.empleados ?? defaultValue),
    inventario: normalizeRowsPerTableValue(value.inventario ?? defaultValue),
  };
}

function normalizeInventoryFilterState(value: unknown): InventoryFilterState {
  if (!isObject(value)) {
    return { ...DEFAULT_INVENTORY_FILTER_STATE };
  }

  const validStockFilters: InventoryStockFilter[] = [
    "all",
    "ok",
    "low-stock",
    "out-of-stock",
  ];
  const stockFilter = validStockFilters.includes(
    value.stockFilter as InventoryStockFilter,
  )
    ? (value.stockFilter as InventoryStockFilter)
    : DEFAULT_INVENTORY_FILTER_STATE.stockFilter;

  const validTypeFilters: InventoryTypeFilter[] = ["all", "flavor", "unit"];
  const typeFilter = validTypeFilters.includes(
    value.typeFilter as InventoryTypeFilter,
  )
    ? (value.typeFilter as InventoryTypeFilter)
    : DEFAULT_INVENTORY_FILTER_STATE.typeFilter;

  return { stockFilter, typeFilter };
}

export function getAdminLocalSettings(adminId: string): AdminLocalSettings {
  if (typeof window === "undefined" || !adminId) {
    return cloneDefaults();
  }

  const raw = window.localStorage.getItem(getStorageKey(adminId));
  if (!raw) {
    return cloneDefaults();
  }

  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!isObject(parsed)) return cloneDefaults();

    const parsedTabOrder = Array.isArray(parsed.tab_order)
      ? parsed.tab_order.filter(
          (entry): entry is string => typeof entry === "string",
        )
      : undefined;

    return {
      tab_order: normalizeTabOrder(parsedTabOrder),
      store_settings: normalizeStoreSettings(parsed.store_settings),
      rows_per_table: normalizeRowsPerTableConfig(parsed.rows_per_table),
      inventory_filter_state: normalizeInventoryFilterState(
        parsed.inventory_filter_state,
      ),
    };
  } catch {
    return cloneDefaults();
  }
}

function saveAdminLocalSettings(
  adminId: string,
  settings: AdminLocalSettings,
): AdminLocalSettings {
  const normalized: AdminLocalSettings = {
    tab_order: normalizeTabOrder(settings.tab_order),
    store_settings: normalizeStoreSettings(settings.store_settings),
    rows_per_table: normalizeRowsPerTableConfig(settings.rows_per_table),
    inventory_filter_state: normalizeInventoryFilterState(
      settings.inventory_filter_state,
    ),
  };

  if (typeof window === "undefined" || !adminId) {
    return normalized;
  }

  window.localStorage.setItem(
    getStorageKey(adminId),
    JSON.stringify(normalized),
  );
  return normalized;
}

export function saveAdminTabOrder(
  adminId: string,
  tabOrder: string[],
): TabKey[] {
  const current = getAdminLocalSettings(adminId);
  const next = saveAdminLocalSettings(adminId, {
    ...current,
    tab_order: normalizeTabOrder(tabOrder),
  });
  return next.tab_order;
}

export function saveAdminStoreSettings(
  adminId: string,
  storeSettings: { orders_enabled: boolean; offers: StoreOfferItem[] },
): { orders_enabled: boolean; offers: StoreOfferItem[] } {
  const current = getAdminLocalSettings(adminId);
  const next = saveAdminLocalSettings(adminId, {
    ...current,
    store_settings: normalizeStoreSettings(storeSettings),
  });
  return next.store_settings;
}

export function saveAdminRowsPerTable(
  adminId: string,
  rowsPerTable: RowsPerTableConfig,
): RowsPerTableConfig {
  const current = getAdminLocalSettings(adminId);
  const next = saveAdminLocalSettings(adminId, {
    ...current,
    rows_per_table: normalizeRowsPerTableConfig(rowsPerTable),
  });
  return next.rows_per_table;
}

export function getInventoryFilterState(adminId: string): InventoryFilterState {
  return getAdminLocalSettings(adminId).inventory_filter_state;
}

export function saveInventoryFilterState(
  adminId: string,
  filterState: Partial<InventoryFilterState>,
): InventoryFilterState {
  const current = getAdminLocalSettings(adminId);
  const next = saveAdminLocalSettings(adminId, {
    ...current,
    inventory_filter_state: normalizeInventoryFilterState({
      ...current.inventory_filter_state,
      ...filterState,
    }),
  });
  return next.inventory_filter_state;
}

export function setCurrentAdminContext(adminId: string, rowsPerTable: number) {
  if (typeof window === "undefined") return;
  if (adminId) {
    window.sessionStorage.setItem(CURRENT_ADMIN_ID_KEY, adminId);
  }
  window.sessionStorage.setItem(
    CURRENT_ROWS_PER_TABLE_KEY,
    String(normalizeRowsPerTableValue(rowsPerTable)),
  );
}

export function getCurrentAdminId(): string {
  if (typeof window === "undefined") return "";
  return window.sessionStorage.getItem(CURRENT_ADMIN_ID_KEY) ?? "";
}

export function getCurrentRowsPerTable(tab?: RowsPerTableTabKey): number {
  if (typeof window === "undefined") return DEFAULT_ROWS_PER_TABLE;
  const adminId = getCurrentAdminId();
  if (adminId) {
    const settings = getAdminLocalSettings(adminId);
    if (tab) {
      return settings.rows_per_table[tab];
    }
    return settings.rows_per_table.default;
  }

  const raw = window.sessionStorage.getItem(CURRENT_ROWS_PER_TABLE_KEY);
  return normalizeRowsPerTableValue(raw);
}
