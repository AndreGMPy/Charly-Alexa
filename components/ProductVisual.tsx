import {
  getAvailabilityLabel,
  getProductBadges,
  getProductDisplayLabel,
  type Product,
} from "@/lib/products";
import ProductImageFrame from "@/components/ProductImageFrame";
import { Sparkles } from "lucide-react";

type ProductWithOptionalImage = Product & {
  imageUrl?: string;
  images?: string[];
  galleryImages?: string[];
};

type ProductVisualProps = {
  product: Product;
  className?: string;
  variant?: number;
  showName?: boolean;
  compact?: boolean;
  showBadges?: boolean;
};

type VisualKind =
  | "dress"
  | "party"
  | "skirt"
  | "shirt"
  | "pants"
  | "jacket"
  | "outfit"
  | "accessories"
  | "generic";

function normalizeText(text: string) {
  return text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function getVisualKind(product: Product): VisualKind {
  const text = normalizeText(
    `${product.name} ${product.category} ${product.subcategory} ${
      product.subcategories?.join(" ") ?? ""
    }`
  );

  if (text.includes("fiesta")) return "party";
  if (text.includes("vestido")) return "dress";
  if (text.includes("falda") || text.includes("short")) return "skirt";
  if (text.includes("playera") || text.includes("camisa")) return "shirt";
  if (text.includes("pantalon") || text.includes("jean")) return "pants";
  if (
    text.includes("chamarra") ||
    text.includes("sueter") ||
    text.includes("sudadera")
  ) {
    return "jacket";
  }
  if (text.includes("conjunto") || text.includes("look")) return "outfit";
  if (
    text.includes("accesorio") ||
    text.includes("moño") ||
    text.includes("mona") ||
    text.includes("gorra") ||
    text.includes("bolsa")
  ) {
    return "accessories";
  }

  return "generic";
}

function ProductIllustration({
  kind,
  category,
}: {
  kind: VisualKind;
  category: Product["category"];
}) {
  const isGirl = category === "Niña";
  const isBoy = category === "Niño";

  return (
    <div className="absolute inset-0 flex items-center justify-center overflow-hidden">
      <div className="absolute -left-10 top-8 h-32 w-32 rounded-full bg-white/35 blur-2xl" />
      <div className="absolute -right-10 bottom-8 h-40 w-40 rounded-full bg-white/35 blur-2xl" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(255,255,255,0.55),transparent_28%),radial-gradient(circle_at_80%_70%,rgba(255,255,255,0.4),transparent_30%)]" />

      <div className="relative flex h-[78%] w-[78%] max-w-[260px] items-center justify-center">
        {kind === "dress" && (
          <div className="relative h-full w-full">
            <div className="absolute left-1/2 top-[8%] h-[18%] w-[30%] -translate-x-1/2 rounded-t-[2rem] bg-rose-300 shadow-lg" />
            <div className="absolute left-[27%] top-[14%] h-[18%] w-[16%] -rotate-12 rounded-full bg-rose-200" />
            <div className="absolute right-[27%] top-[14%] h-[18%] w-[16%] rotate-12 rounded-full bg-rose-200" />
            <div className="absolute left-1/2 top-[24%] h-[56%] w-[62%] -translate-x-1/2 rounded-t-[2rem] bg-rose-400 shadow-2xl [clip-path:polygon(28%_0,72%_0,100%_100%,0_100%)]" />
            <div className="absolute left-1/2 top-[35%] h-[6%] w-[46%] -translate-x-1/2 rounded-full bg-white/70" />
            <div className="absolute left-[29%] top-[58%] h-3 w-3 rounded-full bg-white/80" />
            <div className="absolute right-[31%] top-[50%] h-2.5 w-2.5 rounded-full bg-white/80" />
          </div>
        )}

        {kind === "party" && (
          <div className="relative h-full w-full">
            <div className="absolute left-1/2 top-[7%] h-[18%] w-[32%] -translate-x-1/2 rounded-t-[2rem] bg-fuchsia-300 shadow-lg" />
            <div className="absolute left-1/2 top-[24%] h-[58%] w-[66%] -translate-x-1/2 rounded-t-[2rem] bg-fuchsia-400 shadow-2xl [clip-path:polygon(24%_0,76%_0,100%_100%,0_100%)]" />
            <div className="absolute left-1/2 top-[31%] h-[7%] w-[48%] -translate-x-1/2 rounded-full bg-white/75" />
            <div className="absolute left-[25%] top-[47%] h-3 w-3 rounded-full bg-white/80" />
            <div className="absolute left-[48%] top-[55%] h-2.5 w-2.5 rounded-full bg-white/80" />
            <div className="absolute right-[24%] top-[44%] h-3 w-3 rounded-full bg-white/80" />
            <div className="absolute right-[18%] top-[13%] text-3xl text-white/80">
              ✦
            </div>
          </div>
        )}

        {kind === "skirt" && (
          <div className="relative h-full w-full">
            <div className="absolute left-1/2 top-[8%] h-[30%] w-[46%] -translate-x-1/2 rounded-3xl bg-pink-300 shadow-xl" />
            <div className="absolute left-1/2 top-[40%] h-[36%] w-[64%] -translate-x-1/2 rounded-b-[3rem] bg-rose-400 shadow-2xl [clip-path:polygon(12%_0,88%_0,100%_100%,0_100%)]" />
            <div className="absolute left-1/2 top-[38%] h-[8%] w-[66%] -translate-x-1/2 rounded-full bg-white/75" />
            <div className="absolute left-[32%] top-[19%] h-[10%] w-[36%] rounded-full bg-white/45" />
          </div>
        )}

        {kind === "shirt" && (
          <div className="relative h-full w-full">
            <div
              className={`absolute left-1/2 top-[18%] h-[48%] w-[52%] -translate-x-1/2 rounded-3xl shadow-2xl ${
                isGirl ? "bg-rose-400" : "bg-sky-500"
              }`}
            />
            <div
              className={`absolute left-[16%] top-[21%] h-[26%] w-[26%] -rotate-12 rounded-3xl ${
                isGirl ? "bg-rose-300" : "bg-sky-400"
              }`}
            />
            <div
              className={`absolute right-[16%] top-[21%] h-[26%] w-[26%] rotate-12 rounded-3xl ${
                isGirl ? "bg-rose-300" : "bg-sky-400"
              }`}
            />
            <div className="absolute left-1/2 top-[18%] h-[14%] w-[22%] -translate-x-1/2 rounded-b-full bg-white/80" />
            <div className="absolute left-1/2 top-[39%] h-[8%] w-[32%] -translate-x-1/2 rounded-full bg-white/50" />
          </div>
        )}

        {kind === "pants" && (
          <div className="relative h-full w-full">
            <div className="absolute left-1/2 top-[13%] h-[13%] w-[54%] -translate-x-1/2 rounded-2xl bg-sky-300 shadow-lg" />
            <div className="absolute left-[27%] top-[24%] h-[58%] w-[23%] rounded-b-3xl bg-blue-500 shadow-2xl" />
            <div className="absolute right-[27%] top-[24%] h-[58%] w-[23%] rounded-b-3xl bg-blue-500 shadow-2xl" />
            <div className="absolute left-1/2 top-[25%] h-[52%] w-[4%] -translate-x-1/2 rounded-full bg-white/35" />
            <div className="absolute left-[31%] top-[30%] h-[8%] w-[14%] rounded-full bg-white/35" />
            <div className="absolute right-[31%] top-[30%] h-[8%] w-[14%] rounded-full bg-white/35" />
          </div>
        )}

        {kind === "jacket" && (
          <div className="relative h-full w-full">
            <div className="absolute left-1/2 top-[12%] h-[58%] w-[56%] -translate-x-1/2 rounded-[2rem] bg-indigo-600 shadow-2xl" />
            <div className="absolute left-[16%] top-[20%] h-[38%] w-[24%] -rotate-6 rounded-3xl bg-indigo-500" />
            <div className="absolute right-[16%] top-[20%] h-[38%] w-[24%] rotate-6 rounded-3xl bg-indigo-500" />
            <div className="absolute left-1/2 top-[12%] h-[20%] w-[25%] -translate-x-1/2 rounded-b-full bg-white/85" />
            <div className="absolute left-1/2 top-[31%] h-[38%] w-[3%] -translate-x-1/2 rounded-full bg-white/70" />
            <div className="absolute left-[42%] top-[36%] h-2.5 w-2.5 rounded-full bg-white/80" />
            <div className="absolute left-[42%] top-[48%] h-2.5 w-2.5 rounded-full bg-white/80" />
          </div>
        )}

        {kind === "outfit" && (
          <div className="relative h-full w-full">
            <div
              className={`absolute left-1/2 top-[9%] h-[36%] w-[50%] -translate-x-1/2 rounded-3xl shadow-2xl ${
                isBoy ? "bg-sky-500" : "bg-rose-400"
              }`}
            />
            <div className="absolute left-1/2 top-[9%] h-[13%] w-[20%] -translate-x-1/2 rounded-b-full bg-white/80" />
            <div className="absolute left-[30%] top-[51%] h-[30%] w-[18%] rounded-b-3xl bg-blue-500 shadow-xl" />
            <div className="absolute right-[30%] top-[51%] h-[30%] w-[18%] rounded-b-3xl bg-blue-500 shadow-xl" />
            <div className="absolute left-1/2 top-[48%] h-[9%] w-[54%] -translate-x-1/2 rounded-full bg-white/70" />
          </div>
        )}

        {kind === "accessories" && (
          <div className="relative h-full w-full">
            <div className="absolute left-[20%] top-[18%] h-[26%] w-[26%] rotate-12 rounded-[2rem] bg-rose-300 shadow-xl" />
            <div className="absolute right-[20%] top-[18%] h-[26%] w-[26%] -rotate-12 rounded-[2rem] bg-rose-300 shadow-xl" />
            <div className="absolute left-1/2 top-[26%] h-[18%] w-[18%] -translate-x-1/2 rounded-full bg-rose-500 shadow-xl" />
            <div className="absolute left-1/2 top-[52%] h-[28%] w-[46%] -translate-x-1/2 rounded-b-[2rem] rounded-t-xl bg-amber-300 shadow-2xl" />
            <div className="absolute left-1/2 top-[45%] h-[18%] w-[34%] -translate-x-1/2 rounded-t-full border-4 border-white/80" />
          </div>
        )}

        {kind === "generic" && (
          <div className="relative flex h-36 w-36 items-center justify-center rounded-[2rem] bg-white/80 text-4xl font-black text-slate-800 shadow-2xl">
            CA
          </div>
        )}
      </div>
    </div>
  );
}

export default function ProductVisual({
  product,
  className = "h-40 sm:h-60 lg:h-72",
  variant = 0,
  showName = true,
  compact = false,
  showBadges = true,
}: ProductVisualProps) {
  const currentProduct = product as ProductWithOptionalImage;

  const gradient = product.galleryGradients?.[variant] ?? product.gradient;
  const badges = getProductBadges(product).slice(0, 2);
  const availability = getAvailabilityLabel(product);
  const visualKind = getVisualKind(product);
  const hasTextOverlay = showName && !compact;

  const realImageUrl =
    currentProduct.galleryImages?.[variant] ??
    currentProduct.images?.[variant] ??
    currentProduct.imageUrl;

  return (
    <div
      className={`relative overflow-hidden ${
        realImageUrl ? "bg-[#fffaf5]" : `bg-gradient-to-br ${gradient}`
      } ${className}`}
    >
      {realImageUrl ? (
        <>
          <ProductImageFrame
            src={realImageUrl}
            alt={product.name}
            className="absolute inset-0 rounded-none"
            imageClassName="transition duration-500"
          />
          {hasTextOverlay && (
            <div className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-slate-950/60 via-slate-950/20 to-transparent" />
          )}
        </>
      ) : (
        <>
          <ProductIllustration kind={visualKind} category={product.category} />
          <div className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-slate-950/25 via-transparent to-transparent" />
        </>
      )}

      {showBadges && (
        <div className="absolute left-2.5 right-2.5 top-2.5 z-10 flex items-start justify-between gap-2 sm:left-4 sm:right-4 sm:top-4">
          <div className="flex flex-wrap gap-1.5 sm:gap-2">
            {badges.map((badge, index) => (
              <span
                key={badge}
                className={`rounded-full bg-white/92 px-2.5 py-1.5 text-[8px] font-black uppercase text-slate-700 shadow-sm backdrop-blur sm:px-3 sm:py-2 sm:text-[11px] ${
                  index > 0 ? "hidden sm:inline-flex" : ""
                }`}
              >
                {badge}
              </span>
            ))}
          </div>

          <span
            className={`shrink-0 rounded-full px-2.5 py-1.5 text-[8px] font-black uppercase shadow-sm backdrop-blur sm:px-3 sm:py-2 sm:text-[11px] ${
              availability === "Agotado"
                ? "bg-slate-100 text-slate-500"
                : availability === "Pocas piezas"
                  ? "bg-amber-50 text-amber-700"
                  : "bg-white/92 text-emerald-700"
            }`}
          >
            {availability}
          </span>
        </div>
      )}

      <div
        className={`relative z-10 flex h-full flex-col justify-end text-left ${
          compact ? "p-2.5 sm:p-3" : "p-3 sm:p-5"
        }`}
      >
        {!compact && (
          <div className="mb-2 inline-flex w-max items-center gap-1.5 rounded-full bg-white/92 px-2.5 py-1.5 text-[8px] font-black uppercase text-slate-700 shadow-sm backdrop-blur sm:px-3 sm:py-2 sm:text-[10px]">
            <Sparkles size={11} />
            {getProductDisplayLabel(product) || product.category}
          </div>
        )}

        {showName && !compact && (
          <h3 className="max-w-[13rem] text-lg font-black leading-tight text-white drop-shadow-sm sm:max-w-xs sm:text-2xl lg:text-3xl">
            {product.name}
          </h3>
        )}
      </div>
    </div>
  );
}
