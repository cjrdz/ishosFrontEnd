import { describe, expect, it } from "vitest";
import { computeAddonSelection, fillSlot } from "./order-builder-logic";

const NONE = "none";

describe("computeAddonSelection", () => {
  it("selects the first item as included when nothing is selected", () => {
    const result = computeAddonSelection(
      { includedId: null, extraIds: [] },
      "a",
      NONE,
    );
    expect(result).toEqual({ includedId: "a", extraIds: [] });
  });

  it("replaces 'none' with a real item as included", () => {
    const result = computeAddonSelection(
      { includedId: NONE, extraIds: [] },
      "a",
      NONE,
    );
    expect(result).toEqual({ includedId: "a", extraIds: [] });
  });

  it("adds a second selection as an extra", () => {
    const result = computeAddonSelection(
      { includedId: "a", extraIds: [] },
      "b",
      NONE,
    );
    expect(result).toEqual({ includedId: "a", extraIds: ["b"] });
  });

  it("adds the included item as an extra when tapped again (double portion)", () => {
    const result = computeAddonSelection(
      { includedId: "a", extraIds: [] },
      "a",
      NONE,
    );
    expect(result).toEqual({ includedId: "a", extraIds: ["a"] });
  });

  it("removes the extra portion from an included+extra item", () => {
    const result = computeAddonSelection(
      { includedId: "a", extraIds: ["a", "b"] },
      "a",
      NONE,
    );
    expect(result).toEqual({ includedId: "a", extraIds: ["b"] });
  });

  it("removes an extra when tapped", () => {
    const result = computeAddonSelection(
      { includedId: "a", extraIds: ["b", "c"] },
      "b",
      NONE,
    );
    expect(result).toEqual({ includedId: "a", extraIds: ["c"] });
  });

  it("clears everything when the none item is tapped", () => {
    const result = computeAddonSelection(
      { includedId: "a", extraIds: ["b"] },
      NONE,
      NONE,
    );
    expect(result).toEqual({ includedId: null, extraIds: [] });
  });

  it("does not add duplicate extras", () => {
    const result = computeAddonSelection(
      { includedId: "a", extraIds: ["b"] },
      "b",
      NONE,
    );
    expect(result).toEqual({ includedId: "a", extraIds: [] });
  });
});

describe("fillSlot", () => {
  it("fills the active slot and moves to the next empty one", () => {
    const result = fillSlot(["", "", ""], "vainilla", 0);
    expect(result.slots).toEqual(["vainilla", "", ""]);
    expect(result.nextActiveIndex).toBe(1);
  });

  it("fills the last slot and stays there if all slots are filled", () => {
    const result = fillSlot(["chocolate", "fresa", ""], "vainilla", 2);
    expect(result.slots).toEqual(["chocolate", "fresa", "vainilla"]);
    expect(result.nextActiveIndex).toBe(2);
  });

  it("skips already filled slots when advancing", () => {
    const result = fillSlot(["", "chocolate", ""], "vainilla", 0);
    expect(result.slots).toEqual(["vainilla", "chocolate", ""]);
    expect(result.nextActiveIndex).toBe(2);
  });

  it("overwrites the active slot when explicitly tapped", () => {
    const result = fillSlot(["chocolate", "", ""], "fresa", 0);
    expect(result.slots).toEqual(["fresa", "", ""]);
    expect(result.nextActiveIndex).toBe(1);
  });
});
