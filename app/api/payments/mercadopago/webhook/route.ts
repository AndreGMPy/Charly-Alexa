import { getAdminFirestore } from "@/lib/firebase-admin";
import { logErrorInDevelopment } from "@/lib/safe-errors";
import { FieldValue } from "firebase-admin/firestore";

export const runtime = "nodejs";

const ORDERS_COLLECTION = "orders";
const MERCADO_PAGO_PAYMENTS_URL = "https://api.mercadopago.com/v1/payments";
const MERCADO_PAGO_MERCHANT_ORDERS_URL =
  "https://api.mercadopago.com/merchant_orders";

type VerifiedMercadoPagoPayment = {
  id: string;
  status: string;
  orderId: string;
  amount: number;
  currency: string;
  approvedAt: string;
  updatedAt: string;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function readString(value: unknown, maxLength = 120) {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

function readId(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return String(Math.trunc(value));
  }

  return readString(value, 140);
}

function readNumber(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  return 0;
}

function getMercadoPagoAccessToken() {
  return process.env.MERCADO_PAGO_ACCESS_TOKEN?.trim() ?? "";
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

function getNotificationResourceId(request: Request, body: unknown) {
  const url = new URL(request.url);
  const bodyData = isRecord(body) && isRecord(body.data) ? body.data : {};
  const bodyResource = isRecord(body) ? readString(body.resource, 500) : "";
  const queryResource = readString(url.searchParams.get("resource"), 500);
  const resourceUrl = bodyResource || queryResource;
  const resourceMatch = resourceUrl.match(/\/(\d+)(?:\?.*)?$/);

  return (
    readId(bodyData.id) ||
    (isRecord(body) ? readId(body.id) : "") ||
    readId(url.searchParams.get("data.id")) ||
    readId(url.searchParams.get("id")) ||
    resourceMatch?.[1] ||
    ""
  );
}

async function fetchMercadoPagoRecord(url: string, accessToken: string) {
  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    logErrorInDevelopment("Mercado Pago webhook verification failed", {
      status: response.status,
    });
    return null;
  }

  const data = (await response.json().catch(() => null)) as unknown;
  return isRecord(data) ? data : null;
}

function getPaymentOrderId(payment: Record<string, unknown>) {
  const metadata = isRecord(payment.metadata) ? payment.metadata : {};

  return (
    readString(payment.external_reference, 140) ||
    readString(metadata.order_id, 140) ||
    readString(metadata.orderId, 140)
  );
}

function normalizePayment(
  payment: Record<string, unknown>
): VerifiedMercadoPagoPayment | null {
  const id = readId(payment.id);
  const status = readString(payment.status, 40);
  const orderId = getPaymentOrderId(payment);
  const amount = readNumber(payment.transaction_amount);
  const currency = readString(payment.currency_id, 10);

  if (!id || !status || !orderId) return null;

  return {
    id,
    status,
    orderId,
    amount,
    currency,
    approvedAt: readString(payment.date_approved, 80),
    updatedAt: readString(payment.date_last_updated, 80),
  };
}

async function fetchPayment(paymentId: string, accessToken: string) {
  const payment = await fetchMercadoPagoRecord(
    `${MERCADO_PAGO_PAYMENTS_URL}/${encodeURIComponent(paymentId)}`,
    accessToken
  );

  return payment ? normalizePayment(payment) : null;
}

async function fetchPaymentFromMerchantOrder(
  merchantOrderId: string,
  accessToken: string
) {
  const merchantOrder = await fetchMercadoPagoRecord(
    `${MERCADO_PAGO_MERCHANT_ORDERS_URL}/${encodeURIComponent(
      merchantOrderId
    )}`,
    accessToken
  );
  const payments = Array.isArray(merchantOrder?.payments)
    ? merchantOrder.payments.filter(isRecord)
    : [];
  const selectedPayment =
    payments.find((payment) => readString(payment.status, 40) === "approved") ??
    payments[0];
  const paymentId = selectedPayment ? readId(selectedPayment.id) : "";

  return paymentId ? fetchPayment(paymentId, accessToken) : null;
}

function mapMercadoPagoStatus(status: string) {
  if (status === "approved") return "paid";
  if (
    status === "pending" ||
    status === "authorized" ||
    status === "in_process" ||
    status === "in_mediation"
  ) {
    return "pending";
  }
  if (
    status === "rejected" ||
    status === "cancelled" ||
    status === "refunded" ||
    status === "charged_back"
  ) {
    return "failed";
  }

  return null;
}

async function updateOrderPayment(payment: VerifiedMercadoPagoPayment) {
  const nextStatus = mapMercadoPagoStatus(payment.status);

  if (!nextStatus) return;

  const firestore = getAdminFirestore();
  const orderRef = firestore.collection(ORDERS_COLLECTION).doc(payment.orderId);
  const orderSnapshot = await orderRef.get();

  if (!orderSnapshot.exists) return;

  const order = orderSnapshot.data() ?? {};
  const orderPayment = isRecord(order.payment) ? order.payment : {};
  const provider = readString(orderPayment.provider, 40);

  if (provider && provider !== "mercadopago") return;

  const expectedTotal = readNumber(order.total);
  const currencyMatches = payment.currency === "MXN";
  const amountMatches =
    expectedTotal > 0 && Math.abs(payment.amount - expectedTotal) < 0.01;

  if (nextStatus === "paid" && (!currencyMatches || !amountMatches)) {
    logErrorInDevelopment("Mercado Pago paid webhook rejected", {
      orderId: payment.orderId,
      amount: payment.amount,
      expectedTotal,
      currency: payment.currency,
    });
    return;
  }

  const updateData: Record<string, unknown> = {
    "payment.status": nextStatus,
    "payment.provider": "mercadopago",
    "payment.paymentId": payment.id,
    "payment.updatedAt": payment.updatedAt
      ? new Date(payment.updatedAt)
      : FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  };

  if (nextStatus === "paid") {
    updateData["payment.paidAt"] = payment.approvedAt
      ? new Date(payment.approvedAt)
      : FieldValue.serverTimestamp();
    updateData["payment.amountPaid"] = payment.amount;
  }

  await orderRef.update(updateData);
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

    const accessToken = getMercadoPagoAccessToken();
    const resourceId = getNotificationResourceId(request, body);

    if (!accessToken || !resourceId) {
      return Response.json({ received: true });
    }

    const payment =
      notificationType === "merchant_order"
        ? await fetchPaymentFromMerchantOrder(resourceId, accessToken)
        : await fetchPayment(resourceId, accessToken);

    if (payment) {
      await updateOrderPayment(payment);
    }

    return Response.json({ received: true });
  } catch (error) {
    logErrorInDevelopment("Mercado Pago webhook error", error);
    return Response.json({ received: true });
  }
}
