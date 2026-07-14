"use client";

import ProductCard from "@/components/ProductCard";
import ProductVisual from "@/components/ProductVisual";
import SizeGuideModal from "@/components/SizeGuideModal";
import {
  formatPrice,
  getAvailabilityLabel,
  getProductBadges,
  getProductDisplayLabel,
  getProductStockForColorAndSize,
  getSubcategoryLabels,
  isProductColorSizeAvailable,
  productAppearsInSection,
  type Product,
} from "@/lib/products";
import { buildWhatsAppUrlWithNumber, useSiteSettings } from "@/hooks/useSiteSettings";
import { getWholesaleLabel } from "@/lib/wholesale";
import { useCartStore } from "@/store/cart-store";
import {
  ArrowLeft,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Maximize2,
  MessageCircle,
  Minus,
  Plus,
  Ruler,
  ShieldCheck,
  ShoppingBag,
  Truck,
  X,
} from "lucide-react";
import Link from "next/link";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type PointerEvent,
} from "react";
import { toast } from "sonner";

type ProductDetailClientProps = {
  product: Product;
  relatedProducts: Product[];
};

export default function ProductDetailClient({
  product,
  relatedProducts,
}: ProductDetailClientProps) {
  const { settings } = useSiteSettings();
  const addItem = useCartStore((state) => state.addItem);

  const [selectedVisual, setSelectedVisual] = useState(0);
  const [selectedColor, setSelectedColor] = useState(product.colors[0] ?? "Sin color");
  const [selectedSize, setSelectedSize] = useState("");
  const [quantity, setQuantity] = useState(1);
  const [isSizeGuideOpen, setIsSizeGuideOpen] = useState(false);
  const [isZoomOpen, setIsZoomOpen] = useState(false);
  const zoomSwipeStartRef = useRef<{ x: number; y: number } | null>(null);
  const zoomSwipeDeltaRef = useRef({ x: 0, y: 0 });

  const availability = getAvailabilityLabel(product);
  const isOutOfStock = availability === "Agotado";
  const badges = getProductBadges(product).slice(0, 3);
  const totalVisuals = product.galleryGradients.length;
  const hasMultipleVisuals = totalVisuals > 1;
  const activeSelectedColor = product.colors.includes(selectedColor)
    ? selectedColor
    : product.colors[0] ?? "Sin color";
  const wholesaleLabel = getWholesaleLabel(product, settings.wholesaleSettings);
  const hasWholesale = Boolean(wholesaleLabel);
  const hasWholesaleRun =
    Boolean(product.wholesaleRunEnabled) &&
    Boolean(product.wholesaleRunPrice && product.wholesaleRunPrice <= product.price);
  const wholesaleRunSizes =
    product.wholesaleRunSizes && product.wholesaleRunSizes.length > 0
      ? product.wholesaleRunSizes
      : product.sizes;
  const selectedSizeStock = selectedSize
    ? getProductStockForColorAndSize(product, activeSelectedColor, selectedSize)
    : product.stock;
  const quantityLimit = Math.max(selectedSizeStock, 0);

  const addButtonLabel = isOutOfStock
    ? "Agotado"
    : selectedSize
      ? "Agregar al carrito"
      : "Seleccionar talla";

  const backHref =
    product.category === "Niño" && productAppearsInSection(product, "nino")
      ? "/nino"
      : product.category === "Niña" && productAppearsInSection(product, "nina")
        ? "/nina"
        : productAppearsInSection(product, "nina")
          ? "/nina"
          : productAppearsInSection(product, "nino")
            ? "/nino"
            : "/";

  const goToNextVisual = useCallback(() => {
    if (totalVisuals <= 1) return;
    setSelectedVisual((current) => (current + 1) % totalVisuals);
  }, [totalVisuals]);

  const goToPreviousVisual = useCallback(() => {
    if (totalVisuals <= 1) return;
    setSelectedVisual((current) =>
      current === 0 ? totalVisuals - 1 : current - 1
    );
  }, [totalVisuals]);

  function resetZoomSwipe() {
    zoomSwipeStartRef.current = null;
    zoomSwipeDeltaRef.current = { x: 0, y: 0 };
  }

  function handleZoomPointerDown(event: PointerEvent<HTMLDivElement>) {
    if (!hasMultipleVisuals || event.pointerType === "mouse") return;

    zoomSwipeStartRef.current = {
      x: event.clientX,
      y: event.clientY,
    };
    zoomSwipeDeltaRef.current = { x: 0, y: 0 };
  }

  function handleZoomPointerMove(event: PointerEvent<HTMLDivElement>) {
    if (!zoomSwipeStartRef.current) return;

    const deltaX = event.clientX - zoomSwipeStartRef.current.x;
    const deltaY = event.clientY - zoomSwipeStartRef.current.y;

    zoomSwipeDeltaRef.current = { x: deltaX, y: deltaY };

    if (Math.abs(deltaX) > 12 && Math.abs(deltaX) > Math.abs(deltaY)) {
      event.preventDefault();
    }
  }

  function handleZoomPointerUp() {
    if (!zoomSwipeStartRef.current) return;

    const { x: deltaX, y: deltaY } = zoomSwipeDeltaRef.current;
    const horizontalSwipe =
      Math.abs(deltaX) >= 40 && Math.abs(deltaX) > Math.abs(deltaY) * 1.2;

    if (horizontalSwipe) {
      if (deltaX < 0) {
        goToNextVisual();
      } else {
        goToPreviousVisual();
      }
    }

    resetZoomSwipe();
  }

  useEffect(() => {
    if (!isZoomOpen) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsZoomOpen(false);
      }

      if (event.key === "ArrowRight") {
        goToNextVisual();
      }

      if (event.key === "ArrowLeft") {
        goToPreviousVisual();
      }
    };

    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [goToNextVisual, goToPreviousVisual, isZoomOpen]);

  function requireSize() {
    if (selectedSize) return true;

    toast.error("Selecciona una talla", {
      description: "Elige una talla antes de continuar.",
    });

    return false;
  }

  function handleAddToCart() {
    if (isOutOfStock) {
      toast.error("Producto agotado", {
        description: "Este producto no está disponible por el momento.",
      });
      return;
    }

    if (!requireSize()) return;

    if (
      getProductStockForColorAndSize(product, activeSelectedColor, selectedSize) <
      quantity
    ) {
      toast.error("No hay suficientes piezas disponibles de este color y talla.");
      return;
    }

    addItem(product, { quantity, selectedColor: activeSelectedColor, selectedSize });

    toast.success("Producto agregado al carrito", {
      description: `${product.name} · ${activeSelectedColor} · Talla ${selectedSize}`,
    });
  }

  function handleAddWholesaleRun() {
    if (!hasWholesaleRun) return;

    if (isOutOfStock) {
      toast.error("Producto agotado");
      return;
    }

    const missingStock = wholesaleRunSizes.find(
      (size) => getProductStockForColorAndSize(product, activeSelectedColor, size) < 1
    );

    if (missingStock) {
      toast.error("No hay piezas suficientes para completar la corrida en este color.");
      return;
    }

    wholesaleRunSizes.forEach((size) => {
      addItem(product, {
        selectedColor: activeSelectedColor,
        selectedSize: size,
        quantity: 1,
      });
    });

    toast.success("Corrida agregada al carrito", {
      description: `${activeSelectedColor}: ${wholesaleRunSizes.join(" + ")}`,
    });
  }

  function handleWhatsAppOrder() {
    if (!requireSize()) return;

    const messageText = `Hola, quiero información de este producto:

Producto: ${product.name}
Categoría: ${product.category}
Subcategoría: ${getSubcategoryLabels(product) || product.subcategory}
Color: ${activeSelectedColor}
Talla: ${selectedSize}
Cantidad: ${quantity}
Precio: ${formatPrice(product.price)}${hasWholesale ? `
Mayoreo: ${wholesaleLabel}` : ""}

¿Está disponible para apartarlo?

Observaciones:`;

    window.open(
      buildWhatsAppUrlWithNumber(settings.whatsappInternational, messageText),
      "_blank"
    );
  }

  return (
    <>
      <SizeGuideModal
        isOpen={isSizeGuideOpen}
        onClose={() => setIsSizeGuideOpen(false)}
      />

      <main className="min-h-screen bg-[#fffaf5] pb-24 text-slate-900 lg:pb-12">
        <section className="mx-auto max-w-6xl px-4 py-3 sm:px-5 sm:py-4">
          <Link
            href={backHref}
            className="inline-flex items-center gap-2 rounded-full bg-white px-4 py-2 text-xs font-black text-slate-700 shadow-sm ring-1 ring-slate-100 transition hover:bg-slate-50 sm:text-sm"
          >
            <ArrowLeft size={16} />
            Volver al catálogo
          </Link>
        </section>

        <section className="mx-auto grid max-w-6xl gap-5 px-4 pb-8 sm:px-5 lg:grid-cols-[minmax(0,0.95fr)_minmax(360px,0.85fr)] lg:gap-7 lg:pb-10">
          <div>
            <button
              type="button"
              onClick={() => setIsZoomOpen(true)}
              className="group relative block w-full overflow-hidden rounded-[1.5rem] text-left shadow-lg ring-1 ring-slate-100 transition hover:-translate-y-0.5 hover:shadow-xl sm:rounded-[1.75rem]"
              aria-label={`Ampliar imagen de ${product.name}`}
            >
              <ProductVisual
                product={product}
                variant={selectedVisual}
                className="h-[300px] sm:h-[420px] lg:h-[500px]"
              />

              <div className="absolute bottom-3 right-3 inline-flex items-center gap-1.5 rounded-full bg-white/95 px-3 py-2 text-xs font-black text-slate-800 shadow-sm backdrop-blur transition group-hover:scale-105">
                <Maximize2 size={15} />
                Ver grande
              </div>
            </button>

            {hasMultipleVisuals && (
              <div className="mt-3 grid grid-cols-3 gap-2 sm:mt-4 sm:gap-3">
                {product.galleryGradients.map((gradient, index) => (
                  <button
                    key={`${gradient}-${index}`}
                    type="button"
                    onClick={() => setSelectedVisual(index)}
                    className={`overflow-hidden rounded-2xl border-2 bg-white transition ${
                      selectedVisual === index
                        ? "border-rose-400 shadow-sm"
                        : "border-white hover:border-rose-200"
                    }`}
                    aria-label={`Ver imagen ${index + 1} de ${product.name}`}
                  >
                    <ProductVisual
                      product={product}
                      variant={index}
                      compact
                      showName={false}
                      showBadges={false}
                      className="h-16 sm:h-24"
                    />
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="lg:pt-2">
            <div className="mb-3 flex flex-wrap gap-1.5 sm:mb-4 sm:gap-2">
              {badges.map((badge) => (
                <span
                  key={badge}
                  className="rounded-xl bg-rose-50 px-3 py-1.5 text-[10px] font-black uppercase text-rose-600 sm:px-3.5 sm:py-2 sm:text-[11px]"
                >
                  {badge}
                </span>
              ))}

              <span
                className={`rounded-xl px-3 py-1.5 text-[10px] font-black uppercase sm:px-3.5 sm:py-2 sm:text-[11px] ${
                  isOutOfStock
                    ? "bg-slate-100 text-slate-500"
                    : availability === "Pocas piezas"
                      ? "bg-amber-50 text-amber-700"
                      : "bg-white text-emerald-700"
                }`}
              >
                {availability}
              </span>
            </div>

            <p className="text-[11px] font-black uppercase text-slate-400 sm:text-xs">
              {product.brand} · {getProductDisplayLabel(product) || product.category}
            </p>

            <h1 className="mt-2 text-3xl font-black leading-[1] text-slate-950 sm:mt-3 sm:text-4xl lg:text-[2.7rem]">
              {product.name}
            </h1>

            <p className="mt-3 text-sm leading-6 text-slate-600 sm:mt-4 sm:text-base sm:leading-7">
              {product.longDescription}
            </p>

            <div className="mt-4 flex flex-wrap items-end gap-2 sm:mt-5 sm:gap-3">
              <p className="text-4xl font-black text-slate-950 sm:text-5xl">
                {formatPrice(product.price)}
              </p>
            </div>

            {hasWholesale && (
              <div className="mt-4 rounded-[1.5rem] border border-amber-100 bg-gradient-to-br from-amber-50 via-white to-rose-50 p-4 shadow-sm sm:p-5">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-[11px] font-black uppercase tracking-[0.18em] text-amber-600">
                      Mayoreo corrido disponible
                    </p>
                    <h2 className="mt-1 text-lg font-black text-slate-950">
                      Precio mayoreo: {formatPrice(product.wholesaleRunPrice ?? 0)} por pieza
                    </h2>
                    <p className="mt-1 text-xs font-semibold leading-5 text-slate-500 sm:text-sm">
                      El mayoreo corrido aplica cuando el cliente lleva 1 pieza de cada talla configurada, todas del mismo color.
                    </p>
                    <p className="mt-2 text-xs font-black text-amber-700">
                      Corrida: talla {wholesaleRunSizes.join(" + ")}
                    </p>
                    <p className="mt-1 text-xs font-bold text-amber-800">
                      Debe ser del mismo color.
                    </p>
                    {product.wholesaleNote && (
                      <p className="mt-2 text-xs font-black text-amber-700">
                        {product.wholesaleNote}
                      </p>
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={hasWholesaleRun ? handleAddWholesaleRun : handleAddToCart}
                    disabled={isOutOfStock}
                    className="inline-flex shrink-0 items-center justify-center gap-2 rounded-full bg-slate-950 px-4 py-3 text-sm font-black text-white shadow-lg shadow-slate-200 transition hover:scale-[1.02] hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-300"
                  >
                    <ShoppingBag size={17} />
                    Agregar corrida
                  </button>
                </div>
              </div>
            )}

            {isOutOfStock && (
              <div className="mt-4 rounded-2xl bg-slate-100 px-4 py-3 text-sm font-bold text-slate-600">
                Este producto no está disponible por el momento. Puedes
                consultarlo por WhatsApp para recibir alternativas similares.
              </div>
            )}

            <div className="mt-5 rounded-[1.5rem] bg-white p-4 shadow-sm ring-1 ring-slate-100 sm:rounded-[1.75rem] sm:p-5">
              <h2 className="text-base font-black">Selecciona el color</h2>
              <div className="mt-4 flex flex-wrap gap-2">
                {product.colors.map((color) => (
                  <button
                    key={color}
                    type="button"
                    onClick={() => {
                      const nextSize =
                        product.sizes.find(
                          (size) =>
                            getProductStockForColorAndSize(product, color, size) > 0
                        ) ?? "";
                      setSelectedColor(color);
                      setSelectedSize(nextSize);
                      setQuantity(1);
                    }}
                    className={`rounded-full px-4 py-2 text-xs font-black transition sm:px-4 sm:py-2.5 sm:text-sm ${
                      activeSelectedColor === color
                        ? "bg-slate-950 text-white shadow-lg"
                        : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                    }`}
                  >
                    {color}
                  </button>
                ))}
              </div>
            </div>

            <div className="mt-4 rounded-[1.5rem] bg-white p-4 shadow-sm ring-1 ring-slate-100 sm:rounded-[1.75rem] sm:p-5">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h2 className="text-base font-black">Selecciona la talla</h2>

                  <p className="mt-1 text-xs text-slate-500 sm:text-sm">
                    Tallas disponibles
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => setIsSizeGuideOpen(true)}
                  className="inline-flex shrink-0 items-center justify-center gap-1.5 rounded-full bg-rose-50 px-3 py-2 text-xs font-black text-rose-600 transition hover:bg-rose-100"
                >
                  <Ruler size={15} />
                  Guía
                </button>
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
                {product.sizes.map((size) => {
                  const isAvailable = isProductColorSizeAvailable(
                    product,
                    activeSelectedColor,
                    size
                  );

                  return (
                    <button
                      key={size}
                      type="button"
                      onClick={() => {
                        if (isAvailable) {
                          setSelectedSize(size);
                          setQuantity((value) =>
                            Math.min(
                              value,
                              getProductStockForColorAndSize(
                                product,
                                activeSelectedColor,
                                size
                              )
                            )
                          );
                        }
                      }}
                      disabled={!isAvailable}
                      className={`rounded-full px-4 py-2 text-xs font-black transition disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400 sm:px-4 sm:py-2.5 sm:text-sm ${
                        selectedSize === size
                          ? "bg-slate-950 text-white shadow-lg"
                          : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                      }`}
                    >
                      {size === "Unitalla" ? size : `Talla ${size}`}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="mt-4 rounded-[1.5rem] bg-white p-4 shadow-sm ring-1 ring-slate-100 sm:rounded-[1.75rem] sm:p-5">
              <h2 className="text-base font-black">Cantidad</h2>

              <div className="mt-3 flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={() => setQuantity((value) => Math.max(1, value - 1))}
                  className="rounded-full bg-slate-100 p-2.5 transition hover:bg-slate-200"
                  aria-label="Disminuir cantidad"
                >
                  <Minus size={16} />
                </button>

                <span className="w-10 text-center text-xl font-black">
                  {quantity}
                </span>

                <button
                  type="button"
                  onClick={() =>
                    setQuantity((value) => Math.min(quantityLimit, value + 1))
                  }
                  disabled={isOutOfStock || quantity >= quantityLimit}
                  className="rounded-full bg-slate-100 p-2.5 transition hover:bg-slate-200 disabled:cursor-not-allowed disabled:text-slate-400"
                  aria-label="Aumentar cantidad"
                >
                  <Plus size={16} />
                </button>

                <p className="text-xs font-bold text-slate-500 sm:text-sm">
                  {selectedSize
                    ? `${quantityLimit} pieza(s) disponibles`
                    : availability === "Pocas piezas"
                      ? "Quedan pocas piezas"
                      : availability}
                </p>
              </div>
            </div>

            <div className="mt-5 hidden gap-3 sm:grid sm:grid-cols-2 lg:grid">
              <button
                type="button"
                onClick={handleAddToCart}
                disabled={isOutOfStock}
                className="flex items-center justify-center gap-2 rounded-full bg-rose-500 px-5 py-3.5 text-sm font-black text-white shadow-lg shadow-rose-100 transition hover:scale-[1.02] hover:bg-rose-600 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:shadow-none"
              >
                <ShoppingBag size={18} />
                {addButtonLabel}
              </button>

              <button
                type="button"
                onClick={handleWhatsAppOrder}
                className="flex items-center justify-center gap-2 rounded-full bg-emerald-500 px-5 py-3.5 text-sm font-black text-white shadow-lg shadow-emerald-100 transition hover:scale-[1.02] hover:bg-emerald-600"
              >
                <MessageCircle size={18} />
                Consultar por WhatsApp
              </button>
            </div>

            <div className="mt-5 grid grid-cols-3 gap-2 sm:mt-6 sm:gap-3">
              <div className="rounded-2xl bg-white p-3 shadow-sm ring-1 ring-slate-100">
                <Truck className="mb-2 text-sky-500" size={18} />
                <p className="text-xs font-black sm:text-sm">Entrega</p>
                <p className="mt-1 hidden text-xs text-slate-500 sm:block">
                  Envío nacional
                </p>
              </div>

              <div className="rounded-2xl bg-white p-3 shadow-sm ring-1 ring-slate-100">
                <ShieldCheck className="mb-2 text-emerald-500" size={18} />
                <p className="text-xs font-black sm:text-sm">Segura</p>
                <p className="mt-1 hidden text-xs text-slate-500 sm:block">
                  Confirmación directa
                </p>
              </div>

              <div className="rounded-2xl bg-white p-3 shadow-sm ring-1 ring-slate-100">
                <CheckCircle2 className="mb-2 text-amber-500" size={18} />
                <p className="text-xs font-black sm:text-sm">Tallas</p>
                <p className="mt-1 hidden text-xs text-slate-500 sm:block">
                  Atención personalizada
                </p>
              </div>
            </div>
          </div>
        </section>

        {relatedProducts.length > 0 && (
          <section className="mx-auto max-w-6xl px-4 py-8 sm:px-5 sm:py-12">
            <div className="mb-5">
              <p className="text-[11px] font-black uppercase tracking-[0.22em] text-rose-500 sm:text-xs">
                También te puede gustar
              </p>

              <h2 className="mt-1.5 text-2xl font-black text-slate-950 sm:text-3xl">
                Productos relacionados
              </h2>
            </div>

            <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-3">
              {relatedProducts.slice(0, 4).map((item) => (
                <ProductCard key={item.id} product={item} compact />
              ))}
            </div>
          </section>
        )}
      </main>

      <div className="fixed inset-x-0 bottom-0 z-[850] border-t border-slate-200 bg-white/95 px-3 py-2.5 shadow-2xl backdrop-blur lg:hidden">
        <div className="mx-auto flex max-w-7xl items-center gap-2.5">
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-black text-slate-950">
              {formatPrice(product.price)}
            </p>

            <p className="truncate text-[11px] font-bold text-slate-500">
              {isOutOfStock
                ? "No disponible"
                : selectedSize
                  ? hasWholesale
                    ? `Mayoreo · ${activeSelectedColor} · Talla ${selectedSize}`
                    : `${activeSelectedColor} · Talla ${selectedSize}`
                  : "Elige una talla"}
            </p>
          </div>

          <button
            type="button"
            onClick={handleAddToCart}
            disabled={isOutOfStock}
            className="inline-flex shrink-0 items-center justify-center gap-1.5 rounded-full bg-rose-500 px-4 py-2.5 text-xs font-black text-white shadow-lg shadow-rose-100 disabled:bg-slate-300"
          >
            <ShoppingBag size={16} />
            {isOutOfStock ? "Agotado" : selectedSize ? "Agregar" : "Talla"}
          </button>
        </div>
      </div>

      {isZoomOpen && (
        <div
          className="fixed inset-0 z-[1000] bg-slate-950/85 p-3 backdrop-blur-sm sm:p-6"
          onClick={() => setIsZoomOpen(false)}
        >
          <button
            type="button"
            onClick={() => setIsZoomOpen(false)}
            className="absolute right-4 top-4 z-20 flex h-11 w-11 items-center justify-center rounded-full bg-white text-slate-950 shadow-lg transition hover:scale-105"
            aria-label="Cerrar imagen"
          >
            <X size={22} />
          </button>

          {hasMultipleVisuals && (
            <>
              <button
                type="button"
                onClick={(event) => {
                  event.stopPropagation();
                  goToPreviousVisual();
                }}
                className="absolute left-6 top-1/2 z-20 hidden h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-white/85 text-slate-950 shadow-md ring-1 ring-white/40 transition hover:scale-105 hover:bg-white sm:flex"
                aria-label="Imagen anterior"
              >
                <ChevronLeft size={22} />
              </button>

              <button
                type="button"
                onClick={(event) => {
                  event.stopPropagation();
                  goToNextVisual();
                }}
                className="absolute right-6 top-1/2 z-20 hidden h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-white/85 text-slate-950 shadow-md ring-1 ring-white/40 transition hover:scale-105 hover:bg-white sm:flex"
                aria-label="Imagen siguiente"
              >
                <ChevronRight size={22} />
              </button>
            </>
          )}

          <div
            className="mx-auto flex h-full max-w-5xl flex-col justify-center"
            onClick={(event) => event.stopPropagation()}
          >
            <div
              className="overflow-hidden rounded-[1.5rem] bg-white shadow-2xl [touch-action:pan-y] sm:rounded-[2rem]"
              onPointerDown={handleZoomPointerDown}
              onPointerMove={handleZoomPointerMove}
              onPointerUp={handleZoomPointerUp}
              onPointerCancel={resetZoomSwipe}
            >
              <ProductVisual
                product={product}
                variant={selectedVisual}
                className="h-[66vh] max-h-[680px] min-h-[360px]"
              />
            </div>

            {hasMultipleVisuals && (
              <>
                <div className="mt-3 flex items-center justify-between gap-3 rounded-2xl bg-white/10 p-2 backdrop-blur">
                  <p className="hidden truncate px-2 text-sm font-black text-white sm:block">
                    {product.name}
                  </p>

                  <div className="mx-auto flex gap-2 overflow-x-auto sm:mx-0">
                    {product.galleryGradients.map((gradient, index) => (
                      <button
                        key={`zoom-${gradient}-${index}`}
                        type="button"
                        onClick={() => setSelectedVisual(index)}
                        className={`h-14 w-20 shrink-0 overflow-hidden rounded-xl border-2 transition sm:h-16 sm:w-24 ${
                          selectedVisual === index
                            ? "border-rose-400"
                            : "border-white/40 hover:border-white"
                        }`}
                        aria-label={`Ver imagen ${index + 1}`}
                      >
                        <ProductVisual
                          product={product}
                          variant={index}
                          compact
                          showName={false}
                          showBadges={false}
                          className="h-full"
                        />
                      </button>
                    ))}
                  </div>

                  <p className="hidden px-2 text-sm font-black text-white sm:block">
                    {selectedVisual + 1}/{totalVisuals}
                  </p>
                </div>

                <p className="mt-2 text-center text-xs font-bold text-white/70">
                  <span className="sm:hidden">Desliza para ver más fotos.</span>
                  <span className="hidden sm:inline">
                    Usa flechas o miniaturas para cambiar imagen.
                  </span>
                </p>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}
