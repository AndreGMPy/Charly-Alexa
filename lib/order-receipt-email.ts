import "server-only";

import type { FirebaseOrder } from "@/lib/firebase-types";
import { buildOrderReceiptText, escapeReceiptHtml } from "@/lib/receipts";

export async function sendOrderReceiptEmail(order: FirebaseOrder) {
  const email = order.customer?.email?.trim();
  if (!email) return { sent: false, reason: "missing_email" as const };

  const subject = "Resumen de tu pedido Charly Alexa";
  const html = `<div style="font-family:Arial,sans-serif;white-space:pre-line;line-height:1.55;color:#172033">${escapeReceiptHtml(buildOrderReceiptText(order))}</div>`;

  // Conectar aquí Resend, Brevo, SendGrid o Nodemailer cuando existan
  // credenciales. El envío debe permanecer no bloqueante para el pedido.
  void subject;
  void html;
  void email;
  return { sent: false, reason: "provider_not_configured" as const };
}
