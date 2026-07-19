import { describe, expect, it } from "vitest";
import { cartItemsMatch, type StoreCartItem } from "./cart";

function makeItem(partial?: Partial<StoreCartItem>): StoreCartItem {
  return {
    product_id: "p-1",
    name: "Chocolate",
    unit_price: 3.5,
    quantity: 1,
    ...partial,
  };
}

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
