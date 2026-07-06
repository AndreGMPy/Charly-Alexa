import { db, isFirebaseConfigured } from "@/lib/firebase";
import type { FirebaseDate } from "@/lib/firebase-types";
import { doc, getDoc, serverTimestamp, setDoc } from "firebase/firestore";

export type HomepageSettings = {
  heroTitle: string;
  heroSubtitle: string;
  girlButtonText: string;
  boyButtonText: string;
  heroGirlImage: string;
  heroBoyImage: string;
  heroLooksImage: string;
  featuredProductIds: string[];
  updatedAt?: FirebaseDate;
};

export type HomepageSettingsInput = Omit<HomepageSettings, "updatedAt">;

const HOMEPAGE_COLLECTION = "homepage";
const HOMEPAGE_DOCUMENT = "main";

function ensureFirebaseConfigured() {
  if (!isFirebaseConfigured || !db) {
    throw new Error("La tienda no está conectada.");
  }

  return db;
}

export async function getHomepageSettings() {
  if (!isFirebaseConfigured || !db) return null;

  const snapshot = await getDoc(doc(db, HOMEPAGE_COLLECTION, HOMEPAGE_DOCUMENT));

  if (!snapshot.exists()) return null;

  const data = snapshot.data() as Partial<HomepageSettings>;

  return {
    heroTitle: data.heroTitle ?? "",
    heroSubtitle: data.heroSubtitle ?? "",
    girlButtonText: data.girlButtonText ?? "",
    boyButtonText: data.boyButtonText ?? "",
    heroGirlImage: data.heroGirlImage ?? "",
    heroBoyImage: data.heroBoyImage ?? "",
    heroLooksImage: data.heroLooksImage ?? "",
    featuredProductIds: data.featuredProductIds ?? [],
    updatedAt: data.updatedAt,
  };
}

export async function saveHomepageSettings(settings: HomepageSettingsInput) {
  const firestore = ensureFirebaseConfigured();

  await setDoc(
    doc(firestore, HOMEPAGE_COLLECTION, HOMEPAGE_DOCUMENT),
    {
      ...settings,
      updatedAt: serverTimestamp(),
    },
    { merge: true }
  );
}
