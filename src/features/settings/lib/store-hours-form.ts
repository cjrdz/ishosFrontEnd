/**
 * Weekly opening hours editor helpers. Mirrors the backend rules
 * (services/store_hours.go) so mistakes show next to the day before saving;
 * the backend still validates.
 */
import type { WeekDay, WeeklyHours } from "@features/admin-management/lib/bff";

export const MAX_RANGES_PER_DAY = 3;

export const WEEK_DAYS: { key: WeekDay; label: string }[] = [
  { key: "mon", label: "Lunes" },
  { key: "tue", label: "Martes" },
  { key: "wed", label: "Miércoles" },
  { key: "thu", label: "Jueves" },
  { key: "fri", label: "Viernes" },
  { key: "sat", label: "Sábado" },
  { key: "sun", label: "Domingo" },
];

export type TimeRange = { open: string; close: string };

export function emptyWeek(): WeeklyHours {
  return { mon: [], tue: [], wed: [], thu: [], fri: [], sat: [], sun: [] };
}

function minutes(clock: string): number | null {
  const match = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(clock);
  return match ? Number(match[1]) * 60 + Number(match[2]) : null;
}

/** Spanish error per day key; empty object when the week is valid. */
export function validateWeek(
  week: WeeklyHours,
): Partial<Record<WeekDay, string>> {
  const errors: Partial<Record<WeekDay, string>> = {};
  for (const { key } of WEEK_DAYS) {
    const ranges = week[key] ?? [];
    if (ranges.length > MAX_RANGES_PER_DAY) {
      errors[key] = `Máximo ${MAX_RANGES_PER_DAY} horarios por día.`;
      continue;
    }
    const spans: [number, number][] = [];
    for (const range of ranges) {
      const open = minutes(range.open);
      const close = minutes(range.close);
      if (open === null || close === null) {
        errors[key] = "Completa la hora de apertura y de cierre.";
        break;
      }
      if (close <= open) {
        errors[key] = "La hora de cierre debe ser después de la apertura.";
        break;
      }
      spans.push([open, close]);
    }
    if (errors[key]) continue;
    spans.sort((a, b) => a[0] - b[0]);
    if (spans.some((span, i) => i > 0 && span[0] < spans[i - 1][1])) {
      errors[key] = "Los horarios se traslapan.";
    }
  }
  return errors;
}

/** Copies one day's ranges to every other day (new arrays, no shared refs). */
export function copyDayToAll(week: WeeklyHours, from: WeekDay): WeeklyHours {
  const next = emptyWeek();
  for (const { key } of WEEK_DAYS) {
    next[key] = week[from].map((range) => ({ ...range }));
  }
  return next;
}
