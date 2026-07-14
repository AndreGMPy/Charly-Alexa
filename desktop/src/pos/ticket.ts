import type { SaleDraft, SaleTotals } from "../domain/models";

const escapeHtml = (value: string) => value.replace(/[&<>'"]/g, (character) => ({
  "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;",
}[character]!));

const price = (value: number) => new Intl.NumberFormat("es-MX", {
  style: "currency", currency: "MXN",
}).format(value);

export function buildTicketText(sale: SaleDraft, totals: SaleTotals) {
  const products = sale.items.map((item) => `${item.product.name}\nColor: ${item.color} · Talla: ${item.size}\n${item.quantity} × ${price(item.unitPrice)} = ${price(item.unitPrice * item.quantity)}`).join("\n\n");
  return `Charly Alexa\nBoutique infantil\n\nFolio: ${sale.localFolio}\nFecha y hora: ${new Date(sale.createdAt).toLocaleString("es-MX")}\n\n${products}\n\nSubtotal: ${price(totals.subtotal)}\nDescuento: ${price(totals.discount)}\nTotal: ${price(totals.total)}\nMétodo de pago: ${sale.paymentMethod}\n\nGracias por tu compra.`;
}

export function buildTicketHtml(sale: SaleDraft, totals: SaleTotals) {
  const rows = sale.items.map((item) => `
    <tr><td>${escapeHtml(item.product.name)}<br><small>${escapeHtml(item.color)} · Talla ${escapeHtml(item.size)} · ${item.quantity} × ${price(item.unitPrice)}</small></td>
    <td>${price(item.unitPrice * item.quantity)}</td></tr>`).join("");
  return `<!doctype html><html lang="es"><head><meta charset="utf-8"><title>${escapeHtml(sale.localFolio)}</title><style>body{font:12px Arial,sans-serif;width:72mm;margin:0 auto;color:#111}h1,p{margin:4px 0;text-align:center}table{width:100%;border-collapse:collapse;margin:12px 0}td{padding:6px 0;border-bottom:1px dashed #999}td:last-child{text-align:right}.totals{border-top:1px dashed #111;margin-top:8px;padding-top:8px}.total{font-size:16px;font-weight:700}@page{size:80mm auto;margin:4mm}</style></head>
  <body><main><h1>Charly Alexa</h1><p>Boutique infantil</p><p>Folio ${escapeHtml(sale.localFolio)}</p><p>${new Date(sale.createdAt).toLocaleString("es-MX")}</p>
  <table><tbody>${rows}</tbody></table><div class="totals"><p>Subtotal: ${price(totals.subtotal)}</p><p>Descuento: ${price(totals.discount)}</p>
  <p class="total">Total: ${price(totals.total)}</p><p>Método de pago: ${escapeHtml(sale.paymentMethod)}</p></div><p>Gracias por tu compra.</p></main></body></html>`;
}
