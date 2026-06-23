import {
  addonGroupLabel,
  normalizeAddonGroupName,
} from "@features/catalog/lib/helpers";
import type {
  PublicAddon,
  PublicFlavor,
  PublicProduct,
} from "@features/catalog/lib/api";

export type SelectionState = "none" | "selected";

const MAX_ITEM_QUANTITY = 100;

function toSafeNumber(value: unknown): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

export interface ProductCustomizationDraft {
  quantity: number;
  flavor_id?: string | null;
  flavor_ids?: string[]; // For mixed flavors (multiple flavor selections)
  included_addon_ids?: string[];
  extra_addon_ids?: string[];
  topping_selection?: SelectionState;
  jalea_selection?: SelectionState;
}

export function normalizeSelectionIds(values?: string[]): string[] {
  if (!values || values.length === 0) return [];
  return Array.from(new Set(values.filter(Boolean))).sort();
}

export function normalizeQuantity(value: number): number {
  if (!Number.isFinite(value)) return 1;
  return Math.max(1, Math.min(MAX_ITEM_QUANTITY, Math.floor(value)));
}

export function activeFlavors(product?: PublicProduct): PublicFlavor[] {
  return (product?.flavors ?? [])
    .filter((flavor) => flavor.is_active)
    .slice()
    .sort(
      (left, right) =>
        left.display_order - right.display_order ||
        left.name.localeCompare(right.name),
    );
}

export function activeAddons(product?: PublicProduct): PublicAddon[] {
  return (product?.addons ?? [])
    .filter((addon) => addon.is_active)
    .slice()
    .sort((left, right) => {
      const leftGroup = normalizeAddonGroupName(left.group_name);
      const rightGroup = normalizeAddonGroupName(right.group_name);
      return (
        leftGroup.localeCompare(rightGroup) ||
        left.display_order - right.display_order ||
        left.name.localeCompare(right.name)
      );
    });
}

export function addonsForGroup(
  product: PublicProduct | undefined,
  groupName: string,
): PublicAddon[] {
  return activeAddons(product).filter(
    (addon) => normalizeAddonGroupName(addon.group_name) === groupName,
  );
}

export function paidAddonGroups(
  product: PublicProduct | undefined,
): Array<{ key: string; label: string; items: PublicAddon[] }> {
  const grouped = new Map<string, PublicAddon[]>();

  for (const addon of activeAddons(product)) {
    const key = normalizeAddonGroupName(addon.group_name);

    // Topping and jalea are handled by their own unified selectors in the
    // product modal; they are not shown as generic paid addon groups.
    if (key === "toppings" || key === "jalea") {
      continue;
    }

    const current = grouped.get(key) ?? [];
    current.push(addon);
    grouped.set(key, current);
  }

  return Array.from(grouped.entries())
    .sort((left, right) => left[0].localeCompare(right[0]))
    .map(([key, items]) => ({
      key,
      label: addonGroupLabel(key),
      items,
    }));
}

export function isProductConfigurable(
  product: PublicProduct | undefined,
): boolean {
  return (
    activeFlavors(product).length > 0 ||
    addonsForGroup(product, "toppings").length > 0 ||
    addonsForGroup(product, "jalea").length > 0 ||
    paidAddonGroups(product).some((group) => group.items.length > 0)
  );
}

export function selectedIncludedAddonForGroup(
  product: PublicProduct | undefined,
  draft: ProductCustomizationDraft,
  groupName: "toppings" | "jalea",
): string {
  const options = addonsForGroup(product, groupName);
  return (
    options.find((addon) => (draft.included_addon_ids ?? []).includes(addon.id))
      ?.id ?? ""
  );
}

export function requiresFlavorSelection(
  product: PublicProduct | undefined,
  draft: ProductCustomizationDraft,
): boolean {
  if (activeFlavors(product).length === 0) return false;
  // Mixed flavors use flavor_ids instead of flavor_id.
  if (draft.flavor_ids && draft.flavor_ids.length > 0) return false;
  return !draft.flavor_id;
}

export function requiresGroupSelection(
  product: PublicProduct | undefined,
  draft: ProductCustomizationDraft,
  groupName: "toppings" | "jalea",
): boolean {
  const options = addonsForGroup(product, groupName);
  if (options.length === 0) return false;

  if (selectedIncludedAddonForGroup(product, draft, groupName)) return false;

  if (groupName === "toppings") return draft.topping_selection !== "none";
  return draft.jalea_selection !== "none";
}

export function computeUnitPrice(
  product: PublicProduct | undefined,
  draft: ProductCustomizationDraft,
): number {
  if (!product) return 0;

  let unitPrice = toSafeNumber(product.price);
  const extraIds = draft.extra_addon_ids ?? [];

  if (extraIds.length === 0) return unitPrice;

  const active = activeAddons(product);
  for (const addonId of extraIds) {
    const addon = active.find((candidate) => candidate.id === addonId);
    if (addon) unitPrice += toSafeNumber(addon.price);
  }

  return unitPrice;
}

export function computeTotalPrice(
  product: PublicProduct | undefined,
  draft: ProductCustomizationDraft,
): number {
  const safeQty = normalizeQuantity(draft.quantity);
  return computeUnitPrice(product, draft) * safeQty;
}
