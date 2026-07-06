"use client";

import {
  buildWhatsAppUrlWithNumber,
  useSiteSettings,
} from "@/hooks/useSiteSettings";
import { paymentMethods, policyLinks } from "@/lib/site";
import {
  CreditCard,
  MapPin,
  MessageCircle,
  ShieldCheck,
  ShoppingBag,
} from "lucide-react";

export default function SiteFooter() {
  const { settings } = useSiteSettings();

  return (
    <footer className="border-t border-rose-100 bg-white text-slate-700">
      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-5 sm:py-10 lg:py-12">
        <div className="grid gap-7 sm:grid-cols-2 lg:grid-cols-[1.15fr_0.85fr_0.85fr_1fr] lg:gap-8">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-rose-500">
              Boutique infantil
            </p>

            <h2 className="mt-2 text-2xl font-black leading-none text-slate-950 sm:text-3xl">
              {settings.storeName}
            </h2>

            <p className="mt-3 max-w-sm text-xs font-medium leading-5 text-slate-500 sm:text-sm sm:leading-6">
              {settings.shortDescription}
            </p>
          </div>

          <div>
            <h3 className="text-sm font-black text-slate-950">Cómo pagar</h3>

            <ul className="mt-3 space-y-2">
              {(settings.paymentText
                ? [settings.paymentText]
                : paymentMethods
              ).map((method, index) => (
                <li
                  key={method}
                  className="flex items-start gap-2 text-[11px] leading-5 text-slate-500 sm:text-xs"
                >
                  {index === 0 && (
                    <CreditCard
                      size={14}
                      className="mt-0.5 shrink-0 text-rose-500"
                    />
                  )}

                  {index === 1 && (
                    <ShieldCheck
                      size={14}
                      className="mt-0.5 shrink-0 text-emerald-500"
                    />
                  )}

                  {index === 2 && (
                    <ShoppingBag
                      size={14}
                      className="mt-0.5 shrink-0 text-sky-500"
                    />
                  )}

                  <span>{method}</span>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h3 className="text-sm font-black text-slate-950">Políticas</h3>

            <ul className="mt-3 grid grid-cols-2 gap-x-3 gap-y-2 sm:block sm:space-y-2">
              {policyLinks.map((item) => (
                <li key={item}>
                  <a
                    href="#"
                    className="text-[11px] font-medium text-slate-500 transition hover:text-rose-500 sm:text-xs"
                  >
                    {item}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h3 className="text-sm font-black text-slate-950">Contacto</h3>

            <ul className="mt-3 space-y-2">
              <li className="flex items-start gap-2 text-[11px] leading-5 text-slate-500 sm:text-xs">
                <MapPin size={14} className="mt-0.5 shrink-0 text-rose-500" />
                <span>{settings.address}</span>
              </li>

              <li>
                <a
                  href={buildWhatsAppUrlWithNumber(
                    settings.whatsappInternational,
                    `Hola, quiero información de ${settings.storeName}.`
                  )}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-2 text-[11px] font-medium text-slate-500 transition hover:text-emerald-600 sm:text-xs"
                >
                  <MessageCircle
                    size={14}
                    className="shrink-0 text-emerald-500"
                  />
                  WhatsApp {settings.whatsappDisplay}
                </a>
              </li>

              {settings.hours && (
                <li className="flex items-start gap-2 text-[11px] leading-5 text-slate-500 sm:text-xs">
                  <ShieldCheck
                    size={14}
                    className="mt-0.5 shrink-0 text-emerald-500"
                  />
                  <span>{settings.hours}</span>
                </li>
              )}

              <li className="flex items-center gap-2 text-[11px] text-slate-500 sm:text-xs">
                <ShoppingBag size={14} className="shrink-0 text-sky-500" />
                Catálogo digital
              </li>
            </ul>
          </div>
        </div>

        <div className="mt-7 flex flex-col gap-2 border-t border-slate-100 pt-4 text-[10px] font-medium text-slate-400 sm:mt-8 sm:flex-row sm:items-center sm:justify-between sm:text-xs">
          <p>
            © {new Date().getFullYear()} {settings.storeName}. Catálogo digital.
          </p>

          <p className="hidden sm:block">
            Hecho para pedidos rápidos y atención por WhatsApp.
          </p>
        </div>
      </div>
    </footer>
  );
}
