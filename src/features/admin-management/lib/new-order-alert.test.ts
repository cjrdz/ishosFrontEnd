import { describe, expect, it } from "vitest";
import { titleWithOrderBadge } from "./new-order-alert";

describe("titleWithOrderBadge", () => {
  it("adds a badge with the unseen count", () => {
    expect(titleWithOrderBadge("Admin Panel - IshosFactory", 2)).toBe(
      "(2) Nuevas órdenes · Admin Panel - IshosFactory",
    );
  });

  it("replaces an existing badge instead of stacking", () => {
    const once = titleWithOrderBadge("Admin", 1);
    expect(titleWithOrderBadge(once, 4)).toBe("(4) Nuevas órdenes · Admin");
  });

  it("removes the badge when the count is zero", () => {
    expect(titleWithOrderBadge("(3) Nuevas órdenes · Admin", 0)).toBe("Admin");
  });
});
