import { describe, expect, it } from "vitest";
import {
  describeStoreStatus,
  formatScheduleClock,
  formatStoreClock,
  relativeDay,
  scheduleRows,
  storeDayOfWeek,
} from "./store-status";

// Monday 26 Oct 2026, 4:00 pm in El Salvador (UTC-6) = 22:00 UTC.
const NOW = new Date("2026-10-26T22:00:00Z");
const base = {
  orders_enabled: true,
  hours: { configured: true, is_open: true, today: [], weekly: {} },
};

describe("store status", () => {
  it("formats times in store time regardless of the device", () => {
    expect(formatStoreClock("2026-10-27T03:00:00Z")).toBe("9:00 pm");
    expect(formatStoreClock("2026-10-26T20:00:00Z")).toBe("2:00 pm");
  });

  it("names the day relative to now in store time", () => {
    expect(relativeDay("2026-10-27T03:00:00Z", NOW)).toBe("hoy"); // 9 pm Monday local
    expect(relativeDay("2026-10-27T20:00:00Z", NOW)).toBe("mañana");
    expect(relativeDay("2026-10-30T20:00:00Z", NOW)).toBe("el viernes");
  });

  it("shows open with closing time, then 'closing soon' in the last 30 minutes", () => {
    expect(
      describeStoreStatus(
        {
          ...base,
          hours: { ...base.hours, closes_at: "2026-10-27T03:00:00Z" },
        },
        NOW,
      ),
    ).toMatchObject({
      canOrder: true,
      label: "Abierto · cierra 9:00 pm",
      tone: "open",
    });
    expect(
      describeStoreStatus(
        {
          ...base,
          hours: { ...base.hours, closes_at: "2026-10-26T22:20:00Z" },
        },
        NOW,
      ),
    ).toMatchObject({ canOrder: true, tone: "closing" });
  });

  it("explains when a closed store opens", () => {
    const s = describeStoreStatus(
      {
        ...base,
        hours: {
          ...base.hours,
          is_open: false,
          opens_at: "2026-10-27T20:00:00Z",
        },
      },
      NOW,
    );
    expect(s).toMatchObject({
      canOrder: false,
      label: "Cerrado",
      tone: "closed",
    });
    expect(s.detail).toBe("Estamos cerrados. Abrimos mañana a las 2:00 pm.");
  });

  it("respects the manual switch and older backends without hours", () => {
    expect(
      describeStoreStatus({ orders_enabled: false, hours: undefined }, NOW),
    ).toMatchObject({ canOrder: false });
    expect(describeStoreStatus({ orders_enabled: true }, NOW)).toMatchObject({
      canOrder: true,
      label: "Abierto",
    });
  });

  it("lists the weekly schedule Monday first, marking today in store time", () => {
    expect(formatScheduleClock("00:30")).toBe("12:30 am");
    expect(formatScheduleClock("12:00")).toBe("12:00 pm");
    // 03:00 UTC Tuesday is still Monday 9 pm in El Salvador.
    expect(storeDayOfWeek(new Date("2026-10-27T03:00:00Z"))).toBe("mon");
    const rows = scheduleRows(
      {
        ...base.hours,
        weekly: {
          mon: [{ open: "14:00", close: "21:00" }],
          sat: [
            { open: "10:00", close: "13:00" },
            { open: "15:00", close: "22:00" },
          ],
        },
      },
      NOW,
    );
    expect(rows.map((r) => r.key)).toEqual([
      "mon",
      "tue",
      "wed",
      "thu",
      "fri",
      "sat",
      "sun",
    ]);
    expect(rows[0]).toMatchObject({
      hours: "2:00 pm – 9:00 pm",
      isToday: true,
    });
    expect(rows[1].hours).toBe("Cerrado");
    expect(rows[5].hours).toBe("10:00 am – 1:00 pm · 3:00 pm – 10:00 pm");
    expect(scheduleRows({ ...base.hours, configured: false }, NOW)).toEqual([]);
  });
});
