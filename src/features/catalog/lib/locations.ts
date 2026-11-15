/**
 * Customer-facing helpers for the locations (sucursales): WhatsApp links,
 * whether they share one schedule, and the summary in the header chip.
 */
import type { PublicLocation, StoreHoursStatus } from "./api";
import {
  formatStoreClock,
  relativeDay,
  type StoreStatus,
} from "./store-status";

/** Store-wide WhatsApp, used when a location has none. */
export const DEFAULT_WHATSAPP = "50376454347";

/** wa.me link for a location's number (digits; 8-digit numbers get +503). */
export function whatsappLink(number: string | null | undefined): string {
  let digits = (number ?? "").replace(/\D/g, "");
  if (digits.length === 8) digits = `503${digits}`;
  return `https://wa.me/${digits || DEFAULT_WHATSAPP}`;
}

/** "50376454347" → "7645-4347". */
export function displayPhone(number: string | null | undefined): string {
  const digits = (number ?? "").replace(/\D/g, "");
  const local =
    digits.length === 11 && digits.startsWith("503") ? digits.slice(3) : digits;
  return local.length === 8
    ? `${local.slice(0, 4)}-${local.slice(4)}`
    : (number ?? "");
}

function isOpenNow(hours: StoreHoursStatus | undefined): boolean {
  return !hours?.configured || hours.is_open;
}

/** True when every location has the same weekly schedule. */
export function sharesOneSchedule(locations: PublicLocation[]): boolean {
  if (locations.length <= 1) return true;
  const first = JSON.stringify(locations[0].hours?.weekly ?? {});
  return locations.every(
    (l) => JSON.stringify(l.hours?.weekly ?? {}) === first,
  );
}

/** Header chip across locations: "Abierto", "2 de 3 abiertas", "Cerrado · abrimos 2:00 pm". */
export function describeLocations(
  locations: PublicLocation[],
  now: Date = new Date(),
): StoreStatus | null {
  if (locations.length === 0) return null;
  const open = locations.filter((l) => isOpenNow(l.hours));
  if (open.length === locations.length) {
    return { canOrder: true, label: "Abierto", detail: null, tone: "open" };
  }
  if (open.length > 0) {
    return {
      canOrder: true,
      label: `${open.length} de ${locations.length} abiertas`,
      detail: open.map((l) => l.name).join(", "),
      tone: "open",
    };
  }
  const next = locations
    .map((l) => l.hours?.opens_at)
    .filter((v): v is string => !!v)
    .sort()[0];
  return {
    canOrder: false,
    label: next ? `Cerrado · abrimos ${formatStoreClock(next)}` : "Cerrado",
    detail: next
      ? `Abrimos ${relativeDay(next, now)} a las ${formatStoreClock(next)}.`
      : null,
    tone: "closed",
  };
}
