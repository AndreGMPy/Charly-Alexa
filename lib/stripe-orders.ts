import "server-only";

import { getAdminFirestore } from "@/lib/firebase-admin";
import {
  emptyDeliveryAddress,
  formatDeliveryAddressText,
  getDeliveryAddressValidationMessage,
  normalizeDeliveryAddress,
} from "@/lib/delivery-address";
import type {
  DeliveryAddress,
  DeliveryMethod,
  FirebaseOrder,
  FirebaseOrderItem,
  MainCategoryName,
  WholesaleMode,
} from "@/lib/firebase-types";
import { calculateOrderShipping, isDeliveryAddressRequired, isDeliveryMethod, NATIONAL_DELIVERY_METHOD } from "@/lib/shipping";
import { getAppUrl, getStripe } from "@/lib/stripe";
import {
  calculateWholesaleCart,
  normalizeWholesaleSettings,
  type WholesaleProductLike,
} from "@/lib/wholesale";
import {
  getVariantKey,
  hasStoredStockByVariant,
  normalizeStockByVariant,
  stockByVariantToStockBySize,
  sumStockByVariant,
  type StockByVariant,
} from "@/lib/variant-utils";
import {
  FieldValue,
  type DocumentReference,
  type Firestore,
  type Transaction,
} from "firebase-admin/firestore";
import type Stripe from "stripe";

const MAX_ORDER_ITEMS = 50;
const MAX_TOTAL_ITEMS = 200;
const MAX_ORDER_TOTAL = 100000;
const PRODUCTS_COLLECTION = "products";
const ORDERS_COLLECTION = "orders";
const SITE_SETTINGS_COLLECTION = "siteSettings";
const SITE_SETTINGS_DOCUMENT = "main";
const STOCK_MOVEMENTS_COLLECTION = "stockMovements";

export class SafeCheckoutError extends Error {}

type ParsedCheckoutItem = {
  productId: string;
  color: string;
  size: string;
  quantity: number;
};

type ParsedCheckout = {
  customerName: string;
  customerPhone: string;
  customerEmail: string;
  deliveryMethod: DeliveryMethod;
  address: string;
  deliveryAddress?: DeliveryAddress;
  notes: string;
  items: ParsedCheckoutItem[];
};

type ProductStockBySize = {
  size: string;
  stock: number;
};

type ProductInventoryState = {
  stockBySize: ProductStockBySize[];
  stockByVariant: StockByVariant;
  totalStock: number;
  usesVariantStock: boolean;
  colors: string[];
  sizes: string[];
};

type PricedOrder = {
  orderItems: FirebaseOrderItem[];
  subtotal: number;
  shipping: FirebaseOrder["shipping"];
  total: number;
  totalItems: number;
  hasWholesale: boolean;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function readString(value: unknown, maxLength: number) {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

function readPositiveInteger(value: unknown, max: number) {
  const numberValue = Number(value);
  if (!Number.isInteger(numberValue) || numberValue <= 0 || numberValue > max) {
    return null;
  }

  return numberValue;
}

function readNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function readStringList(value: unknown) {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];
}

function normalizeStockBySize(value: unknown): ProductStockBySize[] {
  if (!Array.isArray(value)) return [];

  return value
    .filter(isRecord)
    .map((item) => ({
      size: readString(item.size, 60),
      stock: Math.max(Number(item.stock) || 0, 0),
    }))
    .filter((item) => item.size);
}

function getStockTotal(
  product: Record<string, unknown>,
  stockBySize: ProductStockBySize[]
) {
  if (typeof product.stock === "number") {
    return Math.max(product.stock, 0);
  }

  return stockBySize.reduce((total, item) => total + item.stock, 0);
}

function getStockForSize(
  product: Record<string, unknown>,
  stockBySize: ProductStockBySize[],
  size: string
) {
  const sizeStock = stockBySize.find((item) => item.size === size);
  if (sizeStock) return sizeStock.stock;
  if (stockBySize.length === 0) return getStockTotal(product, stockBySize);

  return 0;
}

function updateStockBySize(
  stockBySize: ProductStockBySize[],
  size: string,
  nextStock: number
) {
  const cleanStock = Math.max(nextStock, 0);
  const existingIndex = stockBySize.findIndex((item) => item.size === size);

  if (existingIndex === -1) {
    return [...stockBySize, { size, stock: cleanStock }];
  }

  return stockBySize.map((item, index) =>
    index === existingIndex ? { ...item, stock: cleanStock } : item
  );
}

function getProductInventoryState(
  product: Record<string, unknown>
): ProductInventoryState {
  const stockBySize = normalizeStockBySize(product.stockBySize);
  const colors = readStringList(product.colors);
  const sizes = readStringList(product.sizes);
  const usesVariantStock = hasStoredStockByVariant(product.stockByVariant);
  const stockByVariant = normalizeStockByVariant(
    product.stockByVariant,
    colors.length > 0 ? colors : ["Sin color"],
    sizes.length > 0 ? sizes : stockBySize.map((item) => item.size),
    stockBySize,
    readNumber(product.stock)
  );
  const normalizedSizes =
    sizes.length > 0
      ? sizes
      : stockBySize.length > 0
        ? stockBySize.map((item) => item.size)
        : ["Unitalla"];
  const totalStock = usesVariantStock
    ? sumStockByVariant(stockByVariant)
    : getStockTotal(product, stockBySize);

  return {
    stockBySize,
    stockByVariant,
    totalStock,
    usesVariantStock,
    colors: colors.length > 0 ? colors : ["Sin color"],
    sizes: normalizedSizes,
  };
}

function getStockForParsedItem(
  product: Record<string, unknown>,
  inventory: ProductInventoryState,
  item: ParsedCheckoutItem
) {
  if (inventory.usesVariantStock) {
    return Math.max(inventory.stockByVariant[item.color]?.[item.size] ?? 0, 0);
  }

  return getStockForSize(product, inventory.stockBySize, item.size);
}

function groupItems(items: ParsedCheckoutItem[]) {
  const groupedItems = new Map<string, ParsedCheckoutItem>();

  for (const item of items) {
    const key = `${item.productId}::${item.color}::${item.size}`;
    const current = groupedItems.get(key);

    if (current) {
      current.quantity += item.quantity;
      continue;
    }

    groupedItems.set(key, { ...item });
  }

  return Array.from(groupedItems.values());
}

function createOrderNumber(id: string) {
  return id.slice(-6).toUpperCase();
}

function getStringField(data: Record<string, unknown>, field: string) {
  return typeof data[field] === "string" ? data[field] : "";
}

function getNumberField(data: Record<string, unknown>, field: string) {
  return typeof data[field] === "number" ? data[field] : 0;
}

function getWholesaleProductLike(
  productId: string,
  product: Record<string, unknown>
): WholesaleProductLike {
  return {
    id: productId,
    name: getStringField(product, "name") || "Producto",
    price: getNumberField(product, "price"),
    sizes: readStringList(product.sizes),
    wholesaleMode: getStringField(product, "wholesaleMode") || "none",
    wholesalePrice:
      typeof product.wholesalePrice === "number" ? product.wholesalePrice : null,
    wholesaleMinQuantity: getNumberField(product, "wholesaleMinQuantity"),
    wholesaleRunEnabled: Boolean(product.wholesaleRunEnabled),
    wholesaleRunPrice:
      typeof product.wholesaleRunPrice === "number"
        ? product.wholesaleRunPrice
        : null,
    wholesaleRunSizes: readStringList(product.wholesaleRunSizes),
  };
}

function buildOrderItem(
  productId: string,
  color: string,
  size: string,
  quantity: number,
  product: Record<string, unknown>,
  unitPrice: number,
  priceLabel: FirebaseOrderItem["priceLabel"],
  wholesaleRunApplied = false
): FirebaseOrderItem {
  const images = readStringList(product.images);
  const mainImage = getStringField(product, "mainImage") || images[0] || "";
  const productName = getStringField(product, "name") || "Producto";

  return {
    productId,
    productName,
    name: productName,
    slug: getStringField(product, "slug"),
    category: getStringField(product, "category") as MainCategoryName,
    subcategory: getStringField(product, "subcategory"),
    color,
    size,
    quantity,
    price: unitPrice,
    subtotal: unitPrice * quantity,
    mainImage,
    image: mainImage,
    regularPrice: getNumberField(product, "price"),
    wholesaleType:
      (getStringField(product, "wholesaleMode") as WholesaleMode) || "none",
    wholesaleMinimum: getNumberField(product, "wholesaleMinQuantity"),
    wholesaleRunApplied,
    wholesaleRunPrice:
      typeof product.wholesaleRunPrice === "number"
        ? product.wholesaleRunPrice
        : null,
    priceLabel,
  };
}

export function parseCheckoutPayload(body: unknown): ParsedCheckout {
  if (!isRecord(body)) {
    throw new SafeCheckoutError("No pudimos iniciar el pago. Intenta nuevamente.");
  }

  const customerName = readString(body.customerName, 120);
  const customerPhone = readString(body.customerPhone, 20);
  const customerEmail = readString(body.customerEmail, 160);
  const deliveryMethod = isDeliveryMethod(body.deliveryMethod)
    ? body.deliveryMethod
    : NATIONAL_DELIVERY_METHOD;
  const legacyAddress = readString(body.address ?? body.customerAddress, 500);
  const deliveryAddress = normalizeDeliveryAddress(body.deliveryAddress);
  const notes = readString(body.notes, 500);
  const phoneDigits = customerPhone.replace(/\D/g, "");

  if (!customerName || phoneDigits.length < 10 || phoneDigits.length > 15) {
    throw new SafeCheckoutError("Revisa los datos del pedido e intenta de nuevo.");
  }

  if (customerEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(customerEmail)) {
    throw new SafeCheckoutError("Agrega un correo valido para confirmar tu pedido.");
  }

  if (isDeliveryAddressRequired(deliveryMethod)) {
    const canUseLegacyAddress =
      deliveryMethod === "Envío a domicilio" && !deliveryAddress && legacyAddress;
    const validationMessage = canUseLegacyAddress
      ? ""
      : getDeliveryAddressValidationMessage(
          deliveryAddress ?? emptyDeliveryAddress
        );

    if (validationMessage) {
      throw new SafeCheckoutError(validationMessage);
    }
  }

  if (!Array.isArray(body.items) || body.items.length === 0) {
    throw new SafeCheckoutError("El carrito esta vacio.");
  }

  if (body.items.length > MAX_ORDER_ITEMS) {
    throw new SafeCheckoutError("El pedido tiene demasiados productos.");
  }

  const items = body.items.map((item) => {
    if (!isRecord(item)) {
      throw new SafeCheckoutError("Revisa los productos del pedido e intenta de nuevo.");
    }

    const productId = readString(item.productId, 140);
    const color = getVariantKey(readString(item.color ?? item.selectedColor, 80));
    const size = readString(item.size ?? item.selectedSize, 60) || "Unitalla";
    const quantity = readPositiveInteger(item.quantity, MAX_TOTAL_ITEMS);

    if (!productId || !quantity) {
      throw new SafeCheckoutError("Revisa los productos del pedido e intenta de nuevo.");
    }

    return { productId, color, size, quantity };
  });

  const totalItems = items.reduce((total, item) => total + item.quantity, 0);
  if (totalItems <= 0 || totalItems > MAX_TOTAL_ITEMS) {
    throw new SafeCheckoutError("El pedido tiene demasiadas piezas.");
  }

  const formattedAddress = deliveryAddress
    ? formatDeliveryAddressText(deliveryAddress)
    : legacyAddress;

  return {
    customerName,
    customerPhone,
    customerEmail,
    deliveryMethod,
    address: isDeliveryAddressRequired(deliveryMethod) ? formattedAddress : "",
    deliveryAddress:
      isDeliveryAddressRequired(deliveryMethod) && deliveryAddress
        ? deliveryAddress
        : undefined,
    notes,
    items,
  };
}

function validateVariant(
  product: Record<string, unknown>,
  inventory: ProductInventoryState,
  item: ParsedCheckoutItem
) {
  if (product.isActive !== true) {
    throw new SafeCheckoutError("El producto ya no esta disponible.");
  }

  if (!inventory.colors.includes(item.color)) {
    throw new SafeCheckoutError("El color seleccionado ya no esta disponible.");
  }

  if (!inventory.sizes.includes(item.size)) {
    throw new SafeCheckoutError("La talla seleccionada ya no esta disponible.");
  }

  const currentStock = getStockForParsedItem(product, inventory, item);

  if (currentStock < item.quantity) {
    const productName = getStringField(product, "name") || "Producto";
    throw new SafeCheckoutError(
      `No hay suficientes piezas disponibles de ${productName} talla ${item.size}.`
    );
  }
}

async function calculatePricedOrder(
  transaction: Transaction,
  firestore: Firestore,
  groupedItems: ParsedCheckoutItem[],
  deliveryMethod: DeliveryMethod
): Promise<PricedOrder> {
  const productRefs = groupedItems.map((item) =>
    firestore.collection(PRODUCTS_COLLECTION).doc(item.productId)
  );
  const productSnapshots = await Promise.all(
    productRefs.map((productRef) => transaction.get(productRef))
  );
  const settingsSnapshot = await transaction.get(
    firestore.collection(SITE_SETTINGS_COLLECTION).doc(SITE_SETTINGS_DOCUMENT)
  );
  const productDataById = new Map<string, Record<string, unknown>>();

  groupedItems.forEach((item, index) => {
    const snapshot = productSnapshots[index];

    if (!snapshot.exists) {
      throw new SafeCheckoutError("El producto ya no esta disponible.");
    }

    const product = snapshot.data() ?? {};
    const inventory = getProductInventoryState(product);
    validateVariant(product, inventory, item);

    productDataById.set(item.productId, product);
  });

  const wholesaleSettings = normalizeWholesaleSettings(
    isRecord(settingsSnapshot.data()?.wholesaleSettings)
      ? settingsSnapshot.data()?.wholesaleSettings
      : null
  );
  const pricedLines = calculateWholesaleCart(
    groupedItems.map((item) => {
      const product = productDataById.get(item.productId);
      if (!product) {
        throw new SafeCheckoutError("No pudimos iniciar el pago. Intenta nuevamente.");
      }

      return {
        productId: item.productId,
        color: item.color,
        size: item.size,
        product: getWholesaleProductLike(item.productId, product),
        quantity: item.quantity,
      };
    }),
    wholesaleSettings
  );

  const orderItems = pricedLines.flatMap((line) => {
    const item = line.item;
    const product = productDataById.get(item.productId ?? "");
    if (!product) {
      throw new SafeCheckoutError("No pudimos iniciar el pago. Intenta nuevamente.");
    }

    const output: FirebaseOrderItem[] = [];
    const productId = item.productId ?? "";
    const color = item.color ?? "Sin color";
    const size = item.size ?? "Unitalla";

    if (line.wholesaleQuantity > 0) {
      const unitPrice =
        item.product.wholesaleRunEnabled && item.product.wholesaleRunPrice
          ? item.product.wholesaleRunPrice
          : line.unitPrice;

      output.push(
        buildOrderItem(
          productId,
          color,
          size,
          line.wholesaleQuantity,
          product,
          unitPrice,
          item.product.wholesaleRunEnabled ? "wholesale_run" : "wholesale",
          Boolean(item.product.wholesaleRunEnabled)
        )
      );
    }

    if (line.regularQuantity > 0) {
      output.push(
        buildOrderItem(
          productId,
          color,
          size,
          line.regularQuantity,
          product,
          getNumberField(product, "price"),
          "regular",
          false
        )
      );
    }

    return output;
  });
  const subtotal = orderItems.reduce((sum, item) => sum + item.subtotal, 0);
  const totalItems = orderItems.reduce((sum, item) => sum + item.quantity, 0);
  const hasWholesale = orderItems.some(
    (item) =>
      item.wholesaleRunApplied ||
      (item.wholesaleType && item.wholesaleType !== "none")
  );
  const shipping = calculateOrderShipping({
    method: deliveryMethod,
    totalItems,
    hasWholesale,
  });
  const payableShipping = shipping.requiresQuote ? { ...shipping, cost: 0 } : shipping;
  const total = subtotal + payableShipping.cost;

  if (subtotal <= 0 || total <= 0 || total > MAX_ORDER_TOTAL) {
    throw new SafeCheckoutError("Revisa los productos del pedido e intenta de nuevo.");
  }

  return {
    orderItems,
    subtotal,
    shipping: payableShipping,
    total,
    totalItems,
    hasWholesale,
  };
}

function createStripeLineItems(
  orderItems: FirebaseOrderItem[],
  shipping: FirebaseOrder["shipping"]
): Stripe.Checkout.SessionCreateParams.LineItem[] {
  const lineItems = orderItems.map((item) => ({
    quantity: item.quantity,
    price_data: {
      currency: "mxn",
      product_data: {
        name: item.productName ?? item.name ?? "Producto",
        description: `Color ${item.color ?? "Sin color"} - Talla ${item.size}`,
      },
      unit_amount: Math.round(item.price * 100),
    },
  }));

  if (shipping && !shipping.requiresQuote && shipping.cost > 0) {
    lineItems.push({
      quantity: 1,
      price_data: {
        currency: "mxn",
        product_data: {
          name: "Envio",
          description: "Costo de envio del pedido",
        },
        unit_amount: Math.round(shipping.cost * 100),
      },
    });
  }

  return lineItems;
}

export async function createStripeCheckoutFromPayload(body: unknown) {
  const appUrl = getAppUrl();
  if (!appUrl) {
    throw new SafeCheckoutError("Los pagos todavia no estan configurados.");
  }

  const order = parseCheckoutPayload(body);
  const firestore = getAdminFirestore();
  const orderRef = firestore.collection(ORDERS_COLLECTION).doc();
  const orderNumber = createOrderNumber(orderRef.id);
  const groupedItems = groupItems(order.items);
  let pricedOrder: PricedOrder | null = null;

  await firestore.runTransaction(async (transaction) => {
    pricedOrder = await calculatePricedOrder(
      transaction,
      firestore,
      groupedItems,
      order.deliveryMethod
    );

    transaction.set(orderRef, {
      orderNumber,
      customerName: order.customerName,
      customerPhone: order.customerPhone,
      ...(order.customerEmail ? { customerEmail: order.customerEmail } : {}),
      deliveryMethod: order.deliveryMethod,
      address: order.address,
      customerAddress: order.address,
      ...(order.deliveryAddress ? { deliveryAddress: order.deliveryAddress } : {}),
      notes: order.notes,
      items: pricedOrder.orderItems,
      subtotal: pricedOrder.subtotal,
      shipping: pricedOrder.shipping,
      shippingCost: pricedOrder.shipping?.cost ?? 0,
      total: pricedOrder.total,
      totalItems: pricedOrder.totalItems,
      status: "pending_payment",
      paymentStatus: "pending",
      paymentProvider: "stripe",
      payment: {
        status: "pending",
        provider: "stripe",
      },
      source: "web",
      inventoryReturned: false,
      isDeleted: false,
      adminViewedAt: null,
      notifications: {},
      customer: {
        name: order.customerName,
        phone: order.customerPhone,
        ...(order.customerEmail ? { email: order.customerEmail } : {}),
        address: order.address,
        ...(order.deliveryAddress
          ? { deliveryAddress: order.deliveryAddress }
          : {}),
        notes: order.notes,
      },
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });
  });

  const finalPricedOrder = pricedOrder as PricedOrder | null;

  if (!finalPricedOrder) {
    throw new SafeCheckoutError("No pudimos iniciar el pago. Intenta nuevamente.");
  }

  try {
    const stripe = getStripe();
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      line_items: createStripeLineItems(
        finalPricedOrder.orderItems,
        finalPricedOrder.shipping
      ),
      customer_email: order.customerEmail || undefined,
      client_reference_id: orderRef.id,
      metadata: {
        orderId: orderRef.id,
        orderNumber,
      },
      payment_intent_data: {
        metadata: {
          orderId: orderRef.id,
          orderNumber,
        },
      },
      success_url: `${appUrl}/pedido/exito?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${appUrl}/?pago_cancelado=1`,
    });

    await orderRef.update({
      stripeCheckoutSessionId: session.id,
      "payment.stripeCheckoutSessionId": session.id,
      updatedAt: FieldValue.serverTimestamp(),
    });

    return {
      orderId: orderRef.id,
      orderNumber,
      checkoutUrl: session.url,
    };
  } catch (error) {
    await orderRef.update({
      status: "payment_failed",
      paymentStatus: "failed",
      "payment.status": "failed",
      paymentError: "stripe_session_create_failed",
      updatedAt: FieldValue.serverTimestamp(),
    });
    throw error;
  }
}

function getOrderFolio(orderId: string, order: Record<string, unknown>) {
  return readString(order.orderNumber, 40) || createOrderNumber(orderId);
}

async function applyInventoryIfAvailable(
  transaction: Transaction,
  firestore: Firestore,
  orderRef: DocumentReference,
  orderId: string,
  order: Record<string, unknown>
) {
  if (order.inventoryUpdatedAt) return { ok: true as const };
  const items = Array.isArray(order.items)
    ? order.items.filter(isRecord)
    : [];
  const parsedItems: ParsedCheckoutItem[] = items.map((item) => ({
    productId: readString(item.productId, 140),
    color: getVariantKey(readString(item.color, 80)),
    size: readString(item.size, 60) || "Unitalla",
    quantity: Math.max(Math.floor(Number(item.quantity) || 0), 0),
  })).filter((item) => item.productId && item.quantity > 0);
  const groupedItems = groupItems(parsedItems);
  const productRefs = groupedItems.map((item) =>
    firestore.collection(PRODUCTS_COLLECTION).doc(item.productId)
  );
  const productSnapshots = await Promise.all(
    productRefs.map((productRef) => transaction.get(productRef))
  );
  const productDataById = new Map<string, Record<string, unknown>>();
  const inventoryById = new Map<string, ProductInventoryState>();

  for (const [index, item] of groupedItems.entries()) {
    const snapshot = productSnapshots[index];
    const productName =
      items.find((orderItem) => readString(orderItem.productId, 140) === item.productId)
        ?.productName ?? "Producto";

    if (!snapshot.exists) {
      return { ok: false as const, error: `No encontramos inventario para ${productName}.` };
    }

    const product = snapshot.data() ?? {};
    const inventory = getProductInventoryState(product);
    const previousStock = getStockForParsedItem(product, inventory, item);

    if (previousStock < item.quantity) {
      return {
        ok: false as const,
        error: `No hay suficientes piezas disponibles de ${productName} talla ${item.size}.`,
      };
    }

    productDataById.set(item.productId, product);
    inventoryById.set(item.productId, inventory);
  }

  for (const item of groupedItems) {
    const product = productDataById.get(item.productId);
    const inventory = inventoryById.get(item.productId);
    if (!product || !inventory) continue;

    const previousStock = getStockForParsedItem(product, inventory, item);
    const nextSizeStock = previousStock - item.quantity;
    let nextStockBySize = inventory.stockBySize;
    let nextStockByVariant = inventory.stockByVariant;
    let nextTotalStock = inventory.totalStock;

    if (inventory.usesVariantStock) {
      nextStockByVariant = {
        ...inventory.stockByVariant,
        [item.color]: {
          ...(inventory.stockByVariant[item.color] ?? {}),
          [item.size]: Math.max(nextSizeStock, 0),
        },
      };
      nextStockBySize = stockByVariantToStockBySize(
        nextStockByVariant,
        inventory.sizes
      );
      nextTotalStock = sumStockByVariant(nextStockByVariant);
    } else {
      nextTotalStock = Math.max(inventory.totalStock - item.quantity, 0);
      nextStockBySize = updateStockBySize(
        inventory.stockBySize,
        item.size,
        nextSizeStock
      );
    }

    transaction.update(firestore.collection(PRODUCTS_COLLECTION).doc(item.productId), {
      stock: nextTotalStock,
      stockBySize: nextStockBySize,
      ...(inventory.usesVariantStock ? { stockByVariant: nextStockByVariant } : {}),
      updatedAt: FieldValue.serverTimestamp(),
    });
    transaction.set(firestore.collection(STOCK_MOVEMENTS_COLLECTION).doc(), {
      type: "web_order",
      productId: item.productId,
      productName: getStringField(product, "name") || "Producto",
      color: item.color,
      size: item.size,
      previousQuantity: previousStock,
      newQuantity: Math.max(nextSizeStock, 0),
      difference: -item.quantity,
      quantityChange: -item.quantity,
      previousStock,
      newStock: Math.max(nextSizeStock, 0),
      orderId,
      saleId: "",
      note: `Pedido ${getOrderFolio(orderId, order)}`,
      createdAt: FieldValue.serverTimestamp(),
      createdBy: "stripe",
    });

    inventoryById.set(item.productId, {
      ...inventory,
      stockBySize: nextStockBySize,
      stockByVariant: nextStockByVariant,
      totalStock: nextTotalStock,
    });
  }

  transaction.update(orderRef, {
    inventoryUpdatedAt: FieldValue.serverTimestamp(),
    inventoryUpdateError: FieldValue.delete(),
  });

  return { ok: true as const };
}

function stripeId(value: Stripe.Checkout.Session["payment_intent"] | Stripe.Checkout.Session["customer"]) {
  if (!value) return "";
  return typeof value === "string" ? value : value.id;
}

export async function markStripeOrderPaid(session: Stripe.Checkout.Session) {
  const orderId = readString(session.metadata?.orderId, 140);
  if (!orderId) return { orderId: "", shouldNotify: false };

  const firestore = getAdminFirestore();
  const orderRef = firestore.collection(ORDERS_COLLECTION).doc(orderId);
  let shouldNotify = false;

  await firestore.runTransaction(async (transaction) => {
    const orderSnapshot = await transaction.get(orderRef);
    if (!orderSnapshot.exists) return;

    const order = orderSnapshot.data() ?? {};
    const payment = isRecord(order.payment) ? order.payment : {};
    const provider = readString(order.paymentProvider, 40) || readString(payment.provider, 40);
    if (provider && provider !== "stripe") return;

    const alreadyPaid =
      order.paymentStatus === "paid" || readString(payment.status, 40) === "paid";
    const inventoryResult = await applyInventoryIfAvailable(
      transaction,
      firestore,
      orderRef,
      orderId,
      order
    );

    transaction.update(orderRef, {
      status: "paid",
      paymentStatus: "paid",
      paymentProvider: "stripe",
      paidAt: alreadyPaid ? order.paidAt ?? FieldValue.serverTimestamp() : FieldValue.serverTimestamp(),
      stripeCheckoutSessionId: session.id,
      stripePaymentIntentId: stripeId(session.payment_intent),
      stripeCustomerId: stripeId(session.customer),
      "payment.status": "paid",
      "payment.provider": "stripe",
      "payment.stripeCheckoutSessionId": session.id,
      "payment.stripePaymentIntentId": stripeId(session.payment_intent),
      "payment.stripeCustomerId": stripeId(session.customer),
      "payment.paymentId": stripeId(session.payment_intent),
      "payment.amountPaid": session.amount_total ? session.amount_total / 100 : readNumber(order.total),
      "payment.paidAt": alreadyPaid ? payment.paidAt ?? FieldValue.serverTimestamp() : FieldValue.serverTimestamp(),
      "payment.updatedAt": FieldValue.serverTimestamp(),
      ...(inventoryResult.ok
        ? {}
        : { inventoryUpdateError: inventoryResult.error }),
      updatedAt: FieldValue.serverTimestamp(),
    });

    shouldNotify = !alreadyPaid;
  });

  return { orderId, shouldNotify };
}

export async function markStripeOrderFailed(orderId: string, paymentIntentId?: string) {
  if (!orderId) return;

  const firestore = getAdminFirestore();
  await firestore.collection(ORDERS_COLLECTION).doc(orderId).set(
    {
      status: "payment_failed",
      paymentStatus: "failed",
      paymentProvider: "stripe",
      ...(paymentIntentId ? { stripePaymentIntentId: paymentIntentId } : {}),
      "payment.status": "failed",
      "payment.provider": "stripe",
      ...(paymentIntentId ? { "payment.stripePaymentIntentId": paymentIntentId } : {}),
      "payment.updatedAt": FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    },
    { merge: true }
  );
}

export async function markStripeSessionExpired(session: Stripe.Checkout.Session) {
  const orderId = readString(session.metadata?.orderId, 140);
  if (!orderId) return;

  const firestore = getAdminFirestore();
  await firestore.collection(ORDERS_COLLECTION).doc(orderId).set(
    {
      status: "cancelled",
      paymentStatus: "expired",
      paymentProvider: "stripe",
      stripeCheckoutSessionId: session.id,
      "payment.status": "expired",
      "payment.provider": "stripe",
      "payment.stripeCheckoutSessionId": session.id,
      "payment.updatedAt": FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    },
    { merge: true }
  );
}

export async function findOrderIdByPaymentIntent(paymentIntentId: string) {
  if (!paymentIntentId) return "";

  const firestore = getAdminFirestore();
  const snapshot = await firestore
    .collection(ORDERS_COLLECTION)
    .where("stripePaymentIntentId", "==", paymentIntentId)
    .limit(1)
    .get();

  return snapshot.docs[0]?.id ?? "";
}

export async function getOrderByStripeSession(sessionId: string) {
  const stripe = getStripe();
  const session = await stripe.checkout.sessions.retrieve(sessionId);
  const orderId = readString(session.metadata?.orderId, 140);

  if (!orderId) return null;

  const firestore = getAdminFirestore();
  const orderSnapshot = await firestore.collection(ORDERS_COLLECTION).doc(orderId).get();
  if (!orderSnapshot.exists) return null;

  const order = orderSnapshot.data() as FirebaseOrder;
  if (
    order.stripeCheckoutSessionId &&
    order.stripeCheckoutSessionId !== session.id
  ) {
    return null;
  }

  return {
    ...order,
    id: orderSnapshot.id,
  } as FirebaseOrder;
}
