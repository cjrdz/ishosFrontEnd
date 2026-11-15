import { describe, expect, it } from "vitest";
import { flavorColor } from "./flavor-colors";

describe("flavorColor", () => {
  it("maps known flavours regardless of case and accents", () => {
    expect(flavorColor("Fresa")).toBe("#f9b4da");
    expect(flavorColor("CAFÉ")).toBe(flavorColor("cafe"));
    expect(flavorColor("Mango con chile")).toBe("#ffc857");
  });

  it("gives unknown flavours a stable brand colour", () => {
    expect(flavorColor("Sabor nuevo")).toBe(flavorColor("Sabor nuevo"));
    expect(flavorColor("Sabor nuevo")).toMatch(/^#[0-9a-f]{6}$/);
  });
});
