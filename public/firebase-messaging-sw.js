const DEFAULT_URL = "/admin/pedidos";
const DEFAULT_ICON = "/window.svg";

self.addEventListener("install", (event) => {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

function safeAdminUrl(candidate) {
  try {
    const url = new URL(candidate || DEFAULT_URL, self.location.origin);
    if (
      url.origin !== self.location.origin ||
      !url.pathname.startsWith("/admin/")
    ) {
      return DEFAULT_URL;
    }
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return DEFAULT_URL;
  }
}

function readPushPayload(event) {
  if (!event.data) return {};

  try {
    return event.data.json();
  } catch {
    return { data: { body: event.data.text() } };
  }
}

function notificationFromPayload(payload) {
  const notification = payload.notification || {};
  const data = payload.data || {};

  return {
    title: notification.title || data.title || "Nuevo pedido pagado",
    options: {
      body:
        notification.body ||
        data.body ||
        "Tienes una nueva notificacion de Charly Alexa.",
      icon: notification.icon || data.icon || DEFAULT_ICON,
      badge: notification.badge || data.badge || DEFAULT_ICON,
      tag: data.tag || `charly-alexa-${data.type || "notification"}`,
      data: {
        url: safeAdminUrl(data.url || notification.click_action),
      },
    },
  };
}

self.addEventListener("push", (event) => {
  event.waitUntil(
    (async () => {
      const payload = readPushPayload(event);
      const windowClients = await self.clients.matchAll({
        type: "window",
        includeUncontrolled: true,
      });
      const visibleClients = windowClients.filter(
        (client) => client.visibilityState === "visible"
      );

      if (visibleClients.length > 0) {
        const foregroundPayload = {
          ...payload,
          isFirebaseMessaging: true,
          messageType: "push-received",
        };

        visibleClients.forEach((client) =>
          client.postMessage(foregroundPayload)
        );
        return;
      }

      const { title, options } = notificationFromPayload(payload);
      await self.registration.showNotification(title, options);
    })()
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const targetPath = safeAdminUrl(event.notification.data?.url);
  const targetUrl = new URL(targetPath, self.location.origin).href;

  event.waitUntil(
    (async () => {
      const windowClients = await self.clients.matchAll({
        type: "window",
        includeUncontrolled: true,
      });
      const sameOriginClients = windowClients.filter((client) => {
        try {
          return new URL(client.url).origin === self.location.origin;
        } catch {
          return false;
        }
      });
      const exactClient = sameOriginClients.find(
        (client) => client.url === targetUrl
      );
      const client = exactClient || sameOriginClients[0];

      if (client) {
        if (client.url !== targetUrl && "navigate" in client) {
          await client.navigate(targetUrl);
        }
        await client.focus();
        return;
      }

      await self.clients.openWindow(targetUrl);
    })()
  );
});
