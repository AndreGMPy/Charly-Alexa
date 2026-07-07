import { logErrorInDevelopment } from "@/lib/safe-errors";

export const runtime = "nodejs";

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function readString(value: unknown, maxLength = 120) {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

function getNotificationType(request: Request, body: unknown) {
  const url = new URL(request.url);
  const bodyType = isRecord(body)
    ? readString(body.type) || readString(body.topic)
    : "";

  return (
    bodyType ||
    readString(url.searchParams.get("type")) ||
    readString(url.searchParams.get("topic"))
  );
}

export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => null)) as unknown;
    const notificationType = getNotificationType(request, body);

    if (
      notificationType &&
      notificationType !== "payment" &&
      notificationType !== "merchant_order"
    ) {
      return Response.json({ received: true });
    }

    // TODO: Consult Mercado Pago from the server with MERCADO_PAGO_ACCESS_TOKEN
    // using the payment id from the notification. Only after verifying the
    // payment status, amount, currency and external_reference/order id should
    // orders/{orderId}.payment.status be changed to "paid".
    return Response.json({ received: true });
  } catch (error) {
    logErrorInDevelopment("Mercado Pago webhook error", error);
    return Response.json({ received: true });
  }
}
