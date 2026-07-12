import { db, isFirebaseConfigured } from "@/lib/firebase";
import type {
  FirebaseCategory,
  FirebaseSubcategory,
  MainCategoryName,
} from "@/lib/firebase-types";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  type DocumentData,
  type QueryDocumentSnapshot,
} from "firebase/firestore";

export type CategoryCreateInput = Omit<
  FirebaseCategory,
  "id" | "createdAt" | "updatedAt"
>;

export type CategoryUpdateInput = Partial<
  Omit<FirebaseCategory, "id" | "createdAt">
>;

export type SubcategoryCreateInput = Omit<
  FirebaseSubcategory,
  "id" | "createdAt" | "updatedAt"
>;

export type SubcategoryUpdateInput = Partial<
  Omit<FirebaseSubcategory, "id" | "createdAt">
>;

const CATEGORIES_COLLECTION = "categories";
const SUBCATEGORIES_COLLECTION = "subcategories";
type ManagedMainCategoryName = Exclude<MainCategoryName, "Unisex">;

const BASE_CATEGORY_IDS: Record<ManagedMainCategoryName, string> = {
  Niña: "nina",
  Niño: "nino",
};

const BASE_CATEGORIES: Array<
  Omit<FirebaseCategory, "id" | "createdAt" | "updatedAt" | "name"> & {
    name: ManagedMainCategoryName;
  }
> = [
  { name: "Niña", slug: "nina", isActive: true, sortOrder: 1 },
  { name: "Niño", slug: "nino", isActive: true, sortOrder: 2 },
];

function ensureFirebaseConfigured() {
  if (!isFirebaseConfigured || !db) {
    throw new Error("La tienda no está conectada.");
  }

  return db;
}

function sortByOrderThenName<
  Item extends { sortOrder: number; name: string }
>(items: Item[]) {
  return [...items].sort((a, b) => {
    if (a.sortOrder !== b.sortOrder) return a.sortOrder - b.sortOrder;
    return a.name.localeCompare(b.name, "es-MX");
  });
}

function normalizeSlug(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

function getBaseCategoryForSlug(slug: string) {
  const normalizedSlug = normalizeSlug(slug);
  return BASE_CATEGORIES.find((category) => category.slug === normalizedSlug);
}

function mapCategoryDoc(
  snapshot: QueryDocumentSnapshot<DocumentData>
): FirebaseCategory {
  const data = snapshot.data() as Partial<FirebaseCategory>;

  return {
    id: snapshot.id,
    name: data.name ?? "Unisex",
    slug: data.slug ?? "",
    imageUrl: data.imageUrl ?? "",
    isActive: data.isActive ?? true,
    sortOrder: data.sortOrder ?? 0,
    createdAt: data.createdAt ?? "",
    updatedAt: data.updatedAt ?? "",
  };
}

function mapSubcategoryDoc(
  snapshot: QueryDocumentSnapshot<DocumentData>
): FirebaseSubcategory {
  const data = snapshot.data() as Partial<FirebaseSubcategory>;

  return {
    id: snapshot.id,
    name: data.name ?? "",
    slug: data.slug ?? "",
    parentCategory: data.parentCategory ?? "Unisex",
    imageUrl: data.imageUrl ?? "",
    isActive: data.isActive ?? true,
    sortOrder: data.sortOrder ?? 0,
    createdAt: data.createdAt ?? "",
    updatedAt: data.updatedAt ?? "",
  };
}

export async function getCategories() {
  if (!isFirebaseConfigured || !db) return [];

  const snapshot = await getDocs(collection(db, CATEGORIES_COLLECTION));
  return sortByOrderThenName(snapshot.docs.map(mapCategoryDoc));
}

export async function ensureBaseCategories() {
  const firestore = ensureFirebaseConfigured();

  await Promise.all(
    BASE_CATEGORIES.map((category) =>
      setDoc(
        doc(firestore, CATEGORIES_COLLECTION, BASE_CATEGORY_IDS[category.name]),
        {
          name: category.name,
          slug: category.slug,
          isActive: category.isActive,
          sortOrder: category.sortOrder,
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      )
    )
  );
}

export async function getUniqueMainCategories() {
  if (!isFirebaseConfigured || !db) {
    return BASE_CATEGORIES.map((category) => ({
      ...category,
      id: BASE_CATEGORY_IDS[category.name],
      createdAt: "",
      updatedAt: "",
    }));
  }

  const categories = await getCategories();

  return BASE_CATEGORIES.map((baseCategory) => {
    const expectedId = BASE_CATEGORY_IDS[baseCategory.name];
    const matchingCategories = categories.filter((category) => {
      const normalizedSlug = normalizeSlug(category.slug || category.name);
      return normalizedSlug === baseCategory.slug;
    });
    const fixedCategory = matchingCategories.find(
      (category) => category.id === expectedId
    );
    const existingCategory = fixedCategory ?? matchingCategories[0];

    if (!existingCategory) {
      return {
        ...baseCategory,
        id: expectedId,
        createdAt: "",
        updatedAt: "",
      };
    }

    return {
      ...existingCategory,
      id: expectedId,
      name: baseCategory.name,
      slug: baseCategory.slug,
      sortOrder: baseCategory.sortOrder,
    };
  });
}

export async function cleanupDuplicateBaseCategories() {
  const firestore = ensureFirebaseConfigured();

  await ensureBaseCategories();

  const categories = await getCategories();
  const duplicateCategories = categories.filter((category) => {
    const baseCategory = getBaseCategoryForSlug(category.slug || category.name);
    if (!baseCategory) return false;
    return category.id !== BASE_CATEGORY_IDS[baseCategory.name];
  });

  await Promise.all(
    duplicateCategories.map((category) =>
      deleteDoc(doc(firestore, CATEGORIES_COLLECTION, category.id))
    )
  );

  return duplicateCategories.length;
}

export async function getActiveCategories() {
  if (!isFirebaseConfigured || !db) {
    return BASE_CATEGORIES.map((category) => ({
      ...category,
      id: BASE_CATEGORY_IDS[category.name],
      createdAt: "",
      updatedAt: "",
    }));
  }

  const categoriesQuery = query(
    collection(db, CATEGORIES_COLLECTION),
    where("isActive", "==", true)
  );
  const snapshot = await getDocs(categoriesQuery);

  return sortByOrderThenName(snapshot.docs.map(mapCategoryDoc));
}

export async function createCategory(category: CategoryCreateInput) {
  const firestore = ensureFirebaseConfigured();

  const docRef = await addDoc(collection(firestore, CATEGORIES_COLLECTION), {
    ...category,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  return docRef.id;
}

export async function updateCategory(
  id: string,
  data: CategoryUpdateInput
) {
  const firestore = ensureFirebaseConfigured();
  const categoryRef = doc(firestore, CATEGORIES_COLLECTION, id);

  await updateDoc(categoryRef, {
    ...data,
    updatedAt: serverTimestamp(),
  });
}

export async function deleteCategory(id: string) {
  const firestore = ensureFirebaseConfigured();
  await deleteDoc(doc(firestore, CATEGORIES_COLLECTION, id));
}

export async function getSubcategories() {
  if (!isFirebaseConfigured || !db) return [];

  const snapshot = await getDocs(collection(db, SUBCATEGORIES_COLLECTION));
  return sortByOrderThenName(snapshot.docs.map(mapSubcategoryDoc));
}

export async function getSubcategoriesByCategory(
  category: MainCategoryName,
  options: { activeOnly?: boolean } = {}
) {
  if (options.activeOnly) {
    if (!isFirebaseConfigured || !db) return [];

    const subcategoriesQuery = query(
      collection(db, SUBCATEGORIES_COLLECTION),
      where("parentCategory", "==", category),
      where("isActive", "==", true)
    );
    const snapshot = await getDocs(subcategoriesQuery);

    return sortByOrderThenName(snapshot.docs.map(mapSubcategoryDoc));
  }

  const subcategories = await getSubcategories();

  return subcategories.filter(
    (subcategory) => subcategory.parentCategory === category
  );
}

export async function createSubcategory(
  subcategory: SubcategoryCreateInput
) {
  const firestore = ensureFirebaseConfigured();

  const docRef = await addDoc(collection(firestore, SUBCATEGORIES_COLLECTION), {
    ...subcategory,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  return docRef.id;
}

export async function updateSubcategory(
  id: string,
  data: SubcategoryUpdateInput
) {
  const firestore = ensureFirebaseConfigured();
  const subcategoryRef = doc(firestore, SUBCATEGORIES_COLLECTION, id);

  await updateDoc(subcategoryRef, {
    ...data,
    updatedAt: serverTimestamp(),
  });
}

export async function deleteSubcategory(id: string) {
  const firestore = ensureFirebaseConfigured();
  await deleteDoc(doc(firestore, SUBCATEGORIES_COLLECTION, id));
}
