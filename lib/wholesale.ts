import type { Product } from "@/lib/products";

export type WholesaleCartLikeItem = {
  productId?: string;
  product: Product;
  quantity: number;
};

export type WholesaleValidationResult = {
  canCheckout: boolean;
  messages: string[];
  missingSurtido: number;
  missingByProduct: { productName: string; missing: number }[];
};

export function getWholesaleMode(product: Product) {
  return product.wholesaleMode ?? "none";
}

export function isWholesaleProduct(product: Product) {
  return getWholesaleMode(product) !== "none";
}

export function getWholesaleMinQuantity(product: Product) {
  const quantity = product.wholesaleMinQuantity ?? 0;
  return Number.isFinite(quantity) && quantity > 0 ? quantity : 0;
}

export function getWholesaleLabel(product: Product) {
  const mode = getWholesaleMode(product);
  const minQuantity = getWholesaleMinQuantity(product);

  if (mode === "surtido") {
    return minQuantity > 0
      ? `Mayoreo surtido desde ${minQuantity} piezas`
      : "Mayoreo surtido";
  }

  if (mode === "producto") {
    return minQuantity > 0
      ? `Mayoreo por producto desde ${minQuantity} piezas`
      : "Mayoreo por producto";
  }

  return "";
}

export function validateWholesaleCart(
  items: WholesaleCartLikeItem[]
): WholesaleValidationResult {
  const surtidoItems = items.filter(
    (item) => getWholesaleMode(item.product) === "surtido"
  );
  const surtidoTotal = surtidoItems.reduce(
    (total, item) => total + item.quantity,
    0
  );
  const surtidoMinimum = Math.max(
    0,
    ...surtidoItems.map((item) => getWholesaleMinQuantity(item.product))
  );
  const missingSurtido = Math.max(0, surtidoMinimum - surtidoTotal);

  const productModeItems = items.filter(
    (item) => getWholesaleMode(item.product) === "producto"
  );
  const productGroups = new Map<
    string,
    { product: Product; quantity: number; minimum: number }
  >();

  for (const item of productModeItems) {
    const key = item.productId ?? item.product.id;
    const current = productGroups.get(key);

    if (current) {
      current.quantity += item.quantity;
      current.minimum = Math.max(
        current.minimum,
        getWholesaleMinQuantity(item.product)
      );
      continue;
    }

    productGroups.set(key, {
      product: item.product,
      quantity: item.quantity,
      minimum: getWholesaleMinQuantity(item.product),
    });
  }

  const missingByProduct = Array.from(productGroups.values())
    .map((group) => ({
      productName: group.product.name,
      missing: Math.max(0, group.minimum - group.quantity),
    }))
    .filter((item) => item.missing > 0);

  const messages: string[] = [];

  if (missingSurtido > 0) {
    messages.push(
      `Faltan ${missingSurtido} productos para el mayoreo surtido.`
    );
  }

  for (const item of missingByProduct) {
    messages.push(
      `Faltan ${item.missing} piezas de ${item.productName} para el mayoreo por producto.`
    );
  }

  return {
    canCheckout: messages.length === 0,
    messages,
    missingSurtido,
    missingByProduct,
  };
}
