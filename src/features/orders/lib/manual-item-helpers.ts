import type { Addon, Flavor, Product } from "@features/admin-management";
import { normalizeAddonGroupName } from "@features/products";
import type {
  CreateOrderPayload,
  ManualOrderItemDraft,
} from "../types/orders-tab";

/** Resolves a flavor name by product and flavor ID */
export function resolveFlavorName(
  productId: string,
  flavorId: string | undefined,
  products: Product[],
): string | null {
  if (!flavorId) return null;
  const product = products.find((p: Product) => p.id === productId);
  const flavor = product?.flavors?.find((f: Flavor) => f.id === flavorId);
  return flavor?.name ?? null;
}

/** Resolves addon names by product and addon IDs */
export function resolveAddonNames(
  productId: string,
  addonIds: string[],
  products: Product[],
): string[] {
  if (addonIds.length === 0) return [];
  const product = products.find((p: Product) => p.id === productId);
  const addons = product?.addons ?? [];
  return addonIds
    .map(
      (addonId: string) =>
        addons.find((a: Addon) => a.id === addonId)?.name ?? null,
    )
    .filter((name: string | null): name is string => !!name);
}

/** Calculates the unit price for a manual item (product + addon prices) */
export function manualItemUnitPrice(
  item: ManualOrderItemDraft,
  products: Product[],
): number {
  const product = products.find((p: Product) => p.id === item.product_id);
  const addonPrice = (item.extra_addon_ids ?? []).reduce(
    (sum: number, addonId: string) => {
      const addon = product?.addons?.find((a: Addon) => a.id === addonId);
      return sum + Number(addon?.price ?? 0);
    },
    0,
  );
  return Number(product?.price ?? 0) + addonPrice;
}

/** Calculates the subtotal for a manual item (unit price × quantity) */
export function manualItemSubtotal(
  item: ManualOrderItemDraft,
  products: Product[],
): number {
  return manualItemUnitPrice(item, products) * item.quantity;
}

/** Calculates the total of all manual items */
export function manualOrderTotal(
  items: ManualOrderItemDraft[],
  products: Product[],
): number {
  return items.reduce(
    (sum, item) => sum + manualItemSubtotal(item, products),
    0,
  );
}

/** Builds the customizations object from a draft item for API submission */
export function buildCustomizationsFromDraft(
  item: ManualOrderItemDraft,
  products: Product[] = [],
): Record<string, unknown> | undefined {
  const customizations: Record<string, unknown> = {};
  const product = products.find((p: Product) => p.id === item.product_id);

  if (item.flavor_id) {
    customizations.flavor_id = item.flavor_id;
  }
  if ((item.included_addon_ids ?? []).length > 0) {
    customizations.included_addon_ids = item.included_addon_ids;
  }
  if ((item.extra_addon_ids ?? []).length > 0) {
    customizations.extra_addon_ids = item.extra_addon_ids;
  }

  // Default topping/jalea selections to "none" when the product has those
  // option groups but the draft does not explicitly set them.
  const hasToppingOptions = (product?.addons ?? []).some(
    (a: Addon) =>
      a.is_active && normalizeAddonGroupName(a.group_name) === "toppings",
  );
  const hasJaleaOptions = (product?.addons ?? []).some(
    (a: Addon) =>
      a.is_active && normalizeAddonGroupName(a.group_name) === "jalea",
  );

  // Defensive: if the draft claims "selected" but no matching addon is in
  // included_addon_ids, treat it as "none" to avoid backend rejection.
  const hasToppingAddonIncluded = (item.included_addon_ids ?? []).some((id) =>
    (product?.addons ?? []).some(
      (a) =>
        a.id === id &&
        a.is_active &&
        normalizeAddonGroupName(a.group_name) === "toppings",
    ),
  );
  const hasJaleaAddonIncluded = (item.included_addon_ids ?? []).some((id) =>
    (product?.addons ?? []).some(
      (a) =>
        a.id === id &&
        a.is_active &&
        normalizeAddonGroupName(a.group_name) === "jalea",
    ),
  );

  let toppingSelection =
    item.topping_selection ?? (hasToppingOptions ? "none" : undefined);
  if (toppingSelection === "selected" && !hasToppingAddonIncluded) {
    toppingSelection = hasToppingOptions ? "none" : undefined;
  }

  let jaleaSelection =
    item.jalea_selection ?? (hasJaleaOptions ? "none" : undefined);
  if (jaleaSelection === "selected" && !hasJaleaAddonIncluded) {
    jaleaSelection = hasJaleaOptions ? "none" : undefined;
  }

  if (toppingSelection) {
    customizations.topping_selection = toppingSelection;
  }
  if (jaleaSelection) {
    customizations.jalea_selection = jaleaSelection;
  }

  return Object.keys(customizations).length > 0 ? customizations : undefined;
}

/** Converts manual items to the CreateOrderPayload items format */
export function manualItemsToPayloadItems(
  items: ManualOrderItemDraft[],
  products: Product[] = [],
): CreateOrderPayload["items"] {
  return items.map((item) => ({
    product_id: item.product_id,
    quantity: item.quantity,
    customizations: buildCustomizationsFromDraft(item, products),
  }));
}
