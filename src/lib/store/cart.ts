import { arraysEqualUnordered } from "../utils/collections";

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
  notes?: string;
};

const CART_KEY = "ishos_storefront_cart_items";
const CART_COUNT_KEY = "ishos_storefront_cart_count";

function itemsMatch(a: StoreCartItem, b: StoreCartItem): boolean {
  return (
    a.product_id === b.product_id &&
    (a.flavor_id || null) === (b.flavor_id || null) &&
    (a.notes || "") === (b.notes || "") &&
    arraysEqualUnordered(a.addons || [], b.addons || []) &&
    arraysEqualUnordered(a.included_addon_ids || [], b.included_addon_ids || []) &&
    arraysEqualUnordered(a.extra_addon_ids || [], b.extra_addon_ids || [])
  );
}

function syncCartCount(items: StoreCartItem[]) {
  if (typeof window === "undefined") return;
  const count = items.reduce((total, item) => total + item.quantity, 0);
  localStorage.setItem(CART_COUNT_KEY, String(count));
  window.dispatchEvent(new CustomEvent("storefront-cart-count", { detail: count }));
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
  const existing = items.find((entry) => itemsMatch(entry, item));

  if (existing) {
    const updated = items.map((entry) =>
      entry === existing
        ? { ...entry, quantity: entry.quantity + item.quantity }
        : entry,
    );
    setCartItems(updated);
    return;
  }

  setCartItems([...items, item]);
}

export function updateCartItemQuantity(
  productId: string,
  quantity: number,
  flavorId?: string | null,
  addons?: string[],
  notes?: string,
  includedAddonIds?: string[],
  extraAddonIds?: string[],
) {
  const items = getCartItems();
  const updated = items
    .map((item) => {
      if (
        item.product_id === productId &&
        (item.flavor_id || null) === (flavorId || null) &&
        (item.notes || "") === (notes || "") &&
        arraysEqualUnordered(item.addons || [], addons || []) &&
        arraysEqualUnordered(item.included_addon_ids || [], includedAddonIds || []) &&
        arraysEqualUnordered(item.extra_addon_ids || [], extraAddonIds || [])
      ) {
        return { ...item, quantity };
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
) {
  const items = getCartItems().filter(
    (item) =>
      !(
        item.product_id === productId &&
        (item.flavor_id || null) === (flavorId || null) &&
        (item.notes || "") === (notes || "") &&
        arraysEqualUnordered(item.addons || [], addons || []) &&
        arraysEqualUnordered(item.included_addon_ids || [], includedAddonIds || []) &&
        arraysEqualUnordered(item.extra_addon_ids || [], extraAddonIds || [])
      ),
  );
  setCartItems(items);
}

export function clearCartItems() {
  setCartItems([]);
}
