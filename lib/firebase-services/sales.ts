import { db, isFirebaseConfigured } from "@/lib/firebase";
import { applyInventoryChangesInTransaction } from "@/lib/firebase-services/inventory";
import type {
  FirebaseDate,
  FirebaseOrderItem,
  FirebaseCustomer,
  PaymentBreakdown,
  PaymentMethod,
} from "@/lib/firebase-types";
import {
  addDoc,
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
  folio?: string;
  source: "store" | string;
  items: FirebaseOrderItem[];
  subtotal?: number;
  discount?: {
    type: "amount" | "percent";
    value: number;
    total: number;
  };
  total: number;
  totalItems?: number;
  paymentMethod?: PaymentMethod;
  paymentBreakdown?: PaymentBreakdown;
  customer?: Partial<FirebaseCustomer>;
  notes?: string;
  status?: string;
  inventoryReturned?: boolean;
  cancelledAt?: FirebaseDate;
  createdAt: FirebaseDate;
  updatedAt?: FirebaseDate;
};

export type StoreSaleCreateInput = {
  items: FirebaseOrderItem[];
  subtotal: number;
  discount: StoreSale["discount"];
  total: number;
  totalItems: number;
  paymentMethod: PaymentMethod;
  paymentBreakdown?: PaymentBreakdown;
  customer?: {
    name: string;
    phone: string;
    notes: string;
  };
  notes: string;
  createdBy?: string;
};

export type CashClosure = {
  id: string;
  date: string;
  totals: {
    sold: number;
    cash: number;
    transfer: number;
    card: number;
    discounts: number;
    pieces: number;
    cancelled: number;
    salesCount: number;
  };
  notes?: string;
  createdAt: FirebaseDate;
};

export type CashClosureCreateInput = Omit<CashClosure, "id" | "createdAt">;

const SALES_COLLECTIONS = ["sales", "storeSales"];
const SALES_COLLECTION = "sales";
const CASH_CLOSURES_COLLECTION = "cashClosures";
const CUSTOMERS_COLLECTION = "customers";

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
    folio: data.folio ?? snapshot.id.slice(-6).toUpperCase(),
    source: data.source ?? "store",
    items,
    subtotal: data.subtotal ?? data.total ?? 0,
    discount: data.discount,
    total: data.total ?? 0,
    totalItems:
      data.totalItems ??
      items.reduce((total, item) => total + (item.quantity ?? 0), 0),
    paymentMethod: data.paymentMethod,
    paymentBreakdown: data.paymentBreakdown,
    customer: data.customer,
    notes: data.notes ?? "",
    status: data.status,
    inventoryReturned: Boolean(data.inventoryReturned),
    cancelledAt: data.cancelledAt,
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
  const folio = saleRef.id.slice(-6).toUpperCase();

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
      folio,
      source: "store",
      items: sale.items,
      subtotal: sale.subtotal,
      discount: sale.discount,
      total: sale.total,
      totalItems: sale.totalItems,
      paymentMethod: sale.paymentMethod,
      paymentBreakdown: sale.paymentBreakdown ?? null,
      customer: sale.customer?.name
        ? {
            name: sale.customer.name,
            phone: sale.customer.phone,
            notes: sale.customer.notes,
          }
        : null,
      notes: sale.notes,
      status: "Registrada",
      inventoryReturned: false,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    if (sale.customer?.name || sale.customer?.phone) {
      const customerRef = doc(collection(firestore, CUSTOMERS_COLLECTION));
      transaction.set(customerRef, {
        name: sale.customer.name,
        phone: sale.customer.phone,
        notes: sale.customer.notes,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }
  });

  return { id: saleRef.id, folio };
}

export async function cancelStoreSale(id: string) {
  const firestore = ensureFirebaseConfigured();
  const saleRef = doc(firestore, SALES_COLLECTION, id);

  await runTransaction(firestore, async (transaction) => {
    const saleSnapshot = await transaction.get(saleRef);

    if (!saleSnapshot.exists()) {
      throw new Error("No encontramos esta venta.");
    }

    const data = saleSnapshot.data() as Partial<StoreSale>;
    const alreadyCancelled = data.status === "Cancelada" || data.status === "cancelled";

    if (!alreadyCancelled && !data.inventoryReturned) {
      await applyInventoryChangesInTransaction(
        transaction,
        firestore,
        data.items ?? [],
        {
          type: "store_sale_cancelled",
          saleId: id,
          note: `Venta ${data.folio ?? id.slice(-6).toUpperCase()} cancelada`,
          createdBy: "admin",
        },
        "increase"
      );
    }

    transaction.update(saleRef, {
      status: "Cancelada",
      inventoryReturned: true,
      cancelledAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  });
}

export async function createCashClosure(closure: CashClosureCreateInput) {
  const firestore = ensureFirebaseConfigured();

  const docRef = await addDoc(collection(firestore, CASH_CLOSURES_COLLECTION), {
    ...closure,
    createdAt: serverTimestamp(),
  });

  return docRef.id;
}
