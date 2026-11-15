import { describe, expect, it } from "vitest";
import type { PublicLocation } from "./api";
import {
  describeLocations,
  displayPhone,
  sharesOneSchedule,
  whatsappLink,
} from "./locations";

const NOW = new Date("2026-11-13T20:00:00Z"); // 2:00 pm in El Salvador

function loc(name: string, isOpen: boolean, opensAt?: string): PublicLocation {
  return {
    id: name,
    slug: name,
    name,
    address: "",
    maps_url: "",
    maps_embed_url: "",
    whatsapp: "50376454347",
    phone: "",
    accepts_online_orders: false,
    hours: {
      configured: true,
      is_open: isOpen,
      opens_at: opensAt,
      today: [],
      weekly: { mon: [{ open: "14:00", close: "21:00" }] },
    },
  };
}

describe("locations", () => {
  it("builds WhatsApp links and display numbers", () => {
    expect(whatsappLink("7645-4347")).toBe("https://wa.me/50376454347");
    expect(whatsappLink("")).toBe("https://wa.me/50376454347");
    expect(displayPhone("50376454347")).toBe("7645-4347");
  });

  it("summarises how many locations are open", () => {
    expect(
      describeLocations([loc("a", true), loc("b", true)], NOW)?.label,
    ).toBe("Abierto");
    expect(
      describeLocations([loc("a", true), loc("b", false)], NOW)?.label,
    ).toBe("1 de 2 abiertas");
    const closed = describeLocations(
      [loc("a", false, "2026-11-14T20:00:00Z"), loc("b", false)],
      NOW,
    );
    expect(closed?.tone).toBe("closed");
    expect(closed?.label).toContain("abrimos 2:00");
  });

  it("detects a shared schedule", () => {
    expect(sharesOneSchedule([loc("a", true), loc("b", false)])).toBe(true);
    const other = loc("c", true);
    other.hours.weekly = { mon: [{ open: "10:00", close: "18:00" }] };
    expect(sharesOneSchedule([loc("a", true), other])).toBe(false);
  });
});
