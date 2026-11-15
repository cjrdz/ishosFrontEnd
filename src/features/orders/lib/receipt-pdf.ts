/**
 * Customer receipt as a real PDF file, laid out like the 80 mm counter ticket.
 * jsPDF is loaded on demand so it never weighs on the tracking page itself.
 */
import { formatCurrency } from "@shared/utils/formatters";
import {
  PAYMENT_LABELS,
  receiptContactLine,
  receiptLocation,
  STORE_NAME,
  STORE_SOCIAL,
  STORE_TAGLINE,
  changeDue,
  formatTicketDate,
  itemCount,
  itemDetails,
  orderTypeLabel,
  shortOrderNumber,
  type ReceiptOrder,
} from "./receipt-renderer";

type JsPDF = import("jspdf").jsPDF;

const PAGE_WIDTH = 80;
const MARGIN = 6;
const CONTENT = PAGE_WIDTH - MARGIN * 2;
const PT_TO_MM = 0.3528;

/** The built-in PDF fonts only cover Latin-1; drop anything else (emoji…). */
export function pdfSafe(value: unknown): string {
  return String(value ?? "")
    .replace(/[–—]/g, "-")
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[^\u0009\u000A\u000D -~ -ÿ]/g, "")
    .trim();
}

function layout(doc: JsPDF, order: ReceiptOrder, statusLabel?: string): number {
  let y = MARGIN;
  const lineHeight = (size: number) => size * PT_TO_MM * 1.3;

  const font = (size: number, bold = false) => {
    doc.setFont("helvetica", bold ? "bold" : "normal");
    doc.setFontSize(size);
  };

  const center = (text: string, size: number, bold = false) => {
    font(size, bold);
    for (const part of doc.splitTextToSize(
      pdfSafe(text),
      CONTENT,
    ) as string[]) {
      y += lineHeight(size);
      doc.text(part, PAGE_WIDTH / 2, y, { align: "center" });
    }
  };

  const pair = (label: string, value: string, size = 8.5, bold = false) => {
    font(size, bold);
    const valueText = pdfSafe(value);
    const valueWidth = Math.min(doc.getTextWidth(valueText), CONTENT * 0.62);
    const labelLines = doc.splitTextToSize(
      pdfSafe(label),
      CONTENT - valueWidth - 2,
    ) as string[];
    const valueLines = doc.splitTextToSize(
      valueText,
      CONTENT * 0.62,
    ) as string[];
    const rows = Math.max(labelLines.length, valueLines.length);
    for (let i = 0; i < rows; i++) {
      y += lineHeight(size);
      if (labelLines[i]) doc.text(labelLines[i], MARGIN, y);
      if (valueLines[i])
        doc.text(valueLines[i], PAGE_WIDTH - MARGIN, y, { align: "right" });
    }
  };

  const rule = (dashed = true) => {
    y += 2.4;
    doc.setLineWidth(0.3);
    doc.setLineDashPattern(dashed ? [1, 0.8] : [], 0);
    doc.line(MARGIN, y, PAGE_WIDTH - MARGIN, y);
    doc.setLineDashPattern([], 0);
    y += 0.6;
  };

  center(STORE_NAME, 17, true);
  y += 0.6;
  center(STORE_TAGLINE, 8);
  const location = receiptLocation(order);
  if (location) center(location.name, 8.5, true);
  center(receiptContactLine(order), 7.5);
  rule();

  center(`#${shortOrderNumber(order.order_number)}`, 20, true);
  center(order.order_number, 8);
  y += 1.2;
  font(9.5, true);
  const badge = pdfSafe(orderTypeLabel(order));
  const badgeWidth = doc.getTextWidth(badge) + 5;
  const badgeHeight = lineHeight(9.5) + 1.4;
  doc.setLineWidth(0.35);
  doc.roundedRect(
    (PAGE_WIDTH - badgeWidth) / 2,
    y,
    badgeWidth,
    badgeHeight,
    0.8,
    0.8,
  );
  doc.text(badge, PAGE_WIDTH / 2, y + badgeHeight - 1.6, { align: "center" });
  y += badgeHeight;
  rule();

  pair("Fecha", formatTicketDate(order.created_at));
  pair("Cliente", order.customer_name || "-");
  if (statusLabel) pair("Estado", statusLabel);
  rule();

  for (const item of order.items ?? []) {
    font(9, true);
    const amount = formatCurrency(item.subtotal);
    const amountWidth = doc.getTextWidth(amount);
    const nameLines = doc.splitTextToSize(
      pdfSafe(`${item.quantity}x  ${item.product_name}`),
      CONTENT - amountWidth - 3,
    ) as string[];
    nameLines.forEach((part, index) => {
      y += lineHeight(9);
      doc.text(part, MARGIN, y);
      if (index === 0)
        doc.text(amount, PAGE_WIDTH - MARGIN, y, { align: "right" });
    });
    font(7.8);
    for (const detail of itemDetails(item)) {
      for (const part of doc.splitTextToSize(
        pdfSafe(`${detail.label}: ${detail.value}`),
        CONTENT - 6,
      ) as string[]) {
        y += lineHeight(7.8);
        doc.text(part, MARGIN + 6, y);
      }
    }
    y += 1.2;
  }
  if (!order.items?.length) center("Sin productos", 8);

  rule(false);
  pair("Artículos", String(itemCount(order)), 8);
  y += 0.6;
  pair("TOTAL", formatCurrency(order.total_amount), 13, true);
  if (order.payment_method)
    pair("Pago", PAYMENT_LABELS[order.payment_method] ?? order.payment_method);
  const change = changeDue(order);
  if (change != null && order.amount_received != null) {
    pair("Recibido", formatCurrency(order.amount_received));
    pair("Cambio", formatCurrency(change), 8.5, true);
  }
  if (order.notes) {
    rule();
    font(8);
    for (const part of doc.splitTextToSize(
      pdfSafe(`Nota: ${order.notes}`),
      CONTENT,
    ) as string[]) {
      y += lineHeight(8);
      doc.text(part, MARGIN, y);
    }
  }

  rule();
  center("¡Gracias por tu compra!", 10, true);
  center(STORE_SOCIAL, 7.5);
  center(`Generado ${formatTicketDate(undefined)}`, 7);
  return y + MARGIN;
}

export async function buildReceiptPdf(
  order: ReceiptOrder,
  statusLabel?: string,
): Promise<Blob> {
  const { jsPDF } = await import("jspdf");
  // Measure on a throwaway tall page, then draw on one that fits exactly.
  const height = layout(
    new jsPDF({ unit: "mm", format: [PAGE_WIDTH, 1000] }),
    order,
    statusLabel,
  );
  const doc = new jsPDF({
    unit: "mm",
    format: [PAGE_WIDTH, Math.max(height, 90)],
  });
  doc.setProperties({
    title: `Comprobante ${order.order_number}`,
    creator: STORE_NAME,
  });
  layout(doc, order, statusLabel);
  return doc.output("blob");
}

export async function downloadReceiptPdf(
  order: ReceiptOrder,
  statusLabel?: string,
): Promise<void> {
  const blob = await buildReceiptPdf(order, statusLabel);
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `comprobante-${order.order_number}.pdf`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
