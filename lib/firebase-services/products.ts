import { db, isFirebaseConfigured } from "@/lib/firebase";
import type { FirebaseProduct } from "@/lib/firebase-types";
import {
  categoryToSection,
  normalizeProductCategory,
  normalizeProductSections,
  normalizeProductSubcategories,
  productMatchesSubcategory,
  productAppearsInSection,
} from "@/lib/products";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  limit,
  query,
  serverTimestamp,
  updateDoc,
  where,
  type DocumentData,
  type QueryDocumentSnapshot,
} from "firebase/firestore";
import {
  cleanList,
  normalizeStockBySize,
  normalizeStockByVariant,
  stockByVariantToStockBySize,
  sumStockByVariant,
} from "@/lib/variant-utils";

export type ProductCreateInput = Omit<
  FirebaseProduct,
  "id" | "createdAt" | "updatedAt"
> &
  Partial<Pick<FirebaseProduct, "createdAt" | "updatedAt">>;

export type ProductUpdateInput = Partial<
  Omit<FirebaseProduct, "id" | "createdAt">
>;

const PRODUCTS_COLLECTION = "products";

let activeProductsCache: FirebaseProduct[] | null = null;
let activeProductsPromise: Promise<FirebaseProduct[]> | null = null;
const productBySlugCache = new Map<string, FirebaseProduct | null>();

function ensureFirebaseConfigured() {
  if (!isFirebaseConfigured || !db) {
    throw new Error("La tienda no está conectada.");
  }

  return db;
}

function getSections(
  sections: unknown,
  category: FirebaseProduct["category"] | undefined,
  subcategories?: unknown,
  subcategory?: string | null
) {
  return normalizeProductSections({
    sections,
    category,
    subcategories,
    subcategory,
  });
}

function getSubcategories(value: unknown) {
  return Array.isArray(value)
    ? Array.from(
        new Set(
          value.filter(
            (subcategory): subcategory is string =>
              typeof subcategory === "string" && subcategory.trim().length > 0
          )
        )
      )
    : [];
}

function mapProductDoc(
  snapshot: QueryDocumentSnapshot<DocumentData>
): FirebaseProduct {
  const data = snapshot.data() as Partial<FirebaseProduct>;

  const sections = getSections(
    data.sections,
    data.category,
    data.subcategories,
    data.subcategory
  );
  const sizes = cleanList(data.sizes, []);
  const colors = cleanList(data.colors, []);
  const stockBySize = normalizeStockBySize(data.stockBySize);
  const stockByVariant = normalizeStockByVariant(
    data.stockByVariant,
    colors,
    sizes,
    stockBySize,
    data.stock ?? 0
  );
  const stockBySizeFromVariant =
    data.stockByVariant && Object.keys(data.stockByVariant).length > 0
      ? stockByVariantToStockBySize(
          stockByVariant,
          sizes.length > 0 ? sizes : stockBySize.map((item) => item.size)
        )
      : stockBySize;
  const totalStock =
    data.stockByVariant && Object.keys(data.stockByVariant).length > 0
      ? sumStockByVariant(stockByVariant)
      : data.stock ?? stockBySize.reduce((total, item) => total + item.stock, 0);

  return {
    id: snapshot.id,
    slug: data.slug ?? "",
    name: data.name ?? "",
    description: data.description ?? "",
    longDescription: data.longDescription ?? "",
    category: normalizeProductCategory(data.category),
    sections,
    subcategory: data.subcategory ?? "",
    subcategories: normalizeProductSubcategories({
      subcategories: getSubcategories(data.subcategories),
      subcategory: data.subcategory,
      sections: data.sections,
      category: data.category,
    }),
    price: data.price ?? 0,
    basePrice: data.basePrice,
    paymentFeePercent: data.paymentFeePercent,
    wholesaleRunEnabled: Boolean(data.wholesaleRunEnabled),
    wholesaleRunPrice:
      typeof data.wholesaleRunPrice === "number" ? data.wholesaleRunPrice : null,
    wholesaleRunSizes: cleanList(data.wholesaleRunSizes, []),
    sizes,
    colors,
    stock: totalStock,
    stockBySize: stockBySizeFromVariant,
    stockByVariant,
    images: data.images ?? [],
    mainImage: data.mainImage ?? "",
    isOffer: Boolean(data.isOffer),
    isNew: Boolean(data.isNew),
    isSeasonal: Boolean(data.isSeasonal),
    isActive: data.isActive ?? true,
    isTestProduct: Boolean(data.isTestProduct),
    isFeatured: Boolean(data.isFeatured),
    featuredOrder:
      typeof data.featuredOrder === "number" ? data.featuredOrder : 0,
    showOnHome: Boolean(data.showOnHome),
    homeSection: data.homeSection ?? null,
    status: data.status,
    wholesaleMode: data.wholesaleMode ?? "none",
    wholesalePrice:
      typeof data.wholesalePrice === "number" ? data.wholesalePrice : null,
    wholesaleMinQuantity:
      typeof data.wholesaleMinQuantity === "number"
        ? data.wholesaleMinQuantity
        : 0,
    wholesaleNote: data.wholesaleNote ?? "",
    createdAt: data.createdAt ?? "",
    updatedAt: data.updatedAt ?? "",
  };
}

function getDateValue(value: FirebaseProduct["createdAt"]) {
  if (value instanceof Date) return value.getTime();
  if (typeof value === "string") return Date.parse(value) || 0;
  if (
    value &&
    typeof value === "object" &&
    "toMillis" in value &&
    typeof value.toMillis === "function"
  ) {
    return value.toMillis();
  }

  return 0;
}

function rememberActiveProducts(products: FirebaseProduct[]) {
  activeProductsCache = products;
  productBySlugCache.clear();

  for (const product of products) {
    if (product.slug) {
      productBySlugCache.set(product.slug, product);
    }
  }
}

function clearProductSessionCache() {
  activeProductsCache = null;
  activeProductsPromise = null;
  productBySlugCache.clear();
}

export function getCachedActiveProducts() {
  return activeProductsCache ?? [];
}

export function getCachedActiveProductBySlug(slug: string) {
  if (productBySlugCache.has(slug)) {
    return productBySlugCache.get(slug) ?? null;
  }

  if (activeProductsCache) {
    return activeProductsCache.find((product) => product.slug === slug) ?? null;
  }

  return null;
}

export async function getProducts() {
  if (!isFirebaseConfigured || !db) return [];

  const snapshot = await getDocs(collection(db, PRODUCTS_COLLECTION));

  return snapshot.docs
    .map(mapProductDoc)
    .sort((a, b) => getDateValue(b.createdAt) - getDateValue(a.createdAt));
}

export async function getActiveProducts(
  options: { forceRefresh?: boolean } = {}
) {
  if (!isFirebaseConfigured || !db) return [];
  if (!options.forceRefresh && activeProductsCache) return activeProductsCache;
  if (!options.forceRefresh && activeProductsPromise) return activeProductsPromise;

  activeProductsPromise = (async () => {
    const productsQuery = query(
      collection(db, PRODUCTS_COLLECTION),
      where("isActive", "==", true)
    );
    const snapshot = await getDocs(productsQuery);

    const products = snapshot.docs
      .map(mapProductDoc)
      .sort((a, b) => getDateValue(b.createdAt) - getDateValue(a.createdAt));

    rememberActiveProducts(products);
    return products;
  })();

  try {
    return await activeProductsPromise;
  } finally {
    activeProductsPromise = null;
  }
}

export async function getProductsBySubcategory(
  category: FirebaseProduct["category"],
  subcategory: string
) {
  const products = await getProducts();
  const normalizedSubcategory = subcategory.trim().toLowerCase();

  return products.filter(
    (product) => {
      const section = categoryToSection(category);

      return (
        Boolean(section && productAppearsInSection(product, section)) &&
        productMatchesSubcategory(product, normalizedSubcategory)
      );
    }
  );
}

export async function getProductBySlug(slug: string) {
  if (!isFirebaseConfigured || !db) return null;
  if (productBySlugCache.has(slug)) {
    return productBySlugCache.get(slug) ?? null;
  }

  const cachedProduct = getCachedActiveProductBySlug(slug);
  if (cachedProduct) return cachedProduct;
  if (activeProductsCache) return null;

  // Firestore Standard supports merging single-field indexes for equality filters.
  const productsQuery = query(
    collection(db, PRODUCTS_COLLECTION),
    where("slug", "==", slug),
    where("isActive", "==", true),
    limit(1)
  );
  const snapshot = await getDocs(productsQuery);
  const product = snapshot.docs[0];

  const mappedProduct = product ? mapProductDoc(product) : null;
  productBySlugCache.set(slug, mappedProduct);

  return mappedProduct;
}

export async function createProduct(product: ProductCreateInput) {
  const firestore = ensureFirebaseConfigured();

  const productPayload = {
    ...product,
    status: product.status ?? (product.isActive ? "active" : "inactive"),
    isFeatured: product.isFeatured ?? false,
    featuredOrder: product.featuredOrder ?? 0,
    showOnHome: product.showOnHome ?? false,
    homeSection: product.homeSection ?? null,
    wholesaleMode: product.wholesaleMode ?? "none",
    wholesalePrice: product.wholesalePrice ?? null,
    wholesaleMinQuantity: product.wholesaleMinQuantity ?? 0,
    wholesaleNote: product.wholesaleNote ?? "",
    wholesaleRunEnabled: product.wholesaleRunEnabled ?? false,
    wholesaleRunPrice: product.wholesaleRunPrice ?? null,
    wholesaleRunSizes: product.wholesaleRunSizes ?? [],
    stockByVariant: product.stockByVariant ?? {},
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  const docRef = await addDoc(
    collection(firestore, PRODUCTS_COLLECTION),
    productPayload
  );

  clearProductSessionCache();
  return docRef.id;
}

export async function updateProduct(id: string, data: ProductUpdateInput) {
  const firestore = ensureFirebaseConfigured();

  const productRef = doc(firestore, PRODUCTS_COLLECTION, id);
  await updateDoc(productRef, {
    ...data,
    updatedAt: serverTimestamp(),
  });
  clearProductSessionCache();
}

export async function deleteProduct(id: string) {
  const firestore = ensureFirebaseConfigured();

  const productRef = doc(firestore, PRODUCTS_COLLECTION, id);
  const snapshot = await getDoc(productRef);

  if (!snapshot.exists()) {
    throw new Error("Product not found.");
  }

  await deleteDoc(productRef);
  clearProductSessionCache();
}
