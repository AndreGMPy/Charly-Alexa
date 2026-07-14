import type { StockByVariant } from "@/lib/variant-utils";
import {
  getStockForSizeAcrossColors,
  getStockForVariant,
} from "@/lib/variant-utils";

export type ProductCategory = "Niño" | "Niña" | "Unisex";

export type ProductSection = "nina" | "nino" | "unisex";

export type ProductSubcategory = string;

export type WholesaleMode = "none" | "surtido" | "producto" | "mixed" | "product";

export type ProductBadge =
  | "Nuevo"
  | "Oferta"
  | "Temporada"
  | "Tendencia"
  | "Últimas piezas"
  | "Más vendido";

export type CommercialFilter =
  | "Todos"
  | "Novedades"
  | "Ofertas"
  | "Temporada"
  | "Tendencias"
  | "Últimas piezas";

export type PriceFilter =
  | "Todos"
  | "Menos de $250"
  | "$250 a $400"
  | "Más de $400";

export type Product = {
  id: string;
  slug: string;
  name: string;
  category: ProductCategory;
  sections?: ProductSection[];
  subcategory: ProductSubcategory;
  subcategories?: ProductSubcategory[];
  price: number;
  basePrice?: number;
  sizes: string[];
  colors: string[];
  brand: string;
  description: string;
  longDescription: string;
  tag: ProductBadge;
  badges: ProductBadge[];
  stock: number;
  stockBySize?: {
    size: string;
    stock: number;
  }[];
  stockByVariant?: StockByVariant;
  gradient: string;
  galleryGradients: string[];
  imageUrl?: string;
  images?: string[];
  galleryImages?: string[];
  isNew?: boolean;
  isOffer?: boolean;
  isSeasonal?: boolean;
  isTrending?: boolean;
  isLastUnits?: boolean;
  isTestProduct?: boolean;
  wholesaleMode?: WholesaleMode;
  wholesalePrice?: number | null;
  wholesaleMinQuantity?: number;
  wholesaleNote?: string;
  wholesaleRunEnabled?: boolean;
  wholesaleRunPrice?: number | null;
  wholesaleRunSizes?: string[];
};

export const sizeOptions = [
  "1",
  "2",
  "4",
  "6",
  "8",
  "10",
  "12",
  "14",
  "16",
];

export const commercialFilters: CommercialFilter[] = [
  "Todos",
  "Novedades",
  "Ofertas",
  "Temporada",
  "Tendencias",
  "Últimas piezas",
];

export const priceFilters: PriceFilter[] = [
  "Todos",
  "Menos de $250",
  "$250 a $400",
  "Más de $400",
];

export const subcategories: ProductSubcategory[] = [
  "Conjuntos",
  "Playeras",
  "Chamarras",
  "Pantalones",
  "Shorts",
  "Sudaderas",
  "Vestidos",
  "Fiesta",
  "Accesorios",
  "Básicos",
  "Unisex",
];

/**
 * Productos locales de respaldo.
 *
 * Respaldo local vacío para que la tienda use únicamente los productos
 * agregados desde el panel vendedor en Firebase.
 */
export const products: Product[] = [];

type PublicProductLike = {
  name: string;
  isTestProduct?: boolean | null;
};

function normalizePublicProductName(name: string) {
  return name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

export function isPublicStoreProduct(product: PublicProductLike) {
  if (product.isTestProduct) return false;

  const name = normalizePublicProductName(product.name);
  return !["ejemplo", "prueba", "pasarela", "producto de prueba"].some(
    (term) => name.includes(term)
  );
}

export const mainCategories: ProductCategory[] = ["Niño", "Niña"];

export const sectionOptions: Array<{
  value: ProductSection;
  label: ProductCategory;
}> = [
  { value: "nina", label: "Niña" },
  { value: "nino", label: "Niño" },
];

export function categoryToSection(
  category?: ProductCategory | string | null
): ProductSection | null {
  const normalizedCategory = category
    ?.normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();

  if (normalizedCategory === "nina") return "nina";
  if (normalizedCategory === "nino") return "nino";
  if (normalizedCategory === "unisex") return "unisex";
  return null;
}

export function sectionToCategory(section: ProductSection): ProductCategory {
  if (section === "nina") return "Niña";
  if (section === "nino") return "Niño";
  return "Unisex";
}

export function normalizeProductCategory(
  category?: ProductCategory | string | null
): ProductCategory {
  const section = categoryToSection(category);
  if (section === "nina" || section === "nino") {
    return sectionToCategory(section);
  }

  return "Niña";
}

function isProductSection(value: unknown): value is ProductSection {
  return value === "nina" || value === "nino" || value === "unisex";
}

export function normalizeProductSections(product: {
  sections?: unknown;
  subcategories?: unknown;
  subcategory?: ProductSubcategory | string | null;
  category?: ProductCategory | string | null;
}): ProductSection[] {
  const savedSections = Array.isArray(product.sections)
    ? product.sections.filter(isProductSection)
    : [];
  const sections = new Set<ProductSection>();
  const hasUnisexSubcategory = productHasUnisexSubcategory(product);

  for (const section of savedSections) {
    if (section === "unisex") {
      sections.add("nina");
      sections.add("nino");
    } else {
      sections.add(section);
    }
  }

  const fallbackSection = categoryToSection(product.category);
  if (sections.size === 0) {
    if (fallbackSection === "unisex") {
      sections.add("nina");
      sections.add("nino");
    } else if (fallbackSection) {
      sections.add(fallbackSection);
    }
  }

  if (hasUnisexSubcategory) {
    const [primarySection] = Array.from(sections);

    if (primarySection === "nino") {
      sections.add("nino");
      sections.add("nina");
    } else {
      sections.add("nina");
      sections.add("nino");
    }
  }

  return Array.from(sections);
}

export function productAppearsInSection(
  product: {
    sections?: unknown;
    subcategories?: unknown;
    subcategory?: ProductSubcategory | string | null;
    category?: ProductCategory | string | null;
  },
  section: ProductSection
) {
  return normalizeProductSections(product).includes(section);
}

export function primaryCategoryFromSections(
  sections: ProductSection[],
  fallback: ProductCategory = "Niña"
) {
  const normalizedSections = normalizeProductSections({ sections, category: fallback });
  const [firstSection] = normalizedSections;

  if (firstSection) {
    return sectionToCategory(firstSection);
  }

  return fallback;
}

export function getSectionLabels(product: {
  sections?: unknown;
  category?: ProductCategory | string | null;
}) {
  return normalizeProductSections(product)
    .map(sectionToCategory)
    .join(", ");
}

function normalizeTextValue(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

export function productHasUnisexSubcategory(product: {
  subcategories?: unknown;
  subcategory?: ProductSubcategory | string | null;
}) {
  const values = Array.isArray(product.subcategories)
    ? product.subcategories.filter(
        (subcategory): subcategory is string =>
          typeof subcategory === "string" && subcategory.trim().length > 0
      )
    : [];

  if (typeof product.subcategory === "string" && product.subcategory.trim()) {
    values.push(product.subcategory.trim());
  }

  return values.some((value) => normalizeTextValue(value) === "unisex");
}

function hasLegacyUnisexSection(product: {
  sections?: unknown;
  category?: ProductCategory | string | null;
}) {
  const savedSections = Array.isArray(product.sections) ? product.sections : [];
  return (
    savedSections.includes("unisex") || categoryToSection(product.category) === "unisex"
  );
}

export function normalizeProductSubcategories(product: {
  subcategories?: unknown;
  subcategory?: ProductSubcategory | string | null;
  sections?: unknown;
  category?: ProductCategory | string | null;
}) {
  const values = Array.isArray(product.subcategories)
    ? product.subcategories.filter(
        (subcategory): subcategory is string =>
          typeof subcategory === "string" && subcategory.trim().length > 0
      )
    : [];

  if (typeof product.subcategory === "string" && product.subcategory.trim()) {
    values.push(product.subcategory.trim());
  }

  if (hasLegacyUnisexSection(product)) {
    values.push("Unisex");
  }

  const uniqueValues = new Map<string, string>();

  for (const value of values) {
    const cleanValue = value.trim();
    const key = normalizeTextValue(cleanValue);
    if (!key || uniqueValues.has(key)) continue;
    uniqueValues.set(key, cleanValue);
  }

  return Array.from(uniqueValues.values());
}

export function productMatchesSubcategory(
  product: {
    subcategories?: unknown;
    subcategory?: ProductSubcategory | string | null;
    sections?: unknown;
    category?: ProductCategory | string | null;
  },
  subcategory: string
) {
  const normalizedSubcategory = normalizeTextValue(subcategory);

  return normalizeProductSubcategories(product).some(
    (item) => normalizeTextValue(item) === normalizedSubcategory
  );
}

export function getSubcategoryLabels(product: {
  subcategories?: unknown;
  subcategory?: ProductSubcategory | string | null;
  sections?: unknown;
  category?: ProductCategory | string | null;
}) {
  return normalizeProductSubcategories(product).join(", ");
}

export function getProductDisplayLabel(product: {
  sections?: unknown;
  subcategories?: unknown;
  subcategory?: ProductSubcategory | string | null;
  category?: ProductCategory | string | null;
}) {
  const directSection = categoryToSection(product.category);
  const normalizedSections = normalizeProductSections(product);
  const displaySection =
    directSection === "nina" || directSection === "nino"
      ? directSection
      : normalizedSections[0];
  const categoryLabel = displaySection
    ? sectionToCategory(displaySection)
    : normalizeProductCategory(product.category);
  const subcategoryLabels = normalizeProductSubcategories(product);
  const orderedSubcategoryLabels = [
    ...subcategoryLabels.filter(
      (subcategory) => normalizeTextValue(subcategory) === "unisex"
    ),
    ...subcategoryLabels.filter(
      (subcategory) => normalizeTextValue(subcategory) !== "unisex"
    ),
  ];
  const labels = [categoryLabel, ...orderedSubcategoryLabels].filter(Boolean);
  const uniqueLabels = new Map<string, string>();

  for (const label of labels) {
    const key = normalizeTextValue(label);
    if (!key || uniqueLabels.has(key)) continue;
    uniqueLabels.set(key, label);
  }

  return Array.from(uniqueLabels.values()).join(" · ");
}

export const colorOptions = [
  "Rosa",
  "Blanco",
  "Lila",
  "Azul",
  "Beige",
  "Verde",
  "Negro",
  "Dorado",
  "Mezclilla",
  "Gris",
];

export function getFeaturedOffers() {
  return products
    .filter((product) => isPublicStoreProduct(product) && product.isOffer)
    .slice(0, 5);
}

export function getProductBySlug(slug: string) {
  const product = products.find((item) => item.slug === slug);
  return product && isPublicStoreProduct(product) ? product : undefined;
}

export function getProductsByAudience(audience: "Niña" | "Niño") {
  const section = categoryToSection(audience);

  return products.filter(
    (product) =>
      isPublicStoreProduct(product) &&
      Boolean(section && productAppearsInSection(product, section))
  );
}

export function getRelatedProducts(product: Product) {
  const productSections = normalizeProductSections(product);
  const productSubcategories = normalizeProductSubcategories(product);

  return products
    .filter(
      (item) =>
        isPublicStoreProduct(item) &&
        item.id !== product.id &&
        (normalizeProductSections(item).some((section) =>
          productSections.includes(section)
        ) ||
          productSubcategories.some((subcategory) =>
            productMatchesSubcategory(item, subcategory)
          ))
    )
    .slice(0, 3);
}

export function getProductBadges(product: Product) {
  const badges = [...product.badges];

  if (
    product.stock > 0 &&
    product.stock <= 4 &&
    !badges.includes("Últimas piezas")
  ) {
    badges.push("Últimas piezas");
  }

  return badges;
}

export function getAvailabilityLabel(product: Product) {
  if (product.stock <= 0) return "Agotado";
  if (product.stock <= 4) return "Pocas piezas";
  return "Disponible";
}

export function getProductStockForSize(product: Product, size: string) {
  if (product.stockByVariant && Object.keys(product.stockByVariant).length > 0) {
    return getStockForSizeAcrossColors(product, size);
  }

  const stockBySize = product.stockBySize ?? [];
  const sizeStock = stockBySize.find((item) => item.size === size);

  if (sizeStock) {
    return Math.max(sizeStock.stock ?? 0, 0);
  }

  if (stockBySize.length === 0) {
    return Math.max(product.stock ?? 0, 0);
  }

  return 0;
}

export function isProductSizeAvailable(product: Product, size: string) {
  return getProductStockForSize(product, size) > 0;
}

export function getProductStockForColorAndSize(
  product: Product,
  color: string | undefined,
  size: string
) {
  return getStockForVariant(product, color, size);
}

export function isProductColorSizeAvailable(
  product: Product,
  color: string | undefined,
  size: string
) {
  return getProductStockForColorAndSize(product, color, size) > 0;
}

export function matchesCommercialFilter(
  product: Product,
  filter: CommercialFilter
) {
  if (filter === "Todos") return true;
  if (filter === "Novedades") return Boolean(product.isNew);
  if (filter === "Ofertas") return Boolean(product.isOffer);
  if (filter === "Temporada") return Boolean(product.isSeasonal);
  if (filter === "Tendencias") return Boolean(product.isTrending);
  return Boolean(product.isLastUnits) || (product.stock > 0 && product.stock <= 4);
}

export function matchesPriceFilter(product: Product, filter: PriceFilter) {
  if (filter === "Todos") return true;
  if (filter === "Menos de $250") return product.price < 250;
  if (filter === "$250 a $400") {
    return product.price >= 250 && product.price <= 400;
  }
  return product.price > 400;
}

export function formatPrice(price: number) {
  return new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: "MXN",
    maximumFractionDigits: 0,
  }).format(price);
}
