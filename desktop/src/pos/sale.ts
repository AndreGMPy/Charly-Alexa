import type { PaymentBreakdown, SaleDraft, SaleTotals } from "../domain/models";

function money(value: number) {
  return Math.round((Number(value) + Number.EPSILON) * 100) / 100;
}

export function calculateSaleTotals(sale: Pick<SaleDraft, "items" | "discount">): SaleTotals {
  const subtotal = money(sale.items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0));
  const rawDiscount = sale.discount?.type === "percent"
    ? subtotal * Math.min(Math.max(sale.discount.value, 0), 100) / 100
    : Math.max(sale.discount?.value ?? 0, 0);
  const discount = money(Math.min(rawDiscount, subtotal));
  return {
    subtotal,
    discount,
    total: money(subtotal - discount),
    pieces: sale.items.reduce((sum, item) => sum + item.quantity, 0),
  };
}

export function validatePayment(total: number, breakdown: PaymentBreakdown) {
  if (Object.values(breakdown).some((amount) => amount < 0)) {
    throw new Error("Los montos de pago no pueden ser negativos.");
  }
  const paid = money(breakdown.cash + breakdown.transfer + breakdown.card);
  if (paid !== money(total)) {
    throw new Error("La suma del pago debe coincidir con el total de la venta.");
  }
}

export function createLocalFolio(now = new Date(), sequence = 1) {
  const date = now.toISOString().slice(0, 10).replaceAll("-", "");
  return `POS-${date}-${String(sequence).padStart(4, "0")}`;
}
