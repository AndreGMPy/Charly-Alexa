import { db, isFirebaseConfigured } from "@/lib/firebase";
import type { FirebaseDate } from "@/lib/firebase-types";
import { doc, getDoc, serverTimestamp, setDoc } from "firebase/firestore";

export type SiteSettings = {
  storeName: string;
  slogan: string;
  shortDescription: string;
  logoUrl: string;
  storefrontImage: string;
  whatsapp: string;
  address: string;
  hours: string;
  deliveryText: string;
  paymentText: string;
  social: {
    instagram: string;
    facebook: string;
    tiktok: string;
    whatsapp: string;
  };
  createdAt?: FirebaseDate;
  updatedAt?: FirebaseDate;
};

export type SiteSettingsInput = Omit<
  SiteSettings,
  "createdAt" | "updatedAt"
>;

const SETTINGS_COLLECTION = "siteSettings";
const SETTINGS_DOCUMENT = "main";

function ensureFirebaseConfigured() {
  if (!isFirebaseConfigured || !db) {
    throw new Error("La tienda no está conectada.");
  }

  return db;
}

export async function getSiteSettings() {
  if (!isFirebaseConfigured || !db) return null;

  const snapshot = await getDoc(doc(db, SETTINGS_COLLECTION, SETTINGS_DOCUMENT));

  if (!snapshot.exists()) return null;

  return snapshot.data() as SiteSettings;
}

export async function saveSiteSettings(settings: SiteSettingsInput) {
  const firestore = ensureFirebaseConfigured();

  await setDoc(
    doc(firestore, SETTINGS_COLLECTION, SETTINGS_DOCUMENT),
    {
      ...settings,
      updatedAt: serverTimestamp(),
    },
    { merge: true }
  );
}
