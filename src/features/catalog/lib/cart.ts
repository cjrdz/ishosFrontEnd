import { arraysEqualUnordered } from "@shared/utils/collections";

export type StoreCartItem = {
  product_id: string;
  name: string;
  image_url?: string | null;
  unit_price: number;
  quantity: number;
  flavor_id?: string | null;
  addons?: string[]; // legacy array of addon IDs (all paid)
  included_addon_ids?: string[];
  extra_addon_ids?: string[];
  topping_selection?: "none" | "selected";
  jalea_selection?: "none" | "selected";
  notes?: string;
};

const CART_KEY = "ishos_storefront_cart_items";
const CART_COUNT_KEY = "ishos_storefront_cart_count";

export function normalizeCartQuantity(value: number, minimum = 1): number {
  if (!Number.isFinite(value)) return minimum;
  return Math.max(minimum, Math.floor(value));
}

export function cartItemsMatch(a: StoreCartItem, b: StoreCartItem): boolean {
  return (
    a.product_id === b.product_id &&
    (a.flavor_id || null) === (b.flavor_id || null) &&
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
    return Array.isArray(parsed) ? parsed : [];
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
  const items = getCartItems();
  const existing = items.find((entry) => cartItemsMatch(entry, item));

  if (existing) {
    const updated = items.map((entry) =>
      entry === existing
        ? {
            ...entry,
            quantity: normalizeCartQuantity(entry.quantity + item.quantity),
          }
        : entry,
    );
    setCartItems(updated);
    notifyCartAdded(item);
    return;
  }

  setCartItems([...items, item]);
  notifyCartAdded(item);
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
}
