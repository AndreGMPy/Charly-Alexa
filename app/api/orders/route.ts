import { getAdminFirestore } from "@/lib/firebase-admin";
import {
  emptyDeliveryAddress,
  formatDeliveryAddressText,
  getDeliveryAddressValidationMessage,
  normalizeDeliveryAddress,
} from "@/lib/delivery-address";
import { logErrorInDevelopment } from "@/lib/safe-errors";
import {
  calculateOrderShipping,
  isDeliveryAddressRequired,
  isDeliveryMethod,
  NATIONAL_DELIVERY_METHOD,
} from "@/lib/shipping";
import type {
  DeliveryAddress,
  DeliveryMethod,
  FirebaseOrderItem,
  MainCategoryName,
  PaymentProvider,
  PaymentStatus,
  WholesaleMode,
} from "@/lib/firebase-types";
import {
  FieldValue,
  type Firestore,
  type Transaction,
} from "firebase-admin/firestore";
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

export const runtime = "nodejs";

type ParsedOrderItem = {
  productId: string;
  color: string;
  size: string;
  quantity: number;
};

type ParsedOrder = {
  customerName: string;
  customerPhone: string;
  deliveryMethod: DeliveryMethod;
  address: string;
  deliveryAddress?: DeliveryAddress;
  notes: string;
  items: ParsedOrderItem[];
  paymentProvider: PaymentProvider;
  wholesaleValidation?: {
    canCheckout?: boolean;
    messages?: string[];
  };
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

class SafeOrderError extends Error {}

const MAX_ORDER_ITEMS = 50;
const MAX_TOTAL_ITEMS = 200;
const MAX_ORDER_TOTAL = 100000;
const PRODUCTS_COLLECTION = "products";
const ORDERS_COLLECTION = "orders";
const SITE_SETTINGS_COLLECTION = "siteSettings";
const SITE_SETTINGS_DOCUMENT = "main";
const STOCK_MOVEMENTS_COLLECTION = "stockMovements";

function json(message: string, status: number) {
  return Response.json({ message }, { status });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function readString(value: unknown, maxLength: number) {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

function parsePositiveInteger(value: unknown, max: number) {
  const numberValue = Number(value);
  if (!Number.isInteger(numberValue) || numberValue <= 0 || numberValue > max) {
    return null;
  }

  return numberValue;
}

function sanitizeWholesaleValidation(value: unknown) {
  if (!isRecord(value)) return undefined;

  const messages = Array.isArray(value.messages)
    ? value.messages
        .filter((message): message is string => typeof message === "string")
        .map((message) => message.trim())
        .filter(Boolean)
        .slice(0, 6)
    : [];

  return {
    canCheckout:
      typeof value.canCheckout === "boolean" ? value.canCheckout : undefined,
    messages,
  };
}

function parsePaymentProvider(value: unknown): PaymentProvider {
  if (!isRecord(value)) return "manual";
  return value.provider === "mercadopago" ? "mercadopago" : "manual";
}

function getInitialPaymentStatus(provider: PaymentProvider): PaymentStatus {
  return provider === "mercadopago" ? "pending" : "manual";
}

function parseOrderPayload(body: unknown): ParsedOrder | string {
  if (!isRecord(body)) {
    return "No se pudo enviar el pedido. Intenta de nuevo.";
  }

  const customerName = readString(body.customerName, 120);
  const customerPhone = readString(body.customerPhone, 20);
  const deliveryMethod = isDeliveryMethod(body.deliveryMethod)
    ? body.deliveryMethod
    : NATIONAL_DELIVERY_METHOD;
  const legacyAddress = readString(body.address ?? body.customerAddress, 500);
  const deliveryAddress = normalizeDeliveryAddress(body.deliveryAddress);
  const notes = readString(body.notes, 500);
  const paymentProvider = parsePaymentProvider(body.payment);

  const phoneDigits = customerPhone.replace(/\D/g, "");

  if (!customerName || phoneDigits.length < 10 || phoneDigits.length > 15) {
    return "Revisa los datos del pedido e intenta de nuevo.";
  }

  if (isDeliveryAddressRequired(deliveryMethod)) {
    const canUseLegacyAddress =
      deliveryMethod === "Envío a domicilio" && !deliveryAddress && legacyAddress;
    const addressValidationMessage = canUseLegacyAddress
      ? ""
      : getDeliveryAddressValidationMessage(
          deliveryAddress ?? emptyDeliveryAddress
        );

    if (addressValidationMessage) {
      return addressValidationMessage;
    }
  }

  if (!Array.isArray(body.items) || body.items.length === 0) {
    return "El carrito está vacío.";
  }

  if (body.items.length > MAX_ORDER_ITEMS) {
    return "El pedido tiene demasiados productos.";
  }

  const items: ParsedOrderItem[] = [];

  for (const item of body.items) {
    if (!isRecord(item)) {
      return "Revisa los productos del pedido e intenta de nuevo.";
    }

    const productId = readString(item.productId, 140);
    const color = getVariantKey(readString(item.color, 80));
    const size = readString(item.size, 60) || "Unitalla";
    const quantity = parsePositiveInteger(item.quantity, MAX_TOTAL_ITEMS);

    if (!productId || !quantity) {
      return "Revisa los productos del pedido e intenta de nuevo.";
    }

    items.push({ productId, color, size, quantity });
  }

  const totalItems = items.reduce((total, item) => total + item.quantity, 0);
  if (totalItems <= 0 || totalItems > MAX_TOTAL_ITEMS) {
    return "El pedido tiene demasiadas piezas.";
  }

  const formattedAddress = deliveryAddress
    ? formatDeliveryAddressText(deliveryAddress)
    : legacyAddress;

  return {
    customerName,
    customerPhone,
    deliveryMethod,
    address: isDeliveryAddressRequired(deliveryMethod) ? formattedAddress : "",
    deliveryAddress:
      isDeliveryAddressRequired(deliveryMethod) && deliveryAddress
        ? deliveryAddress
        : undefined,
    notes,
    items,
    paymentProvider,
    wholesaleValidation: sanitizeWholesaleValidation(body.wholesaleValidation),
  };
}

function getStringField(data: Record<string, unknown>, field: string) {
  return typeof data[field] === "string" ? data[field] : "";
}

function getNumberField(data: Record<string, unknown>, field: string) {
  return typeof data[field] === "number" ? data[field] : 0;
}

function getStringListField(data: Record<string, unknown>, field: string) {
  return Array.isArray(data[field])
    ? data[field].filter((value): value is string => typeof value === "string")
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
  product: Record<string, unknown>,
  stockBySize: ProductStockBySize[]
): ProductInventoryState {
  const colors = getStringListField(product, "colors");
  const sizes = getStringListField(product, "sizes");
  const usesVariantStock = hasStoredStockByVariant(product.stockByVariant);
  const stockByVariant = normalizeStockByVariant(
    product.stockByVariant,
    colors.length > 0 ? colors : ["Sin color"],
    sizes.length > 0 ? sizes : stockBySize.map((item) => item.size),
    stockBySize,
    getNumberField(product, "stock")
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
  item: ParsedOrderItem
) {
  if (inventory.usesVariantStock) {
    return Math.max(inventory.stockByVariant[item.color]?.[item.size] ?? 0, 0);
  }

  return getStockForSize(product, inventory.stockBySize, item.size);
}

function groupItems(items: ParsedOrderItem[]) {
  const groupedItems = new Map<string, ParsedOrderItem>();

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

function buildOrderItem(
  productId: string,
  color: string,
  size: string,
  quantity: number,
  product: Record<string, unknown>,
  unitPrice: number,
  priceLabel: FirebaseOrderItem["priceLabel"] = "regular",
  wholesaleRunApplied = false
): FirebaseOrderItem {
  const images = getStringListField(product, "images");
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

function getWholesaleProductLike(
  productId: string,
  product: Record<string, unknown>
): WholesaleProductLike {
  return {
    id: productId,
    name: getStringField(product, "name") || "Producto",
    price: getNumberField(product, "price"),
    sizes: getStringListField(product, "sizes"),
    wholesaleMode: getStringField(product, "wholesaleMode") || "none",
    wholesalePrice:
      typeof product.wholesalePrice === "number" ? product.wholesalePrice : null,
    wholesaleMinQuantity: getNumberField(product, "wholesaleMinQuantity"),
    wholesaleRunEnabled: Boolean(product.wholesaleRunEnabled),
    wholesaleRunPrice:
      typeof product.wholesaleRunPrice === "number"
        ? product.wholesaleRunPrice
        : null,
    wholesaleRunSizes: getStringListField(product, "wholesaleRunSizes"),
  };
}

async function createWebOrderInFirestore(order: ParsedOrder) {
  const firestore = getAdminFirestore();
  const orderRef = firestore.collection(ORDERS_COLLECTION).doc();
  const orderNumber = createOrderNumber(orderRef.id);

  await firestore.runTransaction(async (transaction) => {
    await writeOrderTransaction(transaction, firestore, orderRef.id, orderNumber, order);
  });

  return {
    id: orderRef.id,
    orderNumber,
  };
}

async function writeOrderTransaction(
  transaction: Transaction,
  firestore: Firestore,
  orderId: string,
  orderNumber: string,
  order: ParsedOrder
) {
  const groupedItems = groupItems(order.items);
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
  const inventoryById = new Map<string, ProductInventoryState>();

  groupedItems.forEach((item, index) => {
    const snapshot = productSnapshots[index];

    if (!snapshot.exists) {
      throw new SafeOrderError("No se pudo enviar el pedido. Intenta de nuevo.");
    }

    const product = snapshot.data() ?? {};
    if (product.isActive !== true) {
      throw new SafeOrderError("Este producto ya no está disponible.");
    }

    const stockBySize = normalizeStockBySize(product.stockBySize);
    const inventory = getProductInventoryState(product, stockBySize);
    const previousStock = getStockForParsedItem(product, inventory, item);

    if (previousStock < item.quantity) {
      const productName = getStringField(product, "name") || "Producto";
      throw new SafeOrderError(
        `No hay suficientes piezas disponibles de ${productName} talla ${item.size}.`
      );
    }

    productDataById.set(item.productId, product);
    inventoryById.set(item.productId, inventory);
  });

  for (const item of groupedItems) {
    const product = productDataById.get(item.productId);
    const inventory = inventoryById.get(item.productId);

    if (!product || !inventory) {
      throw new SafeOrderError("No se pudo enviar el pedido. Intenta de nuevo.");
    }

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
    const productRef = firestore.collection(PRODUCTS_COLLECTION).doc(item.productId);
    const movementRef = firestore.collection(STOCK_MOVEMENTS_COLLECTION).doc();

    transaction.update(productRef, {
      stock: nextTotalStock,
      stockBySize: nextStockBySize,
      ...(inventory.usesVariantStock ? { stockByVariant: nextStockByVariant } : {}),
      updatedAt: FieldValue.serverTimestamp(),
    });
    transaction.set(movementRef, {
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
      note: `Pedido ${orderNumber}`,
      createdAt: FieldValue.serverTimestamp(),
      createdBy: "web",
    });

    inventoryById.set(item.productId, {
      ...inventory,
      stockBySize: nextStockBySize,
      stockByVariant: nextStockByVariant,
      totalStock: nextTotalStock,
    });
  }

  const wholesaleSettings = normalizeWholesaleSettings(
    isRecord(settingsSnapshot.data()?.wholesaleSettings)
      ? settingsSnapshot.data()?.wholesaleSettings
      : null
  );
  const pricedLines = calculateWholesaleCart(
    groupedItems.map((item) => {
      const product = productDataById.get(item.productId);

      if (!product) {
        throw new SafeOrderError("No se pudo enviar el pedido. Intenta de nuevo.");
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
      throw new SafeOrderError("No se pudo enviar el pedido. Intenta de nuevo.");
    }

    const orderLineItems: FirebaseOrderItem[] = [];
    const productId = item.productId ?? "";
    const color = item.color ?? "Sin color";
    const size = item.size ?? "Unitalla";

    if (line.wholesaleQuantity > 0) {
      const unitPrice =
        item.product.wholesaleRunEnabled && item.product.wholesaleRunPrice
          ? item.product.wholesaleRunPrice
          : line.unitPrice;

      orderLineItems.push(
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
      orderLineItems.push(
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

    return orderLineItems;
  });
  const subtotal = orderItems.reduce((sum, item) => sum + item.subtotal, 0);
  const totalItems = orderItems.reduce((sum, item) => sum + item.quantity, 0);
  const hasWholesale = orderItems.some(
    (item) =>
      item.wholesaleRunApplied ||
      (item.wholesaleType && item.wholesaleType !== "none")
  );
  const shipping = calculateOrderShipping({
    method: order.deliveryMethod,
    totalItems,
    hasWholesale,
  });
  const total = subtotal + shipping.cost;
  const payment = {
    status: getInitialPaymentStatus(order.paymentProvider),
    provider: order.paymentProvider,
  };

  if (subtotal <= 0 || total > MAX_ORDER_TOTAL || totalItems > MAX_TOTAL_ITEMS) {
    throw new SafeOrderError("Revisa los productos del pedido e intenta de nuevo.");
  }

  transaction.set(firestore.collection(ORDERS_COLLECTION).doc(orderId), {
    orderNumber,
    customerName: order.customerName,
    customerPhone: order.customerPhone,
    deliveryMethod: order.deliveryMethod,
    address: order.address,
    customerAddress: order.address,
    ...(order.deliveryAddress ? { deliveryAddress: order.deliveryAddress } : {}),
    notes: order.notes,
    items: orderItems,
    subtotal,
    shipping,
    shippingCost: shipping.cost,
    total,
    payment,
    totalItems,
    status: "Nuevo",
    source: "web",
    inventoryReturned: false,
    isDeleted: false,
    customer: {
      name: order.customerName,
      phone: order.customerPhone,
      address: order.address,
      ...(order.deliveryAddress
        ? { deliveryAddress: order.deliveryAddress }
        : {}),
      notes: order.notes,
    },
    ...(order.wholesaleValidation
      ? { wholesaleValidation: order.wholesaleValidation }
      : {}),
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  });
}

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => null);
    const parsedOrder = parseOrderPayload(body);

    if (typeof parsedOrder === "string") {
      return json(parsedOrder, 400);
    }

    const result = await createWebOrderInFirestore(parsedOrder);
    return Response.json(result);
  } catch (error) {
    logErrorInDevelopment("Web order API error", error);

    if (error instanceof SafeOrderError) {
      return json(error.message, 409);
    }

    return json("La tienda todavía no está lista. Intenta más tarde.", 500);
  }
}
