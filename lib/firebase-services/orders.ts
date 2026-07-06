import { db, isFirebaseConfigured } from "@/lib/firebase";
import { applyInventoryChangesInTransaction } from "@/lib/firebase-services/inventory";
import type {
  DeliveryMethod,
  FirebaseOrder,
  FirebaseOrderItem,
  OrderStatus,
} from "@/lib/firebase-types";
import {
  addDoc,
  collection,
  type DocumentSnapshot,
  doc,
  getDoc,
  getDocs,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
  updateDoc,
  type DocumentData,
  type QueryDocumentSnapshot,
} from "firebase/firestore";

export type OrderCreateInput = Omit<
  FirebaseOrder,
  "id" | "createdAt" | "updatedAt"
> &
  Partial<Pick<FirebaseOrder, "createdAt" | "updatedAt">>;

const ORDERS_COLLECTION = "orders";

export type WebOrderCreateInput = {
  customerName: string;
  customerPhone: string;
  deliveryMethod: DeliveryMethod;
  address: string;
  notes: string;
  items: FirebaseOrderItem[];
  total: number;
  totalItems: number;
  wholesaleValidation: FirebaseOrder["wholesaleValidation"];
};

function ensureFirebaseConfigured() {
  if (!isFirebaseConfigured || !db) {
    throw new Error("La tienda no está conectada.");
  }

  return db;
}

function mapOrderDoc(
  snapshot: QueryDocumentSnapshot<DocumentData> | DocumentSnapshot<DocumentData>
): FirebaseOrder {
  const data = snapshot.data() as Partial<FirebaseOrder>;
  const customer = (data.customer ?? {}) as NonNullable<
    FirebaseOrder["customer"]
  >;
  const customerName = data.customerName ?? customer.name ?? "";
  const customerPhone = data.customerPhone ?? customer.phone ?? "";
  const address = data.address ?? customer.address ?? "";
  const notes = data.notes ?? customer.notes ?? "";
  const items = data.items ?? [];

  return {
    id: snapshot.id,
    orderNumber: data.orderNumber,
    customerId: data.customerId,
    customer: {
      ...customer,
      name: customerName,
      phone: customerPhone,
      address,
      notes,
    },
    customerName,
    customerPhone,
    deliveryMethod: data.deliveryMethod,
    address,
    items,
    subtotal: data.subtotal ?? data.total ?? 0,
    shippingCost: data.shippingCost,
    total: data.total ?? 0,
    totalItems:
      data.totalItems ??
      items.reduce((total, item) => total + (item.quantity ?? 0), 0),
    status: data.status ?? "Nuevo",
    source: data.source ?? "web",
    inventoryReturned: Boolean(data.inventoryReturned),
    inventoryReturnedAt: data.inventoryReturnedAt,
    inventoryReturnedBy: data.inventoryReturnedBy,
    isDeleted: Boolean(data.isDeleted),
    deletedAt: data.deletedAt,
    deletedBy: data.deletedBy,
    wholesaleValidation: data.wholesaleValidation,
    notes,
    createdAt: data.createdAt ?? "",
    updatedAt: data.updatedAt ?? "",
  };
}

function createOrderNumber(id: string) {
  return id.slice(-6).toUpperCase();
}

export async function getOrders(options: { includeDeleted?: boolean } = {}) {
  if (!isFirebaseConfigured || !db) return [];

  const ordersQuery = query(
    collection(db, ORDERS_COLLECTION),
    orderBy("createdAt", "desc")
  );
  const snapshot = await getDocs(ordersQuery);

  const orders = snapshot.docs.map(mapOrderDoc);

  return options.includeDeleted
    ? orders
    : orders.filter((order) => !order.isDeleted);
}

export async function getOrderById(id: string) {
  if (!isFirebaseConfigured || !db) return null;

  const orderRef = doc(db, ORDERS_COLLECTION, id);
  const snapshot = await getDoc(orderRef);

  return snapshot.exists() ? mapOrderDoc(snapshot) : null;
}

export async function createOrder(order: OrderCreateInput) {
  const firestore = ensureFirebaseConfigured();

  const docRef = await addDoc(collection(firestore, ORDERS_COLLECTION), {
    ...order,
    status: order.status ?? "Nuevo",
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  return docRef.id;
}

export async function createWebOrder(order: WebOrderCreateInput) {
  const firestore = ensureFirebaseConfigured();
  const orderRef = doc(collection(firestore, ORDERS_COLLECTION));
  const orderNumber = createOrderNumber(orderRef.id);

  await runTransaction(firestore, async (transaction) => {
    await applyInventoryChangesInTransaction(
      transaction,
      firestore,
      order.items,
      {
        type: "web_order",
        orderId: orderRef.id,
        note: `Pedido ${orderNumber}`,
        createdBy: "web",
      },
      "decrease"
    );

    transaction.set(orderRef, {
      ...order,
      orderNumber,
      status: "Nuevo",
      source: "web",
      subtotal: order.total,
      shippingCost: 0,
      inventoryReturned: false,
      isDeleted: false,
      customer: {
        name: order.customerName,
        phone: order.customerPhone,
        address: order.address,
        notes: order.notes,
      },
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  });

  return {
    id: orderRef.id,
    orderNumber,
  };
}

export async function updateOrderStatus(id: string, status: OrderStatus) {
  const firestore = ensureFirebaseConfigured();

  const orderRef = doc(firestore, ORDERS_COLLECTION, id);
  await updateDoc(orderRef, {
    status,
    updatedAt: serverTimestamp(),
  });
}

export async function cancelOrder(
  id: string,
  options: { returnInventory?: boolean } = {}
) {
  const firestore = ensureFirebaseConfigured();
  const orderRef = doc(firestore, ORDERS_COLLECTION, id);

  await runTransaction(firestore, async (transaction) => {
    const orderSnapshot = await transaction.get(orderRef);

    if (!orderSnapshot.exists()) {
      throw new Error("No encontramos este pedido.");
    }

    const order = mapOrderDoc(orderSnapshot);
    const isAlreadyCancelled =
      order.status === "Cancelado" || order.status === "cancelled";
    const canReturnInventory =
      !isAlreadyCancelled && options.returnInventory && !order.inventoryReturned;

    if (canReturnInventory) {
      await applyInventoryChangesInTransaction(
        transaction,
        firestore,
        order.items,
        {
          type: "order_cancelled",
          orderId: id,
          note: `Pedido ${order.orderNumber ?? ""} cancelado`,
          createdBy: "admin",
        },
        "increase"
      );
    }

    transaction.update(orderRef, {
      status: "Cancelado",
      inventoryReturned: canReturnInventory || order.inventoryReturned,
      ...(canReturnInventory
        ? {
            inventoryReturnedAt: serverTimestamp(),
            inventoryReturnedBy: "admin",
          }
        : {}),
      updatedAt: serverTimestamp(),
    });
  });
}

export async function deleteCancelledOrder(id: string) {
  const firestore = ensureFirebaseConfigured();
  const orderRef = doc(firestore, ORDERS_COLLECTION, id);

  await runTransaction(firestore, async (transaction) => {
    const orderSnapshot = await transaction.get(orderRef);

    if (!orderSnapshot.exists()) {
      throw new Error("No encontramos este pedido.");
    }

    const order = mapOrderDoc(orderSnapshot);
    const isCancelled =
      order.status === "Cancelado" || order.status === "cancelled";

    if (!isCancelled) {
      throw new Error("Solo puedes eliminar pedidos cancelados.");
    }

    transaction.update(orderRef, {
      isDeleted: true,
      deletedAt: serverTimestamp(),
      deletedBy: "admin",
      updatedAt: serverTimestamp(),
    });
  });
}

export async function restoreOrder(id: string) {
  const firestore = ensureFirebaseConfigured();
  const orderRef = doc(firestore, ORDERS_COLLECTION, id);

  await updateDoc(orderRef, {
    isDeleted: false,
    deletedAt: null,
    deletedBy: null,
    updatedAt: serverTimestamp(),
  });
}
