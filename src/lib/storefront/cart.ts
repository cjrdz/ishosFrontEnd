export type StoreCartItem = {
  product_id: string;
  name: string;
  image_url?: string | null;
  unit_price: number;
  quantity: number;
  notes?: string;
};

const CART_KEY = "ishos_storefront_cart_items";
const CART_COUNT_KEY = "ishos_storefront_cart_count";

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
  const existing = items.find((entry) => entry.product_id === item.product_id && (entry.notes || "") === (item.notes || ""));

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

export function updateCartItemQuantity(productId: string, quantity: number, notes?: string) {
  const items = getCartItems();
  const updated = items
    .map((item) => {
      if (item.product_id === productId && (item.notes || "") === (notes || "")) {
        return { ...item, quantity };
      }
      return item;
    })
    .filter((item) => item.quantity > 0);

  setCartItems(updated);
}

export function removeCartItem(productId: string, notes?: string) {
  const items = getCartItems().filter(
    (item) => !(item.product_id === productId && (item.notes || "") === (notes || "")),
  );
  setCartItems(items);
}

export function clearCartItems() {
  setCartItems([]);
}
