"use client";

import {
  browserSupportsFirebaseMessaging,
  FirebaseMessagingClientError,
  generateFirebaseMessagingToken,
  getFirebaseMessagingInstance,
  unregisterFirebaseMessagingServiceWorker,
} from "@/lib/firebase-messaging-client";
import { app, auth, isFirebaseConfigured } from "@/lib/firebase";
import { logErrorInDevelopment } from "@/lib/safe-errors";
import { onAuthStateChanged } from "firebase/auth";
import { deleteToken, onMessage } from "firebase/messaging";
import {
  Bell,
  BellRing,
  LoaderCircle,
  RotateCcw,
  Send,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

type NotificationState =
  | "no_configured"
  | "requesting_permission"
  | "registering_service_worker"
  | "generating_token"
  | "saving_token"
  | "enabled"
  | "denied"
  | "unsupported"
  | "error";

const stateLabels: Record<NotificationState, string> = {
  no_configured: "Notificaciones no configuradas",
  requesting_permission: "Solicitando permiso...",
  registering_service_worker: "Preparando notificaciones...",
  generating_token: "Generando registro del dispositivo...",
  saving_token: "Registrando este dispositivo...",
  enabled: "Notificaciones activadas correctamente.",
  denied: "El permiso para notificaciones fue rechazado.",
  unsupported: "Este navegador no admite notificaciones push.",
  error:
    "No fue posible activar las notificaciones. Recarga la pagina e intentalo nuevamente.",
};

const processingStates: NotificationState[] = [
  "requesting_permission",
  "registering_service_worker",
  "generating_token",
  "saving_token",
];

function getPlatform() {
  const navigatorWithUaData = navigator as Navigator & {
    userAgentData?: { platform?: string };
  };

  return navigatorWithUaData.userAgentData?.platform || navigator.platform || "";
}

async function getAuthHeader() {
  const user = auth?.currentUser;
  if (!user) throw new Error("admin-not-authenticated");

  return {
    Authorization: `Bearer ${await user.getIdToken()}`,
  };
}

async function saveNotificationToken(token: string) {
  const platform = getPlatform();
  const response = await fetch("/api/admin/notification-token", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(await getAuthHeader()),
    },
    body: JSON.stringify({
      token,
      userAgent: navigator.userAgent,
      deviceName: platform,
      platform,
    }),
  });

  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as
      | { message?: string }
      | null;
    throw new Error(body?.message || "notification-token-save-failed");
  }

  if (process.env.NODE_ENV === "development") {
    console.info("[FCM] Token saved", {
      tokenPreview: `${token.slice(0, 8)}...`,
    });
  }
}

export default function AdminNotificationSettings() {
  const [state, setState] =
    useState<NotificationState>("no_configured");
  const [currentToken, setCurrentToken] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [testMessage, setTestMessage] = useState("");
  const [resetMessage, setResetMessage] = useState("");
  const [isTesting, setIsTesting] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const activationInProgress = useRef(false);
  const testInProgress = useRef(false);
  const vapidKey = process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY ?? "";

  const canUseNotifications = useMemo(
    () => isFirebaseConfigured && Boolean(app) && Boolean(vapidKey),
    [vapidKey]
  );
  const isActivating = processingStates.includes(state);
  const isBusy = isActivating || isTesting || isResetting;

  const configureNotifications = useCallback(
    async ({
      requestPermission,
      showSuccess,
    }: {
      requestPermission: boolean;
      showSuccess: boolean;
    }) => {
      if (activationInProgress.current) return;
      activationInProgress.current = true;
      setErrorMessage("");
      setResetMessage("");

      try {
        if (!canUseNotifications) {
          setState("no_configured");
          throw new Error("firebase-messaging-environment-missing");
        }

        const supported = await browserSupportsFirebaseMessaging();
        if (!supported) {
          setState("unsupported");
          return;
        }

        let permission = Notification.permission;
        if (requestPermission && permission !== "granted") {
          setState("requesting_permission");
          permission = await Notification.requestPermission();
        }

        if (permission === "denied") {
          setState("denied");
          return;
        }

        if (permission !== "granted") {
          setState("no_configured");
          return;
        }

        const { token } = await generateFirebaseMessagingToken(
          vapidKey,
          (stage) => setState(stage)
        );

        setState("saving_token");
        await saveNotificationToken(token);

        setCurrentToken(token);
        setState("enabled");
        if (showSuccess) {
          toast.success("Notificaciones activadas correctamente.");
        }
      } catch (error) {
        if (
          error instanceof FirebaseMessagingClientError &&
          error.code === "firebase-messaging-unsupported"
        ) {
          setState("unsupported");
          return;
        }

        setState("error");
        setErrorMessage(
          "No fue posible activar las notificaciones. Recarga la pagina e intentalo nuevamente."
        );
        logErrorInDevelopment("Notification activation error", error);
        if (showSuccess) {
          toast.error(
            "No fue posible activar las notificaciones. Recarga la pagina e intentalo nuevamente."
          );
        }
      } finally {
        activationInProgress.current = false;
      }
    },
    [canUseNotifications, vapidKey]
  );

  useEffect(() => {
    let cancelled = false;

    async function checkInitialState() {
      if (!canUseNotifications) {
        if (!cancelled) setState("no_configured");
        return;
      }

      const supported = await browserSupportsFirebaseMessaging();
      if (cancelled) return;

      if (!supported) {
        setState("unsupported");
        return;
      }

      if (Notification.permission === "denied") {
        setState("denied");
        return;
      }

      if (Notification.permission !== "granted") {
        setState("no_configured");
      }
    }

    void checkInitialState().catch((error) => {
      if (cancelled) return;
      setState("error");
      logErrorInDevelopment("Notification support check error", error);
    });

    return () => {
      cancelled = true;
    };
  }, [canUseNotifications]);

  useEffect(() => {
    if (
      !auth ||
      !("Notification" in window) ||
      Notification.permission !== "granted"
    ) {
      return;
    }

    let restored = false;
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (!user || restored) return;
      restored = true;
      void configureNotifications({
        requestPermission: false,
        showSuccess: false,
      });
    });

    return unsubscribe;
  }, [configureNotifications]);

  useEffect(() => {
    let unsubscribeMessage: (() => void) | undefined;
    let cancelled = false;

    async function listenForForegroundMessages() {
      if (!canUseNotifications) return;
      const messaging = await getFirebaseMessagingInstance();
      if (cancelled) return;

      unsubscribeMessage = onMessage(messaging, (payload) => {
        const title =
          payload.notification?.title ||
          payload.data?.title ||
          "Nueva notificacion de Charly Alexa";
        const body = payload.notification?.body || payload.data?.body;

        toast.info(title, body ? { description: body } : undefined);
      });
    }

    void listenForForegroundMessages().catch((error) => {
      logErrorInDevelopment("Foreground notification listener error", error);
    });

    return () => {
      cancelled = true;
      unsubscribeMessage?.();
    };
  }, [canUseNotifications]);

  async function sendTestNotification() {
    if (testInProgress.current || !currentToken) return;
    testInProgress.current = true;
    setIsTesting(true);
    setTestMessage("");

    try {
      const response = await fetch("/api/admin/test-notification", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(await getAuthHeader()),
        },
        body: JSON.stringify({ token: currentToken }),
      });
      const body = (await response.json().catch(() => null)) as
        | { ok?: boolean; message?: string; invalidated?: number }
        | null;

      if (!response.ok || body?.ok !== true) {
        if (body?.invalidated) {
          setCurrentToken("");
          setState("error");
        }
        throw new Error(body?.message || "test-notification-failed");
      }

      setTestMessage("Notificacion de prueba enviada a este dispositivo.");
      toast.success("Notificacion de prueba enviada.");
    } catch (error) {
      setTestMessage("No fue posible enviar la notificacion de prueba.");
      logErrorInDevelopment("Test notification error", error);
      toast.error("No fue posible enviar la notificacion de prueba.");
    } finally {
      testInProgress.current = false;
      setIsTesting(false);
    }
  }

  async function resetNotifications() {
    if (isResetting) return;
    setIsResetting(true);
    setErrorMessage("");

    try {
      if (currentToken) {
        const response = await fetch("/api/admin/notification-token", {
          method: "DELETE",
          headers: {
            "Content-Type": "application/json",
            ...(await getAuthHeader()),
          },
          body: JSON.stringify({ token: currentToken }),
        });

        if (!response.ok) throw new Error("notification-token-reset-failed");
      }

      try {
        const messaging = await getFirebaseMessagingInstance();
        await deleteToken(messaging);
      } finally {
        await unregisterFirebaseMessagingServiceWorker();
      }

      setCurrentToken("");
      setState("no_configured");
      setTestMessage("");
      setResetMessage(
        "Configuracion reiniciada. Recarga la pagina antes de activarla nuevamente."
      );
      toast.success("Configuracion de notificaciones reiniciada.");
    } catch (error) {
      setErrorMessage("No fue posible reiniciar las notificaciones.");
      logErrorInDevelopment("Notification reset error", error);
      toast.error("No fue posible reiniciar las notificaciones.");
    } finally {
      setIsResetting(false);
    }
  }

  return (
    <section className="rounded-[1.25rem] bg-white p-3 shadow-sm ring-1 ring-rose-100 sm:rounded-[1.75rem] sm:p-6">
      <div className="mb-5 flex items-center gap-3">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-sky-50 text-sky-600 ring-1 ring-sky-100">
          <BellRing size={22} />
        </div>
        <div className="min-w-0">
          <h2 className="text-lg font-black text-slate-950">
            Notificaciones de pedidos
          </h2>
          <p className="text-sm font-medium leading-5 text-slate-500">
            {stateLabels[state]}
          </p>
        </div>
      </div>

      {(errorMessage || testMessage || resetMessage) && (
        <p
          className={`mb-4 rounded-xl px-3 py-2 text-sm font-semibold ${
            errorMessage
              ? "bg-rose-50 text-rose-700 ring-1 ring-rose-100"
              : "bg-sky-50 text-sky-700 ring-1 ring-sky-100"
          }`}
          role="status"
        >
          {errorMessage || testMessage || resetMessage}
        </p>
      )}

      <div className="grid gap-2 sm:flex sm:flex-wrap">
        <button
          type="button"
          onClick={() =>
            void configureNotifications({
              requestPermission: true,
              showSuccess: true,
            })
          }
          disabled={isBusy || state === "unsupported" || state === "denied"}
          className="inline-flex min-h-10 items-center justify-center gap-2 rounded-full bg-slate-950 px-4 py-2 text-xs font-black text-white shadow-sm transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-300 sm:min-h-11 sm:px-5 sm:py-3 sm:text-sm"
        >
          {isActivating ? (
            <LoaderCircle className="animate-spin" size={17} />
          ) : (
            <Bell size={17} />
          )}
          {isActivating ? stateLabels[state] : "Activar notificaciones de pedidos"}
        </button>

        <button
          type="button"
          onClick={() => void sendTestNotification()}
          disabled={isBusy || state !== "enabled" || !currentToken}
          className="inline-flex min-h-10 items-center justify-center gap-2 rounded-full bg-sky-50 px-4 py-2 text-xs font-black text-sky-700 ring-1 ring-sky-100 transition hover:bg-sky-100 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400 disabled:ring-slate-100 sm:min-h-11 sm:px-5 sm:py-3 sm:text-sm"
        >
          {isTesting ? (
            <LoaderCircle className="animate-spin" size={17} />
          ) : (
            <Send size={17} />
          )}
          {isTesting ? "Enviando..." : "Enviar notificacion de prueba"}
        </button>

        {process.env.NODE_ENV === "development" && (
          <button
            type="button"
            onClick={() => void resetNotifications()}
            disabled={isBusy}
            className="inline-flex min-h-10 items-center justify-center gap-2 rounded-full bg-amber-50 px-4 py-2 text-xs font-black text-amber-800 ring-1 ring-amber-100 transition hover:bg-amber-100 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400 sm:min-h-11 sm:px-5 sm:py-3 sm:text-sm"
          >
            {isResetting ? (
              <LoaderCircle className="animate-spin" size={17} />
            ) : (
              <RotateCcw size={17} />
            )}
            {isResetting
              ? "Reiniciando..."
              : "Reiniciar configuracion de notificaciones"}
          </button>
        )}
      </div>
    </section>
  );
}
