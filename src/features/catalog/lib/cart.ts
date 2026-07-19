import { arraysEqualUnordered } from "@shared/utils/collections";
import { normalizeSelectionIds } from "@features/catalog/lib/customization";
import { clearIdempotencyKey } from "@features/orders/lib/idempotency";

export type StoreCartItem = {
  product_id: string;
  name: string;
  image_url?: string | null;
  unit_price: number;
  quantity: number;
  flavor_id?: string | null;
  flavor_ids?: string[]; // For mixed flavors (multiple flavor selections)
  addons?: string[]; // legacy array of addon IDs (all paid)
  included_addon_ids?: string[];
  extra_addon_ids?: string[];
  topping_selection?: "none" | "selected";
  jalea_selection?: "none" | "selected";
  notes?: string;
};

function sanitizeCartItem(item: StoreCartItem): StoreCartItem {
  return {
    ...item,
    quantity: normalizeCartQuantity(item.quantity),
    flavor_id: item.flavor_id || undefined,
    included_addon_ids: normalizeSelectionIds(item.included_addon_ids),
    extra_addon_ids: normalizeSelectionIds(item.extra_addon_ids),
    addons: item.extra_addon_ids?.length
      ? undefined
      : normalizeSelectionIds(item.addons),
    topping_selection: item.topping_selection || undefined,
    jalea_selection: item.jalea_selection || undefined,
    notes: item.notes || undefined,
  };
}

const CART_KEY = "ishos_storefront_cart_items";
const CART_COUNT_KEY = "ishos_storefront_cart_count";
const MAX_ITEM_QUANTITY = 100;

function normalizeCartQuantity(value: number, minimum = 1): number {
  if (!Number.isFinite(value)) return minimum;
  return Math.min(MAX_ITEM_QUANTITY, Math.max(minimum, Math.floor(value)));
}

export function cartItemsMatch(a: StoreCartItem, b: StoreCartItem): boolean {
  return (
    a.product_id === b.product_id &&
    (a.flavor_id || null) === (b.flavor_id || null) &&
    arraysEqualUnordered(a.flavor_ids || [], b.flavor_ids || []) &&
    (a.topping_selection || "") === (b.topping_selection || "") &&
    (a.jalea_selection || "") === (b.jalea_selection || "") &&
    (a.notes || "") === (b.notes || "") &&
    arraysEqualUnordered(a.addons || [], b.addons || []) &&
    arraysEqualUnordered(
      a.included_addon_ids || [],
      b.included_addon_ids || [],
    ) &&
    arraysEqualUnordered(a.extra_addon_ids || [], b.extra_addon_ids || [])
  );
}

function syncCartCount(items: StoreCartItem[]) {
  if (typeof window === "undefined") return;
  const count = items.reduce((total, item) => total + item.quantity, 0);
  localStorage.setItem(CART_COUNT_KEY, String(count));
  window.dispatchEvent(
    new CustomEvent("storefront-cart-count", { detail: count }),
  );
}

function notifyCartAdded(item: StoreCartItem) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent("storefront-cart-added", {
      detail: {
        name: item.name,
        quantity: item.quantity,
      },
    }),
  );
}

export function getCartItems(): StoreCartItem[] {
  if (typeof window === "undefined") return [];
  const raw = localStorage.getItem(CART_KEY);
  if (!raw) return [];

  try {
    const parsed = JSON.parse(raw) as StoreCartItem[];
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((item) => item && typeof item === "object")
      .map((item) => sanitizeCartItem(item));
  } catch {
    return [];
  }
}

export function setCartItems(items: StoreCartItem[]) {
  if (typeof window === "undefined") return;
  localStorage.setItem(CART_KEY, JSON.stringify(items));
  syncCartCount(items);
}

export function addCartItem(item: StoreCartItem) {
  const normalized = sanitizeCartItem(item);
  const items = getCartItems();
  const existing = items.find((entry) => cartItemsMatch(entry, normalized));

  if (existing) {
    const updated = items.map((entry) =>
      entry === existing
        ? {
            ...entry,
            quantity: normalizeCartQuantity(
              entry.quantity + normalized.quantity,
            ),
          }
        : entry,
    );
    setCartItems(updated);
    notifyCartAdded(normalized);
    return;
  }

  setCartItems([...items, normalized]);
  notifyCartAdded(normalized);
}

export function replaceCartItem(
  original: StoreCartItem,
  next: StoreCartItem,
): StoreCartItem[] {
  const items = getCartItems();
  const originalIndex = items.findIndex((entry) =>
    cartItemsMatch(entry, original),
  );
  const normalized = sanitizeCartItem(next);

  const baseItems =
    originalIndex < 0
      ? items
      : items.filter((_, index) => index !== originalIndex);

  const existingIndex = baseItems.findIndex((entry) =>
    cartItemsMatch(entry, normalized),
  );

  const nextItems =
    existingIndex >= 0
      ? baseItems.map((entry, index) =>
          index === existingIndex
            ? {
                ...entry,
                quantity: normalizeCartQuantity(
                  entry.quantity + normalized.quantity,
                ),
              }
            : entry,
        )
      : [...baseItems, normalized];

  setCartItems(nextItems);
  notifyCartAdded(normalized);
  return nextItems;
}

export function updateCartItemQuantity(
  productId: string,
  quantity: number,
  flavorId?: string | null,
  addons?: string[],
  notes?: string,
  includedAddonIds?: string[],
  extraAddonIds?: string[],
  toppingSelection?: "none" | "selected",
  jaleaSelection?: "none" | "selected",
) {
  const items = getCartItems();
  const updated = items
    .map((item) => {
      if (
        item.product_id === productId &&
        (item.flavor_id || null) === (flavorId || null) &&
        (item.topping_selection || "") === (toppingSelection || "") &&
        (item.jalea_selection || "") === (jaleaSelection || "") &&
        (item.notes || "") === (notes || "") &&
        arraysEqualUnordered(item.addons || [], addons || []) &&
        arraysEqualUnordered(
          item.included_addon_ids || [],
          includedAddonIds || [],
        ) &&
        arraysEqualUnordered(item.extra_addon_ids || [], extraAddonIds || [])
      ) {
        return { ...item, quantity: normalizeCartQuantity(quantity, 0) };
      }
      return item;
    })
    .filter((item) => item.quantity > 0);

  setCartItems(updated);
}

export function removeCartItem(
  productId: string,
  flavorId?: string | null,
  addons?: string[],
  notes?: string,
  includedAddonIds?: string[],
  extraAddonIds?: string[],
  toppingSelection?: "none" | "selected",
  jaleaSelection?: "none" | "selected",
) {
  const items = getCartItems().filter(
    (item) =>
      !(
        item.product_id === productId &&
        (item.flavor_id || null) === (flavorId || null) &&
        (item.topping_selection || "") === (toppingSelection || "") &&
        (item.jalea_selection || "") === (jaleaSelection || "") &&
        (item.notes || "") === (notes || "") &&
        arraysEqualUnordered(item.addons || [], addons || []) &&
        arraysEqualUnordered(
          item.included_addon_ids || [],
          includedAddonIds || [],
        ) &&
        arraysEqualUnordered(item.extra_addon_ids || [], extraAddonIds || [])
      ),
  );
  setCartItems(items);
}

export function clearCartItems() {
  setCartItems([]);
  clearIdempotencyKey();
}
