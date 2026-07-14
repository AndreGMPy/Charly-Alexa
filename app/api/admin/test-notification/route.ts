import { requireAdminFromRequest } from "@/lib/admin-api-auth";
import { sendAdminTestNotification } from "@/lib/admin-notifications";
import { logErrorInDevelopment } from "@/lib/safe-errors";

export const runtime = "nodejs";

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

export async function POST(request: Request) {
  try {
    const admin = await requireAdminFromRequest(request);
    if (!admin) {
      return Response.json({ message: "No autorizado." }, { status: 401 });
    }

    const body = await request.json().catch(() => null);
    const token = isRecord(body) && typeof body.token === "string" ? body.token : "";
    const result = await sendAdminTestNotification(admin.uid, token);

    if (!result.sent) {
      if (result.reason === "invalid_token") {
        return Response.json({
          ok: false,
          invalidated: result.invalidated,
          message:
            "El registro de este dispositivo ya no es valido. Activa las notificaciones nuevamente.",
        });
      }

      return Response.json(
        { message: "No fue posible enviar la notificacion de prueba." },
        { status: 404 }
      );
    }

    return Response.json({ ok: true });
  } catch (error) {
    logErrorInDevelopment("Test notification error", error);
    return Response.json(
      { message: "No fue posible enviar la notificacion de prueba." },
      { status: 500 }
    );
  }
}
