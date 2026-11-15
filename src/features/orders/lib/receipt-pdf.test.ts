import { describe, expect, it } from "vitest";
import { buildReceiptPdf, pdfSafe } from "./receipt-pdf";
import type { ReceiptOrder } from "./receipt-renderer";

const order: ReceiptOrder = {
  order_number: "ORD-20261029-3861",
  customer_name: "Carlos 🍦 Test",
  order_type: "para_llevar",
  total_amount: 1.25,
  created_at: "2026-10-30T03:30:00Z",
  items: [
    {
      product_name: "Cono sencillo",
      quantity: 1,
      subtotal: 1.25,
      customizations: {
        flavor_name: "Leche",
        included_addon_names: ["Maní", "Jalea Maracuyá"],
        extra_addon_names: ["Crispy"],
        extra_addon_prices: [0.35],
      },
    },
  ],
};

describe("receipt pdf", () => {
  it("keeps Spanish accents and drops what the PDF fonts can't draw", () => {
    expect(pdfSafe("Maní — ¡listo! 🍦")).toBe("Maní - ¡listo!");
  });

  it("builds a PDF with the order on it", async () => {
    const blob = await buildReceiptPdf(order, "Entregada");
    const text = new TextDecoder("latin1").decode(await blob.arrayBuffer());
    expect(text.startsWith("%PDF-")).toBe(true);
    expect(text).toContain("#3861");
    expect(text).toContain("Cono sencillo");
    expect(text).toContain("$1.25");
    expect(text).toContain("Entregada");
  });
});
