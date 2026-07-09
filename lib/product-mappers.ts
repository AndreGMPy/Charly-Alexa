import type { FirebaseProduct } from "@/lib/firebase-types";
import {
  normalizeProductSections,
  type Product,
  type ProductBadge,
} from "@/lib/products";

const gradientsByCategory: Record<
  FirebaseProduct["category"],
  { gradient: string; galleryGradients: string[] }
> = {
  Niña: {
    gradient: "from-rose-200 via-pink-100 to-amber-100",
    galleryGradients: [
      "from-rose-200 via-pink-100 to-amber-100",
      "from-pink-100 via-white to-sky-100",
      "from-amber-100 via-rose-100 to-white",
    ],
  },
  Niño: {
    gradient: "from-sky-200 via-cyan-100 to-lime-100",
    galleryGradients: [
      "from-sky-200 via-cyan-100 to-lime-100",
      "from-blue-100 via-white to-amber-100",
      "from-lime-100 via-sky-100 to-white",
    ],
  },
  Unisex: {
    gradient: "from-amber-100 via-orange-100 to-sky-100",
    galleryGradients: [
      "from-amber-100 via-orange-100 to-sky-100",
      "from-slate-100 via-white to-rose-100",
      "from-sky-100 via-white to-amber-100",
    ],
  },
};

function getProductBadgesFromFlags(product: FirebaseProduct): ProductBadge[] {
  const badges: ProductBadge[] = [];

  if (product.isOffer) badges.push("Oferta");
  if (product.isNew) badges.push("Nuevo");
  if (product.isSeasonal) badges.push("Temporada");
  if (product.stock > 0 && product.stock <= 4) badges.push("Últimas piezas");

  return badges.length > 0 ? badges : ["Nuevo"];
}

export function mapFirebaseProductToProduct(
  product: FirebaseProduct
): Product {
  const badges = getProductBadgesFromFlags(product);
  const visual = gradientsByCategory[product.category];
  const cleanImages = product.images.filter(Boolean);
  const mainImage = product.mainImage || cleanImages[0] || "";

  return {
    id: product.id,
    slug: product.slug,
    name: product.name,
    category: product.category,
    sections: normalizeProductSections(product),
    subcategory: product.subcategory || "General",
    price: product.price,
    sizes: product.sizes.length > 0 ? product.sizes : ["Unitalla"],
    colors: product.colors.length > 0 ? product.colors : ["Sin color"],
    brand: "Charly Alexa",
    description: product.description,
    longDescription: product.longDescription || product.description,
    tag: badges[0],
    badges,
    stock: product.stock,
    stockBySize: product.stockBySize,
    gradient: visual.gradient,
    galleryGradients: visual.galleryGradients,
    imageUrl: mainImage,
    images: cleanImages,
    galleryImages: cleanImages,
    isNew: product.isNew,
    isOffer: product.isOffer,
    isSeasonal: product.isSeasonal,
    isTestProduct: product.isTestProduct,
    isTrending: product.homeSection === "temporada",
    isLastUnits: product.stock > 0 && product.stock <= 4,
    wholesaleMode: product.wholesaleMode ?? "none",
    wholesalePrice: product.wholesalePrice ?? null,
    wholesaleMinQuantity: product.wholesaleMinQuantity ?? 0,
    wholesaleNote: product.wholesaleNote ?? "",
  };
}
