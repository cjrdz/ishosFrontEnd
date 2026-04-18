import type { Order } from "../../api/admin";
import { formatCurrency } from "../../utils/formatters";
import { amountColumnLabel } from "./order-status";

export function renderReceipt(order: Order): string {
  const itemsMarkup = (order.items || [])
    .map((item) => {
      let details = "";
      if (item.customizations) {
        const parts: string[] = [];
        if (item.customizations.flavor_name)
          parts.push(`Sabor: ${item.customizations.flavor_name}`);
        if (
          Array.isArray(item.customizations.included_addon_names) &&
          item.customizations.included_addon_names.length > 0
        ) {
          parts.push(
            `Incluidos: ${(item.customizations.included_addon_names as string[]).join(", ")}`,
          );
        }
        if (
          Array.isArray(item.customizations.extra_addon_names) &&
          item.customizations.extra_addon_names.length > 0
        ) {
          parts.push(
            `Extras: ${(item.customizations.extra_addon_names as string[]).join(", ")}`,
          );
        }
        if (
          Array.isArray(item.customizations.addon_names) &&
          item.customizations.addon_names.length > 0
        ) {
          parts.push(
            `Complementos: ${(item.customizations.addon_names as string[]).join(", ")}`,
          );
        }
        if (item.customizations.notes)
          parts.push(`Nota: ${item.customizations.notes}`);
        if (parts.length > 0) {
          details = `<br><span style="font-size:11px;color:#666">${parts.join(" | ")}</span>`;
        }
      }
      return `<tr><td>${item.product_name}${details}</td><td>${item.quantity}</td><td>${formatCurrency(item.subtotal)}</td></tr>`;
    })
    .join("");

  const itemsTable = itemsMarkup || '<tr><td colspan="3">Sin items</td></tr>';

  return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>Recibo ${order.order_number}</title>
    <style>
      body { font-family: Arial, sans-serif; padding: 24px; }
      h1 { font-size: 20px; margin: 0 0 12px; }
      table { width: 100%; border-collapse: collapse; margin-top: 12px; }
      th, td { border-bottom: 1px solid #ddd; padding: 6px 0; text-align: left; }
      .meta { font-size: 12px; color: #555; margin-top: 6px; }
      .total { font-weight: bold; margin-top: 12px; }
    </style>
  </head>
  <body>
    <h1>Recibo de orden ${order.order_number}</h1>
    <div class="meta">Cliente: ${order.customer_name}</div>
    <div class="meta">Telefono: ${order.customer_phone}</div>
    <div class="meta">Metodo pago: ${order.payment_method}</div>
    <table>
      <thead><tr><th>Producto</th><th>Cantidad</th><th>${amountColumnLabel(order.status)}</th></tr></thead>
      <tbody>${itemsTable}</tbody>
    </table>
    <div class="total">Total: ${formatCurrency(order.total_amount)}</div>
  </body>
</html>`;
}

export function printOrderReceipt(order: Order): void {
  const receipt = renderReceipt(order);
  const iframe = document.createElement("iframe");
  iframe.style.position = "fixed";
  iframe.style.right = "0";
  iframe.style.bottom = "0";
  iframe.style.width = "0";
  iframe.style.height = "0";
  iframe.style.border = "0";
  iframe.srcdoc = receipt;
  iframe.onload = () => {
    const win = iframe.contentWindow;
    if (!win) return;
    win.focus();
    win.print();
    setTimeout(() => iframe.remove(), 1000);
  };
  document.body.appendChild(iframe);
}
