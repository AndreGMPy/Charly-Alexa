import "server-only";

import type { FirebaseOrder } from "@/lib/firebase-types";
import { getAppUrl } from "@/lib/stripe";

const money = (value: number) =>
  new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: "MXN",
  }).format(Number(value) || 0);

function escapeHtml(value: string) {
  return value.replace(
    /[&<>"']/g,
    (character) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;",
      })[character] ?? character
  );
}

function orderFolio(order: FirebaseOrder) {
  return order.orderNumber ?? order.id.slice(-6).toUpperCase();
}

function customerEmail(order: FirebaseOrder) {
  return (
    order.customerEmail?.trim() ||
    order.customer?.email?.trim() ||
    ""
  );
}

function itemRows(order: FirebaseOrder) {
  return order.items
    .map((item) => {
      const name = escapeHtml(item.productName ?? item.name ?? "Producto");
      const color = escapeHtml(item.color || "Sin color");
      const size = escapeHtml(item.size || "Unitalla");

      return `<tr>
        <td style="padding:10px 0;border-bottom:1px solid #f1e7df">
          <strong>${name}</strong><br />
          <span style="color:#667085;font-size:13px">Color ${color} · Talla ${size}</span>
        </td>
        <td style="padding:10px 0;border-bottom:1px solid #f1e7df;text-align:center">${item.quantity}</td>
        <td style="padding:10px 0;border-bottom:1px solid #f1e7df;text-align:right">${money(item.subtotal)}</td>
      </tr>`;
    })
    .join("");
}

function deliveryText(order: FirebaseOrder) {
  if (order.deliveryMethod === "Recoger en tienda") return "Recoger en tienda";
  return (
    order.address ||
    order.customerAddress ||
    order.customer?.address ||
    "Direccion pendiente"
  );
}

function buildBaseHtml(order: FirebaseOrder, title: string, intro: string, extra = "") {
  const folio = orderFolio(order);

  return `<div style="font-family:Arial,sans-serif;background:#fffaf5;padding:24px;color:#172033">
    <div style="max-width:640px;margin:0 auto;background:#ffffff;border:1px solid #f7d9df;border-radius:18px;padding:24px">
      <p style="margin:0 0 8px;color:#e11d48;font-weight:800;text-transform:uppercase;font-size:12px">Creaciones Charly Alexa</p>
      <h1 style="margin:0 0 12px;font-size:24px">${escapeHtml(title)}</h1>
      <p style="margin:0 0 20px;line-height:1.6;color:#475467">${escapeHtml(intro)}</p>
      <p style="margin:0 0 18px"><strong>Pedido #${escapeHtml(folio)}</strong></p>
      <table style="width:100%;border-collapse:collapse;font-size:14px">
        <thead>
          <tr>
            <th style="text-align:left;border-bottom:2px solid #f1e7df;padding-bottom:8px">Producto</th>
            <th style="text-align:center;border-bottom:2px solid #f1e7df;padding-bottom:8px">Cant.</th>
            <th style="text-align:right;border-bottom:2px solid #f1e7df;padding-bottom:8px">Subtotal</th>
          </tr>
        </thead>
        <tbody>${itemRows(order)}</tbody>
      </table>
      <div style="margin-top:18px;border-top:1px solid #f1e7df;padding-top:16px">
        <p style="margin:0 0 8px"><strong>Total productos:</strong> ${money(order.subtotal)}</p>
        <p style="margin:0 0 8px"><strong>Envio:</strong> ${
          order.shipping?.requiresQuote ? "A cotizar por WhatsApp" : money(order.shippingCost ?? order.shipping?.cost ?? 0)
        }</p>
        <p style="margin:0 0 8px;font-size:18px"><strong>Total pagado:</strong> ${money(order.total)}</p>
        <p style="margin:0 0 8px"><strong>Pago:</strong> Confirmado con Stripe</p>
        <p style="margin:0"><strong>Entrega:</strong> ${escapeHtml(deliveryText(order))}</p>
      </div>
      ${extra}
      <p style="margin:22px 0 0;color:#667085;font-size:13px;line-height:1.6">
        Contacto: WhatsApp 445 144 8846. Gracias por comprar en Charly Alexa.
      </p>
    </div>
  </div>`;
}

async function sendResendEmail({
  to,
  subject,
  html,
}: {
  to: string | string[];
  subject: string;
  html: string;
}) {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  const from = process.env.RESEND_FROM_EMAIL?.trim();

  if (!apiKey || !from) {
    return { sent: false, reason: "provider_not_configured" as const };
  }

  const fromAddress = from.includes("<") ? from : `Charly Alexa <${from}>`;
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: fromAddress,
      to,
      subject,
      html,
    }),
  });

  if (!response.ok) {
    const message = await response.text().catch(() => "");
    throw new Error(`Resend rejected email: ${response.status} ${message.slice(0, 160)}`);
  }

  return { sent: true as const };
}

export async function sendCustomerOrderConfirmationEmail(order: FirebaseOrder) {
  const to = customerEmail(order);
  if (!to) return { sent: false, reason: "missing_email" as const };

  return sendResendEmail({
    to,
    subject: "Tu pedido de Charly Alexa esta confirmado",
    html: buildBaseHtml(
      order,
      "Tu pedido esta confirmado",
      "Recibimos tu pago correctamente. La tienda preparara tu pedido y te contactara para confirmar el envio."
    ),
  });
}

export async function sendAdminPaidOrderEmail(order: FirebaseOrder) {
  const to = process.env.ORDER_NOTIFICATION_EMAIL?.trim();
  if (!to) return { sent: false, reason: "missing_admin_email" as const };

  const appUrl = getAppUrl();
  const orderUrl = appUrl ? `${appUrl}/admin/pedidos?pedido=${encodeURIComponent(order.id)}` : "";
  const extra = `<div style="margin-top:18px;background:#fff7ed;border:1px solid #fed7aa;border-radius:14px;padding:14px">
    <p style="margin:0 0 6px"><strong>Cliente:</strong> ${escapeHtml(order.customerName ?? order.customer?.name ?? "")}</p>
    <p style="margin:0 0 6px"><strong>Telefono:</strong> ${escapeHtml(order.customerPhone ?? order.customer?.phone ?? "")}</p>
    <p style="margin:0 0 6px"><strong>Correo:</strong> ${escapeHtml(customerEmail(order) || "Sin correo")}</p>
    ${orderUrl ? `<p style="margin:8px 0 0"><a href="${escapeHtml(orderUrl)}">Abrir pedido en el panel</a></p>` : ""}
  </div>`;

  return sendResendEmail({
    to,
    subject: "Nuevo pedido pagado - Charly Alexa",
    html: buildBaseHtml(
      order,
      "Nuevo pedido pagado",
      "Hay un nuevo pedido pagado desde la tienda web.",
      extra
    ),
  });
}
