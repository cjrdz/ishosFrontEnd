import type { Product } from "../../../lib/api/admin";
import type { ManualOrderItemDraft } from "../../../components/svelte/admin/tabs/types/orders-tab";
import type { CreateOrderPayload } from "../../../components/svelte/admin/tabs/types/orders-tab";

/** Resolves a flavor name by product and flavor ID */
export function resolveFlavorName(
  productId: string,
  flavorId: string | undefined,
  products: Product[],
): string | null {
  if (!flavorId) return null;
  const product = products.find((p) => p.id === productId);
  const flavor = product?.flavors?.find((f) => f.id === flavorId);
  return flavor?.name ?? null;
}

/** Resolves addon names by product and addon IDs */
export function resolveAddonNames(
  productId: string,
  addonIds: string[],
  products: Product[],
): string[] {
  if (addonIds.length === 0) return [];
  const product = products.find((p) => p.id === productId);
  const addons = product?.addons ?? [];
  return addonIds
    .map((addonId) => addons.find((a) => a.id === addonId)?.name ?? null)
    .filter((name): name is string => !!name);
}

/** Calculates the unit price for a manual item (product + addon prices) */
export function manualItemUnitPrice(
  item: ManualOrderItemDraft,
  products: Product[],
): number {
  const product = products.find((p) => p.id === item.product_id);
  const addonPrice = (item.extra_addon_ids ?? []).reduce((sum, addonId) => {
    const addon = product?.addons?.find((a) => a.id === addonId);
    return sum + (addon?.price ?? 0);
  }, 0);
  return (product?.price ?? 0) + addonPrice;
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
): Record<string, unknown> | undefined {
  const customizations: Record<string, unknown> = {};
  if (item.flavor_id) {
    customizations.flavor_id = item.flavor_id;
  }
  if ((item.included_addon_ids ?? []).length > 0) {
    customizations.included_addon_ids = item.included_addon_ids;
  }
  if ((item.extra_addon_ids ?? []).length > 0) {
    customizations.extra_addon_ids = item.extra_addon_ids;
  }
  return Object.keys(customizations).length > 0 ? customizations : undefined;
}

/** Converts manual items to the CreateOrderPayload items format */
export function manualItemsToPayloadItems(
  items: ManualOrderItemDraft[],
): CreateOrderPayload["items"] {
  return items.map((item) => ({
    product_id: item.product_id,
    quantity: item.quantity,
    customizations: buildCustomizationsFromDraft(item),
  }));
}
