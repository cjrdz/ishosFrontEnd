import { describe, expect, it } from "vitest";
import { delta, lastDays, previousRange, storeTodayISO } from "./compare";

describe("analytics comparison", () => {
  it("uses the store's date, not UTC", () => {
    // 03:00 UTC on the 27th is still 9 pm on the 26th in El Salvador.
    expect(storeTodayISO(new Date("2026-10-27T03:00:00Z"))).toBe("2026-10-26");
  });

  it("builds inclusive ranges and the previous range of equal length", () => {
    expect(lastDays(7, new Date("2026-10-26T20:00:00Z"))).toEqual({
      start: "2026-10-20",
      end: "2026-10-26",
    });
    expect(previousRange("2026-10-20", "2026-10-26")).toEqual({
      start: "2026-10-13",
      end: "2026-10-19",
    });
    expect(previousRange("2026-03-01", "2026-03-01")).toEqual({
      start: "2026-02-28",
      end: "2026-02-28",
    });
  });

  it("describes the change, or nothing without a baseline", () => {
    expect(delta(112, 100)).toMatchObject({
      percent: 12,
      direction: "up",
      label: "+12 % vs. periodo anterior",
    });
    expect(delta(92, 100)).toMatchObject({ percent: -8, direction: "down" });
    expect(delta(100, 100)?.direction).toBe("flat");
    expect(delta(5, 0)).toBeNull();
    expect(delta(5, undefined)).toBeNull();
  });
});
