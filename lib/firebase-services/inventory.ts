import type {
  FirebaseOrderItem,
  FirebaseProduct,
  ProductSizeStock,
} from "@/lib/firebase-types";
import {
  getVariantKey,
  hasStoredStockByVariant,
  normalizeStockByVariant,
  stockByVariantToStockBySize,
  sumStockByVariant,
} from "@/lib/variant-utils";
import {
  collection,
  doc,
  runTransaction,
  serverTimestamp,
  type Firestore,
  type Transaction,
} from "firebase/firestore";

export type InventoryMovementType =
  | "web_order"
  | "store_sale"
  | "order_cancelled"
  | "store_sale_cancelled"
  | "inventory_adjustment";

export type InventoryMovementContext = {
  type: InventoryMovementType;
  orderId?: string;
  saleId?: string;
  note?: string;
  createdBy?: string;
};

export type InventoryAdjustmentReason =
  | "conteo físico"
  | "merma"
  | "devolución"
  | "corrección"
  | "entrada de mercancía";

export type InventoryAdjustmentInput = {
  productId: string;
  productName: string;
  color: string;
  size: string;
  mode: "set" | "move";
  quantity: number;
  reason: InventoryAdjustmentReason;
  createdBy?: string;
};

type GroupedInventoryItem = {
  productId: string;
  productName: string;
  color: string;
  size: string;
  quantity: number;
};

const PRODUCTS_COLLECTION = "products";
const STOCK_MOVEMENTS_COLLECTION = "stockMovements";

function getItemName(item: FirebaseOrderItem) {
  return item.productName ?? item.name ?? "Producto";
}

function normalizeStockBySize(
  stockBySize: FirebaseProduct["stockBySize"] | undefined
) {
  return Array.isArray(stockBySize) ? stockBySize : [];
}

function getStockTotal(product: Partial<FirebaseProduct>) {
  if (typeof product.stock === "number") {
    return Math.max(product.stock, 0);
  }

  return normalizeStockBySize(product.stockBySize).reduce(
    (total, item) => total + Math.max(item.stock ?? 0, 0),
    0
  );
}

function getStockForSize(
  product: Partial<FirebaseProduct>,
  stockBySize: ProductSizeStock[],
  size: string
) {
  const sizeStock = stockBySize.find((item) => item.size === size);

  if (sizeStock) {
    return Math.max(sizeStock.stock ?? 0, 0);
  }

  if (stockBySize.length === 0) {
    return getStockTotal(product);
  }

  return 0;
}

function updateStockBySize(
  stockBySize: ProductSizeStock[],
  size: string,
  newStock: number
) {
  const cleanStock = Math.max(newStock, 0);
  const existingIndex = stockBySize.findIndex((item) => item.size === size);

  if (existingIndex === -1) {
    return [...stockBySize, { size, stock: cleanStock }];
  }

  return stockBySize.map((item, index) =>
    index === existingIndex ? { ...item, stock: cleanStock } : item
  );
}

function groupInventoryItems(items: FirebaseOrderItem[]) {
  const groupedItems = new Map<string, GroupedInventoryItem>();

  for (const item of items) {
    const productId = item.productId;
    const color = getVariantKey(item.color);
    const size = item.size || "Unitalla";
    const quantity = Math.max(Number(item.quantity) || 0, 0);

    if (!productId || quantity <= 0) continue;

    const key = `${productId}::${color}::${size}`;
    const current = groupedItems.get(key);

    if (current) {
      current.quantity += quantity;
      continue;
    }

    groupedItems.set(key, {
      productId,
      productName: getItemName(item),
      color,
      size,
      quantity,
    });
  }

  return Array.from(groupedItems.values());
}

export async function applyInventoryChangesInTransaction(
  transaction: Transaction,
  firestore: Firestore,
  items: FirebaseOrderItem[],
  context: InventoryMovementContext,
  direction: "decrease" | "increase"
) {
  const groupedItems = groupInventoryItems(items);
  const productIds = Array.from(
    new Set(groupedItems.map((item) => item.productId))
  );
  const productRefs = productIds.map((productId) =>
    doc(firestore, PRODUCTS_COLLECTION, productId)
  );
  const productSnapshots = await Promise.all(
    productRefs.map((productRef) => transaction.get(productRef))
  );

  productIds.forEach((productId, index) => {
    const productSnapshot = productSnapshots[index];
    const productItems = groupedItems.filter(
      (item) => item.productId === productId
    );
    const productName = productItems[0]?.productName ?? "Producto";

    if (!productSnapshot.exists()) {
      throw new Error(`No encontramos inventario para ${productName}.`);
    }

    const productData = productSnapshot.data() as Partial<FirebaseProduct>;
    let nextStockBySize = normalizeStockBySize(productData.stockBySize);
    let nextTotalStock = getStockTotal(productData);
    const usesVariantStock = hasStoredStockByVariant(productData.stockByVariant);
    const productColors = productData.colors?.length ? productData.colors : ["Sin color"];
    const productSizes =
      productData.sizes?.length
        ? productData.sizes
        : nextStockBySize.length > 0
          ? nextStockBySize.map((item) => item.size)
          : ["Unitalla"];
    let nextStockByVariant = normalizeStockByVariant(
      productData.stockByVariant,
      productColors,
      productSizes,
      nextStockBySize,
      productData.stock ?? 0
    );

    productItems.forEach((item) => {
      const previousSizeStock = usesVariantStock
        ? Math.max(nextStockByVariant[item.color]?.[item.size] ?? 0, 0)
        : getStockForSize(
            { ...productData, stock: nextTotalStock },
            nextStockBySize,
            item.size
          );

      if (direction === "decrease" && previousSizeStock < item.quantity) {
        throw new Error(
          `No hay suficientes piezas disponibles de ${item.productName} talla ${item.size}.`
        );
      }

      const quantityChange =
        direction === "decrease" ? -item.quantity : item.quantity;
      const newSizeStock = previousSizeStock + quantityChange;

      if (usesVariantStock) {
        nextStockByVariant = {
          ...nextStockByVariant,
          [item.color]: {
            ...(nextStockByVariant[item.color] ?? {}),
            [item.size]: Math.max(newSizeStock, 0),
          },
        };
        nextStockBySize = stockByVariantToStockBySize(
          nextStockByVariant,
          productSizes
        );
        nextTotalStock = sumStockByVariant(nextStockByVariant);
      } else {
        nextTotalStock = Math.max(nextTotalStock + quantityChange, 0);
        nextStockBySize = updateStockBySize(
          nextStockBySize,
          item.size,
          newSizeStock
        );
      }

      const movementRef = doc(
        collection(firestore, STOCK_MOVEMENTS_COLLECTION)
      );
      transaction.set(movementRef, {
        type: context.type,
        productId: item.productId,
        productName: item.productName,
        color: item.color,
        size: item.size,
        previousQuantity: previousSizeStock,
        newQuantity: Math.max(newSizeStock, 0),
        difference: quantityChange,
        quantityChange,
        previousStock: previousSizeStock,
        newStock: Math.max(newSizeStock, 0),
        orderId: context.orderId ?? "",
        saleId: context.saleId ?? "",
        note: context.note ?? "",
        createdAt: serverTimestamp(),
        createdBy: context.createdBy ?? "sistema",
      });
    });

    transaction.update(productRefs[index], {
      stock: nextTotalStock,
      stockBySize: nextStockBySize,
      ...(usesVariantStock ? { stockByVariant: nextStockByVariant } : {}),
      updatedAt: serverTimestamp(),
    });
  });
}

function ensureFirebaseConfigured(firestore: Firestore | null) {
  if (!firestore) {
    throw new Error("La tienda no esta conectada.");
  }

  return firestore;
}

export async function adjustProductInventory(
  firestore: Firestore | null,
  adjustment: InventoryAdjustmentInput
) {
  const database = ensureFirebaseConfigured(firestore);
  const productRef = doc(database, PRODUCTS_COLLECTION, adjustment.productId);

  await runTransaction(database, async (transaction) => {
      const productSnapshot = await transaction.get(productRef);

      if (!productSnapshot.exists()) {
        throw new Error("No encontramos inventario para este producto.");
      }

      const productData = productSnapshot.data() as Partial<FirebaseProduct>;
      let nextStockBySize = normalizeStockBySize(productData.stockBySize);
      const usesVariantStock = hasStoredStockByVariant(productData.stockByVariant);
      const productColors = productData.colors?.length ? productData.colors : ["Sin color"];
      const productSizes =
        productData.sizes?.length
          ? productData.sizes
          : nextStockBySize.length > 0
            ? nextStockBySize.map((item) => item.size)
            : ["Unitalla"];
      let nextStockByVariant = normalizeStockByVariant(
        productData.stockByVariant,
        productColors,
        productSizes,
        nextStockBySize,
        productData.stock ?? 0
      );
      const color = getVariantKey(adjustment.color);
      const previousStock = usesVariantStock
        ? Math.max(nextStockByVariant[color]?.[adjustment.size] ?? 0, 0)
        : getStockForSize(productData, nextStockBySize, adjustment.size);
      const nextQuantity =
        adjustment.mode === "set"
          ? Math.max(Math.floor(adjustment.quantity), 0)
          : Math.max(previousStock + Math.floor(adjustment.quantity), 0);
      const difference = nextQuantity - previousStock;
      let nextTotalStock = getStockTotal(productData);

      if (usesVariantStock) {
        nextStockByVariant = {
          ...nextStockByVariant,
          [color]: {
            ...(nextStockByVariant[color] ?? {}),
            [adjustment.size]: nextQuantity,
          },
        };
        nextStockBySize = stockByVariantToStockBySize(
          nextStockByVariant,
          productSizes
        );
        nextTotalStock = sumStockByVariant(nextStockByVariant);
      } else {
        nextStockBySize = updateStockBySize(
          nextStockBySize,
          adjustment.size,
          nextQuantity
        );
        nextTotalStock = Math.max(getStockTotal(productData) + difference, 0);
      }

      const movementRef = doc(collection(database, STOCK_MOVEMENTS_COLLECTION));
      transaction.set(movementRef, {
        type: "inventory_adjustment",
        productId: adjustment.productId,
        productName: adjustment.productName,
        color,
        size: adjustment.size,
        quantityChange: difference,
        previousStock,
        newStock: nextQuantity,
        previousQuantity: previousStock,
        newQuantity: nextQuantity,
        difference,
        reason: adjustment.reason,
        orderId: "",
        saleId: "",
        note: adjustment.reason,
        createdAt: serverTimestamp(),
        createdBy: adjustment.createdBy ?? "admin",
      });
      transaction.update(productRef, {
        stock: nextTotalStock,
        stockBySize: nextStockBySize,
        ...(usesVariantStock ? { stockByVariant: nextStockByVariant } : {}),
        updatedAt: serverTimestamp(),
      });
  });
}
