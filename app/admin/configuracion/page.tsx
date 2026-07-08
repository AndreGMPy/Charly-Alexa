"use client";

import {
  getSiteSettings,
  saveSiteSettings,
  type SiteSettingsInput,
} from "@/lib/firebase-services/site-settings";
import { storeConfig } from "@/lib/site";
import { ImageUploadField } from "@/components/admin/ImageUploadField";
import { Save, Store } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

const defaultSettings: SiteSettingsInput = {
  storeName: storeConfig.name,
  slogan: storeConfig.tagline,
  shortDescription: storeConfig.description,
  logoUrl: "",
  storefrontImage: "",
  whatsapp: storeConfig.whatsappDisplay,
  address: storeConfig.address,
  hours: "Lunes a sábado de 10:00 a 19:00",
  deliveryText: "Envío nacional a la dirección indicada.",
  paymentText: "Pago en línea seguro o acuerdo por WhatsApp.",
  social: {
    instagram: "",
    facebook: "",
    tiktok: "",
    whatsapp: storeConfig.whatsappInternational,
  },
};

const fieldClass =
  "w-full min-w-0 rounded-xl border border-rose-100 bg-white px-3 py-2 text-[16px] font-bold text-slate-800 outline-none transition placeholder:text-slate-300 placeholder:opacity-70 focus:border-rose-300 focus:ring-4 focus:ring-rose-100 sm:rounded-2xl sm:px-4 sm:py-3 sm:text-sm";

const labelClass = "text-xs font-black uppercase tracking-wide text-slate-500";

export default function AdminSettingsPage() {
  const [form, setForm] = useState<SiteSettingsInput>(defaultSettings);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let isCurrent = true;

    async function loadSettings() {
      try {
        const settings = await getSiteSettings();

        if (!isCurrent || !settings) return;

        setForm({
          storeName: settings.storeName || defaultSettings.storeName,
          slogan: settings.slogan || defaultSettings.slogan,
          shortDescription:
            settings.shortDescription || defaultSettings.shortDescription,
          logoUrl: settings.logoUrl || "",
          storefrontImage: settings.storefrontImage || "",
          whatsapp: settings.whatsapp || defaultSettings.whatsapp,
          address: settings.address || defaultSettings.address,
          hours: settings.hours || defaultSettings.hours,
          deliveryText:
            settings.deliveryText || defaultSettings.deliveryText,
          paymentText: settings.paymentText || defaultSettings.paymentText,
          social: {
            instagram: settings.social?.instagram ?? "",
            facebook: settings.social?.facebook ?? "",
            tiktok: settings.social?.tiktok ?? "",
            whatsapp:
              settings.social?.whatsapp ?? defaultSettings.social.whatsapp,
          },
        });
      } catch {
        if (isCurrent) {
          setError("No se pudieron cargar los datos de la tienda.");
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

  function updateField<Field extends keyof SiteSettingsInput>(
    field: Field,
    value: SiteSettingsInput[Field]
  ) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  function updateSocialField(
    field: keyof SiteSettingsInput["social"],
    value: string
  ) {
    setForm((current) => ({
      ...current,
      social: {
        ...current.social,
        [field]: value,
      },
    }));
  }

  async function handleSave() {
    setError("");

    if (!form.storeName.trim()) {
      setError("Agrega el nombre de la tienda.");
      return;
    }

    try {
      setIsSaving(true);
      await saveSiteSettings(form);
      toast.success("Datos de tienda guardados");
    } catch {
      setError("No se pudieron guardar los datos. Intenta de nuevo.");
      toast.error("No se pudieron guardar los datos");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <section className="space-y-4 sm:space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.22em] text-rose-500">
            Tienda
          </p>
          <h1 className="mt-1 text-xl font-black text-slate-950 sm:mt-2 sm:text-4xl">
            Datos de tienda
          </h1>
          <p className="mt-1 max-w-2xl text-sm font-medium leading-6 text-slate-500 sm:mt-2">
            Edita la información visible para tus clientas: contacto, horario,
            entrega, pagos y redes sociales.
          </p>
        </div>

        <button
          type="button"
          onClick={() => void handleSave()}
          disabled={isSaving}
          className="inline-flex min-h-10 items-center justify-center gap-2 rounded-full bg-slate-950 px-4 py-2 text-xs font-black text-white shadow-sm transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-300 sm:px-6 sm:py-3 sm:text-sm"
        >
          <Save size={17} />
          {isSaving ? "Guardando" : "Guardar cambios"}
        </button>
      </div>

      {error && (
        <div className="rounded-2xl bg-rose-50 px-4 py-3 text-sm font-bold text-rose-700 ring-1 ring-rose-100">
          {error}
        </div>
      )}

      <div className="rounded-[1.25rem] bg-white p-3 shadow-sm ring-1 ring-rose-100 sm:rounded-[1.75rem] sm:p-6">
        <div className="mb-5 flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-rose-50 text-rose-500 ring-1 ring-rose-100">
            <Store size={22} />
          </div>
          <div>
            <h2 className="text-lg font-black text-slate-950">
              Información principal
            </h2>
            <p className="text-sm font-medium text-slate-500">
              {isLoading ? "Cargando datos..." : "Lista para editar"}
            </p>
          </div>
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <label className="space-y-2">
            <span className={labelClass}>Nombre de tienda</span>
            <input
              value={form.storeName}
              onChange={(event) =>
                updateField("storeName", event.target.value)
              }
              className={fieldClass}
              placeholder="Ej. Charly Alexa"
            />
          </label>

          <label className="space-y-2">
            <span className={labelClass}>Eslogan</span>
            <input
              value={form.slogan}
              onChange={(event) => updateField("slogan", event.target.value)}
              className={fieldClass}
              placeholder="Ej. Tienda online infantil"
            />
          </label>

          <label className="space-y-2 lg:col-span-2">
            <span className={labelClass}>Descripción corta</span>
            <textarea
              value={form.shortDescription}
              onChange={(event) =>
                updateField("shortDescription", event.target.value)
              }
              className={`${fieldClass} min-h-24 resize-none`}
              placeholder="Ej. Ropa infantil para niñas y niños..."
            />
          </label>

          <div className="lg:col-span-2 grid gap-4 lg:grid-cols-2">
            <ImageUploadField
              label="Logo o imagen de marca"
              value={form.logoUrl}
              onChange={(url) => updateField("logoUrl", url)}
              storagePath="site/logo"
              helperText="Opcional. Se puede usar para futuras secciones de marca."
              previewClassName="h-40"
            />

            <ImageUploadField
              label="Foto de tienda / ubicación"
              value={form.storefrontImage}
              onChange={(url) => updateField("storefrontImage", url)}
              storagePath="site/ubicacion"
              helperText="Foto del local o fachada para la sección de ubicación."
              previewClassName="h-40"
            />
          </div>

          <label className="space-y-2">
            <span className={labelClass}>WhatsApp</span>
            <input
              value={form.whatsapp}
              onChange={(event) => updateField("whatsapp", event.target.value)}
              className={fieldClass}
              placeholder="Ej. 445 144 8846"
            />
          </label>

          <label className="space-y-2">
            <span className={labelClass}>Horario</span>
            <input
              value={form.hours}
              onChange={(event) => updateField("hours", event.target.value)}
              className={fieldClass}
              placeholder="Ej. Lunes a sábado de 10:00 a 19:00"
            />
          </label>

          <label className="space-y-2 lg:col-span-2">
            <span className={labelClass}>Dirección</span>
            <input
              value={form.address}
              onChange={(event) => updateField("address", event.target.value)}
              className={fieldClass}
              placeholder="Ej. Dirección de la tienda"
            />
          </label>

          <label className="space-y-2">
            <span className={labelClass}>Texto de entrega</span>
            <textarea
              value={form.deliveryText}
              onChange={(event) =>
                updateField("deliveryText", event.target.value)
              }
              className={`${fieldClass} min-h-24 resize-none`}
              placeholder="Ej. Envío nacional a la dirección indicada..."
            />
          </label>

          <label className="space-y-2">
            <span className={labelClass}>Texto de pagos</span>
            <textarea
              value={form.paymentText}
              onChange={(event) =>
                updateField("paymentText", event.target.value)
              }
              className={`${fieldClass} min-h-24 resize-none`}
              placeholder="Ej. Pago en línea seguro o acuerdo por WhatsApp..."
            />
          </label>
        </div>
      </div>

      <div className="rounded-[1.25rem] bg-white p-3 shadow-sm ring-1 ring-rose-100 sm:rounded-[1.75rem] sm:p-6">
        <div className="mb-5">
          <h2 className="text-lg font-black text-slate-950">
            Redes sociales
          </h2>
          <p className="mt-1 text-sm font-medium text-slate-500">
            Agrega usuario o enlace completo, según prefieras.
          </p>
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <label className="space-y-2">
            <span className={labelClass}>Instagram</span>
            <input
              value={form.social.instagram}
              onChange={(event) =>
                updateSocialField("instagram", event.target.value)
              }
              className={fieldClass}
              placeholder="Ej. @charlyalexa"
            />
          </label>

          <label className="space-y-2">
            <span className={labelClass}>Facebook</span>
            <input
              value={form.social.facebook}
              onChange={(event) =>
                updateSocialField("facebook", event.target.value)
              }
              className={fieldClass}
              placeholder="Ej. Charly Alexa"
            />
          </label>

          <label className="space-y-2">
            <span className={labelClass}>TikTok</span>
            <input
              value={form.social.tiktok}
              onChange={(event) =>
                updateSocialField("tiktok", event.target.value)
              }
              className={fieldClass}
              placeholder="Ej. @charlyalexa"
            />
          </label>

          <label className="space-y-2">
            <span className={labelClass}>WhatsApp de redes</span>
            <input
              value={form.social.whatsapp}
              onChange={(event) =>
                updateSocialField("whatsapp", event.target.value)
              }
              className={fieldClass}
              placeholder="Ej. 524451448846"
            />
          </label>
        </div>
      </div>
    </section>
  );
}
