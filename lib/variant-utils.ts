export type StockByVariant = Record<string, Record<string, number>>;

export type SizeStock = {
  size: string;
  stock: number;
};

export function cleanList(values: unknown, fallback: string[] = []) {
  const source = Array.isArray(values) ? values : fallback;
  const uniqueValues = new Map<string, string>();

  for (const value of source) {
    if (typeof value !== "string") continue;
    const cleanValue = value.trim();
    const key = cleanValue.toLowerCase();
    if (!key || uniqueValues.has(key)) continue;
    uniqueValues.set(key, cleanValue);
  }

  return Array.from(uniqueValues.values());
}

export function getVariantKey(color?: string | null) {
  const cleanColor = color?.trim();
  return cleanColor || "Sin color";
}

export function normalizeStockQuantity(value: unknown) {
  const quantity = Number(value);
  return Number.isFinite(quantity) && quantity > 0 ? Math.floor(quantity) : 0;
}

export function normalizeStockBySize(value: unknown): SizeStock[] {
  if (!Array.isArray(value)) return [];

  return value
    .filter((item): item is Record<string, unknown> =>
      Boolean(item) && typeof item === "object" && !Array.isArray(item)
    )
    .map((item) => ({
      size: typeof item.size === "string" ? item.size.trim() : "",
      stock: normalizeStockQuantity(item.stock),
    }))
    .filter((item) => item.size);
}

export function hasStoredStockByVariant(value: unknown) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

export function normalizeStockByVariant(
  value: unknown,
  colors: string[],
  sizes: string[],
  stockBySize: SizeStock[] = [],
  totalStock = 0
): StockByVariant {
  const normalizedColors = colors.length > 0 ? colors : ["Sin color"];
  const normalizedSizes =
    sizes.length > 0
      ? sizes
      : stockBySize.length > 0
        ? stockBySize.map((item) => item.size)
        : ["Unitalla"];
  const stockBySizeMap = new Map(
    stockBySize.map((item) => [item.size, normalizeStockQuantity(item.stock)])
  );
  const output: StockByVariant = {};
  const storedVariant = hasStoredStockByVariant(value)
    ? (value as Record<string, unknown>)
    : null;

  normalizedColors.forEach((color, colorIndex) => {
    const colorKey = getVariantKey(color);
    const storedColor = storedVariant?.[colorKey];
    const storedColorStock =
      storedColor && typeof storedColor === "object" && !Array.isArray(storedColor)
        ? (storedColor as Record<string, unknown>)
        : null;

    output[colorKey] = {};

    normalizedSizes.forEach((size, sizeIndex) => {
      if (storedColorStock && size in storedColorStock) {
        output[colorKey][size] = normalizeStockQuantity(storedColorStock[size]);
        return;
      }

      if (!storedVariant) {
        if (stockBySizeMap.has(size)) {
          output[colorKey][size] = colorIndex === 0 ? stockBySizeMap.get(size) ?? 0 : 0;
          return;
        }

        output[colorKey][size] =
          colorIndex === 0 && sizeIndex === 0 ? normalizeStockQuantity(totalStock) : 0;
        return;
      }

      output[colorKey][size] = 0;
    });
  });

  return output;
}

export function sumStockByVariant(stockByVariant: StockByVariant) {
  return Object.values(stockByVariant).reduce(
    (colorTotal, sizeMap) =>
      colorTotal +
      Object.values(sizeMap).reduce(
        (sizeTotal, stock) => sizeTotal + normalizeStockQuantity(stock),
        0
      ),
    0
  );
}

export function stockByVariantToStockBySize(
  stockByVariant: StockByVariant,
  sizes: string[]
): SizeStock[] {
  return sizes.map((size) => ({
    size,
    stock: Object.values(stockByVariant).reduce(
      (total, sizeMap) => total + normalizeStockQuantity(sizeMap[size]),
      0
    ),
  }));
}

export function getStockForVariant(
  product: {
    stock?: number | null;
    stockBySize?: SizeStock[] | null;
    stockByVariant?: StockByVariant | null;
  },
  color: string | undefined,
  size: string
) {
  const variant = product.stockByVariant;
  const colorKey = getVariantKey(color);

  if (variant && Object.keys(variant).length > 0) {
    return normalizeStockQuantity(variant[colorKey]?.[size]);
  }

  const stockBySize = normalizeStockBySize(product.stockBySize);
  const sizeStock = stockBySize.find((item) => item.size === size);

  if (sizeStock) return normalizeStockQuantity(sizeStock.stock);
  if (stockBySize.length === 0) return normalizeStockQuantity(product.stock);

  return 0;
}

export function getStockForSizeAcrossColors(
  product: {
    stock?: number | null;
    stockBySize?: SizeStock[] | null;
    stockByVariant?: StockByVariant | null;
  },
  size: string
) {
  const variant = product.stockByVariant;

  if (variant && Object.keys(variant).length > 0) {
    return Object.values(variant).reduce(
      (total, sizeMap) => total + normalizeStockQuantity(sizeMap[size]),
      0
    );
  }

  return getStockForVariant(product, undefined, size);
}
