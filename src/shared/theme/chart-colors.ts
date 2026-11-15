/**
 * Chart colours for ECharts, which paints on a canvas and can't read CSS
 * variables or color-mix(). Values mirror the daisyUI themes and --st-*
 * tokens in global.css: keep them in sync when the palette changes.
 */
import { DARK_THEME } from "./constants";

export interface ChartTheme {
  dark: boolean;
  text: string;
  muted: string;
  grid: string;
  surface: string;
  tooltipBackground: string;
  tooltipBorder: string;
  tooltipText: string;
  /** Single-series marks (orders and revenue over time). */
  series: string;
  /** Categorical marks, brand colours first. */
  categorical: string[];
  /** Order status → colour, the chip ink of each state. */
  status: Record<string, string>;
  /** Stock levels: out, low, ok. */
  stock: { out: string; low: string; ok: string };
}

const DAY: ChartTheme = {
  dark: false,
  text: "#2a1418",
  muted: "#6e4f55",
  grid: "rgba(42, 20, 24, 0.12)",
  surface: "#ffffff",
  tooltipBackground: "rgba(42, 20, 24, 0.96)",
  tooltipBorder: "rgba(42, 20, 24, 0.5)",
  tooltipText: "#fff8ec",
  series: "#00756f",
  categorical: [
    "#00968c",
    "#63001f",
    "#eda100",
    "#e87ba4",
    "#2a78d6",
    "#e8623c",
  ],
  status: {
    pendiente_revision: "#c98500",
    recibida: "#00968c",
    en_proceso: "#e87ba4",
    lista: "#1f6b3a",
    entregada: "#63001f",
    cancelada: "#a3122e",
  },
  stock: { out: "#a3122e", low: "#c98500", ok: "#1f6b3a" },
};

const NIGHT: ChartTheme = {
  dark: true,
  text: "#fbf0d5",
  muted: "#c9b3a9",
  grid: "rgba(251, 240, 213, 0.14)",
  surface: "#281319",
  tooltipBackground: "rgba(27, 11, 16, 0.97)",
  tooltipBorder: "rgba(201, 179, 169, 0.35)",
  tooltipText: "#fbf0d5",
  series: "#2cc9be",
  categorical: [
    "#2cc9be",
    "#f9b4da",
    "#f5c26b",
    "#ff8a6b",
    "#6aa8f0",
    "#b3a6f5",
  ],
  status: {
    pendiente_revision: "#f5c26b",
    recibida: "#91e2d6",
    en_proceso: "#f9b4da",
    lista: "#7fd69a",
    entregada: "#d9c6bc",
    cancelada: "#ff8a9b",
  },
  stock: { out: "#ff8a9b", low: "#f5c26b", ok: "#7fd69a" },
};

export function chartThemeFor(theme: string | null | undefined): ChartTheme {
  return theme === DARK_THEME ? NIGHT : DAY;
}

/** Palette for the theme currently on <html>. */
export function currentChartTheme(): ChartTheme {
  if (typeof document === "undefined") return DAY;
  return chartThemeFor(document.documentElement.getAttribute("data-theme"));
}
