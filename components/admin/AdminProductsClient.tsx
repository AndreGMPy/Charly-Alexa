"use client";

import ProductForm from "@/components/admin/ProductForm";
import ProductImageFrame from "@/components/ProductImageFrame";
import {
  createProduct,
  deleteProduct,
  getProducts,
  updateProduct,
  type ProductCreateInput,
} from "@/lib/firebase-services/products";
import type { FirebaseProduct, MainCategoryName } from "@/lib/firebase-types";
import { formatPrice } from "@/lib/products";
import {
  getSafeFirebaseActionMessage,
  logErrorInDevelopment,
} from "@/lib/safe-errors";
import {
  CheckCircle2,
  Copy,
  ImageIcon,
  MoreVertical,
  Pencil,
  Plus,
  RefreshCw,
  Trash2,
  X,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

type AdminProduct = FirebaseProduct;
type ProductFilter = "Todos" | "Activos" | "Agotados" | "Pausados";
type ProductCategoryFilter = "Todas" | MainCategoryName;

const productFilters: ProductFilter[] = [
  "Todos",
  "Activos",
  "Agotados",
  "Pausados",
];
const productCategoryFilters: ProductCategoryFilter[] = [
  "Todas",
  "Niña",
  "Niño",
  "Unisex",
];

function createSlug(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

function getStatusLabel(product: AdminProduct) {
  if (!product.isActive) return "Pausado";
  if (product.stock <= 0) return "Agotado";
  return "Visible";
}

function getStatusClass(product: AdminProduct) {
  const status = getStatusLabel(product);

  if (status === "Visible") return "bg-emerald-50 text-emerald-700";
  if (status === "Agotado") return "bg-amber-50 text-amber-700";
  return "bg-slate-100 text-slate-700";
}

function getInternalBasePrice(product: AdminProduct) {
  return product.basePrice && product.basePrice > 0
    ? product.basePrice
    : product.price;
}

function matchesProductFilter(product: AdminProduct, filter: ProductFilter) {
  if (filter === "Todos") return true;
  if (filter === "Activos") return product.isActive && product.stock > 0;
  if (filter === "Agotados") return product.stock <= 0;
  return !product.isActive;
}

function ProductImage({
  product,
  size = "compact",
}: {
  product: AdminProduct;
  size?: "compact" | "large";
}) {
  const imageUrl = product.mainImage || product.images[0] || "";
  const imageClass =
    size === "large"
      ? "h-44 w-full rounded-2xl"
      : "h-14 w-14 shrink-0 rounded-2xl";

  if (imageUrl) {
    return (
      <ProductImageFrame
        src={imageUrl}
        alt={product.name}
        className={`${imageClass} shadow-sm ring-1 ring-slate-100`}
      />
    );
  }

  return (
    <div
      className={`flex ${imageClass} items-center justify-center bg-gradient-to-br from-rose-100 via-white to-sky-100 text-slate-500 shadow-sm ring-1 ring-slate-100`}
    >
      <ImageIcon size={size === "large" ? 28 : 19} />
    </div>
  );
}

export default function AdminProductsClient() {
  const [products, setProducts] = useState<AdminProduct[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<AdminProduct | null>(
    null
  );
  const [busyProductId, setBusyProductId] = useState("");
  const [error, setError] = useState("");
  const [productFilter, setProductFilter] = useState<ProductFilter>("Todos");
  const [productCategoryFilter, setProductCategoryFilter] =
    useState<ProductCategoryFilter>("Todas");
  const [subcategoryFilter, setSubcategoryFilter] = useState("Todas");
  const [openActionsProductId, setOpenActionsProductId] = useState("");
  const [createInitialCategory, setCreateInitialCategory] =
    useState<MainCategoryName>("Niña");

  const subcategoryFilters = useMemo(() => {
    const filteredProducts =
      productCategoryFilter === "Todas"
        ? products
        : products.filter((product) => product.category === productCategoryFilter);
    const uniqueSubcategories = Array.from(
      new Set(
        filteredProducts
          .map((product) => product.subcategory)
          .filter(Boolean)
      )
    ).sort((a, b) => a.localeCompare(b, "es-MX"));

    return ["Todas", ...uniqueSubcategories];
  }, [productCategoryFilter, products]);

  const visibleProducts = useMemo(
    () =>
      products.filter((product) => {
        const matchesStatus = matchesProductFilter(product, productFilter);
        const matchesCategory =
          productCategoryFilter === "Todas" ||
          product.category === productCategoryFilter;
        const matchesSubcategory =
          subcategoryFilter === "Todas" ||
          product.subcategory === subcategoryFilter;

        return matchesStatus && matchesCategory && matchesSubcategory;
      }),
    [productCategoryFilter, productFilter, products, subcategoryFilter]
  );
  const createButtonLabel =
    productCategoryFilter === "Todas"
      ? "Agregar producto"
      : `Agregar producto de ${productCategoryFilter}`;

  const loadProducts = useCallback(async () => {
    try {
      setIsLoading(true);
      setError("");

      const firebaseProducts = await getProducts();
      setProducts(firebaseProducts);
    } catch (loadError) {
      logErrorInDevelopment("Admin products load error", loadError);
      setError(
        getSafeFirebaseActionMessage(
          loadError,
          "No se pudieron cargar los productos."
        )
      );
      setProducts([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    queueMicrotask(() => {
      void loadProducts();
    });
  }, [loadProducts]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);

    if (params.get("nuevo") === "1") {
      queueMicrotask(() => {
        setCreateInitialCategory("Niña");
        setSelectedProduct(null);
        setIsFormOpen(true);
      });
    }
  }, []);

  function openCreateForm() {
    const wasEditing = Boolean(selectedProduct);

    setCreateInitialCategory(
      productCategoryFilter === "Todas" ? "Niña" : productCategoryFilter
    );
    setSelectedProduct(null);
    setIsFormOpen((value) => wasEditing || !value);
  }

  function handleEditProduct(product: AdminProduct) {
    setSelectedProduct(product);
    setIsFormOpen(true);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function closeForm() {
    setIsFormOpen(false);
    setSelectedProduct(null);
  }

  async function handleToggleActive(product: AdminProduct) {
    const nextValue = !product.isActive;

    try {
      setBusyProductId(product.id);
      await updateProduct(product.id, {
        isActive: nextValue,
        status: nextValue ? "active" : "inactive",
      });

      setProducts((currentProducts) =>
        currentProducts.map((item) =>
          item.id === product.id
            ? {
                ...item,
                isActive: nextValue,
                status: nextValue ? "active" : "inactive",
              }
            : item
        )
      );

      toast.success(nextValue ? "Producto activo" : "Producto pausado");
    } catch {
      toast.error("No se pudo actualizar el producto");
    } finally {
      setBusyProductId("");
    }
  }

  async function handleDuplicateProduct(product: AdminProduct) {
    const copyName = `${product.name} Copia`;
    const copySlug = `${createSlug(copyName)}-${Date.now().toString(36)}`;
    const productCopy: ProductCreateInput = {
      slug: copySlug,
      name: copyName,
      description: product.description,
      longDescription: product.longDescription,
      category: product.category,
      subcategory: product.subcategory,
      price: product.price,
      ...(product.basePrice ? { basePrice: product.basePrice } : {}),
      ...(typeof product.paymentFeePercent === "number"
        ? { paymentFeePercent: product.paymentFeePercent }
        : {}),
      sizes: [...product.sizes],
      colors: [...product.colors],
      stock: product.stock,
      stockBySize: product.stockBySize.map((item) => ({ ...item })),
      images: [...product.images],
      mainImage: product.mainImage,
      isOffer: product.isOffer,
      isNew: product.isNew,
      isSeasonal: product.isSeasonal,
      isActive: product.isActive,
      isFeatured: product.isFeatured,
      featuredOrder: product.featuredOrder,
      showOnHome: product.showOnHome,
      homeSection: product.homeSection,
      status: product.status ?? (product.isActive ? "active" : "inactive"),
      wholesaleMode: product.wholesaleMode,
      wholesaleMinQuantity: product.wholesaleMinQuantity,
      wholesaleNote: product.wholesaleNote ?? "",
    };

    try {
      setBusyProductId(product.id);
      await createProduct(productCopy);
      toast.success("Producto duplicado");
      await loadProducts();
    } catch {
      toast.error("No se pudo duplicar el producto");
    } finally {
      setBusyProductId("");
    }
  }

  async function handleDeleteProduct(product: AdminProduct) {
    const shouldDelete = window.confirm(
      "¿Eliminar este producto? Esta acción no se puede deshacer."
    );

    if (!shouldDelete) return;

    try {
      setBusyProductId(product.id);
      await deleteProduct(product.id);
      setProducts((currentProducts) =>
        currentProducts.filter((item) => item.id !== product.id)
      );

      if (selectedProduct?.id === product.id) {
        closeForm();
      }

      toast.success("Producto eliminado");
    } catch {
      toast.error("No se pudo eliminar el producto");
    } finally {
      setBusyProductId("");
    }
  }

  function renderActions(
    product: AdminProduct,
    layout: "desktop" | "mobile" = "desktop"
  ) {
    const isMobile = layout === "mobile";
    const actionWrapperClass = isMobile
      ? "grid grid-cols-2 gap-2"
      : "flex flex-wrap justify-end gap-2";
    const actionButtonClass = isMobile
      ? "min-h-11 w-full px-3 py-2.5 text-xs"
      : "px-4 py-2 text-xs";

    if (isMobile) {
      const isOpen = openActionsProductId === product.id;

      return (
        <div className="space-y-2">
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => handleEditProduct(product)}
              disabled={busyProductId === product.id}
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full bg-sky-50 px-3 py-2.5 text-xs font-black text-sky-700 transition hover:bg-sky-100 disabled:cursor-not-allowed disabled:text-sky-300"
            >
              <Pencil size={15} />
              Editar
            </button>

            <button
              type="button"
              onClick={() =>
                setOpenActionsProductId((currentId) =>
                  currentId === product.id ? "" : product.id
                )
              }
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full bg-slate-100 px-3 py-2.5 text-xs font-black text-slate-700 transition hover:bg-slate-200"
            >
              <MoreVertical size={15} />
              Más acciones
            </button>
          </div>

          {isOpen && (
            <div className="grid gap-2 rounded-2xl bg-[#fffaf5] p-2 ring-1 ring-rose-100">
              <button
                type="button"
                onClick={() => void handleToggleActive(product)}
                disabled={busyProductId === product.id}
                className="inline-flex min-h-10 items-center justify-center gap-2 rounded-full bg-white px-3 py-2 text-xs font-black text-slate-700 shadow-sm ring-1 ring-slate-100 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:text-slate-400"
              >
                <CheckCircle2 size={15} />
                {product.isActive ? "Pausar" : "Activar"}
              </button>

              <button
                type="button"
                onClick={() => void handleDuplicateProduct(product)}
                disabled={busyProductId === product.id}
                aria-label={`Duplicar producto ${product.name}`}
                className="inline-flex min-h-10 items-center justify-center gap-2 rounded-full bg-white px-3 py-2 text-xs font-black text-amber-700 shadow-sm ring-1 ring-amber-100 transition hover:bg-amber-50 disabled:cursor-not-allowed disabled:text-amber-300"
              >
                <Copy size={15} />
                Duplicar
              </button>

              <button
                type="button"
                onClick={() => void handleDeleteProduct(product)}
                disabled={busyProductId === product.id}
                className="inline-flex min-h-10 items-center justify-center gap-2 rounded-full bg-rose-50 px-3 py-2 text-xs font-black text-rose-600 transition hover:bg-rose-100 disabled:cursor-not-allowed disabled:text-rose-300"
              >
                <Trash2 size={15} />
                Eliminar
              </button>
            </div>
          )}
        </div>
      );
    }

    return (
      <div className={actionWrapperClass}>
        <button
          type="button"
          onClick={() => handleEditProduct(product)}
          disabled={busyProductId === product.id}
          className={`inline-flex items-center justify-center gap-2 rounded-full bg-sky-50 font-black text-sky-700 transition hover:bg-sky-100 disabled:cursor-not-allowed disabled:text-sky-300 ${actionButtonClass}`}
        >
          <Pencil size={15} />
          Editar
        </button>

        <button
          type="button"
          onClick={() => void handleToggleActive(product)}
          disabled={busyProductId === product.id}
          className={`inline-flex items-center justify-center gap-2 rounded-full bg-slate-100 font-black text-slate-700 transition hover:bg-slate-200 disabled:cursor-not-allowed disabled:text-slate-400 ${actionButtonClass}`}
        >
          <CheckCircle2 size={15} />
          {product.isActive ? "Pausar" : "Activar"}
        </button>

        <button
          type="button"
          onClick={() => void handleDuplicateProduct(product)}
          disabled={busyProductId === product.id}
          aria-label={`Duplicar producto ${product.name}`}
          className={`inline-flex items-center justify-center gap-2 rounded-full bg-amber-50 font-black text-amber-700 transition hover:bg-amber-100 disabled:cursor-not-allowed disabled:text-amber-300 ${actionButtonClass}`}
        >
          <Copy size={15} />
          Duplicar
        </button>

        <button
          type="button"
          onClick={() => void handleDeleteProduct(product)}
          disabled={busyProductId === product.id}
          className={`inline-flex items-center justify-center gap-2 rounded-full bg-rose-50 font-black text-rose-600 transition hover:bg-rose-100 disabled:cursor-not-allowed disabled:text-rose-300 ${actionButtonClass}`}
        >
          <Trash2 size={15} />
          Eliminar
        </button>
      </div>
    );
  }

  return (
    <section className="space-y-4 sm:space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.18em] text-rose-500">
            Inventario
          </p>
          <h1 className="mt-1 text-2xl font-black text-slate-950 sm:mt-2 sm:text-4xl">
            Productos
          </h1>
          <p className="mt-1 max-w-2xl text-sm font-medium leading-6 text-slate-600 sm:mt-2">
            Agrega y edita productos de la tienda.
          </p>
        </div>

        <div className="grid gap-2 sm:flex sm:flex-wrap">
          <button
            type="button"
            onClick={() => void loadProducts()}
            className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-full bg-white px-5 py-3 text-sm font-black text-slate-700 shadow-sm ring-1 ring-slate-100 transition hover:bg-slate-50 sm:w-auto"
          >
            <RefreshCw size={17} />
            Actualizar
          </button>

          <button
            type="button"
            onClick={openCreateForm}
            className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-full bg-rose-500 px-5 py-3 text-sm font-black text-white shadow-sm transition hover:bg-rose-600 sm:w-auto"
          >
            {isFormOpen && !selectedProduct ? <X size={17} /> : <Plus size={17} />}
            {isFormOpen && !selectedProduct ? "Cerrar" : createButtonLabel}
          </button>
        </div>
      </div>

      {isFormOpen && (
        <ProductForm
          productToEdit={selectedProduct}
          initialCategory={createInitialCategory}
          onCancel={closeForm}
          onSaved={(options) => {
            if (!options?.keepOpen) {
              closeForm();
            }
            void loadProducts();
          }}
        />
      )}

      {error && (
        <div className="rounded-2xl bg-amber-50 px-4 py-3 text-sm font-bold text-amber-800 ring-1 ring-amber-100">
          {error}
        </div>
      )}

      {products.length > 0 && (
        <div className="space-y-2 rounded-[1.25rem] bg-white p-3 shadow-sm ring-1 ring-rose-100 sm:space-y-3 sm:rounded-[1.5rem]">
          <div className="-mx-1 overflow-x-auto px-1">
            <div className="flex min-w-max gap-2 sm:min-w-0 sm:flex-wrap">
              {productCategoryFilters.map((filter) => (
                <button
                  key={filter}
                  type="button"
                  onClick={() => {
                    setProductCategoryFilter(filter);
                    setSubcategoryFilter("Todas");
                  }}
                  className={`min-h-9 whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-black transition sm:min-h-10 sm:px-4 sm:py-2 ${
                    productCategoryFilter === filter
                      ? "bg-slate-950 text-white"
                      : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                  }`}
                >
                  {filter}
                </button>
              ))}
            </div>
          </div>

          {subcategoryFilters.length > 1 && (
            <div className="-mx-1 overflow-x-auto px-1">
              <div className="flex min-w-max gap-2 sm:min-w-0 sm:flex-wrap">
                {subcategoryFilters.map((filter) => (
                  <button
                    key={filter}
                    type="button"
                    onClick={() => setSubcategoryFilter(filter)}
                    className={`min-h-9 whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-black transition sm:min-h-10 sm:px-4 sm:py-2 ${
                      subcategoryFilter === filter
                        ? "bg-rose-500 text-white"
                        : "bg-rose-50 text-rose-700 ring-1 ring-rose-100 hover:bg-rose-100"
                    }`}
                  >
                    {filter}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="-mx-1 overflow-x-auto px-1">
            <div className="flex min-w-max gap-2 sm:min-w-0 sm:flex-wrap">
              {productFilters.map((filter) => (
                <button
                  key={filter}
                  type="button"
                  onClick={() => setProductFilter(filter)}
                  className={`min-h-9 whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-black transition sm:min-h-10 sm:px-4 sm:py-2 ${
                    productFilter === filter
                      ? "bg-slate-950 text-white"
                      : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                  }`}
                >
                  {filter}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {!isLoading && products.length === 0 && !error && (
        <div className="rounded-[1.75rem] border-2 border-dashed border-rose-200 bg-rose-50/60 p-8 text-center">
          <h2 className="text-2xl font-black text-slate-950">
            Todavía no hay productos
          </h2>
          <p className="mx-auto mt-2 max-w-xl text-sm font-bold leading-6 text-slate-600">
            Ya se quitaron los productos de ejemplo. Empieza agregando tus
            propios productos desde el botón “Agregar producto”.
          </p>
          <button
            type="button"
            onClick={() => {
              setSelectedProduct(null);
              setIsFormOpen(true);
            }}
            className="mt-5 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-full bg-rose-500 px-5 py-3 text-sm font-black text-white shadow-sm transition hover:bg-rose-600 sm:w-auto"
          >
            <Plus size={17} />
            Agregar primer producto
          </button>
        </div>
      )}

      {products.length > 0 && visibleProducts.length === 0 && (
        <div className="rounded-[1.75rem] border-2 border-dashed border-rose-200 bg-rose-50/60 p-8 text-center">
          <h2 className="text-2xl font-black text-slate-950">
            No hay productos en este filtro
          </h2>
          <p className="mx-auto mt-2 max-w-xl text-sm font-bold leading-6 text-slate-600">
            Cambia el filtro para ver otros productos.
          </p>
        </div>
      )}

      {visibleProducts.length > 0 && (
        <div className="hidden overflow-hidden rounded-[1.75rem] bg-white shadow-sm ring-1 ring-rose-100 lg:block">
          <table className="w-full border-collapse text-left">
            <thead className="bg-[#fffaf5] text-xs font-black uppercase tracking-wide text-slate-600">
              <tr>
                <th className="px-5 py-4">Producto</th>
                <th className="px-5 py-4">Categoría</th>
                <th className="px-5 py-4">Precio</th>
                <th className="px-5 py-4">Piezas</th>
                <th className="px-5 py-4">Estado</th>
                <th className="px-5 py-4 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {visibleProducts.map((product) => (
                <tr key={product.id}>
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-3">
                      <ProductImage product={product} />
                      <div className="min-w-0">
                        <p className="truncate text-sm font-black text-slate-950">
                          {product.name}
                        </p>
                        <p className="mt-1 text-xs font-bold text-slate-600">
                          {product.stock} pieza(s) disponibles
                        </p>
                      </div>
                    </div>
                  </td>
                  <td className="px-5 py-4 text-sm font-bold text-slate-600">
                    <div>
                      {product.category} · {product.subcategory}
                    </div>
                    {product.wholesaleMode !== "none" && (
                      <div className="mt-1 text-xs font-black text-amber-700">
                        Mayoreo {product.wholesaleMode === "surtido" ? "surtido" : "por producto"}
                      </div>
                    )}
                  </td>
                  <td className="px-5 py-4">
                    <p className="text-sm font-black text-slate-950">
                      Precio final: {formatPrice(product.price)}
                    </p>
                    <p className="mt-1 text-xs font-bold text-slate-500">
                      Precio base: {formatPrice(getInternalBasePrice(product))}
                    </p>
                  </td>
                  <td className="px-5 py-4 text-sm font-black text-slate-700">
                    {product.stock}
                  </td>
                  <td className="px-5 py-4">
                    <span
                      className={`inline-flex rounded-full px-3 py-1.5 text-xs font-black ${getStatusClass(
                        product
                      )}`}
                    >
                      {getStatusLabel(product)}
                    </span>
                  </td>
                  <td className="px-5 py-4 text-right">
                    {renderActions(product)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {isLoading && (
        <div className="rounded-2xl bg-white px-4 py-3 text-sm font-bold text-slate-600 ring-1 ring-rose-100">
          Cargando productos...
        </div>
      )}

      {visibleProducts.length > 0 && (
        <div className="grid gap-3 lg:hidden">
          {visibleProducts.map((product) => (
            <article
              key={`card-${product.id}`}
              className="rounded-[1.25rem] bg-white p-3 shadow-sm ring-1 ring-rose-100"
            >
              <div className="flex items-start gap-3">
                <ProductImage product={product} />

              <div className="min-w-0 flex-1">
                <div className="min-w-0">
                  <h2 className="line-clamp-2 text-sm font-black leading-tight text-slate-950">
                    {product.name}
                  </h2>
                  <p className="mt-1 line-clamp-1 text-xs font-bold text-slate-600">
                    {product.category} · {product.subcategory}
                  </p>
                  {product.wholesaleMode !== "none" && (
                    <p className="mt-1 text-[11px] font-black uppercase text-amber-700">
                      Mayoreo{" "}
                      {product.wholesaleMode === "surtido"
                        ? "surtido"
                        : "por producto"}
                    </p>
                  )}
                </div>
                <span
                  className={`mt-2 inline-flex shrink-0 rounded-full px-2.5 py-1 text-[11px] font-black ${getStatusClass(
                    product
                  )}`}
                >
                  {getStatusLabel(product)}
                </span>
              </div>
              </div>

              <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
                <div className="rounded-2xl bg-[#fffaf5] px-3 py-2 ring-1 ring-rose-100">
                  <p className="text-[11px] font-black uppercase text-slate-600">
                    Precio final
                  </p>
                  <p className="mt-0.5 text-sm font-black text-slate-950">
                    {formatPrice(product.price)}
                  </p>
                  <p className="mt-0.5 text-[11px] font-bold text-slate-500">
                    Precio base: {formatPrice(getInternalBasePrice(product))}
                  </p>
                </div>
                <div className="rounded-2xl bg-[#fffaf5] px-3 py-2 ring-1 ring-rose-100">
                  <p className="text-[11px] font-black uppercase text-slate-600">
                    Piezas
                  </p>
                  <p className="mt-0.5 text-sm font-black text-slate-950">
                    {product.stock}
                  </p>
                </div>
              </div>

              <div className="mt-3">{renderActions(product, "mobile")}</div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
