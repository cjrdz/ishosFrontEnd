import { describe, expect, it } from "vitest";
import type { PublicProduct } from "./api";
import {
  activeAddons,
  addonsForGroup,
  isProductConfigurable,
  paidAddonGroups,
} from "./customization";

function buildProduct(addons: PublicProduct["addons"]): PublicProduct {
  return {
    id: "p1",
    name: "Producto",
    description: "",
    price: 1,
    is_available: true,
    addons,
  };
}

function buildAddon(
  overrides: Partial<NonNullable<PublicProduct["addons"]>[number]>,
): NonNullable<PublicProduct["addons"]>[number] {
  return {
    id: "a",
    name: "Addon",
    price: 0,
    group_name: "extras",
    display_order: 0,
    is_active: true,
    ...overrides,
  };
}

describe("paidAddonGroups", () => {
  it("excludes toppings and jalea", () => {
    const product = buildProduct([
      buildAddon({ id: "t1", group_name: "toppings", price: 0.25 }),
      buildAddon({ id: "j1", group_name: "jalea", price: 0.35 }),
    ]);

    const groups = paidAddonGroups(product);
    const keys = groups.map((group) => group.key);

    expect(keys).not.toContain("toppings");
    expect(keys).not.toContain("jalea");
    expect(keys).not.toContain("extra-toppings");
    expect(keys).not.toContain("extra-jalea");
    expect(groups).toHaveLength(0);
  });

  it("includes other addon groups", () => {
    const product = buildProduct([
      buildAddon({ id: "e1", group_name: "extras", price: 0.5 }),
      buildAddon({ id: "s1", group_name: "salsas", price: 0.4 }),
    ]);

    const groups = paidAddonGroups(product);
    const keys = groups.map((group) => group.key);

    expect(keys).toContain("extras");
    expect(keys).toContain("salsas");
    expect(groups).toHaveLength(2);
  });

  it("ignores inactive addons", () => {
    const product = buildProduct([
      buildAddon({ id: "e1", group_name: "extras", is_active: false }),
    ]);

    expect(paidAddonGroups(product)).toHaveLength(0);
  });
});

describe("addonsForGroup", () => {
  it("returns active addons for the requested group", () => {
    const product = buildProduct([
      buildAddon({ id: "t1", group_name: "toppings" }),
      buildAddon({ id: "t2", group_name: "toppings", is_active: false }),
      buildAddon({ id: "j1", group_name: "jalea" }),
    ]);

    expect(addonsForGroup(product, "toppings")).toHaveLength(1);
    expect(addonsForGroup(product, "toppings")[0].id).toBe("t1");
    expect(addonsForGroup(product, "jalea")).toHaveLength(1);
  });
});

describe("isProductConfigurable", () => {
  it("returns true when only toppings/jalea exist", () => {
    const product = buildProduct([
      buildAddon({ id: "t1", group_name: "toppings" }),
    ]);

    expect(isProductConfigurable(product)).toBe(true);
  });

  it("returns true when paid addon groups exist", () => {
    const product = buildProduct([
      buildAddon({ id: "e1", group_name: "extras", price: 0.5 }),
    ]);

    expect(isProductConfigurable(product)).toBe(true);
  });

  it("returns false when no customization options exist", () => {
    const product = buildProduct([]);

    expect(isProductConfigurable(product)).toBe(false);
  });
});

describe("activeAddons", () => {
  it("returns only active addons sorted by group, display_order, and name", () => {
    const product = buildProduct([
      buildAddon({
        id: "b",
        name: "B",
        group_name: "extras",
        display_order: 2,
      }),
      buildAddon({
        id: "a",
        name: "A",
        group_name: "extras",
        display_order: 1,
      }),
      buildAddon({
        id: "i",
        name: "I",
        group_name: "extras",
        is_active: false,
      }),
    ]);

    const active = activeAddons(product);

    expect(active.map((addon) => addon.id)).toEqual(["a", "b"]);
  });
});
