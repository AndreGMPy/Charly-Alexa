"use client";

import {
  getSiteSettings,
  type SiteSettings,
} from "@/lib/firebase-services/site-settings";
import { storeConfig } from "@/lib/site";
import {
  normalizeWholesaleSettings,
  type WholesaleSettings,
} from "@/lib/wholesale";
import { useEffect, useMemo, useState } from "react";

export type PublicSiteSettings = {
  storeName: string;
  legalName: string;
  tagline: string;
  shortDescription: string;
  logoUrl: string;
  storefrontImage: string;
  whatsappDisplay: string;
  whatsappInternational: string;
  address: string;
  hours: string;
  deliveryText: string;
  paymentText: string;
  wholesaleSettings: WholesaleSettings;
  social: {
    instagram: string;
    facebook: string;
    tiktok: string;
    whatsapp: string;
  };
};

function onlyDigits(value: string) {
  return value.replace(/\D/g, "");
}

function formatWhatsapp(value: string) {
  const digits = onlyDigits(value);

  if (!digits) return storeConfig.whatsappDisplay;

  if (digits.length === 10) {
    return digits.replace(/(\d{3})(\d{3})(\d{4})/, "$1 $2 $3");
  }

  if (digits.length === 12 && digits.startsWith("52")) {
    return digits
      .slice(2)
      .replace(/(\d{3})(\d{3})(\d{4})/, "$1 $2 $3");
  }

  return value;
}

function normalizeWhatsapp(value: string) {
  const digits = onlyDigits(value);

  if (!digits) return storeConfig.whatsappInternational;
  if (digits.length === 10) return `52${digits}`;

  return digits;
}

function mapSettings(settings: SiteSettings | null): PublicSiteSettings {
  const whatsapp =
    settings?.whatsapp?.trim() ||
    settings?.social?.whatsapp?.trim() ||
    storeConfig.whatsappInternational;

  return {
    storeName: settings?.storeName?.trim() || storeConfig.name,
    legalName: storeConfig.legalName,
    tagline: settings?.slogan?.trim() || storeConfig.tagline,
    shortDescription:
      settings?.shortDescription?.trim() || storeConfig.description,
    logoUrl: settings?.logoUrl?.trim() || "",
    storefrontImage: settings?.storefrontImage?.trim() || "",
    whatsappDisplay: formatWhatsapp(whatsapp),
    whatsappInternational: normalizeWhatsapp(whatsapp),
    address: settings?.address?.trim() || storeConfig.address,
    hours: settings?.hours?.trim() || "Consultar horario en tienda.",
    deliveryText:
      settings?.deliveryText?.trim() ||
      "Envío nacional a la dirección indicada.",
    paymentText:
      settings?.paymentText?.trim() ||
      "Pago en línea seguro o acuerdo por WhatsApp.",
    wholesaleSettings: normalizeWholesaleSettings(settings?.wholesaleSettings),
    social: {
      instagram: settings?.social?.instagram?.trim() || "",
      facebook: settings?.social?.facebook?.trim() || "",
      tiktok: settings?.social?.tiktok?.trim() || "",
      whatsapp: settings?.social?.whatsapp?.trim() || whatsapp,
    },
  };
}

export function buildWhatsAppUrlWithNumber(number: string, message: string) {
  return `https://wa.me/${normalizeWhatsapp(number)}?text=${encodeURIComponent(
    message
  )}`;
}

export function useSiteSettings() {
  const [settings, setSettings] = useState<SiteSettings | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let isCurrent = true;

    async function loadSettings() {
      try {
        const savedSettings = await getSiteSettings();

        if (!isCurrent) return;
        setSettings(savedSettings);
      } catch {
        if (isCurrent) {
          setSettings(null);
        }
      } finally {
        if (isCurrent) {
          setIsLoading(false);
        }
      }
    }

    void loadSettings();

    return () => {
      isCurrent = false;
    };
  }, []);

  const publicSettings = useMemo(() => mapSettings(settings), [settings]);

  return {
    settings: publicSettings,
    rawSettings: settings,
    isLoading,
  };
}
