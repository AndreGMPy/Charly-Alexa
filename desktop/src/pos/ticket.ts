import type { SaleDraft, SaleTotals } from "../domain/models";

const escapeHtml = (value: string) => value.replace(/[&<>'"]/g, (character) => ({
  "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;",
}[character]!));

const price = (value: number) => new Intl.NumberFormat("es-MX", {
  style: "currency", currency: "MXN",
}).format(value);

export function buildTicketHtml(sale: SaleDraft, totals: SaleTotals) {
  const rows = sale.items.map((item) => `
    <tr><td>${escapeHtml(item.product.name)}<br><small>${escapeHtml(item.color)} · ${escapeHtml(item.size)}</small></td>
    <td>${item.quantity}</td><td>${price(item.unitPrice * item.quantity)}</td></tr>`).join("");
  return `<!doctype html><html lang="es"><head><meta charset="utf-8"><title>${escapeHtml(sale.localFolio)}</title></head>
  <body><main><h1>Charly Alexa</h1><p>Folio ${escapeHtml(sale.localFolio)}</p><p>${escapeHtml(sale.createdAt)}</p>
  <table><tbody>${rows}</tbody></table><p>Subtotal: ${price(totals.subtotal)}</p><p>Descuento: ${price(totals.discount)}</p>
  <strong>Total: ${price(totals.total)}</strong><p>Pago: ${escapeHtml(sale.paymentMethod)}</p></main></body></html>`;
}
