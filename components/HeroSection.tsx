"use client";

import { getHomepageSettings } from "@/lib/firebase-services/homepage";
import { heroHighlights, heroImages } from "@/lib/site";
import { ArrowRight, Gift, Shirt, Sparkles } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";

const defaultHero = {
  title: "Nueva temporada para niñas y niños.",
  subtitle:
    "Ropa infantil cómoda, colorida y fácil de elegir por talla, estilo y sección.",
  girlButtonText: "Ver Niña",
  boyButtonText: "Ver Niño",
  heroGirlImage: heroImages.girl,
  heroBoyImage: heroImages.boy,
  heroLooksImage: heroImages.looks,
};

export default function HeroSection() {
  const [hero, setHero] = useState(defaultHero);

  useEffect(() => {
    let isCurrent = true;

    async function loadHero() {
      try {
        const settings = await getHomepageSettings();

        if (!isCurrent || !settings) return;

        setHero({
          title: settings.heroTitle || defaultHero.title,
          subtitle: settings.heroSubtitle || defaultHero.subtitle,
          girlButtonText:
            settings.girlButtonText || defaultHero.girlButtonText,
          boyButtonText: settings.boyButtonText || defaultHero.boyButtonText,
          heroGirlImage: settings.heroGirlImage || defaultHero.heroGirlImage,
          heroBoyImage: settings.heroBoyImage || defaultHero.heroBoyImage,
          heroLooksImage: settings.heroLooksImage || defaultHero.heroLooksImage,
        });
      } catch {
        // Keep the designed fallback if the saved portada is not available.
      }
    }

    void loadHero();

    return () => {
      isCurrent = false;
    };
  }, []);

  return (
    <section className="relative overflow-hidden bg-[#fffaf5] text-slate-900">
      <div className="absolute inset-0 bg-[linear-gradient(115deg,rgba(251,113,133,0.10)_0_28%,transparent_28%_52%,rgba(125,211,252,0.13)_52%_78%,rgba(254,240,138,0.13)_78%_100%)]" />
      <div className="absolute inset-0 bg-white/55" />

      <div className="relative mx-auto grid max-w-7xl items-center gap-5 px-4 py-6 sm:min-h-[520px] sm:px-5 sm:py-10 lg:grid-cols-[1.02fr_0.98fr] lg:py-12">
        <div className="max-w-4xl">
          <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-white px-3 py-1.5 text-[11px] font-black uppercase text-rose-500 shadow-sm ring-1 ring-rose-100 sm:mb-4 sm:px-4 sm:py-2 sm:text-sm">
            <Gift size={14} />
            Catálogo infantil
          </div>

          <h1 className="max-w-4xl text-[2.55rem] font-black leading-[0.95] tracking-[-0.03em] text-slate-950 sm:text-6xl sm:leading-[1.02] lg:text-7xl">
            {hero.title}
          </h1>

          <p className="mt-3 max-w-2xl text-[15px] leading-6 text-slate-600 sm:mt-5 sm:text-lg sm:leading-8">
            {hero.subtitle}
          </p>

          <div className="mt-5 grid grid-cols-2 gap-2.5 sm:mt-7 sm:flex sm:gap-3">
            <Link
              href="/nina"
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full bg-rose-500 px-4 py-2.5 text-sm font-black text-white shadow-lg shadow-rose-100 transition hover:scale-[1.02] hover:bg-rose-600 sm:px-7 sm:py-4 sm:text-base"
            >
              {hero.girlButtonText}
              <ArrowRight size={16} />
            </Link>

            <Link
              href="/nino"
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full bg-sky-600 px-4 py-2.5 text-sm font-black text-white shadow-lg shadow-sky-100 transition hover:scale-[1.02] hover:bg-sky-700 sm:px-7 sm:py-4 sm:text-base"
            >
              {hero.boyButtonText}
              <ArrowRight size={16} />
            </Link>
          </div>

          <div className="mt-5 flex max-w-3xl flex-wrap gap-2 sm:mt-7">
            {heroHighlights.slice(0, 3).map((item, index) => (
              <div
                key={item}
                className="inline-flex items-center gap-1.5 rounded-full bg-white/85 px-3 py-1.5 text-[11px] font-black text-slate-700 shadow-sm ring-1 ring-slate-100 sm:gap-2 sm:px-4 sm:py-2 sm:text-sm"
              >
                {index % 2 === 0 ? (
                  <Sparkles className="text-rose-400" size={15} />
                ) : (
                  <Shirt className="text-sky-500" size={15} />
                )}
                {item}
              </div>
            ))}
          </div>
        </div>

        <div className="hidden lg:block">
          <div className="grid min-h-[410px] grid-cols-[0.9fr_1.1fr] gap-4">
            <div className="flex flex-col gap-4">
              <Link
                href="/nina"
                className="group relative flex flex-1 overflow-hidden rounded-3xl p-5 shadow-sm ring-1 ring-rose-100"
              >
                <div
                  className="absolute inset-0 bg-cover bg-center transition duration-500 group-hover:scale-105"
                  style={{ backgroundImage: `url(${hero.heroGirlImage})` }}
                />
                <div className="absolute inset-0 bg-gradient-to-br from-rose-950/45 via-rose-500/20 to-white/10" />

                <div className="relative flex h-full flex-col justify-between text-white">
                  <Sparkles className="text-white" />

                  <div>
                    <p className="text-xs font-black uppercase">Niña</p>
                    <p className="mt-2 text-2xl font-black leading-tight">
                      Vestidos y conjuntos suaves
                    </p>
                  </div>
                </div>
              </Link>

              <Link
                href="/nino"
                className="group relative flex flex-1 overflow-hidden rounded-3xl p-5 shadow-sm ring-1 ring-sky-100"
              >
                <div
                  className="absolute inset-0 bg-cover bg-center transition duration-500 group-hover:scale-105"
                  style={{ backgroundImage: `url(${hero.heroBoyImage})` }}
                />
                <div className="absolute inset-0 bg-gradient-to-br from-sky-950/45 via-sky-500/20 to-white/10" />

                <div className="relative flex h-full flex-col justify-between text-white">
                  <Shirt className="text-white" />

                  <div>
                    <p className="text-xs font-black uppercase">Niño</p>
                    <p className="mt-2 text-2xl font-black leading-tight">
                      Básicos para todos los días
                    </p>
                  </div>
                </div>
              </Link>
            </div>

            <Link
              href="/nina?filtro=Novedades"
              className="group relative overflow-hidden rounded-3xl p-6 shadow-sm ring-1 ring-violet-100"
            >
              <div
                className="absolute inset-0 bg-cover bg-center transition duration-500 group-hover:scale-105"
                style={{ backgroundImage: `url(${hero.heroLooksImage})` }}
              />
              <div className="absolute inset-0 bg-gradient-to-br from-slate-950/55 via-slate-900/25 to-white/10" />

              <div className="relative flex h-full flex-col justify-between text-white">
                <span className="w-max rounded-full bg-white/90 px-4 py-2 text-xs font-black uppercase text-slate-800 shadow-sm">
                  Nueva colección
                </span>

                <div>
                  <p className="text-5xl font-black leading-none">Looks listos</p>
                  <p className="mt-4 max-w-xs text-sm font-semibold leading-6 text-white/85">
                    Explora novedades y prendas de temporada sin perder tiempo.
                  </p>
                </div>
              </div>
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
