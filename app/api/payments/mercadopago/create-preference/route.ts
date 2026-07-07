import { getAdminFirestore } from "@/lib/firebase-admin";
import type { DeliveryMethod, PaymentProvider } from "@/lib/firebase-types";
import { logErrorInDevelopment } from "@/lib/safe-errors";
import {
  calculateOrderShipping,
  isDeliveryMethod,
  NATIONAL_DELIVERY_METHOD,
} from "@/lib/shipping";
import { FieldValue } from "firebase-admin/firestore";

export const runtime = "nodejs";

const ORDERS_COLLECTION = "orders";
const PRODUCTS_COLLECTION = "products";
const MERCADO_PAGO_PREFERENCES_URL =
  "https://api.mercadopago.com/checkout/preferences";
const PAYMENT_NOT_CONFIGURED_MESSAGE =
  "Los pagos todavía no están configurados.";

type OrderPaymentData = {
  status: string;
  provider: PaymentProvider;
};

type PreferenceItem = {
  id?: string;
  title: string;
  quantity: number;
  unit_price: number;
  currency_id: "MXN";
};

function json(message: string, status: number) {
  return Response.json({ message }, { status });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function readString(value: unknown, maxLength = 160) {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

function readPositiveInteger(value: unknown) {
  const numberValue = Number(value);
  return Number.isInteger(numberValue) && numberValue > 0 ? numberValue : null;
}

function readNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function getMercadoPagoConfig() {
  const accessToken = process.env.MERCADO_PAGO_ACCESS_TOKEN?.trim();
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL?.trim().replace(/\/+$/, "");

  if (!accessToken || !siteUrl) return null;

  return { accessToken, siteUrl };
}

function getOrderPayment(data: Record<string, unknown>): OrderPaymentData {
  const payment = isRecord(data.payment) ? data.payment : {};
  const provider =
    payment.provider === "mercadopago" ? "mercadopago" : "manual";
  const status = readString(payment.status, 40) || "manual";

  return { provider, status };
}

function getOrderDeliveryMethod(data: Record<string, unknown>) {
  const shipping = isRecord(data.shipping) ? data.shipping : {};
  const method = data.deliveryMethod ?? shipping.method;

  return isDeliveryMethod(method) ? method : NATIONAL_DELIVERY_METHOD;
}

function getOrderItems(data: Record<string, unknown>) {
  if (!Array.isArray(data.items)) return null;

  return data.items.map((item) => {
    if (!isRecord(item)) return null;

    const productId = readString(item.productId, 140);
    const quantity = readPositiveInteger(item.quantity);
    const size = readString(item.size, 60) || "Unitalla";

    if (!productId || !quantity) return null;

    return { productId, quantity, size };
  });
}

async function recalculateOrderForPayment(
  orderId: string,
  order: Record<string, unknown>,
  deliveryMethod: DeliveryMethod
) {
  const firestore = getAdminFirestore();
  const orderItems = getOrderItems(order);

  if (!orderItems || orderItems.some((item) => item === null)) {
    throw new Error("invalid-order");
  }

  const validItems = orderItems.filter(
    (item): item is NonNullable<(typeof orderItems)[number]> => item !== null
  );
  const productSnapshots = await Promise.all(
    validItems.map((item) =>
      firestore.collection(PRODUCTS_COLLECTION).doc(item.productId).get()
    )
  );
  const preferenceItems: PreferenceItem[] = [];
  let subtotal = 0;
  let totalItems = 0;
  let hasWholesale = false;

  validItems.forEach((item, index) => {
    const productSnapshot = productSnapshots[index];

    if (!productSnapshot.exists) {
      throw new Error("invalid-order");
    }

    const product = productSnapshot.data() ?? {};
    const price = readNumber(product.price);
    const title = readString(product.name, 120) || "Producto";

    if (price <= 0) {
      throw new Error("invalid-order");
    }

    subtotal += price * item.quantity;
    totalItems += item.quantity;
    hasWholesale =
      hasWholesale ||
      (readString(product.wholesaleMode, 40) !== "" &&
        readString(product.wholesaleMode, 40) !== "none");

    preferenceItems.push({
      id: item.productId,
      title: `${title} - Talla ${item.size}`,
      quantity: item.quantity,
      unit_price: price,
      currency_id: "MXN",
    });
  });

  const shipping = calculateOrderShipping({
    method: deliveryMethod,
    totalItems,
    hasWholesale,
  });

  if (shipping.cost > 0) {
    preferenceItems.push({
      title: "Envío",
      quantity: 1,
      unit_price: shipping.cost,
      currency_id: "MXN",
    });
  }

  const total = subtotal + shipping.cost;

  if (subtotal <= 0 || total <= 0) {
    throw new Error("invalid-order");
  }

  return {
    preferenceItems,
    subtotal,
    shipping,
    total,
    orderNumber:
      readString(order.orderNumber, 40) || orderId.slice(-6).toUpperCase(),
  };
}

export async function POST(request: Request) {
  try {
    const config = getMercadoPagoConfig();

    if (!config) {
      return json(PAYMENT_NOT_CONFIGURED_MESSAGE, 503);
    }

    const body = (await request.json().catch(() => null)) as unknown;
    const orderId = isRecord(body) ? readString(body.orderId, 140) : "";

    if (!orderId) {
      return json("No se pudo iniciar el pago. Intenta de nuevo.", 400);
    }

    const firestore = getAdminFirestore();
    const orderRef = firestore.collection(ORDERS_COLLECTION).doc(orderId);
    const orderSnapshot = await orderRef.get();

    if (!orderSnapshot.exists) {
      return json("No se pudo iniciar el pago. Intenta de nuevo.", 404);
    }

    const order = orderSnapshot.data() ?? {};
    const payment = getOrderPayment(order);

    if (payment.status === "paid") {
      return json("Este pedido ya está pagado.", 409);
    }

    if (payment.provider !== "mercadopago") {
      return json("Este pedido se acordará por WhatsApp.", 400);
    }

    const deliveryMethod = getOrderDeliveryMethod(order);

    const recalculatedOrder = await recalculateOrderForPayment(
      orderId,
      order,
      deliveryMethod
    );
    const preferenceResponse = await fetch(MERCADO_PAGO_PREFERENCES_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        items: recalculatedOrder.preferenceItems,
        external_reference: orderId,
        metadata: {
          order_id: orderId,
          order_number: recalculatedOrder.orderNumber,
        },
        notification_url: `${config.siteUrl}/api/payments/mercadopago/webhook`,
        back_urls: {
          success: `${config.siteUrl}/?payment=success&order=${orderId}`,
          failure: `${config.siteUrl}/?payment=failure&order=${orderId}`,
          pending: `${config.siteUrl}/?payment=pending&order=${orderId}`,
        },
        auto_return: "approved",
      }),
    });
    const preference = (await preferenceResponse.json().catch(() => null)) as
      | Record<string, unknown>
      | null;
    const preferenceId = readString(preference?.id, 120);
    const initPoint =
      readString(preference?.init_point, 500) ||
      readString(preference?.sandbox_init_point, 500);

    if (!preferenceResponse.ok || !preferenceId || !initPoint) {
      logErrorInDevelopment("Mercado Pago preference rejected", {
        status: preferenceResponse.status,
      });
      return json("No se pudo iniciar el pago. Intenta de nuevo.", 502);
    }

    await orderRef.update({
      subtotal: recalculatedOrder.subtotal,
      shipping: recalculatedOrder.shipping,
      shippingCost: recalculatedOrder.shipping.cost,
      total: recalculatedOrder.total,
      "payment.status": "pending",
      "payment.provider": "mercadopago",
      "payment.preferenceId": preferenceId,
      updatedAt: FieldValue.serverTimestamp(),
    });

    return Response.json({ preferenceId, initPoint });
  } catch (error) {
    logErrorInDevelopment("Mercado Pago create preference error", error);
    return json("No se pudo iniciar el pago. Intenta de nuevo.", 500);
  }
}
