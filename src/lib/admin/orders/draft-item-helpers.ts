import type { Product } from "../../../lib/api/admin";
import type { ManualOrderItemDraft } from "../../../components/svelte/admin/tabs/types/orders-tab";
import {
  normalizeIdList,
  arraysEqualUnordered,
} from "../../../components/svelte/admin/tabs/utils/list";

/** Builds a draft item from the current form state, with validation */
export function buildCurrentDraftItem(
  productId: string,
  quantity: number,
  selectedFlavorId: string,
  includedToppingId: string,
  includedJaleaId: string,
  selectedExtraAddonIds: string[],
  products: Product[],
):
  | { item: ManualOrderItemDraft; error: string }
  | { item: null; error: string } {
  if (!productId) {
    return {
      item: null,
      error: "Selecciona un producto para agregar a la orden",
    };
  }

  const safeQuantity = Number(quantity);
  if (!Number.isFinite(safeQuantity) || safeQuantity < 1) {
    return { item: null, error: "La cantidad debe ser mayor que cero" };
  }

  const selectedProduct = products.find((p) => p.id === productId);
  const activeFlavors = (selectedProduct?.flavors ?? [])
    .filter((f) => f.is_active)
    .slice()
    .sort(
      (a, b) =>
        a.display_order - b.display_order || a.name.localeCompare(b.name),
    );

  if (selectedProduct && activeFlavors.length > 0 && !selectedFlavorId) {
    return { item: null, error: "Selecciona un sabor para este producto" };
  }

  return {
    item: {
      product_id: productId,
      quantity: safeQuantity,
      flavor_id: selectedFlavorId || undefined,
      included_addon_ids: normalizeIdList(
        [includedToppingId, includedJaleaId].filter((v) => v),
      ),
      extra_addon_ids: normalizeIdList(selectedExtraAddonIds),
    },
    error: "",
  };
}

/** Adds a new draft item to the list, merging quantities if an identical item exists */
export function addDraftItem(
  manualItems: ManualOrderItemDraft[],
  newItem: ManualOrderItemDraft,
): ManualOrderItemDraft[] {
  const existingIndex = manualItems.findIndex(
    (item) =>
      item.product_id === newItem.product_id &&
      (item.flavor_id || "") === (newItem.flavor_id || "") &&
      arraysEqualUnordered(
        item.included_addon_ids,
        newItem.included_addon_ids,
      ) &&
      arraysEqualUnordered(item.extra_addon_ids, newItem.extra_addon_ids),
  );

  if (existingIndex >= 0) {
    return manualItems.map((item, index) =>
      index === existingIndex
        ? { ...item, quantity: item.quantity + newItem.quantity }
        : item,
    );
  }

  return [...manualItems, newItem];
}

/** Removes a draft item by index */
export function removeDraftItem(
  manualItems: ManualOrderItemDraft[],
  index: number,
): ManualOrderItemDraft[] {
  return manualItems.filter((_, idx) => idx !== index);
}

/** Updates the quantity of a draft item, removing it if quantity becomes ≤ 0 */
export function updateDraftItemQuantity(
  manualItems: ManualOrderItemDraft[],
  index: number,
  newQuantity: number,
): ManualOrderItemDraft[] {
  const safeQuantity = Math.max(0, Math.floor(newQuantity));
  return manualItems
    .map((item, idx) =>
      idx === index ? { ...item, quantity: safeQuantity } : item,
    )
    .filter((item) => item.quantity > 0);
}

/** Generates a stable unique key for a draft item (useful for keying in loops) */
export function draftItemKey(
  item: ManualOrderItemDraft,
  index: number,
): string {
  return [
    item.product_id,
    item.flavor_id || "",
    item.included_addon_ids.join(","),
    item.extra_addon_ids.join(","),
    String(index),
  ].join("|");
}

/** Resets customization selections (flavors, toppings, jaleas, extras) */
export function resetCustomizationSelections(): {
  selectedFlavorId: string;
  includedToppingId: string;
  includedJaleaId: string;
  selectedExtraAddonIds: string[];
} {
  return {
    selectedFlavorId: "",
    includedToppingId: "",
    includedJaleaId: "",
    selectedExtraAddonIds: [],
  };
}
