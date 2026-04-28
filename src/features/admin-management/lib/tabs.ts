export type TabKey =
  | "ordenes"
  | "categorias"
  | "productos"
  | "personas"
  | "ofertas"
  | "herramientas";

export const TAB_LABELS: Record<TabKey, string> = {
  ordenes: "Ordenes",
  categorias: "Categorias",
  productos: "Productos",
  personas: "Personas",
  ofertas: "Ofertas",
  herramientas: "Herramientas",
};

export const ADMIN_ONLY_TABS = new Set<TabKey>([
  "categorias",
  "productos",
  "personas",
  "ofertas",
  "herramientas",
]);

export const DEFAULT_TAB_ORDER: TabKey[] = [
  "ordenes",
  "categorias",
  "productos",
  "personas",
  "ofertas",
  "herramientas",
];

const LEGACY_TAB_MAP: Record<string, TabKey | null> = {
  empleados: "personas",
  usuarios: "personas",
};

export function toTabKey(value: string): TabKey | null {
  if (DEFAULT_TAB_ORDER.includes(value as TabKey)) {
    return value as TabKey;
  }
  return LEGACY_TAB_MAP[value] ?? null;
}

export function normalizeTabOrder(
  rawOrder: string[] | null | undefined,
): TabKey[] {
  const seen = new Set<TabKey>();
  const normalized: TabKey[] = [];

  for (const item of rawOrder ?? []) {
    const mapped = toTabKey(item);
    if (!mapped || seen.has(mapped)) continue;
    seen.add(mapped);
    normalized.push(mapped);
  }

  for (const fallback of DEFAULT_TAB_ORDER) {
    if (seen.has(fallback)) continue;
    normalized.push(fallback);
  }

  return normalized;
}
