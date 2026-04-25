import { describe, expect, it } from "vitest";
import {
  cartItemsMatch,
  normalizeCartQuantity,
  type StoreCartItem,
} from "./cart";

function makeItem(partial?: Partial<StoreCartItem>): StoreCartItem {
  return {
    product_id: "p-1",
    name: "Chocolate",
    unit_price: 3.5,
    quantity: 1,
    ...partial,
  };
}

describe("normalizeCartQuantity", () => {
  it("clamps to at least 1 by default", () => {
    expect(normalizeCartQuantity(0)).toBe(1);
    expect(normalizeCartQuantity(-2)).toBe(1);
  });

  it("supports a custom minimum", () => {
    expect(normalizeCartQuantity(0, 0)).toBe(0);
  });

  it("floors decimal values", () => {
    expect(normalizeCartQuantity(3.8)).toBe(3);
  });
});

describe("cartItemsMatch", () => {
  it("matches equivalent cart identity regardless of addon order", () => {
    const left = makeItem({
      flavor_id: "f-1",
      notes: "sin azucar",
      addons: ["a", "b"],
      included_addon_ids: ["x", "y"],
      extra_addon_ids: ["m", "n"],
    });
    const right = makeItem({
      flavor_id: "f-1",
      notes: "sin azucar",
      addons: ["b", "a"],
      included_addon_ids: ["y", "x"],
      extra_addon_ids: ["n", "m"],
    });

    expect(cartItemsMatch(left, right)).toBe(true);
  });

  it("detects different customizations", () => {
    const left = makeItem({ notes: "con chocolate" });
    const right = makeItem({ notes: "sin chocolate" });

    expect(cartItemsMatch(left, right)).toBe(false);
  });
});
