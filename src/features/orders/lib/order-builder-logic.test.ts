import { describe, expect, it } from "vitest";
import { computeAddonSelection, fillSlot } from "./order-builder-logic";

const NONE = "none";

describe("computeAddonSelection", () => {
  it("selects the first item as included when nothing is selected", () => {
    const result = computeAddonSelection(
      { includedIds: [], extraIds: [] },
      "a",
      NONE,
    );
    expect(result).toEqual({ includedIds: ["a"], extraIds: [] });
  });

  it("selects the first item as included from a cleared state", () => {
    const result = computeAddonSelection(
      { includedIds: [], extraIds: [] },
      "a",
      NONE,
    );
    expect(result).toEqual({ includedIds: ["a"], extraIds: [] });
  });

  it("adds a second selection as an extra when allowance is one", () => {
    const result = computeAddonSelection(
      { includedIds: ["a"], extraIds: [] },
      "b",
      NONE,
    );
    expect(result).toEqual({ includedIds: ["a"], extraIds: ["b"] });
  });

  it("adds a second selection as included when allowance allows", () => {
    const result = computeAddonSelection(
      { includedIds: ["a"], extraIds: [] },
      "b",
      NONE,
      2,
    );
    expect(result).toEqual({ includedIds: ["a", "b"], extraIds: [] });
  });

  it("adds a third selection as an extra after free slots are full", () => {
    const result = computeAddonSelection(
      { includedIds: ["a", "b"], extraIds: [] },
      "c",
      NONE,
      2,
    );
    expect(result).toEqual({ includedIds: ["a", "b"], extraIds: ["c"] });
  });

  it("adds the included item as an extra when tapped again (double portion)", () => {
    const result = computeAddonSelection(
      { includedIds: ["a"], extraIds: [] },
      "a",
      NONE,
    );
    expect(result).toEqual({ includedIds: ["a"], extraIds: ["a"] });
  });

  it("removes the extra portion from an included+extra item", () => {
    const result = computeAddonSelection(
      { includedIds: ["a"], extraIds: ["a", "b"] },
      "a",
      NONE,
    );
    expect(result).toEqual({ includedIds: ["a"], extraIds: ["b"] });
  });

  it("removes an extra when tapped", () => {
    const result = computeAddonSelection(
      { includedIds: ["a"], extraIds: ["b", "c"] },
      "b",
      NONE,
    );
    expect(result).toEqual({ includedIds: ["a"], extraIds: ["c"] });
  });

  it("clears everything when the none item is tapped", () => {
    const result = computeAddonSelection(
      { includedIds: ["a"], extraIds: ["b"] },
      NONE,
      NONE,
    );
    expect(result).toEqual({ includedIds: [], extraIds: [] });
  });

  it("does not add duplicate extras", () => {
    const result = computeAddonSelection(
      { includedIds: ["a"], extraIds: ["b"] },
      "b",
      NONE,
    );
    expect(result).toEqual({ includedIds: ["a"], extraIds: [] });
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
