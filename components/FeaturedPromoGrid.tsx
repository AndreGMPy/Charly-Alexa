import { promoTiles } from "@/lib/site";
import { ArrowRight, Flame, Percent, Shirt, Sparkles } from "lucide-react";
import Link from "next/link";

const iconByTone = {
  rose: Percent,
  lilac: Sparkles,
  sky: Flame,
  amber: Shirt,
};

const stylesByTone = {
  rose: {
    card: "from-rose-100 via-white to-amber-50",
    icon: "text-rose-500",
    button: "bg-rose-500 hover:bg-rose-600",
    overlay: "from-rose-950/55 via-rose-500/25 to-slate-950/20",
  },
  lilac: {
    card: "from-violet-100 via-white to-rose-50",
    icon: "text-violet-500",
    button: "bg-violet-500 hover:bg-violet-600",
    overlay: "from-violet-950/55 via-violet-500/25 to-slate-950/20",
  },
  sky: {
    card: "from-sky-100 via-white to-lime-50",
    icon: "text-sky-600",
    button: "bg-sky-600 hover:bg-sky-700",
    overlay: "from-sky-950/55 via-sky-500/25 to-slate-950/20",
  },
  amber: {
    card: "from-amber-100 via-white to-rose-50",
    icon: "text-amber-600",
    button: "bg-amber-500 hover:bg-amber-600",
    overlay: "from-amber-950/55 via-orange-500/25 to-slate-950/20",
  },
};

export default function FeaturedPromoGrid() {
  return (
    <section id="ofertas" className="bg-[#fffaf5] px-4 py-8 sm:px-5 sm:py-14">
      <div className="mx-auto max-w-7xl">
        <div className="mb-5 flex flex-col justify-between gap-3 sm:mb-7 sm:flex-row sm:items-end">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.25em] text-rose-500">
              Ofertas y novedades
            </p>

            <h2 className="mt-2 text-2xl font-black leading-tight text-slate-950 sm:text-5xl">
              Compra por momento
            </h2>
          </div>

          <p className="max-w-md text-sm leading-6 text-slate-500">
            Entra directo a promociones, novedades y prendas de temporada.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
          {promoTiles.map((promo) => {
            const Icon = iconByTone[promo.tone];
            const styles = stylesByTone[promo.tone];

            const girlFilter = encodeURIComponent(promo.girlFilter);
            const boyFilter = encodeURIComponent(promo.boyFilter);

            const girlHref = `/nina?filtro=${girlFilter}`;
            const boyHref = `/nino?filtro=${boyFilter}`;

            return (
              <article
                key={promo.title}
                className="group overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-slate-100 transition hover:-translate-y-1 hover:shadow-lg sm:rounded-3xl"
              >
                <Link
                  href={girlHref}
                  className="relative block min-h-[155px] overflow-hidden text-white sm:min-h-[205px]"
                  aria-label={`Ver ${promo.title} para niña`}
                >
                  <div
                    className={`absolute inset-0 bg-gradient-to-br ${styles.card}`}
                  />

                  <div
                    className="absolute inset-0 bg-cover bg-center transition duration-500 group-hover:scale-105"
                    style={{ backgroundImage: `url(${promo.imageUrl})` }}
                  />

                  <div
                    className={`absolute inset-0 bg-gradient-to-br ${styles.overlay}`}
                  />

                  <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-slate-950/50 to-transparent" />

                  <div className="relative flex min-h-[155px] flex-col justify-between p-3 sm:min-h-[205px] sm:p-5">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <span className="rounded-full bg-white/95 px-3 py-1.5 text-[10px] font-black uppercase text-slate-700 shadow-sm sm:text-xs">
                          {promo.label}
                        </span>

                        <p className="mt-3 text-[9px] font-black uppercase tracking-wide text-white/90 sm:text-xs">
                          {promo.visualLabel}
                        </p>
                      </div>

                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white/95 shadow-sm sm:h-11 sm:w-11 sm:rounded-2xl">
                        <Icon
                          className={`h-4 w-4 sm:h-5 sm:w-5 ${styles.icon}`}
                        />
                      </div>
                    </div>

                    <div>
                      <h3 className="text-xl font-black leading-none text-white drop-shadow-sm sm:text-3xl">
                        {promo.title}
                      </h3>

                      <p className="mt-2 line-clamp-2 text-[11px] font-semibold leading-4 text-white/90 sm:text-sm sm:leading-5">
                        {promo.subtitle}
                      </p>

                      <div className="mt-3 inline-flex items-center gap-1 text-[10px] font-black uppercase text-white/90 sm:text-xs">
                        Tocar para ver
                        <ArrowRight className="h-3 w-3 sm:h-4 sm:w-4" />
                      </div>
                    </div>
                  </div>
                </Link>

                <div className="grid grid-cols-2 gap-2 bg-white p-3">
                  <Link
                    href={girlHref}
                    className="inline-flex items-center justify-center gap-1 rounded-full bg-slate-50 px-3 py-2 text-xs font-black text-slate-950 shadow-sm ring-1 ring-slate-100 transition hover:scale-[1.02] hover:bg-rose-50 sm:text-sm"
                  >
                    Niña
                    <ArrowRight size={14} />
                  </Link>

                  <Link
                    href={boyHref}
                    className={`inline-flex items-center justify-center gap-1 rounded-full px-3 py-2 text-xs font-black text-white shadow-sm transition hover:scale-[1.02] sm:text-sm ${styles.button}`}
                  >
                    Niño
                    <ArrowRight size={14} />
                  </Link>
                </div>
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
}