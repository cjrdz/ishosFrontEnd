/**
 * Tickets for 80 mm / 58 mm thermal printers.
 *
 * - "customer": the receipt handed to the client (prices, payment, change).
 * - "kitchen": the comanda for whoever prepares the order: big order number,
 *   type/table and every flavour and topping, no prices.
 *
 * Every value is HTML-escaped: names, phones and notes come from public
 * orders, and the ticket renders in a same-origin frame. Text is pure black,
 * because thermal heads print grey as faint dots. `@page { margin: 0 }` drops
 * the browser's date/URL header and footer.
 */
import { formatCurrency } from "@shared/utils/formatters";
// The print frame has its own document, so it loads the same bundled fonts.
import amaticUrl from "@fontsource/amatic-sc/files/amatic-sc-latin-700-normal.woff2?url";
import roboto500Url from "@fontsource/roboto/files/roboto-latin-500-normal.woff2?url";
import roboto700Url from "@fontsource/roboto/files/roboto-latin-700-normal.woff2?url";

export type PaperWidth = "80" | "58";
export type TicketKind = "customer" | "kitchen";
export type PaymentMethod = "efectivo" | "tarjeta" | "transferencia" | "otro";

/** The fields a ticket needs; both the admin order and the public tracking response fit it. */
export interface ReceiptItem {
  product_name: string;
  quantity: number;
  subtotal: number;
  customizations?: { [key: string]: unknown } | null;
}

export interface ReceiptOrder {
  order_number: string;
  created_at?: string;
  customer_name?: string | null;
  customer_phone?: string | null;
  order_type: "en_local" | "para_llevar";
  table_number?: number | null;
  payment_method?: PaymentMethod;
  amount_received?: number | null;
  total_amount: number;
  notes?: string | null;
  created_by_role?: string | null;
  created_by_name?: string | null;
  items?: ReceiptItem[];
}

export const STORE_NAME = "Isho's Factory";
export const STORE_TAGLINE = "Gelatos y sorbetes artesanales";
export const STORE_CONTACT = "Ahuachapán, El Salvador · WhatsApp 7645-4347";
export const STORE_SOCIAL = "Síguenos en Instagram @ishos_factory";

const PAPER_WIDTH_KEY = "ishos.receipt-paper-width";
const STORE_TIME_ZONE = "America/El_Salvador";

export const PAYMENT_LABELS: Record<PaymentMethod, string> = {
  efectivo: "Efectivo",
  tarjeta: "Tarjeta",
  transferencia: "Transferencia",
  otro: "Otro",
};

export function getPaperWidth(): PaperWidth {
  try {
    return localStorage.getItem(PAPER_WIDTH_KEY) === "58" ? "58" : "80";
  } catch {
    return "80";
  }
}

export function setPaperWidth(width: PaperWidth): void {
  try {
    localStorage.setItem(PAPER_WIDTH_KEY, width);
  } catch {
    // Private mode: the default (80 mm) is used.
  }
}

export function escapeHtml(value: unknown): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function formatTicketDate(iso: string | undefined): string {
  const date = iso ? new Date(iso) : new Date();
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("es-SV", {
    timeZone: STORE_TIME_ZONE,
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  })
    .format(date)
    .replace(/\s?a\.?\s?m\.?/i, " am")
    .replace(/\s?p\.?\s?m\.?/i, " pm");
}

function formatTime(iso: string | undefined): string {
  const date = iso ? new Date(iso) : new Date();
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("es-SV", {
    timeZone: STORE_TIME_ZONE,
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  })
    .format(date)
    .replace(/\s?a\.?\s?m\.?/i, " am")
    .replace(/\s?p\.?\s?m\.?/i, " pm");
}

function names(value: unknown): string[] {
  return Array.isArray(value) ? value.map(String).filter(Boolean) : [];
}

export function shortOrderNumber(orderNumber: string): string {
  return orderNumber.split("-").pop() ?? orderNumber;
}

export function orderTypeLabel(
  order: Pick<ReceiptOrder, "order_type" | "table_number">,
): string {
  if (order.order_type !== "en_local") return "Para llevar";
  return order.table_number
    ? `En local · Mesa ${order.table_number}`
    : "En local";
}

export function itemCount(order: ReceiptOrder): number {
  return (order.items ?? []).reduce((sum, item) => sum + item.quantity, 0);
}

export function changeDue(order: ReceiptOrder): number | null {
  if (order.payment_method !== "efectivo" || order.amount_received == null)
    return null;
  return Math.max(0, order.amount_received - order.total_amount);
}

/** Who took the order, for the ticket footer. Empty when unknown. */
export function servedBy(order: ReceiptOrder): string {
  if (order.created_by_role && order.created_by_role !== "customer") {
    return order.created_by_name ?? "";
  }
  return "Pedido en línea";
}

export interface ItemDetail {
  label: string;
  value: string;
}

/** Customization lines for one item, unescaped. */
export function itemDetails(
  item: ReceiptItem,
  options: { prices: boolean } = { prices: true },
): ItemDetail[] {
  const c = item.customizations;
  if (!c) return [];
  const lines: ItemDetail[] = [];
  const flavors = names(c.flavor_names);
  if (flavors.length)
    lines.push({
      label: flavors.length > 1 ? "Sabores" : "Sabor",
      value: flavors.join(", "),
    });
  else if (typeof c.flavor_name === "string" && c.flavor_name)
    lines.push({ label: "Sabor", value: c.flavor_name });
  const included = names(c.included_addon_names);
  if (included.length)
    lines.push({ label: "Incluye", value: included.join(", ") });
  const extras = names(c.extra_addon_names);
  if (extras.length) {
    const prices = Array.isArray(c.extra_addon_prices)
      ? (c.extra_addon_prices as unknown[])
      : [];
    const extraTotal = prices.reduce<number>(
      (sum, p) => sum + (Number.isFinite(Number(p)) ? Number(p) : 0),
      0,
    );
    const price =
      options.prices && extraTotal > 0
        ? ` (+${formatCurrency(extraTotal)})`
        : "";
    lines.push({ label: "Extras", value: `${extras.join(", ")}${price}` });
  }
  const addons = names(c.addon_names);
  if (addons.length && !included.length && !extras.length) {
    lines.push({ label: "Complementos", value: addons.join(", ") });
  }
  if (typeof c.notes === "string" && c.notes)
    lines.push({ label: "Nota", value: c.notes });
  return lines;
}

function line(label: string, value: string, cls = ""): string {
  return `<div class="line ${cls}"><span>${label}</span><span class="amt">${value}</span></div>`;
}

function customerTicket(order: ReceiptOrder): string {
  const items = order.items ?? [];
  const rows =
    items
      .map((item) => {
        const details = itemDetails(item)
          .map(
            (d) =>
              `<div class="detail">${escapeHtml(`${d.label}: ${d.value}`)}</div>`,
          )
          .join("");
        return `<div class="item">
          <div class="line"><span class="qty">${item.quantity}×</span><span class="name">${escapeHtml(item.product_name)}</span><span class="amt">${formatCurrency(item.subtotal)}</span></div>
          ${details}
        </div>`;
      })
      .join("") || `<div class="detail">Sin productos</div>`;

  const change = changeDue(order);
  const cash =
    change != null && order.amount_received != null
      ? line("Recibido", formatCurrency(order.amount_received)) +
        line("Cambio", formatCurrency(change), "strong")
      : "";
  const attendant = servedBy(order);
  const payment = order.payment_method
    ? line(
        "Pago",
        escapeHtml(
          PAYMENT_LABELS[order.payment_method] ?? order.payment_method,
        ),
      )
    : "";

  return `<section class="ticket">
  <div class="center">
    <div class="brand">${escapeHtml(STORE_NAME)}</div>
    <div class="tag">${escapeHtml(STORE_TAGLINE)}</div>
    <div class="tag">${escapeHtml(STORE_CONTACT)}</div>
  </div>

  <div class="rule"></div>

  <div class="center">
    <div class="order">#${escapeHtml(shortOrderNumber(order.order_number))}<small>${escapeHtml(order.order_number)}</small></div>
    <div class="badge">${escapeHtml(orderTypeLabel(order))}</div>
  </div>

  <div class="rule"></div>

  <div class="meta">
    ${line("Fecha", escapeHtml(formatTicketDate(order.created_at)))}
    ${line("Cliente", escapeHtml(order.customer_name || "—"))}
    ${order.customer_phone ? line("Teléfono", escapeHtml(order.customer_phone)) : ""}
    ${attendant ? line("Atendió", escapeHtml(attendant)) : ""}
  </div>

  <div class="rule"></div>

  ${rows}

  <div class="rule solid"></div>

  ${line("Artículos", String(itemCount(order)), "muted")}
  ${line("TOTAL", formatCurrency(order.total_amount), "total")}
  ${payment}
  ${cash}

  ${order.notes ? `<div class="rule"></div><div class="note">Nota: ${escapeHtml(order.notes)}</div>` : ""}

  <div class="rule"></div>
  <div class="center">
    <div class="strong">¡Gracias por tu compra!</div>
    <div class="muted">${escapeHtml(STORE_SOCIAL)}</div>
    <div class="muted">Impreso ${escapeHtml(formatTicketDate(undefined))}</div>
  </div>
</section>`;
}

function kitchenTicket(order: ReceiptOrder): string {
  const items = order.items ?? [];
  const rows =
    items
      .map((item) => {
        const details = itemDetails(item, { prices: false })
          .map((d) =>
            d.label === "Nota"
              ? `<div class="k-note">NOTA: ${escapeHtml(d.value)}</div>`
              : `<div class="k-detail"><b>${escapeHtml(d.label)}:</b> ${escapeHtml(d.value)}</div>`,
          )
          .join("");
        return `<div class="k-item">
          <div class="k-name"><span class="k-qty">${item.quantity}×</span> ${escapeHtml(item.product_name)}</div>
          ${details}
        </div>`;
      })
      .join("") || `<div class="k-detail">Sin productos</div>`;

  const where =
    order.order_type === "en_local"
      ? order.table_number
        ? `MESA ${order.table_number}`
        : "EN LOCAL"
      : "PARA LLEVAR";

  return `<section class="ticket">
  <div class="center">
    <div class="k-kind">COMANDA · COCINA</div>
    <div class="k-order">#${escapeHtml(shortOrderNumber(order.order_number))}</div>
    <div class="k-where">${escapeHtml(where)}</div>
  </div>

  <div class="rule"></div>
  ${line("Cliente", escapeHtml(order.customer_name || "—"))}
  ${line("Hora", escapeHtml(formatTime(order.created_at)))}
  ${line("Artículos", String(itemCount(order)))}
  <div class="rule solid"></div>

  ${rows}

  ${order.notes ? `<div class="rule"></div><div class="note k-order-note">NOTA DE LA ORDEN: ${escapeHtml(order.notes)}</div>` : ""}

  <div class="rule"></div>
  <div class="center muted">${escapeHtml(order.order_number)} · Impreso ${escapeHtml(formatTime(undefined))}</div>
</section>`;
}

export function renderReceipt(
  order: ReceiptOrder,
  width: PaperWidth = "80",
  kinds: TicketKind[] = ["customer"],
): string {
  const paperMm = width === "58" ? 58 : 80;
  const contentMm = width === "58" ? 48 : 72;
  const base = width === "58" ? 11 : 12.5;
  const tickets = (kinds.length ? kinds : ["customer" as const])
    .map((kind) =>
      kind === "kitchen" ? kitchenTicket(order) : customerTicket(order),
    )
    .join("");
  const title =
    kinds.length === 1 && kinds[0] === "kitchen" ? "Comanda" : "Ticket";

  return `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8" />
<title>${title} ${escapeHtml(order.order_number)}</title>

<style>
  @font-face { font-family: "Amatic SC"; font-weight: 700; src: url("${amaticUrl}") format("woff2"); }
  @font-face { font-family: "Roboto"; font-weight: 500; src: url("${roboto500Url}") format("woff2"); }
  @font-face { font-family: "Roboto"; font-weight: 700; src: url("${roboto700Url}") format("woff2"); }
  @page { size: ${paperMm}mm auto; margin: 0; }
  * { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; background: #fff; }
  body {
    color: #000; font: 500 ${base}px/1.35 "Roboto", "Arial", sans-serif;
    -webkit-print-color-adjust: exact; print-color-adjust: exact;
  }
  .ticket { width: ${contentMm}mm; margin: 0 auto; padding: 4mm 0 6mm; }
  /* Each ticket on its own page: most thermal drivers cut between pages. */
  .ticket + .ticket { break-before: page; page-break-before: always; }
  .center { text-align: center; }
  .strong { font-weight: 800; }
  .brand { font: 700 ${width === "58" ? 30 : 36}px/1 "Amatic SC", "Arial Narrow", sans-serif; letter-spacing: .02em; }
  .tag { font-size: ${base - 1}px; }
  .rule { border-top: 1.5px dashed #000; margin: 2.5mm 0; }
  .rule.solid { border-top-style: solid; }
  .order { font-size: ${base + 9}px; font-weight: 800; letter-spacing: .02em; }
  .order small { display: block; font-size: ${base - 1}px; font-weight: 600; letter-spacing: 0; }
  .badge { display: inline-block; border: 1.5px solid #000; border-radius: 3px; padding: .5mm 2mm; margin-top: 1.5mm; font-weight: 800; }
  .line { display: flex; gap: 2mm; align-items: baseline; }
  .line > span:first-child { flex: 1; min-width: 0; }
  .line.strong { font-weight: 800; }
  .qty { flex: none !important; min-width: 7mm; font-weight: 800; }
  .name { flex: 1; min-width: 0; font-weight: 700; overflow-wrap: anywhere; }
  .amt { flex: none; text-align: right; font-variant-numeric: tabular-nums; white-space: nowrap; }
  .item { margin-bottom: 1.8mm; }
  .detail { padding-left: 9mm; font-size: ${base - 1}px; font-weight: 600; overflow-wrap: anywhere; }
  .meta .line { margin-bottom: .6mm; }
  .total { font-size: ${base + 6}px; font-weight: 800; }
  .note { border: 1.5px solid #000; padding: 1.5mm 2mm; overflow-wrap: anywhere; font-weight: 700; }
  .muted { font-size: ${base - 1}px; }
  .k-kind { font-size: ${base}px; font-weight: 800; letter-spacing: .12em; }
  .k-order { font-size: ${base + 22}px; font-weight: 800; line-height: 1.05; }
  .k-where { display: inline-block; margin-top: 1mm; padding: .6mm 2.5mm; background: #000; color: #fff; font-size: ${base + 3}px; font-weight: 800; border-radius: 3px; }
  .k-item { padding: 1.6mm 0; }
  .k-item + .k-item { border-top: 1px dashed #000; }
  .k-name { font-size: ${base + 4}px; font-weight: 800; overflow-wrap: anywhere; }
  .k-qty { display: inline-block; min-width: 8mm; }
  .k-detail { padding-left: 8mm; font-size: ${base + 1}px; overflow-wrap: anywhere; }
  .k-note { margin: 1mm 0 0 8mm; padding: .8mm 1.5mm; border: 1.5px solid #000; font-weight: 800; overflow-wrap: anywhere; }
  .k-order-note { font-size: ${base + 1}px; }
</style>
</head>
<body>
${tickets}
</body>
</html>`;
}

export function printOrderReceipt(
  order: ReceiptOrder,
  width: PaperWidth = getPaperWidth(),
  kinds: TicketKind[] = ["customer"],
): void {
  const iframe = document.createElement("iframe");
  iframe.setAttribute("aria-hidden", "true");
  iframe.setAttribute("tabindex", "-1");
  Object.assign(iframe.style, {
    position: "fixed",
    right: "0",
    bottom: "0",
    width: "0",
    height: "0",
    border: "0",
  });
  iframe.srcdoc = renderReceipt(order, width, kinds);
  iframe.onload = () => {
    const win = iframe.contentWindow;
    if (!win) return;
    // Wait for the brand font so the header doesn't print in the fallback.
    const fontsReady = win.document.fonts?.ready ?? Promise.resolve();
    void Promise.race([
      fontsReady,
      new Promise((r) => setTimeout(r, 800)),
    ]).then(() => {
      win.focus();
      win.print();
      setTimeout(() => iframe.remove(), 1000);
    });
  };
  document.body.appendChild(iframe);
}
