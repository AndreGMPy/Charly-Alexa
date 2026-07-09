export type NormalizedWholesaleMode = "none" | "mixed" | "product";

export type WholesaleProductLike = {
  id: string;
  name: string;
  price: number;
  wholesaleMode?: unknown;
  wholesalePrice?: number | null;
  wholesaleMinQuantity?: number | null;
};

export type WholesaleSettings = {
  mixedWholesaleEnabled: boolean;
  mixedWholesaleMinQuantity: number;
  wholesaleInfoText: string;
};

export type WholesaleCartLikeItem = {
  productId?: string;
  product: WholesaleProductLike;
  quantity: number;
};

export type WholesalePricedLine<TItem> = {
  item: TItem;
  unitPrice: number;
  regularUnitPrice: number;
  subtotal: number;
  usesWholesalePrice: boolean;
  missingForWholesale: number;
  message: string;
};

export type WholesaleValidationResult = {
  canCheckout: boolean;
  messages: string[];
  missingSurtido: number;
  missingByProduct: { productName: string; missing: number }[];
};

export const defaultWholesaleSettings: WholesaleSettings = {
  mixedWholesaleEnabled: true,
  mixedWholesaleMinQuantity: 6,
  wholesaleInfoText: "Mayoreo disponible desde 6 piezas surtidas.",
};

export function formatMissingPiecesText(missing: number) {
  const pieces = Math.max(0, Math.floor(missing));
  return `Agrega ${pieces} ${pieces === 1 ? "pieza más" : "piezas más"}`;
}

export function getMixedWholesaleCartMessage(missing: number) {
  return `Hay productos con mayoreo surtido. ${formatMissingPiecesText(
    missing
  )} para activar el precio de mayoreo.`;
}

export function getMixedWholesaleProductMessage(missing: number) {
  return `Este producto aplica para mayoreo surtido. ${formatMissingPiecesText(
    missing
  )} para obtener precio de mayoreo.`;
}

export function getProductWholesaleCartMessage(productName: string, missing: number) {
  return `${productName}: ${formatMissingPiecesText(
    missing
  )} para activar el precio de mayoreo.`;
}

export function getProductWholesaleProductMessage(missing: number) {
  return `Este producto aplica para mayoreo por producto. ${formatMissingPiecesText(
    missing
  )} para obtener precio de mayoreo.`;
}

export function normalizeWholesaleMode(value: unknown): NormalizedWholesaleMode {
  if (value === "mixed" || value === "surtido") return "mixed";
  if (value === "product" || value === "producto") return "product";
  return "none";
}

export function normalizeWholesaleSettings(
  settings?: Partial<WholesaleSettings> | null
): WholesaleSettings {
  const mixedWholesaleMinQuantity = Number(settings?.mixedWholesaleMinQuantity);
  const wholesaleInfoText =
    typeof settings?.wholesaleInfoText === "string"
      ? settings.wholesaleInfoText.trim()
      : "";

  return {
    mixedWholesaleEnabled:
      typeof settings?.mixedWholesaleEnabled === "boolean"
        ? settings.mixedWholesaleEnabled
        : defaultWholesaleSettings.mixedWholesaleEnabled,
    mixedWholesaleMinQuantity:
      Number.isFinite(mixedWholesaleMinQuantity) && mixedWholesaleMinQuantity > 0
        ? Math.floor(mixedWholesaleMinQuantity)
        : defaultWholesaleSettings.mixedWholesaleMinQuantity,
    wholesaleInfoText:
      wholesaleInfoText || defaultWholesaleSettings.wholesaleInfoText,
  };
}

export function getWholesaleMode(product: Pick<WholesaleProductLike, "wholesaleMode">) {
  return normalizeWholesaleMode(product.wholesaleMode);
}

export function isWholesaleProduct(product: Pick<WholesaleProductLike, "wholesaleMode">) {
  return getWholesaleMode(product) !== "none";
}

export function getWholesaleMinQuantity(
  product: Pick<WholesaleProductLike, "wholesaleMinQuantity">
) {
  const quantity = Number(product.wholesaleMinQuantity ?? 0);
  return Number.isFinite(quantity) && quantity > 0 ? Math.floor(quantity) : 0;
}

export function getWholesaleUnitPrice(
  product: Pick<WholesaleProductLike, "price" | "wholesalePrice">
) {
  const price = Number(product.price);
  const wholesalePrice = Number(product.wholesalePrice ?? 0);

  if (
    Number.isFinite(price) &&
    Number.isFinite(wholesalePrice) &&
    wholesalePrice > 0 &&
    wholesalePrice <= price
  ) {
    return wholesalePrice;
  }

  return null;
}

export function getWholesaleLabel(
  product: Pick<
    WholesaleProductLike,
    "price" | "wholesaleMode" | "wholesaleMinQuantity" | "wholesalePrice"
  >,
  settings?: Partial<WholesaleSettings> | null
) {
  const mode = getWholesaleMode(product);
  const wholesalePrice = getWholesaleUnitPrice(product);

  if (mode === "mixed") {
    const normalizedSettings = normalizeWholesaleSettings(settings);
    if (!normalizedSettings.mixedWholesaleEnabled || !wholesalePrice) return "";
    return `Mayoreo surtido desde ${normalizedSettings.mixedWholesaleMinQuantity} piezas`;
  }

  if (mode === "product") {
    const minQuantity = getWholesaleMinQuantity(product);
    if (!wholesalePrice) return "";
    return minQuantity > 0
      ? `Mayoreo por producto desde ${minQuantity} piezas`
      : "Mayoreo por producto";
  }

  return "";
}

function getMixedTotals<TItem extends WholesaleCartLikeItem>(
  items: TItem[],
  settings?: Partial<WholesaleSettings> | null
) {
  const normalizedSettings = normalizeWholesaleSettings(settings);
  const eligibleTotal = items
    .filter(
      (item) =>
        normalizedSettings.mixedWholesaleEnabled &&
        getWholesaleMode(item.product) === "mixed" &&
        Boolean(getWholesaleUnitPrice(item.product))
    )
    .reduce((total, item) => total + item.quantity, 0);

  return {
    eligibleTotal,
    minimum: normalizedSettings.mixedWholesaleMinQuantity,
    applies:
      normalizedSettings.mixedWholesaleEnabled &&
      eligibleTotal >= normalizedSettings.mixedWholesaleMinQuantity,
    missing: normalizedSettings.mixedWholesaleEnabled
      ? Math.max(0, normalizedSettings.mixedWholesaleMinQuantity - eligibleTotal)
      : 0,
  };
}

function getProductModeQuantities<TItem extends WholesaleCartLikeItem>(
  items: TItem[]
) {
  const quantities = new Map<string, number>();

  for (const item of items) {
    if (getWholesaleMode(item.product) !== "product") continue;
    if (!getWholesaleUnitPrice(item.product)) continue;

    const key = item.productId ?? item.product.id;
    quantities.set(key, (quantities.get(key) ?? 0) + item.quantity);
  }

  return quantities;
}

export function calculateWholesaleCart<TItem extends WholesaleCartLikeItem>(
  items: TItem[],
  settings?: Partial<WholesaleSettings> | null
) {
  const mixedTotals = getMixedTotals(items, settings);
  const productQuantities = getProductModeQuantities(items);

  return items.map<WholesalePricedLine<TItem>>((item) => {
    const mode = getWholesaleMode(item.product);
    const wholesalePrice = getWholesaleUnitPrice(item.product);
    let unitPrice = item.product.price;
    let usesWholesalePrice = false;
    let missingForWholesale = 0;
    let message = "";

    if (mode === "mixed" && wholesalePrice) {
      if (mixedTotals.applies) {
        unitPrice = wholesalePrice;
        usesWholesalePrice = true;
      } else {
        missingForWholesale = mixedTotals.missing;
        message = getMixedWholesaleProductMessage(mixedTotals.missing);
      }
    }

    if (mode === "product" && wholesalePrice) {
      const minimum = getWholesaleMinQuantity(item.product);
      const productQuantity = productQuantities.get(item.productId ?? item.product.id) ?? 0;

      if (minimum > 0 && productQuantity >= minimum) {
        unitPrice = wholesalePrice;
        usesWholesalePrice = true;
      } else if (minimum > 0) {
        missingForWholesale = Math.max(0, minimum - productQuantity);
        message = getProductWholesaleProductMessage(missingForWholesale);
      }
    }

    return {
      item,
      unitPrice,
      regularUnitPrice: item.product.price,
      subtotal: unitPrice * item.quantity,
      usesWholesalePrice,
      missingForWholesale,
      message,
    };
  });
}

export function validateWholesaleCart(
  items: WholesaleCartLikeItem[],
  settings?: Partial<WholesaleSettings> | null
): WholesaleValidationResult {
  const pricedLines = calculateWholesaleCart(items, settings);
  const mixedMissing = Math.max(
    0,
    ...pricedLines
      .filter((line) => getWholesaleMode(line.item.product) === "mixed")
      .map((line) => line.missingForWholesale)
  );
  const missingByProduct = pricedLines
    .filter(
      (line) =>
        getWholesaleMode(line.item.product) === "product" &&
        line.missingForWholesale > 0
    )
    .map((line) => ({
      productName: line.item.product.name,
      missing: line.missingForWholesale,
    }));
  const messages = [
    ...(mixedMissing > 0 ? [getMixedWholesaleCartMessage(mixedMissing)] : []),
    ...missingByProduct.map((item) =>
      getProductWholesaleCartMessage(item.productName, item.missing)
    ),
  ];

  return {
    canCheckout: true,
    messages,
    missingSurtido: mixedMissing,
    missingByProduct,
  };
}
