import { describe, expect, it } from "vitest";
import type { Order } from "@features/admin-management";
import { escapeHtml, renderReceipt } from "./receipt-renderer";

const order = {
  id: "1",
  order_number: "ORD-20261026-3535",
  customer_name: '<img src=x onerror="alert(1)">',
  customer_phone: "+50370000001",
  order_type: "en_local",
  table_number: 4,
  status: "lista",
  payment_method: "efectivo",
  payment_status: "pendiente",
  total_amount: 5.4,
  amount_received: 10,
  notes: "Sin <b>azúcar</b>",
  created_at: "2026-10-27T03:30:00Z",
  created_by_role: "customer",
  items: [
    {
      id: "i1",
      product_id: "p1",
      product_name: "Bowl apaneca",
      quantity: 1,
      unit_price: 4.5,
      subtotal: 4.5,
      customizations: {
        included_addon_names: ["Granola"],
        extra_addon_names: ["Maní"],
        extra_addon_prices: [0.9],
      },
    },
  ],
} as unknown as Order;

describe("receipt", () => {
  it("escapes everything that comes from customers", () => {
    expect(escapeHtml(`<a href="x">'&`)).toBe(
      "&lt;a href=&quot;x&quot;&gt;&#39;&amp;",
    );
    const html = renderReceipt(order);
    expect(html).not.toContain("<img src=x");
    expect(html).not.toContain("<b>azúcar</b>");
    expect(html).toContain("&lt;img src=x");
  });

  it("prints the order essentials for the counter", () => {
    const html = renderReceipt(order);
    expect(html).toContain("#3535");
    expect(html).toContain("En local · Mesa 4");
    expect(html).toContain("Incluye: Granola");
    expect(html).toContain("Extras: Maní (+$0.90)");
    expect(html).toContain("TOTAL");
    expect(html).toContain("Cambio");
    expect(html).toContain("$4.60"); // 10.00 − 5.40
    // 03:30 UTC on the 27th is 9:30 pm on the 26th in El Salvador.
    expect(html).toMatch(/26\/10\/2026.*9:30 pm/);
  });

  it("sizes the page for the chosen roll and removes browser margins", () => {
    expect(renderReceipt(order, "58")).toContain(
      "@page { size: 58mm auto; margin: 0; }",
    );
    expect(renderReceipt(order, "80")).toContain("width: 72mm");
  });

  it("prints a kitchen comanda without prices", () => {
    const html = renderReceipt(order, "80", ["kitchen"]);
    expect(html).toContain("COMANDA");
    expect(html).toContain("MESA 4");
    expect(html).toContain("Bowl apaneca");
    expect(html).toContain("Maní");
    expect(html).not.toContain("$0.90");
    expect(html).not.toContain("TOTAL");
    expect(html).toContain("NOTA DE LA ORDEN: Sin &lt;b&gt;azúcar");
  });

  it("puts customer and kitchen tickets on separate pages in one job", () => {
    const html = renderReceipt(order, "80", ["customer", "kitchen"]);
    expect(html.match(/<section class="ticket">/g)).toHaveLength(2);
    expect(html).toContain("break-before: page");
  });
});
