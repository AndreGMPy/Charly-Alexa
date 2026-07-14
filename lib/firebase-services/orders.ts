import { db, isFirebaseConfigured } from "@/lib/firebase";
import { applyInventoryChangesInTransaction } from "@/lib/firebase-services/inventory";
import {
  formatDeliveryAddressText,
  normalizeDeliveryAddress,
} from "@/lib/delivery-address";
import type {
  DeliveryAddress,
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
  customerEmail?: string;
  deliveryMethod: DeliveryMethod;
  address: string;
  deliveryAddress?: DeliveryAddress;
  shipping?: FirebaseOrder["shipping"];
  notes: string;
  items: FirebaseOrderItem[];
  subtotal?: number;
  shippingCost?: number;
  total: number;
  payment?: FirebaseOrder["payment"];
  totalItems: number;
  wholesaleValidation: FirebaseOrder["wholesaleValidation"];
};

type WebOrderCreateResponse = {
  id: string;
  orderNumber: string;
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
  const deliveryAddress = normalizeDeliveryAddress(
    data.deliveryAddress ?? customer.deliveryAddress
  );
  const legacyAddress =
    data.address ??
    data.customerAddress ??
    customer.address ??
    "";
  const address = legacyAddress || formatDeliveryAddressText(deliveryAddress);
  const notes = data.notes ?? customer.notes ?? "";
  const items = data.items ?? [];
  const subtotal = data.subtotal ?? data.total ?? 0;
  const shippingCost = data.shippingCost ?? data.shipping?.cost ?? 0;
  const shipping =
    data.shipping ??
    (data.deliveryMethod
      ? {
          method: data.deliveryMethod,
          cost: shippingCost,
          status:
            data.deliveryMethod === "Recoger en tienda"
              ? "pickup"
              : "calculated",
          requiresQuote: false,
        }
      : undefined);
  const payment: NonNullable<FirebaseOrder["payment"]> =
    data.payment ??
    ({
      status: "manual",
      provider: "manual",
    } as NonNullable<FirebaseOrder["payment"]>);

  return {
    id: snapshot.id,
    orderNumber: data.orderNumber,
    customerId: data.customerId,
    customer: {
      ...customer,
      name: customerName,
      phone: customerPhone,
      address,
      ...(deliveryAddress ? { deliveryAddress } : {}),
      notes,
    },
    customerName,
    customerPhone,
    customerEmail: data.customerEmail ?? customer.email ?? "",
    deliveryMethod: data.deliveryMethod,
    address,
    customerAddress: data.customerAddress,
    ...(deliveryAddress ? { deliveryAddress } : {}),
    ...(shipping ? { shipping } : {}),
    items,
    subtotal,
    shippingCost,
    total: data.total ?? subtotal + shippingCost,
    payment,
    paymentStatus: data.paymentStatus ?? payment.status,
    paymentProvider: data.paymentProvider ?? payment.provider,
    stripeCheckoutSessionId:
      data.stripeCheckoutSessionId ?? payment.stripeCheckoutSessionId,
    stripePaymentIntentId:
      data.stripePaymentIntentId ?? payment.stripePaymentIntentId,
    stripeCustomerId: data.stripeCustomerId ?? payment.stripeCustomerId,
    paidAt: data.paidAt ?? payment.paidAt,
    totalItems:
      data.totalItems ??
      items.reduce((total, item) => total + (item.quantity ?? 0), 0),
    status: data.status ?? "Nuevo",
    source: data.source ?? "web",
    adminViewedAt: data.adminViewedAt,
    notifications: data.notifications,
    inventoryUpdatedAt: data.inventoryUpdatedAt,
    inventoryUpdateError: data.inventoryUpdateError,
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
  const response = await fetch("/api/orders", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(order),
  });

  const responseBody = (await response.json().catch(() => null)) as
    | Partial<WebOrderCreateResponse> & { message?: string }
    | null;

  if (!response.ok) {
    throw new Error(
      responseBody?.message ?? "No se pudo enviar el pedido. Intenta de nuevo."
    );
  }

  if (!responseBody?.id || !responseBody.orderNumber) {
    throw new Error("No se pudo enviar el pedido. Intenta de nuevo.");
  }

  return {
    id: responseBody.id,
    orderNumber: responseBody.orderNumber,
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

export async function markOrderAsViewed(id: string) {
  const firestore = ensureFirebaseConfigured();

  const orderRef = doc(firestore, ORDERS_COLLECTION, id);
  await updateDoc(orderRef, {
    adminViewedAt: serverTimestamp(),
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
