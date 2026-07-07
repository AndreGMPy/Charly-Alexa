export type ProductCategory = "Niño" | "Niña" | "Unisex";

export type ProductSubcategory = string;

export type WholesaleMode = "none" | "surtido" | "producto";

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
  wholesaleMode?: WholesaleMode;
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
 * Antes aquí estaban los productos de ejemplo del boceto.
 * Se dejaron vacíos para que la tienda use únicamente los productos
 * agregados desde el panel vendedor en Firebase.
 */
export const products: Product[] = [];

export const mainCategories: ProductCategory[] = ["Niño", "Niña", "Unisex"];

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
  return products.filter((product) => product.isOffer).slice(0, 5);
}

export function getProductBySlug(slug: string) {
  return products.find((product) => product.slug === slug);
}

export function getProductsByAudience(audience: "Niña" | "Niño") {
  return products.filter(
    (product) => product.category === audience || product.category === "Unisex"
  );
}

export function getRelatedProducts(product: Product) {
  return products
    .filter(
      (item) =>
        item.id !== product.id &&
        (item.category === product.category ||
          item.category === "Unisex" ||
          product.category === "Unisex" ||
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
