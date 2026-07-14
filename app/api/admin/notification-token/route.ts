import { requireAdminFromRequest } from "@/lib/admin-api-auth";
import { getAdminFirestore } from "@/lib/firebase-admin";
import { logErrorInDevelopment } from "@/lib/safe-errors";
import { FieldValue } from "firebase-admin/firestore";
import { createHash } from "node:crypto";

export const runtime = "nodejs";

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function readString(value: unknown, maxLength: number) {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

function isValidFcmToken(token: string) {
  return (
    token.length >= 20 &&
    token.length <= 4096 &&
    /^[A-Za-z0-9_:.-]+$/.test(token)
  );
}

function tokenDocId(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export async function POST(request: Request) {
  try {
    const admin = await requireAdminFromRequest(request);
    if (!admin) {
      return Response.json({ message: "No autorizado." }, { status: 401 });
    }

    const body = await request.json().catch(() => null);
    if (!isRecord(body)) {
      return Response.json({ message: "No fue posible activar las notificaciones." }, { status: 400 });
    }

    const token = readString(body.token, 4096);
    if (!isValidFcmToken(token)) {
      return Response.json({ message: "No fue posible activar las notificaciones." }, { status: 400 });
    }

    const firestore = getAdminFirestore();
    const docRef = firestore
      .collection("adminNotificationTokens")
      .doc(tokenDocId(token));

    await firestore.runTransaction(async (transaction) => {
      const snapshot = await transaction.get(docRef);
      const data = {
        token,
        uid: admin.uid,
        email: admin.email ?? "",
        userAgent: readString(body.userAgent, 500),
        deviceName: readString(body.deviceName, 120),
        platform: readString(body.platform, 120),
        active: true,
        updatedAt: FieldValue.serverTimestamp(),
        ...(snapshot.exists
          ? {
              invalidatedAt: FieldValue.delete(),
              resetAt: FieldValue.delete(),
            }
          : { createdAt: FieldValue.serverTimestamp() }),
      };

      transaction.set(docRef, data, { merge: true });
    });

    return Response.json({ ok: true });
  } catch (error) {
    logErrorInDevelopment("Notification token save error", error);
    return Response.json(
      { message: "No fue posible activar las notificaciones." },
      { status: 500 }
    );
  }
}

export async function DELETE(request: Request) {
  try {
    const admin = await requireAdminFromRequest(request);
    if (!admin) {
      return Response.json({ message: "No autorizado." }, { status: 401 });
    }

    const body = await request.json().catch(() => null);
    if (!isRecord(body)) {
      return Response.json(
        { message: "No fue posible reiniciar las notificaciones." },
        { status: 400 }
      );
    }

    const token = readString(body.token, 4096);
    if (!isValidFcmToken(token)) {
      return Response.json(
        { message: "No fue posible reiniciar las notificaciones." },
        { status: 400 }
      );
    }

    const firestore = getAdminFirestore();
    const docRef = firestore
      .collection("adminNotificationTokens")
      .doc(tokenDocId(token));

    await firestore.runTransaction(async (transaction) => {
      const snapshot = await transaction.get(docRef);
      if (!snapshot.exists || snapshot.data()?.uid !== admin.uid) return;

      transaction.set(
        docRef,
        {
          active: false,
          resetAt: FieldValue.serverTimestamp(),
          updatedAt: FieldValue.serverTimestamp(),
        },
        { merge: true }
      );
    });

    return Response.json({ ok: true });
  } catch (error) {
    logErrorInDevelopment("Notification token reset error", error);
    return Response.json(
      { message: "No fue posible reiniciar las notificaciones." },
      { status: 500 }
    );
  }
}
