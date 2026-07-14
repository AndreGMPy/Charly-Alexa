"use client";

import { auth, app, isFirebaseConfigured } from "@/lib/firebase";
import { getSafeFirebaseActionMessage, logErrorInDevelopment } from "@/lib/safe-errors";
import { Bell, BellRing, Send } from "lucide-react";
import { getMessaging, getToken, isSupported } from "firebase/messaging";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

type NotificationState =
  | "not_configured"
  | "enabled"
  | "denied"
  | "unsupported"
  | "idle";

const stateLabels: Record<NotificationState, string> = {
  not_configured: "Notificaciones no configuradas",
  enabled: "Notificaciones activadas",
  denied: "Permiso rechazado",
  unsupported: "Este navegador no es compatible",
  idle: "Notificaciones no configuradas",
};

export default function AdminNotificationSettings() {
  const [state, setState] = useState<NotificationState>("idle");
  const [isBusy, setIsBusy] = useState(false);
  const [currentToken, setCurrentToken] = useState("");
  const vapidKey = process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY ?? "";

  const canUseNotifications = useMemo(
    () => isFirebaseConfigured && Boolean(app) && Boolean(vapidKey),
    [vapidKey]
  );

  useEffect(() => {
    let isCurrent = true;

    async function checkSupport() {
      if (!canUseNotifications) {
        setState("not_configured");
        return;
      }

      if (!("Notification" in window) || !("serviceWorker" in navigator)) {
        setState("unsupported");
        return;
      }

      const supported = await isSupported().catch(() => false);
      if (!isCurrent) return;

      if (!supported) {
        setState("unsupported");
        return;
      }

      if (Notification.permission === "denied") {
        setState("denied");
        return;
      }

      if (Notification.permission === "granted") {
        setState(currentToken ? "enabled" : "idle");
      }
    }

    void checkSupport();

    return () => {
      isCurrent = false;
    };
  }, [canUseNotifications, currentToken]);

  async function getAuthHeader() {
    const user = auth?.currentUser;
    if (!user) throw new Error("No autorizado.");

    return {
      Authorization: `Bearer ${await user.getIdToken()}`,
    };
  }

  async function activateNotifications() {
    if (!canUseNotifications || !app) {
      setState("not_configured");
      toast.error("No fue posible activar las notificaciones.");
      return;
    }

    try {
      setIsBusy(true);

      const supported = await isSupported().catch(() => false);
      if (!supported || !("Notification" in window) || !("serviceWorker" in navigator)) {
        setState("unsupported");
        return;
      }

      const permission = await Notification.requestPermission();
      if (permission === "denied") {
        setState("denied");
        return;
      }

      if (permission !== "granted") {
        setState("idle");
        return;
      }

      const registration = await navigator.serviceWorker.register(
        "/firebase-messaging-sw.js"
      );
      const messaging = getMessaging(app);
      const token = await getToken(messaging, {
        vapidKey,
        serviceWorkerRegistration: registration,
      });

      if (!token) {
        throw new Error("No fue posible activar las notificaciones.");
      }

      const response = await fetch("/api/admin/notification-token", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(await getAuthHeader()),
        },
        body: JSON.stringify({
          token,
          userAgent: navigator.userAgent,
          deviceName: navigator.platform,
        }),
      });

      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as
          | { message?: string }
          | null;
        throw new Error(body?.message || "No fue posible activar las notificaciones.");
      }

      setCurrentToken(token);
      setState("enabled");
      toast.success("Notificaciones activadas");
    } catch (error) {
      logErrorInDevelopment("Notification activation error", error);
      toast.error(getSafeFirebaseActionMessage(error, "No fue posible activar las notificaciones."));
    } finally {
      setIsBusy(false);
    }
  }

  async function sendTestNotification() {
    try {
      setIsBusy(true);
      const response = await fetch("/api/admin/test-notification", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(await getAuthHeader()),
        },
        body: JSON.stringify({ token: currentToken }),
      });

      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as
          | { message?: string }
          | null;
        throw new Error(body?.message || "No fue posible enviar la notificacion de prueba.");
      }

      toast.success("Notificacion de prueba enviada");
    } catch (error) {
      logErrorInDevelopment("Test notification error", error);
      toast.error("No fue posible enviar la notificacion de prueba.");
    } finally {
      setIsBusy(false);
    }
  }

  return (
    <section className="rounded-[1.25rem] bg-white p-3 shadow-sm ring-1 ring-rose-100 sm:rounded-[1.75rem] sm:p-6">
      <div className="mb-5 flex items-center gap-3">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-sky-50 text-sky-600 ring-1 ring-sky-100">
          <BellRing size={22} />
        </div>
        <div>
          <h2 className="text-lg font-black text-slate-950">
            Notificaciones de pedidos
          </h2>
          <p className="text-sm font-medium text-slate-500">
            {stateLabels[state]}
          </p>
        </div>
      </div>

      <div className="grid gap-2 sm:flex sm:flex-wrap">
        <button
          type="button"
          onClick={() => void activateNotifications()}
          disabled={isBusy || state === "unsupported" || state === "denied"}
          className="inline-flex min-h-10 items-center justify-center gap-2 rounded-full bg-slate-950 px-4 py-2 text-xs font-black text-white shadow-sm transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-300 sm:min-h-11 sm:px-5 sm:py-3 sm:text-sm"
        >
          <Bell size={17} />
          {isBusy ? "Activando..." : "Activar notificaciones de pedidos"}
        </button>

        <button
          type="button"
          onClick={() => void sendTestNotification()}
          disabled={isBusy || state !== "enabled"}
          className="inline-flex min-h-10 items-center justify-center gap-2 rounded-full bg-sky-50 px-4 py-2 text-xs font-black text-sky-700 ring-1 ring-sky-100 transition hover:bg-sky-100 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400 disabled:ring-slate-100 sm:min-h-11 sm:px-5 sm:py-3 sm:text-sm"
        >
          <Send size={17} />
          Enviar notificacion de prueba
        </button>
      </div>
    </section>
  );
}
