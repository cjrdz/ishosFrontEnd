import { describe, expect, it } from "vitest";
import {
  statusChipClass,
  statusIcons,
  statusLabels,
  statusPluralLabels,
} from "./order-status";

describe("order status meta", () => {
  const statuses = Object.keys(statusLabels);

  it("gives every status a label, plural, icon and chip", () => {
    for (const status of statuses) {
      const key = status as keyof typeof statusLabels;
      expect(statusPluralLabels[key]).toBeTruthy();
      expect(statusIcons[key]).toMatch(/^lucide:/);
      expect(statusChipClass[key]).toMatch(/^status-chip status-chip--/);
    }
  });

  it("never relies on colour alone: icons are unique per status", () => {
    const icons = statuses.map(
      (s) => statusIcons[s as keyof typeof statusIcons],
    );
    expect(new Set(icons).size).toBe(statuses.length);
  });
});
