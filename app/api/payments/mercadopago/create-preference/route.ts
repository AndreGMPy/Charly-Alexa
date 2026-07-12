import { getAdminFirestore } from "@/lib/firebase-admin";
import type { DeliveryMethod, PaymentProvider } from "@/lib/firebase-types";
import { logErrorInDevelopment } from "@/lib/safe-errors";
import {
  calculateOrderShipping,
  isDeliveryMethod,
  NATIONAL_DELIVERY_METHOD,
} from "@/lib/shipping";
import {
  calculateWholesaleCart,
  normalizeWholesaleSettings,
  type WholesaleProductLike,
} from "@/lib/wholesale";
import { FieldValue } from "firebase-admin/firestore";

export const runtime = "nodejs";

const ORDERS_COLLECTION = "orders";
const PRODUCTS_COLLECTION = "products";
const SITE_SETTINGS_COLLECTION = "siteSettings";
const SITE_SETTINGS_DOCUMENT = "main";
const MERCADO_PAGO_PREFERENCES_URL =
  "https://api.mercadopago.com/checkout/preferences";
const PAYMENT_NOT_CONFIGURED_MESSAGE =
  "Los pagos todavía no están configurados.";

type OrderPaymentData = {
  status: string;
  provider: PaymentProvider;
  preferenceId: string;
  initPoint: string;
};

type PreferenceItem = {
  id?: string;
  title: string;
  description?: string;
  quantity: number;
  unit_price: number;
  currency_id: "MXN";
};

type PaymentProduct = {
  productId: string;
  title: string;
  color: string;
  size: string;
  quantity: number;
  price: number;
  subtotal: number;
};

type PaymentCartLine = {
  productId: string;
  color: string;
  size: string;
  quantity: number;
  product: WholesaleProductLike;
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

function formatCurrency(value: number) {
  return new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: "MXN",
    maximumFractionDigits: 2,
  }).format(value);
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
  const preferenceId = readString(payment.preferenceId, 120);
  const initPoint = readString(payment.initPoint, 500);

  return { provider, status, preferenceId, initPoint };
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
    const color = readString(item.color, 80) || "Sin color";
    const size = readString(item.size, 60) || "Unitalla";

    if (!productId || !quantity) return null;

    return { productId, quantity, color, size };
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
  const settingsSnapshot = await firestore
    .collection(SITE_SETTINGS_COLLECTION)
    .doc(SITE_SETTINGS_DOCUMENT)
    .get();
  const wholesaleSettings = normalizeWholesaleSettings(
    isRecord(settingsSnapshot.data()?.wholesaleSettings)
      ? settingsSnapshot.data()?.wholesaleSettings
      : null
  );
  const cartLines: PaymentCartLine[] = [];
  const paymentProducts: PaymentProduct[] = [];
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

    totalItems += item.quantity;
    hasWholesale =
      hasWholesale ||
      Boolean(product.wholesaleRunEnabled) ||
      (readString(product.wholesaleMode, 40) !== "" &&
        readString(product.wholesaleMode, 40) !== "none");

    cartLines.push({
      productId: item.productId,
      color: item.color,
      size: item.size,
      quantity: item.quantity,
      product: {
        id: item.productId,
        name: title,
        price,
        sizes: Array.isArray(product.sizes)
          ? product.sizes.filter((size): size is string => typeof size === "string")
          : [],
        wholesaleMode: readString(product.wholesaleMode, 40) || "none",
        wholesalePrice:
          typeof product.wholesalePrice === "number"
            ? product.wholesalePrice
            : null,
        wholesaleMinQuantity: readNumber(product.wholesaleMinQuantity),
        wholesaleRunEnabled: Boolean(product.wholesaleRunEnabled),
        wholesaleRunPrice:
          typeof product.wholesaleRunPrice === "number"
            ? product.wholesaleRunPrice
            : null,
        wholesaleRunSizes: Array.isArray(product.wholesaleRunSizes)
          ? product.wholesaleRunSizes.filter(
              (size): size is string => typeof size === "string"
            )
          : [],
      },
    });
  });

  const pricedLines = calculateWholesaleCart(cartLines, wholesaleSettings);

  pricedLines.forEach((line) => {
    const item = line.item;

    subtotal += line.subtotal;

    if (line.wholesaleQuantity > 0) {
      const unitPrice =
        item.product.wholesaleRunEnabled && item.product.wholesaleRunPrice
          ? item.product.wholesaleRunPrice
          : line.unitPrice;

      paymentProducts.push({
        productId: item.productId,
        title: item.product.name,
        color: item.color,
        size: item.size,
        quantity: line.wholesaleQuantity,
        price: unitPrice,
        subtotal: unitPrice * line.wholesaleQuantity,
      });
    }

    if (line.regularQuantity > 0) {
      paymentProducts.push({
        productId: item.productId,
        title: item.product.name,
        color: item.color,
        size: item.size,
        quantity: line.regularQuantity,
        price: item.product.price,
        subtotal: item.product.price * line.regularQuantity,
      });
    }
  });

  const shipping = calculateOrderShipping({
    method: deliveryMethod,
    totalItems,
    hasWholesale,
  });
  const payableShipping = shipping.requiresQuote ? { ...shipping, cost: 0 } : shipping;

  const shippingDescription = payableShipping.requiresQuote
    ? "Productos Charly Alexa. Envío pendiente de cotización por WhatsApp."
    : payableShipping.cost > 0
      ? "Envio nacional incluido en el pedido"
      : "Sin cargo de envio automatico";
  const preferenceItems: PreferenceItem[] = paymentProducts.map((item) => ({
    id: item.productId,
    title: `${item.title} - ${item.color} - Talla ${item.size}`,
    description: `Cantidad: ${item.quantity} · Subtotal: ${formatCurrency(
      item.subtotal
    )} · ${shippingDescription}`,
    quantity: item.quantity,
    unit_price: item.price,
    currency_id: "MXN",
  }));

  if (!payableShipping.requiresQuote && payableShipping.cost > 0) {
    preferenceItems.push({
      title:
        deliveryMethod === NATIONAL_DELIVERY_METHOD
          ? "Envio nacional"
          : "Envio",
      description: "Costo de envio del pedido",
      quantity: 1,
      unit_price: payableShipping.cost,
      currency_id: "MXN",
    });
  }

  const total = subtotal + payableShipping.cost;

  if (subtotal <= 0 || total <= 0) {
    throw new Error("invalid-order");
  }

  return {
    preferenceItems,
    subtotal,
    shipping: payableShipping,
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

    if (payment.preferenceId && payment.initPoint) {
      return Response.json({
        preferenceId: payment.preferenceId,
        initPoint: payment.initPoint,
      });
    }

    const deliveryMethod = getOrderDeliveryMethod(order);
    const encodedOrderId = encodeURIComponent(orderId);

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
          success: `${config.siteUrl}/pago/exitoso?orderId=${encodedOrderId}`,
          failure: `${config.siteUrl}/pago/error?orderId=${encodedOrderId}`,
          pending: `${config.siteUrl}/pago/pendiente?orderId=${encodedOrderId}`,
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
      "payment.initPoint": initPoint,
      updatedAt: FieldValue.serverTimestamp(),
    });

    return Response.json({ preferenceId, initPoint });
  } catch (error) {
    logErrorInDevelopment("Mercado Pago create preference error", error);
    return json("No se pudo iniciar el pago. Intenta de nuevo.", 500);
  }
}
