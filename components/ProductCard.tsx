import ProductVisual from "@/components/ProductVisual";
import {
  formatPrice,
  getAvailabilityLabel,
  getProductBadges,
  getProductDisplayLabel,
  type Product,
} from "@/lib/products";
import { getWholesaleLabel } from "@/lib/wholesale";
import { ArrowRight, Eye } from "lucide-react";
import Link from "next/link";

type ProductCardProps = {
  product: Product;
  compact?: boolean;
};

export function ProductCardSkeleton({ compact = false }: { compact?: boolean }) {
  return (
    <article
      className="overflow-hidden rounded-[1.5rem] bg-white shadow-sm ring-1 ring-slate-100 sm:rounded-[1.75rem]"
      aria-hidden="true"
    >
      <div
        className={`animate-pulse bg-slate-100 ${
          compact ? "h-36 sm:h-44 lg:h-52" : "h-40 sm:h-52 lg:h-60"
        }`}
      />

      <div className="p-4 sm:p-5">
        <div className="mb-3 flex gap-2">
          <div className="h-6 w-20 animate-pulse rounded-full bg-rose-50" />
          <div className="hidden h-6 w-16 animate-pulse rounded-full bg-slate-100 sm:block" />
        </div>

        <div className="h-3 w-28 animate-pulse rounded-full bg-slate-100" />
        <div className="mt-2 h-5 w-full animate-pulse rounded-full bg-slate-100" />
        <div className="mt-2 h-5 w-3/4 animate-pulse rounded-full bg-slate-100" />

        {!compact && (
          <div className="mt-3 space-y-2">
            <div className="h-3 w-full animate-pulse rounded-full bg-slate-100" />
            <div className="h-3 w-4/5 animate-pulse rounded-full bg-slate-100" />
          </div>
        )}

        <div className="mt-5 flex items-end justify-between gap-3">
          <div>
            <div className="h-3 w-12 animate-pulse rounded-full bg-slate-100" />
            <div className="mt-2 h-8 w-24 animate-pulse rounded-full bg-slate-100" />
          </div>
          <div className="h-10 w-10 animate-pulse rounded-full bg-slate-100" />
        </div>

        <div className="mt-5 h-11 animate-pulse rounded-full bg-rose-50" />
      </div>
    </article>
  );
}

export default function ProductCard({ product, compact = false }: ProductCardProps) {
  const badges = getProductBadges(product).slice(0, 1);
  const availability = getAvailabilityLabel(product);
  const isOutOfStock = availability === "Agotado";
  const productHref = `/producto/${product.slug}`;
  const wholesaleLabel = getWholesaleLabel(product);
  const hasWholesale = Boolean(wholesaleLabel);

  return (
    <article className="group overflow-hidden rounded-[1.5rem] bg-white shadow-sm ring-1 ring-slate-100 transition duration-300 hover:-translate-y-1 hover:shadow-xl sm:rounded-[1.75rem]">
      <Link href={productHref} className="block overflow-hidden">
        <ProductVisual
          product={product}
          compact
          showName={false}
          showBadges={false}
          className={
            compact
              ? "h-36 sm:h-44 lg:h-52"
              : "h-40 sm:h-52 lg:h-60"
          }
        />
      </Link>

      <div className="p-4 sm:p-5">
        <div className="mb-3 flex items-center justify-between gap-2">
          <div className="flex min-w-0 flex-wrap gap-1.5">
            {badges.map((badge) => (
              <span
                key={badge}
                className="rounded-xl bg-rose-50 px-3 py-1.5 text-[10px] font-black uppercase text-rose-600"
              >
                {badge}
              </span>
            ))}

            {hasWholesale && (
              <span className="rounded-xl bg-amber-50 px-3 py-1.5 text-[10px] font-black uppercase text-amber-700 ring-1 ring-amber-100">
                Mayoreo disponible
              </span>
            )}
          </div>

          <span
            className={`hidden rounded-xl px-2.5 py-1 text-[9px] font-black uppercase sm:inline-flex ${
              isOutOfStock
                ? "bg-slate-100 text-slate-500"
                : availability === "Pocas piezas"
                  ? "bg-amber-50 text-amber-700"
                  : "bg-emerald-50 text-emerald-700"
            }`}
          >
            {availability}
          </span>
        </div>

        <p className="text-[11px] font-black uppercase text-slate-400 sm:text-xs">
          {getProductDisplayLabel(product) || product.category}
        </p>

        <Link href={productHref}>
          <h3 className="mt-1.5 line-clamp-2 min-h-[2.4rem] text-base font-black leading-tight text-slate-950 transition group-hover:text-rose-500 sm:text-lg">
            {product.name}
          </h3>
        </Link>

        {!compact && (
          <p className="mt-2 line-clamp-2 text-xs leading-5 text-slate-500 sm:text-sm">
            {product.description}
          </p>
        )}

        <div className="mt-5 flex items-end justify-between gap-3">
          <div>
            <p className="text-[11px] font-bold text-slate-400">Precio</p>

            <p className="text-2xl font-black text-slate-950 sm:text-3xl">
              {formatPrice(product.price)}
            </p>
          </div>

          <Link
            href={productHref}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-700 transition hover:bg-slate-950 hover:text-white"
            aria-label={`Ver detalles de ${product.name}`}
          >
            <Eye size={17} />
          </Link>
        </div>

        <Link
          href={productHref}
          className={`mt-5 flex w-full items-center justify-center gap-2 rounded-full px-4 py-3 text-sm font-black text-white shadow-lg transition ${
            isOutOfStock
              ? "pointer-events-none bg-slate-300 shadow-none"
              : "bg-rose-500 shadow-rose-100 hover:scale-[1.02] hover:bg-rose-600"
          }`}
        >
          {isOutOfStock ? "Agotado" : "Tallas"}
          {!isOutOfStock && <ArrowRight size={16} />}
        </Link>
      </div>
    </article>
  );
}
