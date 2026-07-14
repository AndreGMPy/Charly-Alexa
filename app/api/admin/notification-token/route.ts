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
    if (!token) {
      return Response.json({ message: "No fue posible activar las notificaciones." }, { status: 400 });
    }

    const firestore = getAdminFirestore();
    const docRef = firestore
      .collection("adminNotificationTokens")
      .doc(tokenDocId(token));

    await docRef.set(
      {
        token,
        uid: admin.uid,
        email: admin.email ?? "",
        userAgent: readString(body.userAgent, 500),
        deviceName: readString(body.deviceName, 120),
        active: true,
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true }
    );

    return Response.json({ ok: true });
  } catch (error) {
    logErrorInDevelopment("Notification token save error", error);
    return Response.json(
      { message: "No fue posible activar las notificaciones." },
      { status: 500 }
    );
  }
}
