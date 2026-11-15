import { describe, expect, it } from "vitest";
import { chartThemeFor } from "./chart-colors";
import { linearStatuses } from "@features/orders/lib/order-status";

describe("chartThemeFor", () => {
  it("returns the night palette only for the night theme", () => {
    expect(chartThemeFor("night").dark).toBe(true);
    expect(chartThemeFor("fantasy").dark).toBe(false);
    expect(chartThemeFor(null).dark).toBe(false);
  });

  it("has a distinct colour for every order status in both themes", () => {
    for (const theme of [chartThemeFor("fantasy"), chartThemeFor("night")]) {
      const keys = [...linearStatuses, "cancelada"];
      const colors = keys.map((key) => theme.status[key]);
      expect(colors.every(Boolean)).toBe(true);
      expect(new Set(colors).size).toBe(keys.length);
    }
  });
});
