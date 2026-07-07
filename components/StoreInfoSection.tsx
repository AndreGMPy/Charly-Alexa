"use client";

import { useSiteSettings } from "@/hooks/useSiteSettings";
import { Clock, MessageCircle, Ruler, Truck } from "lucide-react";

export default function StoreInfoSection() {
  const { settings } = useSiteSettings();

  const infoItems = [
    {
      title: "Elige tu talla",
      description: "Consulta tallas disponibles antes de pedir.",
      icon: Ruler,
    },
    {
      title: "Pedido por WhatsApp",
      description: `Atención directa al ${settings.whatsappDisplay}.`,
      icon: MessageCircle,
    },
    {
      title: "Envío nacional",
      description: settings.deliveryText,
      icon: Truck,
    },
    ...(settings.hours
      ? [
          {
            title: "Horario",
            description: settings.hours,
            icon: Clock,
          },
        ]
      : []),
  ];

  return (
    <section className="border-y border-rose-100 bg-[#fffaf5] px-4 py-6 sm:px-5 sm:py-10">
      <div className="mx-auto max-w-7xl">
        {settings.storefrontImage && (
          <div className="mb-4 overflow-hidden rounded-[1.75rem] bg-white shadow-sm ring-1 ring-rose-100 sm:mb-6">
            <div
              className="h-48 bg-cover bg-center sm:h-64"
              style={{ backgroundImage: `url(${settings.storefrontImage})` }}
            />
            <div className="p-4 sm:p-5">
              <p className="text-xs font-black uppercase tracking-[0.18em] text-rose-500">
                Ubicación
              </p>
              <h2 className="mt-1 text-xl font-black text-slate-950">
                Visítanos en tienda
              </h2>
              <p className="mt-1 text-sm font-semibold leading-6 text-slate-500">
                {settings.address}
              </p>
            </div>
          </div>
        )}

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {infoItems.map((item) => {
            const Icon = item.icon;

            return (
              <div
                key={item.title}
                className="flex items-center gap-4 rounded-3xl bg-white/80 p-4 shadow-sm ring-1 ring-rose-100 sm:p-5"
              >
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-rose-50 text-rose-500 shadow-sm">
                  <Icon size={22} />
                </div>

                <div>
                  <h3 className="text-base font-black text-slate-950 sm:text-lg">
                    {item.title}
                  </h3>

                  <p className="mt-1 text-sm leading-5 text-slate-500">
                    {item.description}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
