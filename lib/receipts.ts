import type { FirebaseDate, FirebaseOrder, FirebaseOrderItem, PaymentBreakdown, PaymentMethod } from "@/lib/firebase-types";

export const SHIPPING_AGREEMENT_TEXT =
  "El envío se cotiza por WhatsApp y se paga al recibir o según acuerdo con la tienda.";

const money = (value: number) => new Intl.NumberFormat("es-MX", {
  style: "currency",
  currency: "MXN",
}).format(Number(value) || 0);

function receiptDate(value: FirebaseDate) {
  if (value instanceof Date) return value;
  if (typeof value === "string") return new Date(value);
  if (value && typeof value === "object" && "toDate" in value) return value.toDate();
  return new Date();
}

function itemLines(items: FirebaseOrderItem[]) {
  return items.map((item) => {
    const name = item.productName ?? item.name ?? "Producto";
    return `${name}\nColor: ${item.color || "Sin color"} · Talla: ${item.size}\n${item.quantity} × ${money(item.price)} = ${money(item.subtotal)}`;
  });
}

export type StoreReceipt = {
  folio: string;
  items: FirebaseOrderItem[];
  subtotal: number;
  discountTotal: number;
  total: number;
  paymentMethod: PaymentMethod;
  paymentBreakdown?: PaymentBreakdown;
  createdAt: FirebaseDate;
};

export function buildStoreReceiptText(receipt: StoreReceipt) {
  const mixed = receipt.paymentMethod === "Mixto" && receipt.paymentBreakdown
    ? `\nEfectivo: ${money(receipt.paymentBreakdown.cash)}\nTransferencia: ${money(receipt.paymentBreakdown.transfer)}\nTarjeta: ${money(receipt.paymentBreakdown.card)}`
    : "";

  return `Charly Alexa\nBoutique infantil\n\nFolio: ${receipt.folio}\nFecha y hora: ${receiptDate(receipt.createdAt).toLocaleString("es-MX")}\n\n${itemLines(receipt.items).join("\n\n")}\n\nSubtotal: ${money(receipt.subtotal)}\nDescuento: ${money(receipt.discountTotal)}\nTotal: ${money(receipt.total)}\nMétodo de pago: ${receipt.paymentMethod}${mixed}\n\nGracias por tu compra.`;
}

export function buildOrderReceiptText(order: FirebaseOrder) {
  const folio = order.orderNumber ?? order.id.slice(-6).toUpperCase();
  return `Hola, te compartimos el resumen de tu pedido Charly Alexa.\n\nCharly Alexa\nBoutique infantil\nFolio: ${folio}\nFecha y hora: ${receiptDate(order.createdAt).toLocaleString("es-MX")}\n\n${itemLines(order.items).join("\n\n")}\n\nTotal de productos: ${money(order.subtotal)}\nEnvío: A cotizar\nTotal sin envío: ${money(order.subtotal)}\n\n${SHIPPING_AGREEMENT_TEXT}\nEl costo de envío se confirma por WhatsApp antes de enviar.\n\nGracias por tu compra.`;
}

export function escapeReceiptHtml(value: string) {
  return value.replace(/[&<>"']/g, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  })[character] ?? character);
}
