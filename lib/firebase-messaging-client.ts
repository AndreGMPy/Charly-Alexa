"use client";

import { app } from "@/lib/firebase";
import {
  getMessaging,
  getToken,
  isSupported,
  type Messaging,
} from "firebase/messaging";

export const FIREBASE_MESSAGING_SW_PATH = "/firebase-messaging-sw.js";
export const FIREBASE_MESSAGING_SW_SCOPE = "/";

const ACTIVATION_TIMEOUT_MS = 20_000;

let registrationPromise: Promise<ServiceWorkerRegistration> | null = null;

export type FirebaseMessagingClientErrorCode =
  | "firebase-not-configured"
  | "firebase-messaging-unsupported"
  | "service-worker-activation-timeout"
  | "service-worker-redundant"
  | "service-worker-not-active"
  | "firebase-token-not-generated";

export class FirebaseMessagingClientError extends Error {
  constructor(
    public readonly code: FirebaseMessagingClientErrorCode,
    message: string
  ) {
    super(message);
    this.name = "FirebaseMessagingClientError";
  }
}

function isBrowser() {
  return typeof window !== "undefined" && typeof navigator !== "undefined";
}

function debugMessaging(
  stage: string,
  details?: Record<string, unknown>
) {
  if (process.env.NODE_ENV !== "development") return;
  console.info(`[FCM] ${stage}`, details ?? {});
}

function isExpectedWorker(worker: ServiceWorker | null | undefined) {
  if (!worker || !isBrowser()) return false;

  try {
    const scriptUrl = new URL(worker.scriptURL, window.location.origin);
    return (
      scriptUrl.origin === window.location.origin &&
      scriptUrl.pathname === FIREBASE_MESSAGING_SW_PATH
    );
  } catch {
    return false;
  }
}

function getRelatedWorkers(registration: ServiceWorkerRegistration) {
  return [
    registration.installing,
    registration.waiting,
    registration.active,
  ].filter((worker): worker is ServiceWorker => isExpectedWorker(worker));
}

function isRelatedRegistration(registration: ServiceWorkerRegistration) {
  return getRelatedWorkers(registration).length > 0;
}

function getActiveExpectedWorker(registration: ServiceWorkerRegistration) {
  const worker = registration.active;
  return worker?.state === "activated" && isExpectedWorker(worker)
    ? worker
    : null;
}

function logRegistration(
  stage: string,
  registration: ServiceWorkerRegistration
) {
  const worker =
    registration.installing ?? registration.waiting ?? registration.active;

  debugMessaging(stage, {
    scriptUrl: worker?.scriptURL ?? FIREBASE_MESSAGING_SW_PATH,
    scope: registration.scope,
    workerState: worker?.state ?? "missing",
    hasActiveWorker: Boolean(registration.active),
    activeState: registration.active?.state ?? "missing",
  });
}

async function getReadyRegistration(
  registration: ServiceWorkerRegistration,
  timeoutMs: number
) {
  let timeoutId: number | undefined;

  try {
    const readyRegistration = await Promise.race([
      navigator.serviceWorker.ready,
      new Promise<never>((_, reject) => {
        timeoutId = window.setTimeout(() => {
          reject(
            new FirebaseMessagingClientError(
              "service-worker-activation-timeout",
              "Service Worker activation timeout"
            )
          );
        }, timeoutMs);
      }),
    ]);

    if (
      readyRegistration.scope === registration.scope &&
      getActiveExpectedWorker(readyRegistration)
    ) {
      return readyRegistration;
    }

    if (getActiveExpectedWorker(registration)) return registration;

    throw new FirebaseMessagingClientError(
      "service-worker-not-active",
      "Service Worker did not become active"
    );
  } finally {
    if (timeoutId !== undefined) window.clearTimeout(timeoutId);
  }
}

export async function waitForActiveServiceWorker(
  registration: ServiceWorkerRegistration,
  timeoutMs = ACTIVATION_TIMEOUT_MS
): Promise<ServiceWorkerRegistration> {
  if (!isBrowser()) {
    throw new FirebaseMessagingClientError(
      "firebase-messaging-unsupported",
      "Firebase Messaging requires a browser"
    );
  }

  if (getActiveExpectedWorker(registration)) {
    logRegistration("Service Worker already active", registration);
    return getReadyRegistration(registration, timeoutMs);
  }

  await new Promise<void>((resolve, reject) => {
    let settled = false;
    const observedWorkers = new Set<ServiceWorker>();

    const cleanup = () => {
      window.clearTimeout(timeoutId);
      registration.removeEventListener("updatefound", onUpdateFound);
      observedWorkers.forEach((worker) => {
        worker.removeEventListener("statechange", onStateChange);
      });
    };

    const finish = (callback: () => void) => {
      if (settled) return;
      settled = true;
      cleanup();
      callback();
    };

    const inspect = () => {
      const workers = getRelatedWorkers(registration);
      workers.forEach(observeWorker);

      if (getActiveExpectedWorker(registration)) {
        finish(resolve);
        return;
      }

      if (
        workers.length > 0 &&
        workers.every((worker) => worker.state === "redundant")
      ) {
        finish(() =>
          reject(
            new FirebaseMessagingClientError(
              "service-worker-redundant",
              "Service Worker became redundant"
            )
          )
        );
      }
    };

    function onStateChange() {
      inspect();
    }

    function observeWorker(worker: ServiceWorker) {
      if (observedWorkers.has(worker)) return;
      observedWorkers.add(worker);
      worker.addEventListener("statechange", onStateChange);
    }

    function onUpdateFound() {
      inspect();
    }

    const timeoutId = window.setTimeout(() => {
      finish(() =>
        reject(
          new FirebaseMessagingClientError(
            "service-worker-activation-timeout",
            "Service Worker activation timeout"
          )
        )
      );
    }, timeoutMs);

    registration.addEventListener("updatefound", onUpdateFound);
    inspect();
  });

  const readyRegistration = await getReadyRegistration(
    registration,
    timeoutMs
  );

  if (!getActiveExpectedWorker(readyRegistration)) {
    throw new FirebaseMessagingClientError(
      "service-worker-not-active",
      "No active Firebase Messaging Service Worker available"
    );
  }

  logRegistration("Service Worker activated", readyRegistration);
  return readyRegistration;
}

async function registerServiceWorkerAttempt(
  allowRedundantRecovery: boolean
): Promise<ServiceWorkerRegistration> {
  const expectedScope = new URL(
    FIREBASE_MESSAGING_SW_SCOPE,
    window.location.origin
  ).href;
  const registrations = await navigator.serviceWorker.getRegistrations();
  const relatedRegistration = registrations.find(isRelatedRegistration);
  const rootRegistration = registrations.find(
    (registration) => registration.scope === expectedScope
  );
  let registration = relatedRegistration ?? rootRegistration;

  const relatedWorkers = registration
    ? getRelatedWorkers(registration)
    : [];
  const onlyRedundant =
    relatedWorkers.length > 0 &&
    relatedWorkers.every((worker) => worker.state === "redundant");

  if (registration && onlyRedundant && isRelatedRegistration(registration)) {
    await registration.unregister();
    registration = undefined;
  }

  if (!registration || !isRelatedRegistration(registration)) {
    registration = await navigator.serviceWorker.register(
      FIREBASE_MESSAGING_SW_PATH,
      {
        scope: FIREBASE_MESSAGING_SW_SCOPE,
        updateViaCache: "none",
      }
    );
  }

  logRegistration("Service Worker registration found", registration);
  await registration.update().catch(() => undefined);

  try {
    return await waitForActiveServiceWorker(registration);
  } catch (error) {
    if (
      allowRedundantRecovery &&
      error instanceof FirebaseMessagingClientError &&
      error.code === "service-worker-redundant" &&
      isRelatedRegistration(registration)
    ) {
      await registration.unregister();
      return registerServiceWorkerAttempt(false);
    }

    throw error;
  }
}

export async function getActiveFirebaseMessagingServiceWorker() {
  if (!isBrowser() || !("serviceWorker" in navigator)) {
    throw new FirebaseMessagingClientError(
      "firebase-messaging-unsupported",
      "Service Workers are not supported"
    );
  }

  if (!registrationPromise) {
    registrationPromise = registerServiceWorkerAttempt(true).catch((error) => {
      registrationPromise = null;
      throw error;
    });
  }

  const registration = await registrationPromise;
  if (getActiveExpectedWorker(registration)) return registration;

  registrationPromise = null;
  return getActiveFirebaseMessagingServiceWorker();
}

export async function browserSupportsFirebaseMessaging() {
  if (
    !isBrowser() ||
    !("Notification" in window) ||
    !("serviceWorker" in navigator) ||
    !("PushManager" in window)
  ) {
    debugMessaging("Browser support check", { supported: false });
    return false;
  }

  const supported = await isSupported().catch(() => false);
  debugMessaging("Browser support check", { supported });
  return supported;
}

export async function getFirebaseMessagingInstance(): Promise<Messaging> {
  if (!app) {
    throw new FirebaseMessagingClientError(
      "firebase-not-configured",
      "Firebase is not configured"
    );
  }

  if (!(await browserSupportsFirebaseMessaging())) {
    throw new FirebaseMessagingClientError(
      "firebase-messaging-unsupported",
      "Firebase Messaging is not supported"
    );
  }

  return getMessaging(app);
}

export async function generateFirebaseMessagingToken(
  vapidKey: string,
  onStage?: (stage: "registering_service_worker" | "generating_token") => void
) {
  onStage?.("registering_service_worker");
  const registration = await getActiveFirebaseMessagingServiceWorker();

  if (
    !registration.active ||
    registration.active.state !== "activated" ||
    !isExpectedWorker(registration.active)
  ) {
    throw new FirebaseMessagingClientError(
      "service-worker-not-active",
      "Firebase Messaging Service Worker is not active"
    );
  }

  onStage?.("generating_token");
  const messaging = await getFirebaseMessagingInstance();
  const token = await getToken(messaging, {
    vapidKey,
    serviceWorkerRegistration: registration,
  });

  if (!token) {
    throw new FirebaseMessagingClientError(
      "firebase-token-not-generated",
      "Firebase token was not generated"
    );
  }

  debugMessaging("Firebase token generated", {
    tokenPreview: `${token.slice(0, 8)}...`,
    scope: registration.scope,
    activeState: registration.active.state,
  });

  return { messaging, registration, token };
}

export async function unregisterFirebaseMessagingServiceWorker() {
  if (!isBrowser() || !("serviceWorker" in navigator)) return false;

  const registrations = await navigator.serviceWorker.getRegistrations();
  const relatedRegistrations = registrations.filter(isRelatedRegistration);
  const results = await Promise.all(
    relatedRegistrations.map((registration) => registration.unregister())
  );

  registrationPromise = null;
  debugMessaging("Firebase Messaging Service Worker unregistered", {
    count: relatedRegistrations.length,
  });
  return results.some(Boolean);
}
