import { db, isFirebaseConfigured } from "@/lib/firebase";
import type { FirebaseProduct } from "@/lib/firebase-types";
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

export type ProductCreateInput = Omit<
  FirebaseProduct,
  "id" | "createdAt" | "updatedAt"
> &
  Partial<Pick<FirebaseProduct, "createdAt" | "updatedAt">>;

export type ProductUpdateInput = Partial<
  Omit<FirebaseProduct, "id" | "createdAt">
>;

const PRODUCTS_COLLECTION = "products";

function ensureFirebaseConfigured() {
  if (!isFirebaseConfigured || !db) {
    throw new Error("La tienda no está conectada.");
  }

  return db;
}

function mapProductDoc(
  snapshot: QueryDocumentSnapshot<DocumentData>
): FirebaseProduct {
  const data = snapshot.data() as Partial<FirebaseProduct>;

  return {
    id: snapshot.id,
    slug: data.slug ?? "",
    name: data.name ?? "",
    description: data.description ?? "",
    longDescription: data.longDescription ?? "",
    category: data.category ?? "Unisex",
    subcategory: data.subcategory ?? "",
    price: data.price ?? 0,
    basePrice: data.basePrice,
    sizes: data.sizes ?? [],
    colors: data.colors ?? [],
    stock: data.stock ?? 0,
    stockBySize: data.stockBySize ?? [],
    images: data.images ?? [],
    mainImage: data.mainImage ?? "",
    isOffer: Boolean(data.isOffer),
    isNew: Boolean(data.isNew),
    isSeasonal: Boolean(data.isSeasonal),
    isActive: data.isActive ?? true,
    isFeatured: Boolean(data.isFeatured),
    featuredOrder:
      typeof data.featuredOrder === "number" ? data.featuredOrder : 0,
    showOnHome: Boolean(data.showOnHome),
    homeSection: data.homeSection ?? null,
    status: data.status,
    wholesaleMode: data.wholesaleMode ?? "none",
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

export async function getProducts() {
  if (!isFirebaseConfigured || !db) return [];

  const snapshot = await getDocs(collection(db, PRODUCTS_COLLECTION));

  return snapshot.docs
    .map(mapProductDoc)
    .sort((a, b) => getDateValue(b.createdAt) - getDateValue(a.createdAt));
}

export async function getActiveProducts() {
  const products = await getProducts();
  return products.filter((product) => product.isActive);
}

export async function getProductsBySubcategory(
  category: FirebaseProduct["category"],
  subcategory: string
) {
  const products = await getProducts();
  const normalizedSubcategory = subcategory.trim().toLowerCase();

  return products.filter(
    (product) =>
      product.category === category &&
      product.subcategory.trim().toLowerCase() === normalizedSubcategory
  );
}

export async function getProductBySlug(slug: string) {
  if (!isFirebaseConfigured || !db) return null;

  const productsQuery = query(
    collection(db, PRODUCTS_COLLECTION),
    where("slug", "==", slug),
    limit(1)
  );
  const snapshot = await getDocs(productsQuery);
  const product = snapshot.docs[0];

  return product ? mapProductDoc(product) : null;
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
    wholesaleMinQuantity: product.wholesaleMinQuantity ?? 0,
    wholesaleNote: product.wholesaleNote ?? "",
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  const docRef = await addDoc(
    collection(firestore, PRODUCTS_COLLECTION),
    productPayload
  );

  return docRef.id;
}

export async function updateProduct(id: string, data: ProductUpdateInput) {
  const firestore = ensureFirebaseConfigured();

  const productRef = doc(firestore, PRODUCTS_COLLECTION, id);
  await updateDoc(productRef, {
    ...data,
    updatedAt: serverTimestamp(),
  });
}

export async function deleteProduct(id: string) {
  const firestore = ensureFirebaseConfigured();

  const productRef = doc(firestore, PRODUCTS_COLLECTION, id);
  const snapshot = await getDoc(productRef);

  if (!snapshot.exists()) {
    throw new Error("Product not found.");
  }

  await deleteDoc(productRef);
}
