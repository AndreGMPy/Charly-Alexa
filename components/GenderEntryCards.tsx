import { genderEntries } from "@/lib/site";
import { ArrowRight, Shirt, Sparkles } from "lucide-react";
import Link from "next/link";

export default function GenderEntryCards() {
  return (
    <section className="bg-[#fffaf5] px-4 py-7 sm:px-5 sm:py-14">
      <div className="mx-auto max-w-7xl">
        <div className="mb-4 sm:mb-6">
          <p className="text-[11px] font-black uppercase tracking-[0.22em] text-rose-500 sm:text-xs">
            Catálogo
          </p>

          <h2 className="mt-1.5 text-2xl font-black leading-tight text-slate-950 sm:mt-2 sm:text-5xl">
            Elige una sección
          </h2>
        </div>

        <div className="grid grid-cols-2 gap-3 sm:gap-5">
          {genderEntries.map((entry) => {
            const isGirl = entry.label === "Niña";
            const Icon = isGirl ? Sparkles : Shirt;
            const iconClass = isGirl ? "text-rose-500" : "text-sky-600";
            const overlay = isGirl
              ? "from-rose-950/55 via-rose-500/20 to-slate-950/25"
              : "from-sky-950/55 via-sky-500/20 to-slate-950/25";
            const shortText = isGirl
              ? "Vestidos y conjuntos"
              : "Playeras y básicos";

            return (
              <Link
                key={entry.href}
                href={entry.href}
                className="group relative flex min-h-[230px] items-end overflow-hidden rounded-3xl bg-white px-3 py-4 text-white shadow-sm ring-1 ring-slate-100 sm:min-h-[520px] sm:px-5 sm:py-16"
              >
                <div
                  className="absolute inset-0 bg-cover bg-center transition duration-500 group-hover:scale-105"
                  style={{ backgroundImage: `url(${entry.imageUrl})` }}
                />
                <div className={`absolute inset-0 bg-gradient-to-br ${overlay}`} />
                <div className="absolute inset-x-0 bottom-0 h-32 bg-gradient-to-t from-slate-950/55 to-transparent sm:h-56" />

                <div className="relative w-full text-center">
                  <div className="mx-auto mb-2 flex h-10 w-10 items-center justify-center rounded-2xl bg-white/90 shadow-sm sm:mb-6 sm:h-20 sm:w-20">
                    <Icon className={`h-5 w-5 sm:h-9 sm:w-9 ${iconClass}`} />
                  </div>

                  <h2 className="text-3xl font-black leading-none sm:text-8xl lg:text-9xl">
                    {entry.label}
                  </h2>

                  <p className="mx-auto mt-2 max-w-[8.5rem] text-[11px] font-semibold leading-4 text-white/90 sm:mt-4 sm:max-w-md sm:px-4 sm:text-base sm:leading-7">
                    <span className="sm:hidden">{shortText}</span>
                    <span className="hidden sm:inline">{entry.subtitle}</span>
                  </p>

                  <div className="mx-auto mt-3 inline-flex items-center gap-1.5 rounded-full bg-white px-4 py-2 text-[11px] font-black text-slate-950 shadow-sm transition group-hover:scale-[1.02] sm:mt-7 sm:gap-2 sm:px-7 sm:py-4 sm:text-base">
                    Entrar
                    <ArrowRight className="h-3.5 w-3.5 sm:h-5 sm:w-5" />
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      </div>
    </section>
  );
}
