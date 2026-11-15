/**
 * Period-over-period comparison for the analytics KPIs. Dates are calendar
 * days (YYYY-MM-DD) in the store's time zone, and ranges are inclusive.
 */
import { STORE_TIME_ZONE } from "@features/catalog/lib/store-status";

/** Today as YYYY-MM-DD in store time (not UTC: after 6 pm UTC is "tomorrow"). */
export function storeTodayISO(now: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: STORE_TIME_ZONE }).format(
    now,
  );
}

function shiftDays(iso: string, days: number): string {
  const date = new Date(`${iso}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

/** The `days`-long range ending today (inclusive), in store time. */
export function lastDays(
  days: number,
  now: Date = new Date(),
): { start: string; end: string } {
  const end = storeTodayISO(now);
  return { start: shiftDays(end, -(days - 1)), end };
}

/** The range of equal length immediately before [start, end]. */
export function previousRange(
  start: string,
  end: string,
): { start: string; end: string } {
  const length =
    Math.round(
      (Date.parse(`${end}T12:00:00Z`) - Date.parse(`${start}T12:00:00Z`)) /
        86_400_000,
    ) + 1;
  const prevEnd = shiftDays(start, -1);
  return { start: shiftDays(prevEnd, -(length - 1)), end: prevEnd };
}

export interface Delta {
  /** Rounded percentage change, e.g. 12 or -8. */
  percent: number;
  direction: "up" | "down" | "flat";
  /** "+12 % vs. periodo anterior" */
  label: string;
}

/** Change vs. the previous period; null when there is nothing to compare. */
export function delta(
  current: number,
  previous: number | undefined,
): Delta | null {
  if (previous === undefined || previous <= 0) return null;
  const percent = Math.round(((current - previous) / previous) * 100);
  const direction = percent > 0 ? "up" : percent < 0 ? "down" : "flat";
  const sign = percent > 0 ? "+" : "";
  return {
    percent,
    direction,
    label: `${sign}${percent} % vs. periodo anterior`,
  };
}
