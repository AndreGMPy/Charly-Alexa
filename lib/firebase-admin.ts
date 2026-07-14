import "server-only";

import {
  cert,
  getApps,
  initializeApp,
  type App,
} from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";
import { getMessaging } from "firebase-admin/messaging";

let adminApp: App | undefined;

function getFirebaseAdminCredentials() {
  const projectId = process.env.FIREBASE_ADMIN_PROJECT_ID?.trim();
  const clientEmail = process.env.FIREBASE_ADMIN_CLIENT_EMAIL?.trim();
  const rawPrivateKey = process.env.FIREBASE_ADMIN_PRIVATE_KEY;
  const missingVariables = [
    ["FIREBASE_ADMIN_PROJECT_ID", projectId],
    ["FIREBASE_ADMIN_CLIENT_EMAIL", clientEmail],
    ["FIREBASE_ADMIN_PRIVATE_KEY", rawPrivateKey],
  ]
    .filter(([, value]) => !value?.trim())
    .map(([name]) => name);

  if (missingVariables.length > 0) {
    throw new Error(
      `Faltan credenciales de Firebase Admin: ${missingVariables.join(", ")}.`
    );
  }

  return {
    projectId: projectId as string,
    clientEmail: clientEmail as string,
    privateKey: (rawPrivateKey as string).replace(/\\n/g, "\n").trim(),
  };
}

function getAdminApp() {
  if (adminApp) return adminApp;

  const existingApp = getApps()[0];
  if (existingApp) {
    adminApp = existingApp;
    return adminApp;
  }

  const credentials = getFirebaseAdminCredentials();
  adminApp = initializeApp({
    credential: cert(credentials),
    projectId: credentials.projectId,
  });

  return adminApp;
}

export function getAdminAuth() {
  return getAuth(getAdminApp());
}

export function getAdminFirestore() {
  return getFirestore(getAdminApp());
}

export function getAdminMessaging() {
  return getMessaging(getAdminApp());
}
