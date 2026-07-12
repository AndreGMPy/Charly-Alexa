export type NormalizedWholesaleMode = "none" | "mixed" | "product";

export type WholesaleProductLike = {
  id: string;
  name: string;
  price: number;
  sizes?: string[];
  wholesaleMode?: unknown;
  wholesalePrice?: number | null;
  wholesaleMinQuantity?: number | null;
  wholesaleRunEnabled?: boolean | null;
  wholesaleRunPrice?: number | null;
  wholesaleRunSizes?: string[] | null;
};

export type WholesaleSettings = {
  mixedWholesaleEnabled: boolean;
  mixedWholesaleMinQuantity: number;
  wholesaleInfoText: string;
  wholesaleRunInfoText?: string;
  publicWholesaleEnabled?: boolean;
};

export type WholesaleCartLikeItem = {
  productId?: string;
  product: WholesaleProductLike;
  selectedSize?: string;
  size?: string;
  selectedColor?: string;
  color?: string;
  quantity: number;
};

export type WholesalePricedLine<TItem> = {
  item: TItem;
  unitPrice: number;
  regularUnitPrice: number;
  wholesaleQuantity: number;
  regularQuantity: number;
  wholesaleSubtotal: number;
  regularSubtotal: number;
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
  wholesaleInfoText:
    "El mayoreo corrido aplica en prendas seleccionadas comprando 1 pieza de cada talla disponible del mismo color.",
  wholesaleRunInfoText:
    "El mayoreo corrido aplica cuando el cliente lleva 1 pieza de cada talla configurada, todas del mismo color.",
  publicWholesaleEnabled: true,
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
  const wholesaleRunInfoText =
    typeof settings?.wholesaleRunInfoText === "string"
      ? settings.wholesaleRunInfoText.trim()
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
    wholesaleRunInfoText:
      wholesaleRunInfoText || defaultWholesaleSettings.wholesaleRunInfoText,
    publicWholesaleEnabled:
      typeof settings?.publicWholesaleEnabled === "boolean"
        ? settings.publicWholesaleEnabled
        : defaultWholesaleSettings.publicWholesaleEnabled,
  };
}

export function getWholesaleMode(product: Pick<WholesaleProductLike, "wholesaleMode">) {
  return normalizeWholesaleMode(product.wholesaleMode);
}

export function isWholesaleProduct(product: Pick<WholesaleProductLike, "wholesaleMode">) {
  const maybeRunProduct = product as WholesaleProductLike;
  return isWholesaleRunProduct(maybeRunProduct) || getWholesaleMode(product) !== "none";
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

export function getWholesaleRunUnitPrice(
  product: Pick<WholesaleProductLike, "price" | "wholesaleRunPrice">
) {
  const price = Number(product.price);
  const wholesaleRunPrice = Number(product.wholesaleRunPrice ?? 0);

  if (
    Number.isFinite(price) &&
    Number.isFinite(wholesaleRunPrice) &&
    wholesaleRunPrice > 0 &&
    wholesaleRunPrice <= price
  ) {
    return wholesaleRunPrice;
  }

  return null;
}

export function getWholesaleRunSizes(
  product: Pick<WholesaleProductLike, "sizes" | "wholesaleRunSizes">
) {
  const configuredSizes = Array.isArray(product.wholesaleRunSizes)
    ? product.wholesaleRunSizes
    : [];
  const fallbackSizes = Array.isArray(product.sizes) ? product.sizes : [];
  const source = configuredSizes.length > 0 ? configuredSizes : fallbackSizes;
  const uniqueSizes = new Map<string, string>();

  for (const size of source) {
    if (typeof size !== "string") continue;
    const cleanSize = size.trim();
    if (!cleanSize || uniqueSizes.has(cleanSize)) continue;
    uniqueSizes.set(cleanSize, cleanSize);
  }

  return Array.from(uniqueSizes.values());
}

export function isWholesaleRunProduct(product: WholesaleProductLike) {
  return Boolean(product.wholesaleRunEnabled) && Boolean(getWholesaleRunUnitPrice(product));
}

function getItemSize(item: WholesaleCartLikeItem) {
  return item.selectedSize ?? item.size ?? "Unitalla";
}

function getItemColor(item: WholesaleCartLikeItem) {
  return item.selectedColor ?? item.color ?? "Sin color";
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: "MXN",
    maximumFractionDigits: 0,
  }).format(value);
}

export function getWholesaleLabel(
  product: Pick<
    WholesaleProductLike,
    | "price"
    | "sizes"
    | "wholesaleMode"
    | "wholesaleMinQuantity"
    | "wholesalePrice"
    | "wholesaleRunEnabled"
    | "wholesaleRunPrice"
    | "wholesaleRunSizes"
  >,
  settings?: Partial<WholesaleSettings> | null
) {
  const normalizedSettings = normalizeWholesaleSettings(settings);
  const wholesaleRunPrice = getWholesaleRunUnitPrice(product);

  if (
    normalizedSettings.publicWholesaleEnabled !== false &&
    product.wholesaleRunEnabled &&
    wholesaleRunPrice
  ) {
    return `Mayoreo corrido ${formatCurrency(wholesaleRunPrice)} por pieza`;
  }

  const mode = getWholesaleMode(product);
  const wholesalePrice = getWholesaleUnitPrice(product);

  if (mode === "mixed") {
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

type RunGroupTotals = {
  runs: number;
  missingSizes: string[];
};

function getRunGroupKey(item: WholesaleCartLikeItem) {
  return `${item.productId ?? item.product.id}::${getItemColor(item)}`;
}

function getRunTotals<TItem extends WholesaleCartLikeItem>(items: TItem[]) {
  const groups = new Map<string, RunGroupTotals>();
  const groupItems = new Map<string, TItem[]>();

  for (const item of items) {
    if (!isWholesaleRunProduct(item.product)) continue;
    const runSizes = getWholesaleRunSizes(item.product);
    if (runSizes.length === 0) continue;

    const key = getRunGroupKey(item);
    groupItems.set(key, [...(groupItems.get(key) ?? []), item]);
  }

  groupItems.forEach((itemsInGroup, key) => {
    const [firstItem] = itemsInGroup;
    const runSizes = getWholesaleRunSizes(firstItem.product);
    const quantitiesBySize = new Map<string, number>();

    for (const item of itemsInGroup) {
      const size = getItemSize(item);
      if (!runSizes.includes(size)) continue;
      quantitiesBySize.set(size, (quantitiesBySize.get(size) ?? 0) + item.quantity);
    }

    const runs = Math.min(
      ...runSizes.map((size) => quantitiesBySize.get(size) ?? 0)
    );
    const missingSizes = runSizes.filter((size) => (quantitiesBySize.get(size) ?? 0) <= 0);

    groups.set(key, {
      runs: Number.isFinite(runs) ? Math.max(Math.floor(runs), 0) : 0,
      missingSizes,
    });
  });

  return groups;
}

export function calculateWholesaleCart<TItem extends WholesaleCartLikeItem>(
  items: TItem[],
  settings?: Partial<WholesaleSettings> | null
) {
  const runTotals = getRunTotals(items);
  const runAllocatedByLineKey = new Map<string, number>();
  const mixedTotals = getMixedTotals(items, settings);
  const productQuantities = getProductModeQuantities(items);

  return items.map<WholesalePricedLine<TItem>>((item) => {
    const mode = getWholesaleMode(item.product);
    const wholesalePrice = getWholesaleUnitPrice(item.product);
    const wholesaleRunPrice = getWholesaleRunUnitPrice(item.product);
    const runSizes = getWholesaleRunSizes(item.product);
    const size = getItemSize(item);
    let unitPrice = item.product.price;
    let usesWholesalePrice = false;
    let missingForWholesale = 0;
    let message = "";
    let wholesaleQuantity = 0;
    let regularQuantity = item.quantity;
    let wholesaleSubtotal = 0;
    let regularSubtotal = 0;

    if (item.product.wholesaleRunEnabled && wholesaleRunPrice && runSizes.length > 0) {
      const groupKey = getRunGroupKey(item);
      const totals = runTotals.get(groupKey);
      const runLineKey = `${groupKey}::${size}`;
      const allocated = runAllocatedByLineKey.get(runLineKey) ?? 0;
      const canUseRunPrice =
        (totals?.runs ?? 0) > 0 && runSizes.includes(size);

      if (canUseRunPrice && totals) {
        wholesaleQuantity = Math.min(item.quantity, Math.max(totals.runs - allocated, 0));
        regularQuantity = Math.max(item.quantity - wholesaleQuantity, 0);
        runAllocatedByLineKey.set(runLineKey, allocated + wholesaleQuantity);
        usesWholesalePrice = wholesaleQuantity > 0;
        unitPrice = regularQuantity > 0 ? item.product.price : wholesaleRunPrice;
        message = usesWholesalePrice
          ? "Mayoreo corrido aplicado."
          : "";
      } else {
        missingForWholesale = totals?.missingSizes.length ?? runSizes.length;
        message =
          "Este producto aplica para mayoreo corrido. Agrega las tallas faltantes del mismo color para activar el precio de mayoreo.";
      }

      wholesaleSubtotal = wholesaleQuantity * wholesaleRunPrice;
      regularSubtotal = regularQuantity * item.product.price;

      return {
        item,
        unitPrice,
        regularUnitPrice: item.product.price,
        wholesaleQuantity,
        regularQuantity,
        wholesaleSubtotal,
        regularSubtotal,
        subtotal: wholesaleSubtotal + regularSubtotal,
        usesWholesalePrice,
        missingForWholesale,
        message,
      };
    }

    if (mode === "mixed" && wholesalePrice) {
      if (mixedTotals.applies) {
        unitPrice = wholesalePrice;
        usesWholesalePrice = true;
        wholesaleQuantity = item.quantity;
        regularQuantity = 0;
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
        wholesaleQuantity = item.quantity;
        regularQuantity = 0;
      } else if (minimum > 0) {
        missingForWholesale = Math.max(0, minimum - productQuantity);
        message = getProductWholesaleProductMessage(missingForWholesale);
      }
    }

    if (usesWholesalePrice && wholesalePrice) {
      wholesaleSubtotal = item.quantity * wholesalePrice;
      regularSubtotal = 0;
    } else {
      wholesaleQuantity = 0;
      regularQuantity = item.quantity;
      wholesaleSubtotal = 0;
      regularSubtotal = item.quantity * item.product.price;
    }

    return {
      item,
      unitPrice,
      regularUnitPrice: item.product.price,
      wholesaleQuantity,
      regularQuantity,
      wholesaleSubtotal,
      regularSubtotal,
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
  const hasIncompleteRun = pricedLines.some(
    (line) =>
      Boolean(line.item.product.wholesaleRunEnabled) &&
      line.missingForWholesale > 0
  );
  const hasAppliedRun = pricedLines.some(
    (line) =>
      Boolean(line.item.product.wholesaleRunEnabled) &&
      line.usesWholesalePrice
  );
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
    ...(hasAppliedRun ? ["Mayoreo corrido aplicado."] : []),
    ...(hasIncompleteRun
      ? [
          "Este producto aplica para mayoreo corrido. Agrega las tallas faltantes del mismo color para activar el precio de mayoreo.",
        ]
      : []),
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
