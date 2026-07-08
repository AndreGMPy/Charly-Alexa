"use client";

import {
  getHomepageSettings,
  saveHomepageSettings,
  type HomepageSettingsInput,
} from "@/lib/firebase-services/homepage";
import { ImageUploadField } from "@/components/admin/ImageUploadField";
import { getProducts, updateProduct } from "@/lib/firebase-services/products";
import type { FirebaseProduct, HomeSection } from "@/lib/firebase-types";
import { formatPrice } from "@/lib/products";
import { ArrowDown, ArrowUp, Home, RefreshCw, Save, Star } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

type ProductDraft = FirebaseProduct;

const defaultHomepage: HomepageSettingsInput = {
  heroTitle: "Nueva temporada para niñas y niños.",
  heroSubtitle:
    "Ropa infantil cómoda, colorida y fácil de elegir por talla, estilo y sección.",
  girlButtonText: "Ver Niña",
  boyButtonText: "Ver Niño",
  heroGirlImage: "",
  heroBoyImage: "",
  heroLooksImage: "",
  featuredProductIds: [],
};

const fieldClass =
  "w-full min-w-0 rounded-xl border border-rose-100 bg-white px-3 py-2 text-[16px] font-bold text-slate-800 outline-none transition placeholder:text-slate-300 placeholder:opacity-70 focus:border-rose-300 focus:ring-4 focus:ring-rose-100 sm:rounded-2xl sm:px-4 sm:py-3 sm:text-sm";

const labelClass = "text-xs font-black uppercase tracking-wide text-slate-500";

const homeSectionOptions: { value: Exclude<HomeSection, null>; label: string }[] =
  [
    { value: "ofertas", label: "Ofertas" },
    { value: "novedades", label: "Novedades" },
    { value: "temporada", label: "Temporada" },
  ];

export default function AdminHomePage() {
  const [settings, setSettings] =
    useState<HomepageSettingsInput>(defaultHomepage);
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

      setSettings({
        ...defaultHomepage,
        ...(homepageSettings ?? {}),
        featuredProductIds: featuredIds,
      });
      setProducts(normalizedProducts);
    } catch {
      setError("No se pudo cargar la portada.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    queueMicrotask(() => {
      void loadHome();
    });
  }, [loadHome]);

  function updateSetting<Field extends keyof HomepageSettingsInput>(
    field: Field,
    value: HomepageSettingsInput[Field]
  ) {
    setSettings((current) => ({ ...current, [field]: value }));
  }

  function updateProductDraft(id: string, data: Partial<ProductDraft>) {
    setProducts((current) =>
      current.map((product) =>
        product.id === id ? { ...product, ...data } : product
      )
    );
  }

  function toggleFeatured(product: ProductDraft) {
    const nextValue = !product.isFeatured;

    if (nextValue && featuredProducts.length >= 5) {
      toast.error("Solo puedes destacar hasta 5 productos.");
      return;
    }

    setProducts((current) => {
      const nextProducts = current.map((item) =>
        item.id === product.id
          ? {
              ...item,
              isFeatured: nextValue,
              featuredOrder: nextValue ? featuredProducts.length + 1 : 0,
              showOnHome: nextValue ? true : item.showOnHome,
              homeSection: nextValue ? "ofertas" : item.homeSection,
            }
          : item
      );
      const orderedFeatured = nextProducts
        .filter((item) => item.isFeatured)
        .sort((a, b) => a.featuredOrder - b.featuredOrder);

      return nextProducts.map((item) => {
        const featuredIndex = orderedFeatured.findIndex(
          (featured) => featured.id === item.id
        );
        return featuredIndex === -1
          ? { ...item, featuredOrder: 0 }
          : { ...item, featuredOrder: featuredIndex + 1 };
      });
    });

    toast.success("Ofertas destacadas actualizadas");
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
    toast.success("Ofertas destacadas actualizadas");
  }

  async function handleSave() {
    setError("");

    if (!settings.heroTitle.trim()) {
      setError("Agrega el título principal.");
      return;
    }

    if (featuredProducts.length > 5) {
      setError("Elige máximo 5 ofertas destacadas.");
      return;
    }

    const featuredProductIds = featuredProducts.map((product) => product.id);

    try {
      setIsSaving(true);

      await saveHomepageSettings({
        ...settings,
        heroTitle: settings.heroTitle.trim(),
        heroSubtitle: settings.heroSubtitle.trim(),
        girlButtonText: settings.girlButtonText.trim(),
        boyButtonText: settings.boyButtonText.trim(),
        heroGirlImage: settings.heroGirlImage.trim(),
        heroBoyImage: settings.heroBoyImage.trim(),
        heroLooksImage: settings.heroLooksImage.trim(),
        featuredProductIds,
      });

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

      setSettings((current) => ({ ...current, featuredProductIds }));
      toast.success("Portada guardada");
    } catch {
      setError("No se pudo guardar la portada.");
      toast.error("No se pudo guardar la portada");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <section className="space-y-4 sm:space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.22em] text-rose-500">
            Inicio
          </p>
          <h1 className="mt-1 text-xl font-black text-slate-950 sm:mt-2 sm:text-4xl">
            Portada
          </h1>
          <p className="mt-1 max-w-2xl text-sm font-medium leading-6 text-slate-500 sm:mt-2">
            Cambia el texto principal y elige qué productos aparecen primero en
            la tienda.
          </p>
        </div>

        <div className="grid gap-2 sm:flex sm:flex-wrap">
          <button
            type="button"
            onClick={() => void loadHome()}
            className="inline-flex min-h-10 items-center justify-center gap-2 rounded-full bg-white px-4 py-2 text-xs font-black text-slate-700 shadow-sm ring-1 ring-slate-100 transition hover:bg-slate-50 sm:px-5 sm:py-3 sm:text-sm"
          >
            <RefreshCw size={17} />
            Actualizar
          </button>

          <button
            type="button"
            onClick={() => void handleSave()}
            disabled={isSaving}
            className="inline-flex min-h-10 items-center justify-center gap-2 rounded-full bg-slate-950 px-4 py-2 text-xs font-black text-white shadow-sm transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-300 sm:px-6 sm:py-3 sm:text-sm"
          >
            <Save size={17} />
            {isSaving ? "Guardando" : "Guardar portada"}
          </button>
        </div>
      </div>

      {error && (
        <div className="rounded-2xl bg-rose-50 px-4 py-3 text-sm font-bold text-rose-700 ring-1 ring-rose-100">
          {error}
        </div>
      )}

      <div className="rounded-[1.25rem] bg-white p-3 shadow-sm ring-1 ring-rose-100 sm:rounded-[1.75rem] sm:p-6">
        <div className="mb-5 flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-rose-50 text-rose-500 ring-1 ring-rose-100">
            <Home size={22} />
          </div>
          <div>
            <h2 className="text-lg font-black text-slate-950">
              Texto principal
            </h2>
            <p className="text-sm font-medium text-slate-500">
              {isLoading ? "Cargando portada..." : "Visible en la primera pantalla"}
            </p>
          </div>
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <div className="lg:col-span-2">
            <p className="mb-3 text-xs font-black uppercase tracking-wide text-slate-500">
              Imágenes de portada
            </p>
            <div className="grid gap-4 lg:grid-cols-3">
              <ImageUploadField
                label="Imagen sección Niña"
                value={settings.heroGirlImage}
                onChange={(url) => updateSetting("heroGirlImage", url)}
                storagePath="homepage/nina"
                helperText="Foto para la tarjeta de Niña en la portada."
              />

              <ImageUploadField
                label="Imagen sección Niño"
                value={settings.heroBoyImage}
                onChange={(url) => updateSetting("heroBoyImage", url)}
                storagePath="homepage/nino"
                helperText="Foto para la tarjeta de Niño en la portada."
              />

              <ImageUploadField
                label="Imagen looks listos"
                value={settings.heroLooksImage}
                onChange={(url) => updateSetting("heroLooksImage", url)}
                storagePath="homepage/looks"
                helperText="Foto grande de colección o temporada."
              />
            </div>
          </div>

          <label className="space-y-2 lg:col-span-2">
            <span className={labelClass}>Título principal del hero</span>
            <input
              value={settings.heroTitle}
              onChange={(event) =>
                updateSetting("heroTitle", event.target.value)
              }
              className={fieldClass}
              placeholder="Ej. Nueva temporada para niñas y niños."
            />
          </label>

          <label className="space-y-2 lg:col-span-2">
            <span className={labelClass}>Subtítulo del hero</span>
            <textarea
              value={settings.heroSubtitle}
              onChange={(event) =>
                updateSetting("heroSubtitle", event.target.value)
              }
              className={`${fieldClass} min-h-24 resize-none`}
              placeholder="Ej. Ropa infantil cómoda..."
            />
          </label>

          <label className="space-y-2">
            <span className={labelClass}>Texto botón Niña</span>
            <input
              value={settings.girlButtonText}
              onChange={(event) =>
                updateSetting("girlButtonText", event.target.value)
              }
              className={fieldClass}
              placeholder="Ej. Ver Niña"
            />
          </label>

          <label className="space-y-2">
            <span className={labelClass}>Texto botón Niño</span>
            <input
              value={settings.boyButtonText}
              onChange={(event) =>
                updateSetting("boyButtonText", event.target.value)
              }
              className={fieldClass}
              placeholder="Ej. Ver Niño"
            />
          </label>
        </div>
      </div>

      <div className="rounded-[1.25rem] bg-white p-3 shadow-sm ring-1 ring-rose-100 sm:rounded-[1.75rem] sm:p-6">
        <div className="mb-5 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.18em] text-rose-500">
              Productos destacados del inicio
            </p>
            <h2 className="mt-1 text-xl font-black text-slate-950">
              Ofertas destacadas
            </h2>
            <p className="mt-1 text-sm font-medium text-slate-500">
              Destaca hasta 5 productos para mostrarlos en el inicio. Usa las flechas para acomodar el orden.
            </p>
          </div>

          <div className="inline-flex w-max items-center gap-2 rounded-full bg-rose-50 px-4 py-2 text-sm font-black text-rose-600">
            <Star size={16} />
            {featuredProducts.length}/5 elegidos
          </div>
        </div>

        {products.length === 0 ? (
          <div className="rounded-2xl bg-[#fffaf5] px-4 py-5 text-sm font-bold text-slate-500 ring-1 ring-rose-100">
            Agrega productos activos para poder elegirlos en la portada.
          </div>
        ) : (
          <div className="space-y-5">
            <div className="rounded-[1.5rem] bg-[#fffaf5] p-4 ring-1 ring-rose-100">
              <h3 className="text-sm font-black text-slate-950">
                Ofertas destacadas en orden
              </h3>
              <p className="mt-1 text-xs font-semibold text-slate-500">
                Usa las flechas para acomodarlas como aparecerán en la tienda.
              </p>

              {featuredProducts.length === 0 ? (
                <div className="mt-4 rounded-2xl bg-white px-4 py-5 text-sm font-bold text-slate-500 ring-1 ring-slate-100">
                  Aún no hay ofertas destacadas. Marca productos abajo para agregarlos.
                </div>
              ) : (
                <div className="mt-4 grid gap-3">
                  {featuredProducts.map((product, index) => (
                    <article
                      key={`featured-${product.id}`}
                      className="flex flex-col gap-3 rounded-2xl bg-white p-4 ring-1 ring-slate-100 sm:flex-row sm:items-center sm:justify-between"
                    >
                      <div>
                        <p className="text-sm font-black text-slate-950">
                          {product.name}
                        </p>
                        <p className="mt-1 text-xs font-bold text-slate-400">
                          {product.category} · {product.subcategory} · {formatPrice(product.price)}
                        </p>
                      </div>

                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => moveFeaturedProduct(product, "up")}
                          disabled={index === 0}
                          className="inline-flex items-center justify-center gap-1 rounded-full bg-slate-100 px-3 py-2 text-xs font-black text-slate-700 transition hover:bg-slate-200 disabled:cursor-not-allowed disabled:text-slate-300"
                        >
                          <ArrowUp size={14} />
                          Subir
                        </button>
                        <button
                          type="button"
                          onClick={() => moveFeaturedProduct(product, "down")}
                          disabled={index === featuredProducts.length - 1}
                          className="inline-flex items-center justify-center gap-1 rounded-full bg-slate-100 px-3 py-2 text-xs font-black text-slate-700 transition hover:bg-slate-200 disabled:cursor-not-allowed disabled:text-slate-300"
                        >
                          <ArrowDown size={14} />
                          Bajar
                        </button>
                        <button
                          type="button"
                          onClick={() => toggleFeatured(product)}
                          className="inline-flex items-center justify-center rounded-full bg-rose-50 px-3 py-2 text-xs font-black text-rose-600 transition hover:bg-rose-100"
                        >
                          Quitar
                        </button>
                      </div>
                    </article>
                  ))}
                </div>
              )}
            </div>

            <div className="overflow-hidden rounded-[1.5rem] ring-1 ring-slate-100">
              <div className="hidden lg:block">
              <table className="w-full border-collapse text-left">
                <thead className="bg-[#fffaf5] text-xs font-black uppercase tracking-wide text-slate-400">
                  <tr>
                    <th className="px-5 py-4">Producto</th>
                    <th className="px-5 py-4">Precio</th>
                    <th className="px-5 py-4">Oferta destacada</th>
                    <th className="px-5 py-4">Sección inicio</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  {products.map((product) => (
                    <tr key={product.id}>
                      <td className="px-5 py-4">
                        <p className="text-sm font-black text-slate-950">
                          {product.name}
                        </p>
                        <p className="mt-1 text-xs font-bold text-slate-400">
                          {product.category} · {product.subcategory}
                        </p>
                      </td>
                      <td className="px-5 py-4 text-sm font-black text-slate-950">
                        {formatPrice(product.price)}
                      </td>
                      <td className="px-5 py-4">
                        <label className="inline-flex items-center gap-2 text-sm font-black text-slate-700">
                          <input
                            type="checkbox"
                            checked={product.isFeatured}
                            onChange={() => toggleFeatured(product)}
                            className="h-5 w-5 accent-rose-500"
                          />
                          Destacar
                        </label>
                      </td>
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={product.showOnHome}
                            onChange={() => toggleShowOnHome(product)}
                            className="h-5 w-5 accent-sky-600"
                          />
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
                            className="rounded-2xl border border-rose-100 bg-white px-3 py-2 text-sm font-bold text-slate-700 outline-none disabled:bg-slate-50 disabled:text-slate-300"
                          >
                            {homeSectionOptions.map((section) => (
                              <option key={section.value} value={section.value}>
                                {section.label}
                              </option>
                            ))}
                          </select>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="grid gap-3 bg-[#fffaf5] p-3 lg:hidden">
              {products.map((product) => (
                <article
                  key={`card-${product.id}`}
                  className="rounded-[1.25rem] bg-white p-4 ring-1 ring-slate-100"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h3 className="text-sm font-black text-slate-950">
                        {product.name}
                      </h3>
                      <p className="mt-1 text-xs font-bold text-slate-400">
                        {product.category} · {formatPrice(product.price)}
                      </p>
                    </div>

                    <label className="shrink-0 text-xs font-black text-slate-600">
                      <input
                        type="checkbox"
                        checked={product.isFeatured}
                        onChange={() => toggleFeatured(product)}
                        className="mr-2 h-4 w-4 align-middle accent-rose-500"
                      />
                      Destacar
                    </label>
                  </div>

                  <div className="mt-4">
                    <label className="space-y-1">
                      <span className="text-[10px] font-black uppercase text-slate-400">
                        Sección
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
                        className="w-full rounded-2xl border border-rose-100 px-3 py-2 text-sm font-bold outline-none"
                      >
                        {homeSectionOptions.map((section) => (
                          <option key={section.value} value={section.value}>
                            {section.label}
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>

                  <label className="mt-3 flex items-center justify-between rounded-2xl bg-[#fffaf5] px-3 py-2 text-sm font-black text-slate-700">
                    Mostrar en inicio
                    <input
                      type="checkbox"
                      checked={product.showOnHome}
                      onChange={() => toggleShowOnHome(product)}
                      className="h-5 w-5 accent-sky-600"
                    />
                  </label>
                </article>
              ))}
            </div>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
