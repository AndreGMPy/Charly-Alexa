import { db, isFirebaseConfigured } from "@/lib/firebase";
import { applyInventoryChangesInTransaction } from "@/lib/firebase-services/inventory";
import type {
  FirebaseDate,
  FirebaseOrderItem,
  PaymentMethod,
} from "@/lib/firebase-types";
import {
  collection,
  doc,
  getDocs,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
  type DocumentData,
  type QueryDocumentSnapshot,
} from "firebase/firestore";

export type StoreSale = {
  id: string;
  source: "store" | string;
  items: FirebaseOrderItem[];
  total: number;
  totalItems?: number;
  paymentMethod?: PaymentMethod;
  notes?: string;
  status?: string;
  createdAt: FirebaseDate;
  updatedAt?: FirebaseDate;
};

export type StoreSaleCreateInput = {
  items: FirebaseOrderItem[];
  total: number;
  totalItems: number;
  paymentMethod: PaymentMethod;
  notes: string;
  createdBy?: string;
};

const SALES_COLLECTIONS = ["sales", "storeSales"];
const SALES_COLLECTION = "sales";

function ensureFirebaseConfigured() {
  if (!isFirebaseConfigured || !db) {
    throw new Error("La tienda no esta conectada.");
  }

  return db;
}

function mapSaleDoc(snapshot: QueryDocumentSnapshot<DocumentData>): StoreSale {
  const data = snapshot.data() as Partial<StoreSale>;
  const items = data.items ?? [];

  return {
    id: snapshot.id,
    source: data.source ?? "store",
    items,
    total: data.total ?? 0,
    totalItems:
      data.totalItems ??
      items.reduce((total, item) => total + (item.quantity ?? 0), 0),
    paymentMethod: data.paymentMethod,
    notes: data.notes ?? "",
    status: data.status,
    createdAt: data.createdAt ?? "",
    updatedAt: data.updatedAt,
  };
}

export async function getStoreSales() {
  if (!isFirebaseConfigured || !db) return [];

  const firestore = db;
  const salesGroups = await Promise.all(
    SALES_COLLECTIONS.map(async (collectionName) => {
      try {
        const salesQuery = query(
          collection(firestore, collectionName),
          orderBy("createdAt", "desc")
        );
        const snapshot = await getDocs(salesQuery);
        return snapshot.docs.map(mapSaleDoc);
      } catch {
        return [];
      }
    })
  );

  return salesGroups.flat();
}

export async function createStoreSale(sale: StoreSaleCreateInput) {
  const firestore = ensureFirebaseConfigured();
  const saleRef = doc(collection(firestore, SALES_COLLECTION));

  await runTransaction(firestore, async (transaction) => {
    await applyInventoryChangesInTransaction(
      transaction,
      firestore,
      sale.items,
      {
        type: "store_sale",
        saleId: saleRef.id,
        note: sale.notes,
        createdBy: sale.createdBy ?? "admin",
      },
      "decrease"
    );

    transaction.set(saleRef, {
      source: "store",
      items: sale.items,
      total: sale.total,
      totalItems: sale.totalItems,
      paymentMethod: sale.paymentMethod,
      notes: sale.notes,
      status: "Registrada",
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  });

  return saleRef.id;
}
