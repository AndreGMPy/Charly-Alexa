"use client";

import {
  getHomepageSettings,
  saveHomepageFeaturedProductIds,
} from "@/lib/firebase-services/homepage";
import { getProducts, updateProduct } from "@/lib/firebase-services/products";
import type {
  FirebaseProduct,
  HomeSection,
  MainCategoryName,
} from "@/lib/firebase-types";
import {
  categoryToSection,
  formatPrice,
  getSectionLabels,
  getSubcategoryLabels,
  productAppearsInSection,
} from "@/lib/products";
import { ArrowDown, ArrowUp, RefreshCw, Save, Star } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

type ProductDraft = FirebaseProduct;
type HomeCategoryFilter = "Todas" | Exclude<MainCategoryName, "Unisex">;

const homeCategoryOptions: HomeCategoryFilter[] = ["Todas", "Niña", "Niño"];

const homeSectionOptions: { value: Exclude<HomeSection, null>; label: string }[] =
  [
    { value: "ofertas", label: "Ofertas" },
    { value: "novedades", label: "Novedades" },
    { value: "temporada", label: "Temporada" },
  ];

function getDateValue(value: ProductDraft["createdAt"]) {
  if (!value) return 0;
  if (value instanceof Date) return value.getTime();
  if (typeof value === "string") return Date.parse(value) || 0;
  if ("toDate" in value && typeof value.toDate === "function") {
    return value.toDate().getTime();
  }
  return 0;
}

export default function AdminHomePage() {
  const [activeCategory, setActiveCategory] =
    useState<HomeCategoryFilter>("Todas");
  const [products, setProducts] = useState<ProductDraft[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState("");

  const featuredProducts = useMemo(
    () =>
      products
        .filter((product) => product.isFeatured)
        .sort((a, b) => a.featuredOrder - b.featuredOrder),
    [products]
  );

  const productsByCategory = useMemo(
    () =>
      homeCategoryOptions.map((category) => ({
        category,
        products: products
          .filter((product) => {
            if (category === "Todas") return true;

            const section = categoryToSection(category);
            return section ? productAppearsInSection(product, section) : false;
          })
          .sort((a, b) => getDateValue(b.createdAt) - getDateValue(a.createdAt)),
      })),
    [products]
  );

  const activeGroup =
    productsByCategory.find((group) => group.category === activeCategory) ??
    productsByCategory[0];

  const loadHome = useCallback(async () => {
    try {
      setIsLoading(true);
      setError("");

      const [homepageSettings, productItems] = await Promise.all([
        getHomepageSettings(),
        getProducts(),
      ]);

      const activeProducts = productItems.filter((product) => product.isActive);
      const featuredIds = homepageSettings?.featuredProductIds ?? [];
      const normalizedProducts = activeProducts.map((product) => {
        const featuredIndex = featuredIds.indexOf(product.id);

        if (featuredIndex === -1) return product;

        return {
          ...product,
          isFeatured: true,
          featuredOrder: featuredIndex + 1,
          showOnHome: true,
          homeSection: product.homeSection ?? "ofertas",
        };
      });

      setProducts(normalizedProducts);
    } catch {
      setError("No se pudieron cargar los productos destacados.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    queueMicrotask(() => {
      void loadHome();
    });
  }, [loadHome]);

  function updateProductDraft(id: string, data: Partial<ProductDraft>) {
    setProducts((current) =>
      current.map((product) =>
        product.id === id ? { ...product, ...data } : product
      )
    );
  }

  function normalizeFeaturedOrder(items: ProductDraft[]) {
    const orderedFeatured = items
      .filter((item) => item.isFeatured)
      .sort((a, b) => a.featuredOrder - b.featuredOrder);

    return items.map((item) => {
      const featuredIndex = orderedFeatured.findIndex(
        (featured) => featured.id === item.id
      );
      return featuredIndex === -1
        ? { ...item, featuredOrder: 0 }
        : { ...item, featuredOrder: featuredIndex + 1 };
    });
  }

  function toggleFeatured(product: ProductDraft) {
    const nextValue = !product.isFeatured;

    if (nextValue && featuredProducts.length >= 5) {
      toast.error("Solo puedes destacar hasta 5 productos.");
      return;
    }

    setProducts((current) =>
      normalizeFeaturedOrder(
        current.map((item) =>
          item.id === product.id
            ? {
                ...item,
                isFeatured: nextValue,
                featuredOrder: nextValue ? featuredProducts.length + 1 : 0,
                showOnHome: nextValue ? true : item.showOnHome,
                homeSection: nextValue ? "ofertas" : item.homeSection,
              }
            : item
        )
      )
    );

    toast.success("Destacados actualizados");
  }

  function toggleShowOnHome(product: ProductDraft) {
    const nextValue = !product.showOnHome;

    updateProductDraft(product.id, {
      showOnHome: nextValue,
      homeSection: nextValue ? product.homeSection ?? "novedades" : null,
    });
  }

  function moveFeaturedProduct(product: ProductDraft, direction: "up" | "down") {
    const currentIndex = featuredProducts.findIndex(
      (item) => item.id === product.id
    );
    const nextIndex = direction === "up" ? currentIndex - 1 : currentIndex + 1;

    if (
      currentIndex < 0 ||
      nextIndex < 0 ||
      nextIndex >= featuredProducts.length
    ) {
      return;
    }

    const reorderedFeatured = [...featuredProducts];
    const [movedProduct] = reorderedFeatured.splice(currentIndex, 1);
    reorderedFeatured.splice(nextIndex, 0, movedProduct);

    setProducts((current) =>
      current.map((item) => {
        const featuredIndex = reorderedFeatured.findIndex(
          (featured) => featured.id === item.id
        );
        return featuredIndex === -1
          ? item
          : { ...item, featuredOrder: featuredIndex + 1 };
      })
    );
    toast.success("Orden actualizado");
  }

  async function handleSave() {
    setError("");

    if (featuredProducts.length > 5) {
      setError("Elige máximo 5 productos destacados.");
      return;
    }

    const featuredProductIds = featuredProducts.map((product) => product.id);

    try {
      setIsSaving(true);

      await saveHomepageFeaturedProductIds(featuredProductIds);

      await Promise.all(
        products.map((product) =>
          updateProduct(product.id, {
            isFeatured: product.isFeatured,
            featuredOrder: product.isFeatured
              ? featuredProducts.findIndex((item) => item.id === product.id) + 1
              : 0,
            showOnHome: product.showOnHome,
            homeSection: product.showOnHome ? product.homeSection : null,
          })
        )
      );

      toast.success("Productos destacados guardados");
    } catch {
      setError("No se pudieron guardar los destacados.");
      toast.error("No se pudieron guardar los destacados");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <section className="space-y-4 sm:space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <p className="text-xs font-black uppercase tracking-[0.22em] text-rose-500">
            Mostrar en portada
          </p>
          <h1 className="mt-1 text-xl font-black text-slate-950 sm:mt-2 sm:text-4xl">
            Productos destacados
          </h1>
          <p className="mt-1 max-w-2xl text-sm font-medium leading-6 text-slate-500 sm:mt-2">
            Elige las prendas que aparecerán primero en la portada de la
            boutique.
          </p>
        </div>

        <div className="grid gap-2 sm:flex sm:flex-wrap">
          <button
            type="button"
            onClick={() => void loadHome()}
            className="inline-flex min-h-10 items-center justify-center gap-2 rounded-full bg-white px-4 py-2 text-xs font-black text-slate-700 shadow-sm ring-1 ring-slate-100 transition hover:bg-slate-50 focus:outline-none focus:ring-4 focus:ring-rose-100 sm:px-5 sm:py-3 sm:text-sm"
          >
            <RefreshCw size={17} />
            Actualizar
          </button>

          <button
            type="button"
            onClick={() => void handleSave()}
            disabled={isSaving}
            className="inline-flex min-h-10 items-center justify-center gap-2 rounded-full bg-slate-950 px-4 py-2 text-xs font-black text-white shadow-sm transition hover:bg-slate-800 focus:outline-none focus:ring-4 focus:ring-slate-200 disabled:cursor-not-allowed disabled:bg-slate-300 sm:px-6 sm:py-3 sm:text-sm"
          >
            <Save size={17} />
            {isSaving ? "Guardando" : "Guardar destacados"}
          </button>
        </div>
      </div>

      {error && (
        <div className="rounded-2xl bg-rose-50 px-4 py-3 text-sm font-bold text-rose-700 ring-1 ring-rose-100">
          {error}
        </div>
      )}

      <div className="rounded-[1.25rem] bg-white p-3 shadow-sm ring-1 ring-rose-100 sm:rounded-[1.75rem] sm:p-6">
        <div className="mb-4 flex flex-col gap-2 sm:mb-5 sm:flex-row sm:items-end sm:justify-between">
          <div className="min-w-0">
            <p className="text-xs font-black uppercase tracking-[0.18em] text-rose-500">
              Portada
            </p>
            <h2 className="mt-1 text-lg font-black text-slate-950 sm:text-xl">
              Prendas seleccionadas
            </h2>
            <p className="mt-1 text-sm font-medium text-slate-500">
              Puedes seleccionar hasta 5 y acomodar el orden.
            </p>
          </div>

          <div className="w-max rounded-xl bg-rose-50 px-3 py-1.5 text-xs font-black text-rose-600 sm:px-4 sm:py-2 sm:text-sm">
            {featuredProducts.length}/5 elegidos
          </div>
        </div>

        {products.length === 0 ? (
          <div className="rounded-2xl bg-[#fffaf5] px-4 py-5 text-sm font-bold text-slate-500 ring-1 ring-rose-100">
            {isLoading
              ? "Cargando productos..."
              : "Agrega productos activos para poder elegir destacados."}
          </div>
        ) : (
          <div className="space-y-5">
            <div className="rounded-[1.25rem] bg-[#fffaf5] p-3 ring-1 ring-rose-100 sm:rounded-[1.5rem] sm:p-4">
              <div className="flex items-center justify-between gap-3">
                <h3 className="text-sm font-black text-slate-950">
                  Orden en portada
                </h3>
                <span className="rounded-xl bg-white px-3 py-1 text-[11px] font-black text-slate-500 ring-1 ring-rose-100">
                  {featuredProducts.length}/5
                </span>
              </div>

              {featuredProducts.length === 0 ? (
                <div className="mt-3 rounded-2xl bg-white px-4 py-4 text-sm font-bold text-slate-500 ring-1 ring-slate-100">
                  Marca productos abajo para agregarlos.
                </div>
              ) : (
                <div className="mt-3 grid gap-2 sm:gap-3">
                  {featuredProducts.map((product, index) => (
                    <article
                      key={`featured-${product.id}`}
                      className="flex min-w-0 flex-col gap-3 rounded-2xl bg-white p-3 ring-1 ring-slate-100 sm:flex-row sm:items-center sm:justify-between sm:p-4"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm font-black text-slate-950">
                          {product.name}
                        </p>
                        <p className="mt-1 truncate text-xs font-bold text-slate-400">
                          {getSectionLabels(product) || product.category} ·{" "}
                          {getSubcategoryLabels(product) ||
                            product.subcategory}{" "}
                          ·{" "}
                          {formatPrice(product.price)}
                        </p>
                      </div>

                      <div className="grid grid-cols-3 gap-2 sm:flex sm:flex-wrap">
                        <button
                          type="button"
                          onClick={() => moveFeaturedProduct(product, "up")}
                          disabled={index === 0}
                          className="inline-flex items-center justify-center gap-1 rounded-full bg-slate-100 px-3 py-2 text-xs font-black text-slate-700 transition hover:bg-slate-200 focus:outline-none focus:ring-4 focus:ring-slate-100 disabled:cursor-not-allowed disabled:text-slate-300"
                        >
                          <ArrowUp size={14} />
                          Subir
                        </button>
                        <button
                          type="button"
                          onClick={() => moveFeaturedProduct(product, "down")}
                          disabled={index === featuredProducts.length - 1}
                          className="inline-flex items-center justify-center gap-1 rounded-full bg-slate-100 px-3 py-2 text-xs font-black text-slate-700 transition hover:bg-slate-200 focus:outline-none focus:ring-4 focus:ring-slate-100 disabled:cursor-not-allowed disabled:text-slate-300"
                        >
                          <ArrowDown size={14} />
                          Bajar
                        </button>
                        <button
                          type="button"
                          onClick={() => toggleFeatured(product)}
                          className="inline-flex items-center justify-center rounded-full bg-rose-50 px-3 py-2 text-xs font-black text-rose-600 transition hover:bg-rose-100 focus:outline-none focus:ring-4 focus:ring-rose-100"
                        >
                          Quitar
                        </button>
                      </div>
                    </article>
                  ))}
                </div>
              )}
            </div>

            <div className="rounded-2xl bg-[#fffaf5] p-2 ring-1 ring-rose-100">
              <p className="px-2 pb-2 text-[11px] font-black uppercase tracking-wide text-slate-500">
                Filtra productos por categoría
              </p>
              <div className="grid grid-cols-3 gap-2">
                {homeCategoryOptions.map((category) => (
                  <button
                    key={category}
                    type="button"
                    onClick={() => setActiveCategory(category)}
                    className={`min-h-10 rounded-full px-3 py-2 text-xs font-black transition focus:outline-none focus:ring-4 focus:ring-rose-100 sm:text-sm ${
                      category === activeCategory
                        ? "bg-slate-950 text-white shadow-sm"
                        : "bg-white text-slate-600 ring-1 ring-rose-100 hover:bg-rose-50"
                    }`}
                  >
                    {category}
                  </button>
                ))}
              </div>
            </div>

            <div className="rounded-[1.25rem] bg-[#fffaf5] p-3 ring-1 ring-rose-100 sm:p-4">
              <div className="mb-3 flex min-w-0 items-center justify-between gap-3">
                <div className="min-w-0">
                  <h3 className="text-sm font-black text-slate-950">
                    {activeGroup.category}
                  </h3>
                  <p className="text-xs font-semibold text-slate-500">
                    {activeGroup.products.length} productos activos
                  </p>
                </div>
                <Star className="shrink-0 text-rose-400" size={18} />
              </div>

              {activeGroup.products.length === 0 ? (
                <div className="rounded-2xl bg-white px-4 py-4 text-sm font-bold text-slate-500 ring-1 ring-slate-100">
                  No hay productos activos en esta categoría.
                </div>
              ) : (
                <div className="grid gap-3 lg:grid-cols-2">
                  {activeGroup.products.map((product) => (
                    <article
                      key={product.id}
                      className={`min-w-0 rounded-[1.25rem] p-3 sm:p-4 ${
                        product.isFeatured
                          ? "bg-rose-50/70 ring-2 ring-rose-200"
                          : "bg-white ring-1 ring-slate-100"
                      }`}
                    >
                      <div className="flex min-w-0 items-start justify-between gap-3">
                        <div className="min-w-0">
                          <h3 className="line-clamp-2 text-sm font-black leading-tight text-slate-950">
                            {product.name}
                          </h3>
                          <p className="mt-1 truncate text-xs font-bold text-slate-400">
                            {getSubcategoryLabels(product) ||
                              product.subcategory}{" "}
                            · {formatPrice(product.price)}
                          </p>
                        </div>

                        {product.isFeatured && (
                          <span className="shrink-0 rounded-xl bg-white px-2.5 py-1 text-[10px] font-black text-rose-600 ring-1 ring-rose-100">
                            Destacado
                          </span>
                        )}
                      </div>

                      <div className="mt-3 grid grid-cols-2 gap-2">
                        <button
                          type="button"
                          onClick={() => toggleFeatured(product)}
                          className={`inline-flex min-h-9 items-center justify-center rounded-full px-3 py-2 text-xs font-black transition focus:outline-none focus:ring-4 ${
                            product.isFeatured
                              ? "bg-rose-50 text-rose-600 hover:bg-rose-100 focus:ring-rose-100"
                              : "bg-slate-950 text-white hover:bg-slate-800 focus:ring-slate-200"
                          }`}
                        >
                          {product.isFeatured ? "Quitar" : "Destacar"}
                        </button>

                        <label className="inline-flex min-h-9 items-center justify-center gap-2 rounded-xl bg-slate-50 px-3 py-2 text-xs font-black text-slate-700 ring-1 ring-slate-100">
                          Mostrar en portada
                          <input
                            type="checkbox"
                            checked={product.showOnHome}
                            onChange={() => toggleShowOnHome(product)}
                            className="h-4 w-4 accent-sky-600"
                          />
                        </label>
                      </div>

                      <label className="mt-3 block space-y-1">
                        <span className="text-[10px] font-black uppercase text-slate-400">
                          Ubicación en portada
                        </span>
                        <select
                          value={product.homeSection ?? "novedades"}
                          onChange={(event) =>
                            updateProductDraft(product.id, {
                              homeSection: event.target.value as Exclude<
                                HomeSection,
                                null
                              >,
                              showOnHome: true,
                            })
                          }
                          disabled={!product.showOnHome}
                          className="w-full rounded-2xl border border-rose-100 bg-white px-3 py-2 text-sm font-bold text-slate-700 outline-none focus:border-rose-300 focus:ring-4 focus:ring-rose-100 disabled:bg-slate-50 disabled:text-slate-300"
                        >
                          {homeSectionOptions.map((section) => (
                            <option key={section.value} value={section.value}>
                              {section.label}
                            </option>
                          ))}
                        </select>
                      </label>
                    </article>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
