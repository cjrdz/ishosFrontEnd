/**
 * Customer-facing store status ("Abierto · cierra 9:00 pm") from the backend's
 * hours status and the manual orders switch. Times are shown in the store's
 * time zone, whatever the customer's device is set to.
 */
import type { StorePublicSettings } from "./api";

export const STORE_TIME_ZONE = "America/El_Salvador";

export interface StoreStatus {
  /** Customers can place orders right now. */
  canOrder: boolean;
  /** Short label for the header chip. */
  label: string;
  /** Longer sentence for banners (null when open and unremarkable). */
  detail: string | null;
  tone: "open" | "closing" | "closed";
}

const CLOSING_SOON_MS = 30 * 60 * 1000;

export function formatStoreClock(iso: string): string {
  return new Intl.DateTimeFormat("es-SV", {
    timeZone: STORE_TIME_ZONE,
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  })
    .format(new Date(iso))
    .replace(/\s?a\.?\s?m\.?/i, " am")
    .replace(/\s?p\.?\s?m\.?/i, " pm")
    .replace(/ /g, " ")
    .trim();
}

function storeDayKey(date: Date): string {
  // YYYY-MM-DD in the store's time zone.
  return new Intl.DateTimeFormat("en-CA", { timeZone: STORE_TIME_ZONE }).format(
    date,
  );
}

/** "hoy", "mañana" or "el viernes", relative to now in store time. */
export function relativeDay(iso: string, now: Date = new Date()): string {
  const target = new Date(iso);
  const today = storeDayKey(now);
  const tomorrow = storeDayKey(new Date(now.getTime() + 24 * 3600 * 1000));
  const day = storeDayKey(target);
  if (day === today) return "hoy";
  if (day === tomorrow) return "mañana";
  const weekday = new Intl.DateTimeFormat("es-SV", {
    timeZone: STORE_TIME_ZONE,
    weekday: "long",
  }).format(target);
  return `el ${weekday}`;
}

export function describeStoreStatus(
  settings: Pick<StorePublicSettings, "orders_enabled" | "hours"> | null,
  now: Date = new Date(),
): StoreStatus {
  if (!settings) {
    return { canOrder: true, label: "", detail: null, tone: "open" };
  }
  const hours = settings.hours;
  const closed = (detail: string): StoreStatus => ({
    canOrder: false,
    label: "Cerrado",
    detail,
    tone: "closed",
  });

  if (hours?.configured && !hours.is_open) {
    return closed(
      hours.opens_at
        ? `Estamos cerrados. Abrimos ${relativeDay(hours.opens_at, now)} a las ${formatStoreClock(hours.opens_at)}.`
        : "Estamos cerrados por ahora.",
    );
  }
  if (!settings.orders_enabled) {
    return closed("No estamos recibiendo pedidos en línea en este momento.");
  }
  if (hours?.configured && hours.closes_at) {
    const closesIn = new Date(hours.closes_at).getTime() - now.getTime();
    const at = formatStoreClock(hours.closes_at);
    if (closesIn <= CLOSING_SOON_MS) {
      return {
        canOrder: true,
        label: `Cierra pronto · ${at}`,
        detail: `Cerramos a las ${at}.`,
        tone: "closing",
      };
    }
    return {
      canOrder: true,
      label: `Abierto · cierra ${at}`,
      detail: null,
      tone: "open",
    };
  }
  return { canOrder: true, label: "Abierto", detail: null, tone: "open" };
}

const WEEK_DAYS = [
  { key: "mon", label: "Lunes" },
  { key: "tue", label: "Martes" },
  { key: "wed", label: "Miércoles" },
  { key: "thu", label: "Jueves" },
  { key: "fri", label: "Viernes" },
  { key: "sat", label: "Sábado" },
  { key: "sun", label: "Domingo" },
] as const;

/** "14:00" → "2:00 pm" (schedule times are already store-local). */
export function formatScheduleClock(value: string): string {
  const [h, m] = value.split(":").map(Number);
  const hour12 = h % 12 === 0 ? 12 : h % 12;
  return `${hour12}:${String(m).padStart(2, "0")} ${h < 12 ? "am" : "pm"}`;
}

/** Day key (mon…sun) for now in store time. */
export function storeDayOfWeek(now: Date = new Date()): string {
  const weekday = new Intl.DateTimeFormat("en-US", {
    timeZone: STORE_TIME_ZONE,
    weekday: "short",
  })
    .format(now)
    .toLowerCase();
  return weekday.slice(0, 3);
}

export interface ScheduleRow {
  key: string;
  label: string;
  /** "2:00 pm – 9:00 pm", split shifts joined with " · ", or "Cerrado". */
  hours: string;
  isToday: boolean;
}

/** Weekly schedule rows, Monday first, for display. Empty when not configured. */
export function scheduleRows(
  hours: StorePublicSettings["hours"],
  now: Date = new Date(),
): ScheduleRow[] {
  if (!hours?.configured) return [];
  const today = storeDayOfWeek(now);
  return WEEK_DAYS.map(({ key, label }) => {
    const ranges = hours.weekly?.[key] ?? [];
    return {
      key,
      label,
      hours: ranges.length
        ? ranges
            .map(
              (r) =>
                `${formatScheduleClock(r.open)} – ${formatScheduleClock(r.close)}`,
            )
            .join(" · ")
        : "Cerrado",
      isToday: key === today,
    };
  });
}
