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
  price: number;
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
  "Playeras",
  "Pantalones",
  "Vestidos",
  "Conjuntos",
  "Chamarras",
  "Fiesta",
  "Accesorios",
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

export const mainCategories: ProductCategory[] = ["Niño", "Niña", "Unisex"];

export const sectionOptions: Array<{
  value: ProductSection;
  label: ProductCategory;
}> = [
  { value: "nina", label: "Niña" },
  { value: "nino", label: "Niño" },
  { value: "unisex", label: "Unisex" },
];

export function categoryToSection(
  category?: ProductCategory | string | null
): ProductSection | null {
  if (category === "Niña") return "nina";
  if (category === "Niño") return "nino";
  if (category === "Unisex") return "unisex";
  return null;
}

export function sectionToCategory(section: ProductSection): ProductCategory {
  if (section === "nina") return "Niña";
  if (section === "nino") return "Niño";
  return "Unisex";
}

function isProductSection(value: unknown): value is ProductSection {
  return value === "nina" || value === "nino" || value === "unisex";
}

export function normalizeProductSections(product: {
  sections?: unknown;
  category?: ProductCategory | string | null;
}) {
  const savedSections = Array.isArray(product.sections)
    ? product.sections.filter(isProductSection)
    : [];

  if (savedSections.length > 0) {
    return Array.from(new Set(savedSections));
  }

  const fallbackSection = categoryToSection(product.category);
  return fallbackSection ? [fallbackSection] : [];
}

export function productAppearsInSection(
  product: { sections?: unknown; category?: ProductCategory | string | null },
  section: ProductSection
) {
  return normalizeProductSections(product).includes(section);
}

export function primaryCategoryFromSections(
  sections: ProductSection[],
  fallback: ProductCategory = "Niña"
) {
  const [firstSection] = sections;

  if (firstSection && firstSection !== "unisex") {
    return sectionToCategory(firstSection);
  }

  if (sections.includes("nina")) return "Niña";
  if (sections.includes("nino")) return "Niño";
  if (firstSection) return sectionToCategory(firstSection);

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

  return products
    .filter(
      (item) =>
        isPublicStoreProduct(item) &&
        item.id !== product.id &&
        (normalizeProductSections(item).some((section) =>
          productSections.includes(section)
        ) ||
          item.subcategory === product.subcategory)
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
