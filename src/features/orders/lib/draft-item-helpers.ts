import type { Addon, Flavor, Product } from "@features/admin-management";
import type { ManualOrderItemDraft } from "../types/orders-tab";
import {
  normalizeIdList,
  arraysEqualUnordered,
  arraysEqualOrdered,
} from "@shared/utils/collections";
import { normalizeAddonGroupName } from "@features/products";

/** Builds a draft item from the current form state, with validation */
export function buildCurrentDraftItem(
  productId: string,
  quantity: number,
  selectedFlavorId: string,
  selectedFlavorIds: string[],
  includedToppingIds: string[],
  includedJaleaIds: string[],
  selectedExtraAddonIds: string[],
  toppingSelection: "none" | "selected" | undefined,
  jaleaSelection: "none" | "selected" | undefined,
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
    .filter((f: Flavor) => f.is_active)
    .slice()
    .sort(
      (a: Flavor, b: Flavor) =>
        a.display_order - b.display_order || a.name.localeCompare(b.name),
    );

  const allowsMixedFlavors =
    (selectedProduct?.allows_mixed_flavors ?? false) &&
    (selectedProduct?.ball_quantity ?? 1) > 1;
  const ballQuantity = selectedProduct?.ball_quantity ?? 1;
  const hasFlavorSelection = allowsMixedFlavors
    ? selectedFlavorIds.length === ballQuantity &&
      selectedFlavorIds.every((id) => !!id)
    : !!selectedFlavorId;

  if (selectedProduct && activeFlavors.length > 0 && !hasFlavorSelection) {
    return { item: null, error: "Selecciona un sabor para este producto" };
  }

  const hasToppingOptions = (selectedProduct?.addons ?? []).some(
    (addon: Addon) =>
      addon.is_active &&
      normalizeAddonGroupName(addon.group_name) === "toppings",
  );
  const hasJaleaOptions = (selectedProduct?.addons ?? []).some(
    (addon: Addon) =>
      addon.is_active && normalizeAddonGroupName(addon.group_name) === "jalea",
  );

  if (hasToppingOptions && toppingSelection === undefined) {
    return {
      item: null,
      error: "Selecciona un topping o marca 'Sin topping'",
    };
  }

  if (hasJaleaOptions && jaleaSelection === undefined) {
    return {
      item: null,
      error: "Selecciona una jalea o marca 'Sin jalea'",
    };
  }

  return {
    item: {
      product_id: productId,
      quantity: safeQuantity,
      flavor_id: allowsMixedFlavors ? undefined : selectedFlavorId || undefined,
      flavor_ids: allowsMixedFlavors
        ? Array(ballQuantity)
            .fill("")
            .map((_, index) => selectedFlavorIds[index] || "")
        : undefined,
      included_addon_ids: normalizeIdList([
        ...includedToppingIds,
        ...includedJaleaIds,
      ]),
      extra_addon_ids: normalizeIdList(selectedExtraAddonIds),
      topping_selection: hasToppingOptions ? toppingSelection : undefined,
      jalea_selection: hasJaleaOptions ? jaleaSelection : undefined,
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
      arraysEqualOrdered(item.flavor_ids ?? [], newItem.flavor_ids ?? []) &&
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
    (item.flavor_ids ?? []).join(","),
    item.included_addon_ids.join(","),
    item.extra_addon_ids.join(","),
    String(index),
  ].join("|");
}

/** Resets customization selections (flavors, toppings, jaleas, extras) */
export function resetCustomizationSelections(): {
  selectedFlavorId: string;
  selectedFlavorIds: string[];
  includedToppingIds: string[];
  includedJaleaIds: string[];
  selectedExtraAddonIds: string[];
} {
  return {
    selectedFlavorId: "",
    selectedFlavorIds: [],
    includedToppingIds: [],
    includedJaleaIds: [],
    selectedExtraAddonIds: [],
  };
}
