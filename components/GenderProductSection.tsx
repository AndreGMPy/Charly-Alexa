"use client";

import ProductCard, { ProductCardSkeleton } from "@/components/ProductCard";
import { getSubcategoriesByCategory } from "@/lib/firebase-services/categories";
import {
  getActiveProducts,
  getCachedActiveProducts,
} from "@/lib/firebase-services/products";
import { mapFirebaseProductToProduct } from "@/lib/product-mappers";
import type { FirebaseProduct } from "@/lib/firebase-types";
import {
  categoryToSection,
  isPublicStoreProduct,
  productAppearsInSection,
  type Product,
} from "@/lib/products";
import { Filter, SlidersHorizontal, X } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

type FilterOption = string;

type GenderProductSectionProps = {
  id: string;
  title: "Niña" | "Niño";
  subtitle?: string;
  products: Product[];
  accent: "pink" | "sky";
  initialFilter?: string;
};

const girlFilters: FilterOption[] = [
  "Todos",
  "Novedades",
  "Ofertas",
  "Vestidos",
  "Conjuntos",
  "Playeras",
  "Fiesta",
  "Accesorios",
  "Chamarras",
];

const boyFilters: FilterOption[] = [
  "Todos",
  "Novedades",
  "Ofertas",
  "Conjuntos",
  "Playeras",
  "Pantalones",
  "Chamarras",
  "Accesorios",
];

const sizes = ["1", "2", "4", "6", "8", "10", "12", "14", "16"];

const colors = [
  "Todos",
  "Rosa",
  "Blanco",
  "Lila",
  "Azul",
  "Beige",
  "Verde",
  "Negro",
  "Dorado",
  "Mezclilla",
  "Gris",
];

const priceOptions = ["Todos", "Menos de $250", "$250 a $400", "Más de $400"];

function belongsToAudience(
  product: {
    category: Product["category"] | FirebaseProduct["category"];
    sections?: Product["sections"] | FirebaseProduct["sections"];
  },
  title: "Niña" | "Niño"
) {
  const section = categoryToSection(title);
  return section ? productAppearsInSection(product, section) : false;
}

function getInitialCatalogProducts(
  title: "Niña" | "Niño",
  fallbackProducts: Product[]
) {
  const cachedProducts = getCachedActiveProducts();

  if (cachedProducts.length > 0) {
    return cachedProducts
      .filter(isPublicStoreProduct)
      .filter((product) => belongsToAudience(product, title))
      .map(mapFirebaseProductToProduct);
  }

  return fallbackProducts.filter(isPublicStoreProduct);
}

export default function GenderProductSection({
  id,
  title,
  products,
  accent,
  initialFilter,
}: GenderProductSectionProps) {
  const searchParams = useSearchParams();

  const [selectedFilter, setSelectedFilter] = useState<FilterOption | null>(
    null
  );
  const [catalogProducts, setCatalogProducts] = useState(() =>
    getInitialCatalogProducts(title, products)
  );
  const [isLoadingProducts, setIsLoadingProducts] = useState(
    () => getCachedActiveProducts().length === 0 && products.length === 0
  );
  const [loadError, setLoadError] = useState(false);
  const [filters, setFilters] = useState<FilterOption[]>(
    title === "Niña" ? girlFilters : boyFilters
  );
  const [activeSize, setActiveSize] = useState("Todas");
  const [activeColor, setActiveColor] = useState("Todos");
  const [priceRange, setPriceRange] = useState("Todos");
  const [showMobileFilters, setShowMobileFilters] = useState(false);

  const filtro = searchParams.get("filtro") ?? initialFilter;
  const routeFilter =
    filtro && filters.includes(filtro as FilterOption)
      ? (filtro as FilterOption)
      : null;
  const activeFilter = selectedFilter ?? routeFilter ?? "Todos";

  const accentClasses =
    accent === "pink"
      ? {
          text: "text-rose-500",
          bg: "bg-rose-500",
          soft: "bg-rose-50",
          border: "border-rose-200",
          hover: "hover:bg-rose-50",
        }
      : {
          text: "text-sky-600",
          bg: "bg-sky-600",
          soft: "bg-sky-50",
          border: "border-sky-200",
          hover: "hover:bg-sky-50",
        };

  useEffect(() => {
    let isCurrent = true;

    async function loadProducts() {
      if (catalogProducts.length === 0) {
        setIsLoadingProducts(true);
      }

      try {
        const firebaseProducts = await getActiveProducts();
        const audienceProducts = firebaseProducts
          .filter(isPublicStoreProduct)
          .filter((product) => belongsToAudience(product, title));

        if (!isCurrent) return;

        setCatalogProducts(audienceProducts.map(mapFirebaseProductToProduct));
        setLoadError(false);
      } catch {
        if (isCurrent) {
          setLoadError(true);
        }
      } finally {
        if (isCurrent) {
          setIsLoadingProducts(false);
        }
      }
    }

    void loadProducts();

    return () => {
      isCurrent = false;
    };
  }, [catalogProducts.length, title]);

  useEffect(() => {
    let isCurrent = true;

    async function loadSubcategoryFilters() {
      try {
        const savedSubcategories = await getSubcategoriesByCategory(title, {
          activeOnly: true,
        });
        const activeNames = savedSubcategories
          .filter((subcategory) => subcategory.isActive)
          .map((subcategory) => subcategory.name)
          .filter(
            (name) =>
              name !== "Todos" && name !== "Novedades" && name !== "Ofertas"
          );

        const uniqueNames = Array.from(new Set(activeNames));

        if (!isCurrent || uniqueNames.length === 0) return;

        setFilters(["Todos", "Novedades", "Ofertas", ...uniqueNames]);
      } catch {
        // Keep fallback filters if saved subcategories are not available.
      }
    }

    void loadSubcategoryFilters();

    return () => {
      isCurrent = false;
    };
  }, [title]);

  useEffect(() => {
    if (!showMobileFilters) return;

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setShowMobileFilters(false);
      }
    };

    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", handleEscape);

    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", handleEscape);
    };
  }, [showMobileFilters]);

  const filteredProducts = useMemo(() => {
    return catalogProducts.filter((product) => {
      const matchesCategory =
        activeFilter === "Todos" ||
        (activeFilter === "Ofertas" && product.isOffer) ||
        (activeFilter === "Novedades" && product.isNew) ||
        product.subcategory === activeFilter;

      const matchesSize =
        activeSize === "Todas" || product.sizes.includes(activeSize);

      const matchesColor =
        activeColor === "Todos" || product.colors.includes(activeColor);

      const matchesPrice =
        priceRange === "Todos" ||
        (priceRange === "Menos de $250" && product.price < 250) ||
        (priceRange === "$250 a $400" &&
          product.price >= 250 &&
          product.price <= 400) ||
        (priceRange === "Más de $400" && product.price > 400);

      return matchesCategory && matchesSize && matchesColor && matchesPrice;
    });
  }, [activeColor, activeFilter, activeSize, catalogProducts, priceRange]);

  const availableColors = useMemo(() => {
    const productColors = catalogProducts.flatMap((product) => product.colors);
    const uniqueColors = Array.from(new Set(productColors)).sort((a, b) =>
      a.localeCompare(b, "es-MX")
    );

    return uniqueColors.length > 0 ? ["Todos", ...uniqueColors] : colors;
  }, [catalogProducts]);

  function clearFilters() {
    setSelectedFilter("Todos");
    setActiveSize("Todas");
    setActiveColor("Todos");
    setPriceRange("Todos");
  }

  function closeMobileFilters() {
    setShowMobileFilters(false);
  }

  const filtersContent = (
    <div className="space-y-5">
      <div>
        <h3 className="mb-3 text-[11px] font-black uppercase tracking-[0.18em] text-slate-400">
          Subcategorías
        </h3>

        <div className="grid gap-2">
          {filters.map((filter) => (
            <button
              key={filter}
              type="button"
              onClick={() => setSelectedFilter(filter)}
              className={`rounded-2xl px-4 py-3 text-left text-sm font-black transition ${
                activeFilter === filter
                  ? `${accentClasses.bg} text-white shadow-sm`
                  : `bg-white text-slate-700 ring-1 ring-slate-100 ${accentClasses.hover}`
              }`}
            >
              {filter}
            </button>
          ))}
        </div>
      </div>

      <div>
        <h3 className="mb-3 text-[11px] font-black uppercase tracking-[0.18em] text-slate-400">
          Talla
        </h3>

        <div className="flex flex-wrap gap-2">
          {["Todas", ...sizes].map((size) => (
            <button
              key={size}
              type="button"
              onClick={() => setActiveSize(size)}
              className={`rounded-full px-4 py-2 text-xs font-black transition ${
                activeSize === size
                  ? "bg-slate-950 text-white"
                  : `bg-white text-slate-700 ring-1 ring-slate-100 ${accentClasses.hover}`
              }`}
            >
              {size}
            </button>
          ))}
        </div>
      </div>

      <div>
        <h3 className="mb-3 text-[11px] font-black uppercase tracking-[0.18em] text-slate-400">
          Color
        </h3>

        <div className="flex flex-wrap gap-2">
          {availableColors.map((color) => (
            <button
              key={color}
              type="button"
              onClick={() => setActiveColor(color)}
              className={`rounded-full px-4 py-2 text-xs font-black transition ${
                activeColor === color
                  ? "bg-slate-950 text-white"
                  : `bg-white text-slate-700 ring-1 ring-slate-100 ${accentClasses.hover}`
              }`}
            >
              {color}
            </button>
          ))}
        </div>
      </div>

      <div>
        <h3 className="mb-3 text-[11px] font-black uppercase tracking-[0.18em] text-slate-400">
          Precio
        </h3>

        <div className="grid gap-2">
          {priceOptions.map((price) => (
            <button
              key={price}
              type="button"
              onClick={() => setPriceRange(price)}
              className={`rounded-2xl px-4 py-3 text-left text-sm font-black transition ${
                priceRange === price
                  ? "bg-slate-950 text-white"
                  : `bg-white text-slate-700 ring-1 ring-slate-100 ${accentClasses.hover}`
              }`}
            >
              {price}
            </button>
          ))}
        </div>
      </div>

      <button
        type="button"
        onClick={clearFilters}
        className="w-full rounded-full bg-slate-100 px-5 py-3 text-sm font-black text-slate-700 transition hover:bg-slate-200"
      >
        Limpiar filtros
      </button>
    </div>
  );

  return (
    <section id={id} className="bg-[#fffaf5] px-4 py-8 sm:px-5 sm:py-12">
      <div className="mx-auto max-w-7xl">
        <div className="mb-5 flex items-center justify-between gap-4 lg:hidden">
          <button
            type="button"
            onClick={() => setShowMobileFilters(true)}
            className="inline-flex items-center gap-2 rounded-full bg-slate-950 px-5 py-3 text-sm font-black text-white shadow-sm"
          >
            <SlidersHorizontal size={17} />
            Filtros
          </button>

          <p className="text-sm font-bold text-slate-500">
            {isLoadingProducts ? "Cargando productos..." : `${filteredProducts.length} productos`}
          </p>
        </div>

        <div className="grid gap-8 lg:grid-cols-[280px_1fr]">
          <aside className="hidden lg:block lg:sticky lg:top-28 lg:self-start">
            <div className="rounded-[2rem] bg-white/85 p-5 shadow-sm ring-1 ring-rose-100">
              <div className="mb-5 flex items-center gap-2">
                <Filter size={18} className={accentClasses.text} />
                <h3 className="text-xl font-black text-slate-950">Filtros</h3>
              </div>

              {filtersContent}
            </div>
          </aside>

          <div>
            <div className="mb-5 hidden items-center justify-between gap-4 lg:flex">
              <p className="text-sm font-bold text-slate-500">
                {isLoadingProducts ? (
                  "Cargando productos..."
                ) : (
                  <>
                    Mostrando{" "}
                    <span className="font-black text-slate-950">
                      {filteredProducts.length}
                    </span>{" "}
                    productos
                  </>
                )}
              </p>

              <div className="rounded-full bg-white px-4 py-2 text-sm font-black text-slate-500 shadow-sm ring-1 ring-slate-100">
                {activeFilter} · {activeSize} · {activeColor}
              </div>
            </div>

            {isLoadingProducts && filteredProducts.length === 0 ? (
              <div className="grid grid-cols-2 gap-3 sm:gap-5 xl:grid-cols-3">
                {Array.from({ length: 6 }).map((_, index) => (
                  <ProductCardSkeleton key={`product-skeleton-${index}`} />
                ))}
              </div>
            ) : filteredProducts.length > 0 ? (
              <div className="grid grid-cols-2 gap-3 sm:gap-5 xl:grid-cols-3">
                {filteredProducts.map((product) => (
                  <ProductCard key={product.id} product={product} />
                ))}
              </div>
            ) : (
              <div
                className={`rounded-[2rem] border-2 border-dashed ${accentClasses.border} ${accentClasses.soft} p-8 text-center`}
              >
                <h3 className="text-2xl font-black text-slate-950">
                  {loadError && catalogProducts.length === 0
                    ? "No se pudo cargar la tienda"
                    : catalogProducts.length === 0
                    ? "Todavía no hay productos"
                    : "No hay productos con esos filtros"}
                </h3>

                <p className="mt-2 text-slate-600">
                  {loadError && catalogProducts.length === 0
                    ? "No se pudo cargar la tienda. Intenta de nuevo."
                    : catalogProducts.length === 0
                    ? "Agrega productos desde el panel vendedor para que aparezcan en esta sección."
                    : "Prueba limpiando los filtros o seleccionando otra categoría."}
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {showMobileFilters && (
        <div
          className="fixed inset-0 z-[999] bg-slate-950/45 backdrop-blur-sm lg:hidden"
          onClick={closeMobileFilters}
        >
          <div
            className="h-full w-[86%] max-w-sm overflow-y-auto bg-[#fffaf5] p-5 shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="mb-6 flex items-center justify-between">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.25em] text-rose-500">
                  Catálogo
                </p>

                <h2 className="mt-1 text-2xl font-black text-slate-950">
                  Filtros
                </h2>
              </div>

              <button
                type="button"
                onClick={closeMobileFilters}
                className="rounded-full bg-white p-3 shadow-sm ring-1 ring-slate-100 transition hover:bg-rose-50"
                aria-label="Cerrar filtros"
              >
                <X size={20} />
              </button>
            </div>

            {filtersContent}
          </div>
        </div>
      )}
    </section>
  );
}
