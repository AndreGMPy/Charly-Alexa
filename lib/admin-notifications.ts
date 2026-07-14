import "server-only";

import { getAdminFirestore, getAdminMessaging } from "@/lib/firebase-admin";
import {
  sendAdminPaidOrderEmail,
  sendCustomerOrderConfirmationEmail,
} from "@/lib/email";
import type { FirebaseOrder } from "@/lib/firebase-types";
import { getAppUrl } from "@/lib/stripe";
import { FieldValue } from "firebase-admin/firestore";

const ORDERS_COLLECTION = "orders";
const TOKENS_COLLECTION = "adminNotificationTokens";

const money = (value: number) =>
  new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: "MXN",
    maximumFractionDigits: 0,
  }).format(Number(value) || 0);

function getOrderFolio(order: FirebaseOrder) {
  return order.orderNumber ?? order.id.slice(-6).toUpperCase();
}

function isInvalidMessagingToken(code?: string) {
  return (
    code === "messaging/registration-token-not-registered" ||
    code === "messaging/invalid-registration-token" ||
    code === "messaging/invalid-argument"
  );
}

async function getOrder(orderId: string) {
  const firestore = getAdminFirestore();
  const snapshot = await firestore.collection(ORDERS_COLLECTION).doc(orderId).get();

  if (!snapshot.exists) return null;
  return { id: snapshot.id, ...(snapshot.data() as Omit<FirebaseOrder, "id">) };
}

async function updateNotificationField(
  orderId: string,
  data: Record<string, unknown>
) {
  await getAdminFirestore()
    .collection(ORDERS_COLLECTION)
    .doc(orderId)
    .set(
      {
        notifications: data,
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true }
    );
}

export async function sendPaidOrderNotifications(orderId: string) {
  const order = await getOrder(orderId);
  if (!order || order.paymentStatus !== "paid") return;

  const notifications = order.notifications ?? {};

  if (!notifications.customerEmailSentAt) {
    try {
      const result = await sendCustomerOrderConfirmationEmail(order);
      if (result.sent) {
        await updateNotificationField(orderId, {
          customerEmailSentAt: FieldValue.serverTimestamp(),
          customerEmailError: FieldValue.delete(),
        });
      }
    } catch (error) {
      await updateNotificationField(orderId, {
        customerEmailError:
          error instanceof Error ? error.message.slice(0, 300) : "email_failed",
      });
    }
  }

  if (!notifications.adminEmailSentAt) {
    try {
      const result = await sendAdminPaidOrderEmail(order);
      if (result.sent) {
        await updateNotificationField(orderId, {
          adminEmailSentAt: FieldValue.serverTimestamp(),
          adminEmailError: FieldValue.delete(),
        });
      }
    } catch (error) {
      await updateNotificationField(orderId, {
        adminEmailError:
          error instanceof Error ? error.message.slice(0, 300) : "email_failed",
      });
    }
  }

  if (!notifications.pushSentAt) {
    try {
      await sendPushForPaidOrder(order);
      await updateNotificationField(orderId, {
        pushSentAt: FieldValue.serverTimestamp(),
        pushError: FieldValue.delete(),
      });
    } catch (error) {
      await updateNotificationField(orderId, {
        pushError:
          error instanceof Error ? error.message.slice(0, 300) : "push_failed",
      });
    }
  }
}

export async function sendPushForPaidOrder(order: FirebaseOrder) {
  const firestore = getAdminFirestore();
  const tokensSnapshot = await firestore
    .collection(TOKENS_COLLECTION)
    .where("active", "==", true)
    .get();
  const tokens = tokensSnapshot.docs
    .map((doc) => ({ id: doc.id, token: String(doc.data().token ?? "") }))
    .filter((item) => item.token);

  if (tokens.length === 0) return { sent: false, reason: "no_tokens" as const };

  const appUrl = getAppUrl();
  const link = appUrl
    ? `${appUrl}/admin/pedidos?pedido=${encodeURIComponent(order.id)}`
    : `/admin/pedidos?pedido=${encodeURIComponent(order.id)}`;
  const response = await getAdminMessaging().sendEachForMulticast({
    tokens: tokens.map((item) => item.token),
    notification: {
      title: "Nuevo pedido pagado",
      body: `Pedido #${getOrderFolio(order)} por ${money(order.total)} MXN`,
    },
    webpush: {
      fcmOptions: {
        link,
      },
      notification: {
        icon: "/window.svg",
        badge: "/window.svg",
      },
    },
    data: {
      orderId: order.id,
      url: link,
      type: "paid_order",
    },
  });
  const batch = firestore.batch();

  response.responses.forEach((item, index) => {
    if (!item.success && isInvalidMessagingToken(item.error?.code)) {
      batch.set(
        firestore.collection(TOKENS_COLLECTION).doc(tokens[index].id),
        {
          active: false,
          invalidatedAt: FieldValue.serverTimestamp(),
          updatedAt: FieldValue.serverTimestamp(),
        },
        { merge: true }
      );
    }
  });

  await batch.commit();
  return { sent: response.successCount > 0 };
}

export async function sendAdminTestNotification(uid: string, token?: string) {
  const firestore = getAdminFirestore();
  let tokens: string[] = [];

  if (token) {
    const snapshot = await firestore
      .collection(TOKENS_COLLECTION)
      .where("uid", "==", uid)
      .where("token", "==", token)
      .where("active", "==", true)
      .limit(1)
      .get();
    tokens = snapshot.docs.map((doc) => String(doc.data().token ?? ""));
  } else {
    const snapshot = await firestore
      .collection(TOKENS_COLLECTION)
      .where("uid", "==", uid)
      .where("active", "==", true)
      .get();
    tokens = snapshot.docs.map((doc) => String(doc.data().token ?? ""));
  }

  tokens = tokens.filter(Boolean);
  if (tokens.length === 0) return { sent: false, reason: "no_tokens" as const };

  const appUrl = getAppUrl();
  const link = appUrl ? `${appUrl}/admin/pedidos` : "/admin/pedidos";
  const response = await getAdminMessaging().sendEachForMulticast({
    tokens,
    notification: {
      title: "Notificacion de prueba",
      body: "Las notificaciones de pedidos estan activas.",
    },
    webpush: {
      fcmOptions: { link },
      notification: {
        icon: "/window.svg",
        badge: "/window.svg",
      },
    },
    data: {
      type: "test",
      url: link,
    },
  });

  return { sent: response.successCount > 0 };
}
