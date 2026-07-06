"use client";

import { GalleryUploadField, ImageUploadField } from "@/components/admin/ImageUploadField";
import ProductVisual from "@/components/ProductVisual";
import {
  createProduct,
  updateProduct,
  type ProductCreateInput,
} from "@/lib/firebase-services/products";
import { getSubcategoriesByCategory } from "@/lib/firebase-services/categories";
import type {
  FirebaseProduct,
  FirebaseSubcategory,
  HomeSection,
  MainCategoryName,
  WholesaleMode,
} from "@/lib/firebase-types";
import { mapFirebaseProductToProduct } from "@/lib/product-mappers";
import { formatPrice } from "@/lib/products";
import {
  BadgePercent,
  ChevronDown,
  DollarSign,
  Images,
  Save,
  Shirt,
  Sparkles,
  Tags,
  WandSparkles,
  X,
} from "lucide-react";
import Link from "next/link";
import type { FormEvent, ReactNode } from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

type ProductFormProps = {
  onSaved?: (options?: { keepOpen?: boolean }) => void;
  onCancel?: () => void;
  initialCategory?: MainCategoryName;
  productToEdit?: FirebaseProduct | null;
};

type HomeSectionValue = Exclude<HomeSection, null> | "";
type StockBySizeFormValue = Record<string, string>;

type ProductFormValues = {
  name: string;
  description: string;
  longDescription: string;
  category: MainCategoryName;
  subcategory: string;
  price: string;
  basePrice: string;
  sizes: string;
  colors: string;
  stockBySize: StockBySizeFormValue;
  mainImage: string;
  images: string;
  isOffer: boolean;
  isNew: boolean;
  isSeasonal: boolean;
  isActive: boolean;
  isFeatured: boolean;
  featuredOrder: string;
  showOnHome: boolean;
  homeSection: HomeSectionValue;
  wholesaleMode: WholesaleMode;
  wholesaleMinQuantity: string;
  wholesaleNote: string;
};

type BooleanField = "isOffer" | "isNew" | "isSeasonal" | "isActive";

type ProductTemplate = {
  label: string;
  category: MainCategoryName;
  subcategory: string;
  sizes: string[];
};

const categoryOptions: MainCategoryName[] = ["Niña", "Niño", "Unisex"];

const productTemplates: ProductTemplate[] = [
  {
    label: "Vestido",
    category: "Niña",
    subcategory: "Vestidos",
    sizes: ["1", "2", "4", "6", "8", "10", "12"],
  },
  {
    label: "Conjunto",
    category: "Unisex",
    subcategory: "Conjuntos",
    sizes: ["1", "2", "4", "6", "8", "10", "12", "14"],
  },
  {
    label: "Playera",
    category: "Unisex",
    subcategory: "Playeras",
    sizes: ["2", "4", "6", "8", "10", "12", "14", "16"],
  },
  {
    label: "Pantalón",
    category: "Unisex",
    subcategory: "Pantalones",
    sizes: ["2", "4", "6", "8", "10", "12", "14", "16"],
  },
  {
    label: "Chamarra",
    category: "Unisex",
    subcategory: "Chamarras",
    sizes: ["2", "4", "6", "8", "10", "12", "14", "16"],
  },
];

const defaultSizes = ["1", "2", "4", "6", "8"];
const quickSizeOptions = ["1", "2", "4", "6", "8", "10", "12", "14", "16"];

function getInitialValues(category: MainCategoryName = "Niña"): ProductFormValues {
  return {
    name: "",
    description: "",
    longDescription: "",
    category,
    subcategory: "",
    price: "",
    basePrice: "",
    sizes: defaultSizes.join(", "),
    colors: "Rosa, Blanco",
    stockBySize: createEmptyStockBySize(defaultSizes),
    mainImage: "",
    images: "",
    isOffer: false,
    isNew: true,
    isSeasonal: false,
    isActive: true,
    isFeatured: false,
    featuredOrder: "",
    showOnHome: false,
    homeSection: "",
    wholesaleMode: "none",
    wholesaleMinQuantity: "",
    wholesaleNote: "",
  };
}

const fieldClass =
  "w-full rounded-2xl border border-rose-100 bg-white px-3 py-2.5 text-sm font-bold text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-rose-300 focus:ring-4 focus:ring-rose-100 disabled:bg-slate-50 disabled:text-slate-400 sm:px-4 sm:py-3";

const labelClass = "text-xs font-black uppercase tracking-wide text-slate-600";

const booleanFields: { field: BooleanField; label: string; helper: string }[] = [
  {
    field: "isOffer",
    label: "Oferta",
    helper: "Muestra la etiqueta de descuento.",
  },
  {
    field: "isNew",
    label: "Nuevo",
    helper: "Muestra que acaba de llegar.",
  },
  {
    field: "isSeasonal",
    label: "Temporada",
    helper: "Útil para fechas especiales.",
  },
  {
    field: "isActive",
    label: "Visible en tienda",
    helper: "Apágalo si aún no quieres venderlo.",
  },
];

const homeSections: { value: HomeSectionValue; label: string }[] = [
  { value: "", label: "Sin sección" },
  { value: "ofertas", label: "Ofertas" },
  { value: "novedades", label: "Novedades" },
  { value: "temporada", label: "Temporada" },
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

function parseList(value: string) {
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function createEmptyStockBySize(sizes: string[]) {
  return sizes.reduce<StockBySizeFormValue>((values, size) => {
    values[size] = "0";
    return values;
  }, {});
}

function normalizeStockBySize(
  stockBySize: StockBySizeFormValue,
  sizes: string[]
) {
  return sizes.reduce<StockBySizeFormValue>((values, size) => {
    values[size] = stockBySize[size] ?? "0";
    return values;
  }, {});
}

function stockBySizeToMap(product: FirebaseProduct) {
  const sizes = product.sizes.length > 0 ? product.sizes : defaultSizes;
  const stockMap = createEmptyStockBySize(sizes);

  product.stockBySize.forEach((item) => {
    if (item.size) {
      stockMap[item.size] = String(item.stock ?? 0);
    }
  });

  const hasStoredSizeStock = product.stockBySize.some(
    (item) => item.size && item.stock > 0
  );

  if (!hasStoredSizeStock && product.stock > 0 && sizes[0]) {
    stockMap[sizes[0]] = String(product.stock);
  }

  return stockMap;
}

function getStockQuantity(value: string) {
  const quantity = Number(value);
  return Number.isFinite(quantity) && quantity > 0 ? Math.floor(quantity) : 0;
}

function sumStock(stockBySize: StockBySizeFormValue, sizes: string[]) {
  return sizes.reduce(
    (total, size) => total + getStockQuantity(stockBySize[size] ?? "0"),
    0
  );
}

function productToFormValues(product: FirebaseProduct): ProductFormValues {
  const sizes = product.sizes.length > 0 ? product.sizes : defaultSizes;

  return {
    name: product.name,
    description: product.description,
    longDescription: product.longDescription,
    category: product.category,
    subcategory: product.subcategory,
    price: String(product.price || ""),
    basePrice: product.basePrice ? String(product.basePrice) : "",
    sizes: sizes.join(", "),
    colors: product.colors.join(", "),
    stockBySize: stockBySizeToMap(product),
    mainImage: product.mainImage ?? "",
    images: product.images.join(", "),
    isOffer: product.isOffer,
    isNew: product.isNew,
    isSeasonal: product.isSeasonal,
    isActive: product.isActive,
    isFeatured: product.isFeatured,
    featuredOrder: product.featuredOrder ? String(product.featuredOrder) : "",
    showOnHome: product.showOnHome,
    homeSection: product.homeSection ?? "",
    wholesaleMode: product.wholesaleMode ?? "none",
    wholesaleMinQuantity: product.wholesaleMinQuantity
      ? String(product.wholesaleMinQuantity)
      : "",
    wholesaleNote: product.wholesaleNote ?? "",
  };
}

function SectionHeader({
  eyebrow,
  title,
  description,
  icon,
}: {
  eyebrow: string;
  title: string;
  description?: string;
  icon: ReactNode;
}) {
  return (
    <div className="mb-4 flex items-start gap-3">
      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-rose-50 text-rose-500 ring-1 ring-rose-100">
        {icon}
      </span>
      <div>
        <p className="text-xs font-black uppercase tracking-[0.18em] text-rose-500">
          {eyebrow}
        </p>
        <h3 className="mt-1 text-lg font-black text-slate-950">{title}</h3>
        {description && (
          <p className="mt-1 hidden text-xs font-semibold leading-5 text-slate-600 sm:block">
            {description}
          </p>
        )}
      </div>
    </div>
  );
}

function CollapsibleBlock({
  title,
  description,
  children,
  defaultOpen = false,
}: {
  title: string;
  description?: string;
  children: ReactNode;
  defaultOpen?: boolean;
}) {
  return (
    <details
      open={defaultOpen}
      className="group rounded-2xl border border-rose-100 bg-[#fffaf5] px-4 py-3"
    >
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3">
        <span>
          <span className="block text-sm font-black text-slate-800">
            {title}
          </span>
          {description && (
            <span className="mt-1 hidden text-xs font-semibold leading-5 text-slate-600 sm:block">
              {description}
            </span>
          )}
        </span>
        <ChevronDown
          size={18}
          className="shrink-0 text-slate-400 transition group-open:rotate-180"
        />
      </summary>
      <div className="mt-4">{children}</div>
    </details>
  );
}

function HelpText({ children }: { children: ReactNode }) {
  return (
    <p className="hidden text-xs font-semibold leading-5 text-slate-600 sm:block">
      {children}
    </p>
  );
}

export default function ProductForm({
  onSaved,
  onCancel,
  initialCategory = "Niña",
  productToEdit = null,
}: ProductFormProps) {
  const [form, setForm] = useState<ProductFormValues>(() =>
    getInitialValues(initialCategory)
  );
  const [subcategories, setSubcategories] = useState<FirebaseSubcategory[]>([]);
  const [isLoadingSubcategories, setIsLoadingSubcategories] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [saveAction, setSaveAction] = useState<"close" | "addAnother">("close");
  const [error, setError] = useState("");
  const [bulkStockQuantity, setBulkStockQuantity] = useState("");
  const saveActionRef = useRef<"close" | "addAnother">("close");

  const isEditing = Boolean(productToEdit);
  const sizes = useMemo(() => parseList(form.sizes), [form.sizes]);
  const images = useMemo(() => parseList(form.images), [form.images]);
  const productPhotoUrls = useMemo(() => {
    const urls = [form.mainImage.trim(), ...images].filter(Boolean);
    return Array.from(new Set(urls));
  }, [form.mainImage, images]);
  const totalStock = useMemo(
    () => sumStock(form.stockBySize, sizes),
    [form.stockBySize, sizes]
  );
  const canWriteTemporarySubcategory =
    !isLoadingSubcategories && subcategories.length === 0;
  const previewImage = productPhotoUrls[0] || "";
  const selectedSubcategoryExists = subcategories.some(
    (item) => item.name === form.subcategory
  );

  const previewProduct = useMemo(() => {
    const product: FirebaseProduct = {
      id: productToEdit?.id ?? "preview",
      slug: createSlug(form.name) || "producto",
      name: form.name.trim() || "Nombre del producto",
      description:
        form.description.trim() || "Descripción corta para la tienda.",
      longDescription:
        form.longDescription.trim() ||
        form.description.trim() ||
        "Descripción del producto.",
      category: form.category,
      subcategory: form.subcategory.trim() || "Subcategoría",
      price: Number(form.price) || 0,
      basePrice: Number(form.basePrice) || undefined,
      sizes: sizes.length > 0 ? sizes : ["Unitalla"],
      colors: parseList(form.colors),
      stock: totalStock,
      stockBySize: sizes.map((size) => ({
        size,
        stock: getStockQuantity(form.stockBySize[size] ?? "0"),
      })),
      images: productPhotoUrls.slice(1),
      mainImage: previewImage,
      isOffer: form.isOffer,
      isNew: form.isNew,
      isSeasonal: form.isSeasonal,
      isActive: form.isActive,
      isFeatured: form.isFeatured,
      featuredOrder: Number(form.featuredOrder) || 0,
      showOnHome: form.showOnHome,
      homeSection: form.showOnHome && form.homeSection ? form.homeSection : null,
      status: form.isActive ? "active" : "inactive",
      wholesaleMode: form.wholesaleMode,
      wholesaleMinQuantity: Number(form.wholesaleMinQuantity) || 0,
      wholesaleNote: form.wholesaleNote,
      createdAt: "",
      updatedAt: "",
    };

    return mapFirebaseProductToProduct(product);
  }, [form, previewImage, productPhotoUrls, productToEdit?.id, sizes, totalStock]);

  const imageStorageFolder = useMemo(() => {
    const baseName = productToEdit?.id || createSlug(form.name) || "nuevo-producto";
    return `products/${baseName}`;
  }, [form.name, productToEdit?.id]);

  useEffect(() => {
    queueMicrotask(() => {
      setForm(
        productToEdit
          ? productToFormValues(productToEdit)
          : getInitialValues(initialCategory)
      );
      setError("");
      setShowAdvanced(false);
      setBulkStockQuantity("");
      saveActionRef.current = "close";
      setSaveAction("close");
    });
  }, [initialCategory, productToEdit]);

  useEffect(() => {
    let isCurrent = true;

    async function loadSubcategories() {
      try {
        setIsLoadingSubcategories(true);
        const items = await getSubcategoriesByCategory(form.category);
        const selectableItems = items.filter(
          (item) => item.isActive || item.name === form.subcategory
        );

        if (!isCurrent) return;

        setSubcategories(selectableItems);
        setForm((current) => {
          if (current.subcategory || selectableItems.length === 0) return current;
          return { ...current, subcategory: selectableItems[0].name };
        });
      } catch {
        if (isCurrent) {
          setSubcategories([]);
        }
      } finally {
        if (isCurrent) {
          setIsLoadingSubcategories(false);
        }
      }
    }

    void loadSubcategories();

    return () => {
      isCurrent = false;
    };
  }, [form.category, form.subcategory]);

  function updateField<Field extends keyof ProductFormValues>(
    field: Field,
    value: ProductFormValues[Field]
  ) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  function updateCategory(value: MainCategoryName) {
    setForm((current) => ({
      ...current,
      category: value,
      subcategory: "",
    }));
  }

  function updateSizes(value: string) {
    const nextSizes = parseList(value);

    setForm((current) => ({
      ...current,
      sizes: value,
      stockBySize: normalizeStockBySize(current.stockBySize, nextSizes),
    }));
  }

  function toggleQuickSize(size: string) {
    setForm((current) => {
      const currentSizes = parseList(current.sizes);
      const hasSize = currentSizes.includes(size);
      const nextSizes = hasSize
        ? currentSizes.filter((item) => item !== size)
        : [...currentSizes, size].sort(
            (a, b) => quickSizeOptions.indexOf(a) - quickSizeOptions.indexOf(b)
          );

      return {
        ...current,
        sizes: nextSizes.join(", "),
        stockBySize: normalizeStockBySize(
          {
            ...current.stockBySize,
            ...(hasSize ? { [size]: "0" } : {}),
          },
          nextSizes
        ),
      };
    });
  }

  function updateSizeStock(size: string, value: string) {
    setForm((current) => ({
      ...current,
      stockBySize: {
        ...current.stockBySize,
        [size]: value,
      },
    }));
  }

  function applyStockToAllSizes() {
    const cleanQuantity = String(getStockQuantity(bulkStockQuantity));

    setForm((current) => ({
      ...current,
      stockBySize: sizes.reduce<StockBySizeFormValue>((values, size) => {
        values[size] = cleanQuantity;
        return values;
      }, {}),
    }));
  }

  function clearStockQuantities() {
    setForm((current) => ({
      ...current,
      stockBySize: sizes.reduce<StockBySizeFormValue>((values, size) => {
        values[size] = "0";
        return values;
      }, {}),
    }));
    setBulkStockQuantity("");
  }

  function updateProductPhotos(urls: string[]) {
    const cleanUrls = Array.from(new Set(urls.map((url) => url.trim()).filter(Boolean)));

    setForm((current) => ({
      ...current,
      mainImage: cleanUrls[0] ?? "",
      images: cleanUrls.slice(1).join(", "),
    }));
  }

  function applyTemplate(template: ProductTemplate) {
    setForm((current) => ({
      ...current,
      category: template.category,
      subcategory: template.subcategory,
      sizes: template.sizes.join(", "),
      stockBySize: createEmptyStockBySize(template.sizes),
    }));
  }

  function setNextSaveAction(action: "close" | "addAnother") {
    saveActionRef.current = action;
    setSaveAction(action);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    const requestedSaveAction = saveActionRef.current;

    const price = Number(form.price);
    const basePrice = form.basePrice.trim() ? Number(form.basePrice) : undefined;
    const wholesaleMinQuantity = form.wholesaleMinQuantity.trim()
      ? Number(form.wholesaleMinQuantity)
      : 0;
    const colors = parseList(form.colors);
    const mainImage = productPhotoUrls[0] || "";
    const subcategory = form.subcategory.trim();
    const featuredOrder = Number(form.featuredOrder) || productToEdit?.featuredOrder || 0;

    if (!form.name.trim()) {
      setError("Agrega el nombre del producto.");
      return;
    }

    if (!subcategory) {
      setError("Elige una subcategoría o crea una nueva en Categorías.");
      return;
    }

    if (!Number.isFinite(price) || price <= 0) {
      setError("Agrega el precio que verá el cliente.");
      return;
    }

    if (!mainImage) {
      setError("Te falta agregar una foto principal.");
      return;
    }

    if (sizes.length === 0 || colors.length === 0) {
      setError("Agrega al menos una talla y un color.");
      return;
    }

    if (form.showOnHome && !form.homeSection) {
      setError("Elige en qué sección del inicio aparecerá.");
      return;
    }

    if (
      form.wholesaleMode !== "none" &&
      (!Number.isFinite(wholesaleMinQuantity) || wholesaleMinQuantity < 2)
    ) {
      setError("Para mayoreo agrega un mínimo de al menos 2 piezas.");
      return;
    }

    if (totalStock === 0) {
      toast("Este producto aparecerá como agotado porque no tiene piezas disponibles.");
    }

    const product: ProductCreateInput = {
      slug: createSlug(form.name),
      name: form.name.trim(),
      description: form.description.trim(),
      longDescription: form.longDescription.trim(),
      category: form.category,
      subcategory,
      price,
      ...(basePrice && Number.isFinite(basePrice) && basePrice > 0
        ? { basePrice }
        : {}),
      sizes,
      colors,
      stock: totalStock,
      stockBySize: sizes.map((size) => ({
        size,
        stock: getStockQuantity(form.stockBySize[size] ?? "0"),
      })),
      images: productPhotoUrls.slice(1),
      mainImage,
      isOffer: form.isOffer,
      isNew: form.isNew,
      isSeasonal: form.isSeasonal,
      isActive: form.isActive,
      isFeatured: form.isFeatured,
      featuredOrder: form.isFeatured ? featuredOrder : 0,
      showOnHome: form.showOnHome,
      homeSection: form.showOnHome && form.homeSection ? form.homeSection : null,
      status: form.isActive ? "active" : "inactive",
      wholesaleMode: form.wholesaleMode,
      wholesaleMinQuantity:
        form.wholesaleMode === "none" ? 0 : wholesaleMinQuantity,
      wholesaleNote:
        form.wholesaleMode === "none" ? "" : form.wholesaleNote.trim(),
    };

    try {
      setIsSaving(true);

      if (productToEdit) {
        await updateProduct(productToEdit.id, product);
        toast.success("Cambios guardados");
      } else {
        await createProduct(product);
        toast.success("Producto guardado");
        setForm(getInitialValues(initialCategory));
      }

      if (requestedSaveAction === "addAnother" && !productToEdit) {
        onSaved?.({ keepOpen: true });
      } else {
        onSaved?.();
      }
    } catch {
      setError(
        productToEdit
          ? "No se pudieron guardar los cambios. Intenta de nuevo."
          : "No se pudo guardar el producto. Intenta de nuevo."
      );
      toast.error(productToEdit ? "No se pudo editar" : "No se pudo guardar");
    } finally {
      saveActionRef.current = "close";
      setSaveAction("close");
      setIsSaving(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-[1.5rem] bg-white p-3 shadow-sm ring-1 ring-rose-100 sm:rounded-[1.75rem] sm:p-5"
    >
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.18em] text-rose-500">
            {isEditing ? "Editar" : "Nuevo producto"}
          </p>
          <h2 className="mt-1 text-xl font-black text-slate-950 sm:text-2xl">
            {isEditing ? "Editar producto" : `Agregar producto de ${form.category}`}
          </h2>
          <p className="mt-2 hidden max-w-xl text-sm font-semibold leading-6 text-slate-600 sm:block">
            Producto rápido muestra solo lo necesario para subir una prenda sin ver opciones extra.
          </p>
        </div>

        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-full bg-slate-100 px-4 py-2.5 text-sm font-black text-slate-700 transition hover:bg-slate-200 sm:w-auto"
          >
            <X size={16} />
            Cancelar
          </button>
        )}
      </div>

      <div className="mb-4 flex flex-col gap-3 rounded-2xl bg-rose-50/60 p-3 ring-1 ring-rose-100 sm:mb-5 sm:flex-row sm:items-center sm:justify-between sm:p-4">
        <div className="flex items-start gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-white text-rose-500 shadow-sm ring-1 ring-rose-100 sm:h-11 sm:w-11">
            <WandSparkles size={20} />
          </span>
          <div>
            <p className="text-sm font-black text-slate-950">Producto rápido</p>
          <p className="mt-1 hidden text-xs font-semibold leading-5 text-slate-600 sm:block">
              Foto, nombre, precio, tallas y piezas. Lo demás queda guardado en opciones avanzadas.
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setShowAdvanced((value) => !value)}
          className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-full bg-white px-4 py-2.5 text-sm font-black text-slate-700 shadow-sm ring-1 ring-rose-100 transition hover:bg-rose-100 sm:w-auto"
        >
          <ChevronDown
            size={16}
            className={`transition ${showAdvanced ? "rotate-180" : ""}`}
          />
          {showAdvanced ? "Ocultar opciones avanzadas" : "Mostrar opciones avanzadas"}
        </button>
      </div>

      <div
        className={`grid gap-5 sm:gap-6 ${
          showAdvanced ? "xl:grid-cols-[minmax(0,1fr)_320px]" : ""
        }`}
      >
        <div className="flex flex-col gap-5 sm:gap-7">
          <section className="order-2 border-t border-rose-100 pt-5">
            <SectionHeader
              eyebrow="Información básica"
              title="Datos que identifican el producto"
              description="Nombre, categoría y textos visibles para el cliente."
              icon={<Shirt size={20} />}
            />

            {showAdvanced && (
            <div className="mb-5 space-y-3 rounded-2xl bg-rose-50/60 p-4 ring-1 ring-rose-100">
              <div className="flex items-start gap-2">
                <WandSparkles className="mt-0.5 shrink-0 text-rose-500" size={17} />
                <div>
                  <p className="text-sm font-black text-slate-800">
                    Plantillas rápidas
                  </p>
                  <p className="mt-1 text-xs font-semibold leading-5 text-slate-600">
                    Elige una para llenar categoría, subcategoría y tallas disponibles.
                  </p>
                </div>
              </div>

              <div className="-mx-1 overflow-x-auto px-1">
                <div className="flex min-w-max gap-2 sm:min-w-0 sm:flex-wrap">
                  {productTemplates.map((template) => (
                    <button
                      key={template.label}
                      type="button"
                      onClick={() => applyTemplate(template)}
                      className="inline-flex min-h-10 items-center justify-center whitespace-nowrap rounded-full bg-white px-4 py-2 text-xs font-black text-slate-700 shadow-sm ring-1 ring-rose-100 transition hover:bg-rose-100 hover:text-rose-700"
                    >
                      {template.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            )}

            <div className="grid gap-4 lg:grid-cols-2">
              <label className="space-y-2">
                <span className={labelClass}>Nombre del producto</span>
                <input
                  value={form.name}
                  onChange={(event) => updateField("name", event.target.value)}
                  className={fieldClass}
                  placeholder="Vestido infantil floral"
                />
                <HelpText>Así aparecerá en la tienda y en la vista previa.</HelpText>
              </label>

              <label className="space-y-2">
                <span className={labelClass}>Categoría</span>
                <select
                  value={form.category}
                  onChange={(event) =>
                    updateCategory(event.target.value as FirebaseProduct["category"])
                  }
                  className={fieldClass}
                >
                  {categoryOptions.map((category) => (
                    <option key={category} value={category}>
                      {category}
                    </option>
                  ))}
                </select>
              </label>

              <div className="space-y-2">
                <div className="flex items-center justify-between gap-3">
                  <span className={labelClass}>Subcategoría</span>
                  <Link
                    href="/admin/categorias"
                    className="text-xs font-black text-rose-500 transition hover:text-rose-600"
                  >
                    Agregar subcategoría
                  </Link>
                </div>

                {canWriteTemporarySubcategory ? (
                  <input
                    value={form.subcategory}
                    onChange={(event) =>
                      updateField("subcategory", event.target.value)
                    }
                    className={fieldClass}
                    placeholder="Ej. Vestidos"
                  />
                ) : (
                  <select
                    value={form.subcategory}
                    onChange={(event) =>
                      updateField("subcategory", event.target.value)
                    }
                    className={fieldClass}
                    disabled={isLoadingSubcategories}
                  >
                    {isLoadingSubcategories && <option>Cargando...</option>}
                    {form.subcategory && !selectedSubcategoryExists && (
                      <option value={form.subcategory}>{form.subcategory}</option>
                    )}
                    {subcategories.map((subcategory) => (
                      <option key={subcategory.id} value={subcategory.name}>
                        {subcategory.name}
                      </option>
                    ))}
                  </select>
                )}

                <HelpText>
                  Ayuda a que el producto quede bien acomodado en la tienda.
                </HelpText>
              </div>

              {showAdvanced && (
                <>
                  <label className="space-y-2">
                    <span className={labelClass}>Colores disponibles</span>
                    <input
                      value={form.colors}
                      onChange={(event) => updateField("colors", event.target.value)}
                      className={fieldClass}
                      placeholder="Rosa, Blanco"
                    />
                    <HelpText>Escribe los colores separados por coma.</HelpText>
                  </label>

                  <label className="space-y-2 lg:col-span-2">
                    <span className={labelClass}>Descripción corta</span>
                    <textarea
                      value={form.description}
                      onChange={(event) =>
                        updateField("description", event.target.value)
                      }
                      className={`${fieldClass} min-h-24 resize-none`}
                      placeholder="Prenda cómoda para uso diario."
                    />
                  </label>

                  <label className="space-y-2 lg:col-span-2">
                    <span className={labelClass}>Descripción para detalle</span>
                    <textarea
                      value={form.longDescription}
                      onChange={(event) =>
                        updateField("longDescription", event.target.value)
                      }
                      className={`${fieldClass} min-h-24 resize-none`}
                      placeholder="Cuenta cuándo se usa, cómo queda y qué la hace especial."
                    />
                  </label>
                </>
              )}
            </div>
          </section>

          <section className="order-3 border-t border-rose-100 pt-5">
            <SectionHeader
              eyebrow="Precio y stock"
              title="Precio que verá el cliente y piezas disponibles"
              description="El stock total se calcula solo con las cantidades por talla."
              icon={<DollarSign size={20} />}
            />

            <div className="grid gap-4 lg:grid-cols-2">
              <label className="space-y-2">
                <span className={labelClass}>Precio que verá el cliente</span>
                <input
                  value={form.price}
                  onChange={(event) => updateField("price", event.target.value)}
                  className={fieldClass}
                  inputMode="decimal"
                  placeholder="329"
                />
              </label>

              <div className="space-y-2">
                <span className={labelClass}>Piezas disponibles</span>
                <div className="flex min-h-12 items-center rounded-2xl border border-rose-100 bg-slate-50 px-4 text-lg font-black text-slate-950">
                  {totalStock}
                </div>
                <HelpText>Suma automática de todas las tallas.</HelpText>
              </div>

              <label className="space-y-2 lg:col-span-2">
                <span className={labelClass}>Tallas disponibles</span>
                <div className="flex flex-wrap gap-2">
                  {quickSizeOptions.map((size) => {
                    const isSelected = sizes.includes(size);

                    return (
                      <button
                        key={size}
                        type="button"
                        onClick={() => toggleQuickSize(size)}
                        className={`min-h-10 min-w-10 rounded-full px-3 py-2 text-sm font-black transition ${
                          isSelected
                            ? "bg-slate-950 text-white"
                            : "bg-[#fffaf5] text-slate-700 ring-1 ring-rose-100 hover:bg-rose-50"
                        }`}
                      >
                        {size}
                      </button>
                    );
                  })}
                </div>
                <input
                  value={form.sizes}
                  onChange={(event) => updateSizes(event.target.value)}
                  className={fieldClass}
                  placeholder="1, 2, 4, 6, 8"
                />
                <HelpText>También puedes ajustar tallas separadas por coma.</HelpText>
              </label>
            </div>

            <div className="mt-4 space-y-3">
              <CollapsibleBlock
                title="Stock por talla"
                description="Llena cuántas piezas hay de cada talla."
                defaultOpen
              >
                {sizes.length > 0 ? (
                  <div className="space-y-4">
                    <div className="rounded-2xl bg-white p-3 ring-1 ring-rose-100">
                      <label className="space-y-2">
                        <span className={labelClass}>
                          Cantidad para todas las tallas
                        </span>
                        <input
                          value={bulkStockQuantity}
                          onChange={(event) =>
                            setBulkStockQuantity(event.target.value)
                          }
                          className={fieldClass}
                          inputMode="numeric"
                          placeholder="10"
                        />
                      </label>

                      <div className="mt-3 grid gap-2 sm:grid-cols-2">
                        <button
                          type="button"
                          onClick={applyStockToAllSizes}
                          className="inline-flex min-h-11 items-center justify-center rounded-full bg-slate-950 px-4 py-2.5 text-sm font-black text-white transition hover:bg-slate-800"
                        >
                          Aplicar a todas
                        </button>
                        <button
                          type="button"
                          onClick={clearStockQuantities}
                          className="inline-flex min-h-11 items-center justify-center rounded-full bg-slate-100 px-4 py-2.5 text-sm font-black text-slate-700 transition hover:bg-slate-200"
                        >
                          Limpiar cantidades
                        </button>
                      </div>
                    </div>

                    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                      {sizes.map((size) => (
                        <label key={size} className="space-y-2">
                          <span className={labelClass}>Talla {size}</span>
                          <input
                            value={form.stockBySize[size] ?? "0"}
                            onChange={(event) =>
                              updateSizeStock(size, event.target.value)
                            }
                            className={fieldClass}
                            inputMode="numeric"
                            placeholder="0"
                          />
                        </label>
                      ))}
                    </div>
                  </div>
                ) : (
                  <HelpText>Agrega tallas para poder llenar las piezas disponibles.</HelpText>
                )}
              </CollapsibleBlock>

              {showAdvanced && (
                <CollapsibleBlock
                  title="Precio anterior"
                  description="Úsalo solo cuando quieras mostrar rebaja."
                >
                  <label className="space-y-2">
                    <span className={labelClass}>Precio antes de la oferta</span>
                    <input
                      value={form.basePrice}
                      onChange={(event) =>
                        updateField("basePrice", event.target.value)
                      }
                      className={fieldClass}
                      inputMode="decimal"
                      placeholder="379"
                    />
                  </label>
                </CollapsibleBlock>
              )}
            </div>
          </section>

          <section className="order-1 border-t border-rose-100 pt-5">
            <SectionHeader
              eyebrow="Imágenes"
              title="Fotos del producto"
              description="La primera foto es la que más verá el cliente."
              icon={<Images size={20} />}
            />

            <ImageUploadField
              label="Foto principal del producto"
              value={form.mainImage}
              onChange={(url) => {
                const currentMainImage = form.mainImage.trim();
                const remainingPhotos = productPhotoUrls.filter(
                  (photoUrl) => photoUrl !== currentMainImage
                );
                updateProductPhotos(url ? [url, ...remainingPhotos] : remainingPhotos);
              }}
              storagePath={`${imageStorageFolder}/principal`}
              helperText="Esta foto se verá en tarjetas, detalle y vista previa."
              previewClassName="h-56"
              previewFit="contain"
            />
            <HelpText>La primera foto será la principal.</HelpText>

            {showAdvanced && (
              <div className="mt-4 space-y-3">
                <CollapsibleBlock
                  title="Galería de imágenes"
                  description="Agrega fotos extra para que el cliente vea más detalles."
                >
                  <GalleryUploadField
                    label="Fotos del producto"
                    values={productPhotoUrls}
                    onChange={updateProductPhotos}
                    storagePath={`${imageStorageFolder}/galeria`}
                    helperText="Puedes seleccionar varias fotos. Usa las flechas para acomodar el orden."
                    previewFit="contain"
                  />
                </CollapsibleBlock>

                <CollapsibleBlock
                  title="Pegar enlaces de fotos"
                  description="Solo si ya tienes una liga de imagen."
                >
                  <div className="grid gap-3 lg:grid-cols-2">
                    <label className="space-y-2">
                      <span className={labelClass}>Enlace de foto principal</span>
                      <input
                        value={form.mainImage}
                        onChange={(event) =>
                          updateField("mainImage", event.target.value)
                        }
                        className={fieldClass}
                        placeholder="https://.../foto-principal.webp"
                      />
                    </label>

                    <label className="space-y-2">
                      <span className={labelClass}>Enlaces de fotos extra</span>
                      <input
                        value={form.images}
                        onChange={(event) => updateField("images", event.target.value)}
                        className={fieldClass}
                        placeholder="https://foto1.webp, https://foto2.webp"
                      />
                    </label>
                  </div>
                </CollapsibleBlock>
              </div>
            )}
          </section>

          {showAdvanced && (
            <>
              <section className="order-4 border-t border-rose-100 pt-5">
                <SectionHeader
                  eyebrow="Opciones de venta"
                  title="Etiquetas simples para la tienda"
                  description="Activa solo lo que ayude a vender este producto."
                  icon={<Tags size={20} />}
                />

            <div className="grid gap-3 sm:grid-cols-2">
              {booleanFields.map((item) => (
                <label
                  key={item.field}
                  className="flex items-center justify-between gap-4 rounded-2xl border border-rose-100 bg-[#fffaf5] px-4 py-3"
                >
                  <span>
                    <span className="block text-sm font-black text-slate-800">
                      {item.label}
                    </span>
                    <span className="mt-1 block text-xs font-semibold leading-5 text-slate-600">
                      {item.helper}
                    </span>
                  </span>
                  <input
                    type="checkbox"
                    checked={form[item.field]}
                    onChange={(event) =>
                      updateField(item.field, event.target.checked)
                    }
                    className="h-5 w-5 shrink-0 accent-rose-500"
                  />
                </label>
              ))}
            </div>

            <div className="mt-4">
              <CollapsibleBlock
                title="Configuración avanzada"
                description="Opciones de aparición en la portada."
              >
                <div className="space-y-3">
                  <label className="flex items-center justify-between gap-4 rounded-2xl border border-rose-100 bg-white px-4 py-3">
                    <span>
                      <span className="block text-sm font-black text-slate-800">
                        Mostrar en inicio
                      </span>
                      <span className="mt-1 block text-xs font-semibold leading-5 text-slate-600">
                        Actívalo si quieres colocarlo en una sección de la portada.
                      </span>
                    </span>
                    <input
                      type="checkbox"
                      checked={form.showOnHome}
                      onChange={(event) =>
                        updateField("showOnHome", event.target.checked)
                      }
                      className="h-5 w-5 shrink-0 accent-rose-500"
                    />
                  </label>

                  <div className="grid gap-3 lg:grid-cols-2">
                    <label className="space-y-2">
                      <span className={labelClass}>Sección de la portada</span>
                      <select
                        value={form.homeSection}
                        onChange={(event) =>
                          updateField(
                            "homeSection",
                            event.target.value as HomeSectionValue
                          )
                        }
                        className={fieldClass}
                        disabled={!form.showOnHome}
                      >
                        {homeSections.map((section) => (
                          <option key={section.value || "none"} value={section.value}>
                            {section.label}
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>
                </div>
              </CollapsibleBlock>
            </div>
              </section>

              <section className="order-5 border-t border-rose-100 pt-5">
                <SectionHeader
                  eyebrow="Mayoreo"
                  title="Venta por mayoreo"
                  description="Déjalo cerrado si este producto se vende normal."
                  icon={<BadgePercent size={20} />}
                />

            <CollapsibleBlock
              title="Configurar mayoreo"
              description="Mínimo de piezas y nota que verá el cliente."
            >
              <div className="grid gap-4 lg:grid-cols-3">
                <label className="space-y-2">
                  <span className={labelClass}>Forma de mayoreo</span>
                  <select
                    value={form.wholesaleMode}
                    onChange={(event) =>
                      updateField(
                        "wholesaleMode",
                        event.target.value as WholesaleMode
                      )
                    }
                    className={fieldClass}
                  >
                    <option value="none">No aplica</option>
                    <option value="surtido">Cuenta con otros productos</option>
                    <option value="producto">Solo de este producto</option>
                  </select>
                </label>

                <label className="space-y-2">
                  <span className={labelClass}>Piezas mínimas</span>
                  <input
                    value={form.wholesaleMinQuantity}
                    onChange={(event) =>
                      updateField("wholesaleMinQuantity", event.target.value)
                    }
                    className={fieldClass}
                    inputMode="numeric"
                    placeholder="Ej. 6"
                    disabled={form.wholesaleMode === "none"}
                  />
                </label>

                <label className="space-y-2">
                  <span className={labelClass}>Mensaje para el cliente</span>
                  <input
                    value={form.wholesaleNote}
                    onChange={(event) =>
                      updateField("wholesaleNote", event.target.value)
                    }
                    className={fieldClass}
                    placeholder="Ej. Puedes combinar colores y tallas"
                    disabled={form.wholesaleMode === "none"}
                  />
                </label>
              </div>

              {form.wholesaleMode !== "none" && (
                <div className="mt-4 rounded-2xl bg-white px-4 py-3 text-xs font-bold leading-5 text-slate-600 ring-1 ring-rose-100">
                  {form.wholesaleMode === "surtido"
                    ? "Cuenta con otros productos: el mínimo se completa combinando varios productos marcados para mayoreo."
                    : "Solo de este producto: el mínimo se completa con esta prenda, aunque cambie la talla."}
                </div>
              )}
            </CollapsibleBlock>
              </section>

              <section className="order-6 border-t border-rose-100 pt-5">
                <SectionHeader
                  eyebrow="Destacados"
                  title="Ofertas destacadas"
                  description="Destaca hasta 5 productos para mostrarlos en el inicio."
                  icon={<Sparkles size={20} />}
                />

            <CollapsibleBlock
              title="Mostrar en ofertas destacadas"
              description="Activa esta opción solo para productos principales."
            >
              <div>
                <label className="flex items-center justify-between gap-4 rounded-2xl border border-rose-100 bg-white px-4 py-3">
                  <span>
                    <span className="block text-sm font-black text-slate-800">
                      Mostrar en ofertas destacadas
                    </span>
                    <span className="mt-1 block text-xs font-semibold leading-5 text-slate-600">
                      Aparece en el bloque principal de ofertas.
                    </span>
                  </span>
                  <input
                    type="checkbox"
                    checked={form.isFeatured}
                    onChange={(event) =>
                      updateField("isFeatured", event.target.checked)
                    }
                    className="h-5 w-5 shrink-0 accent-rose-500"
                  />
                </label>
              </div>
            </CollapsibleBlock>
              </section>
            </>
          )}
        </div>

        {showAdvanced && (
        <aside className="space-y-4 xl:sticky xl:top-6 xl:self-start">
          <div className="rounded-[1.5rem] bg-[#fffaf5] p-4 ring-1 ring-rose-100">
            <p className="text-xs font-black uppercase tracking-[0.18em] text-rose-500">
              Vista previa
            </p>
            <h3 className="mt-1 text-lg font-black text-slate-950">
              Así lo verá el cliente
            </h3>
            <p className="mt-1 text-xs font-semibold leading-5 text-slate-600">
              Revisa foto, precio, categoría y etiquetas antes de guardar.
            </p>

            <article className="mt-4 overflow-hidden rounded-[1.5rem] bg-white shadow-sm ring-1 ring-slate-100">
              <ProductVisual
                product={previewProduct}
                compact
                showName={false}
                showBadges={false}
                className="h-48"
              />

              <div className="p-4">
                <div className="mb-3 flex flex-wrap gap-1.5">
                  {form.isOffer && (
                    <span className="rounded-full bg-rose-50 px-3 py-1.5 text-[10px] font-black uppercase text-rose-600">
                      Oferta
                    </span>
                  )}
                  {form.isNew && (
                    <span className="rounded-full bg-emerald-50 px-3 py-1.5 text-[10px] font-black uppercase text-emerald-700">
                      Nuevo
                    </span>
                  )}
                  {form.isSeasonal && (
                    <span className="rounded-full bg-amber-50 px-3 py-1.5 text-[10px] font-black uppercase text-amber-700">
                      Temporada
                    </span>
                  )}
                </div>

                <p className="text-[11px] font-black uppercase text-slate-600">
                  {previewProduct.category} · {previewProduct.subcategory}
                </p>
                <h3 className="mt-1.5 line-clamp-2 min-h-[2.4rem] text-base font-black leading-tight text-slate-950">
                  {previewProduct.name}
                </h3>
                <div className="mt-4">
                  <p className="text-[11px] font-bold text-slate-600">Precio</p>
                  <div className="flex flex-wrap items-end gap-2">
                    <p className="text-2xl font-black text-slate-950">
                      {formatPrice(previewProduct.price)}
                    </p>
                    {previewProduct.basePrice &&
                      previewProduct.basePrice > previewProduct.price && (
                        <p className="pb-1 text-sm font-bold text-slate-500 line-through">
                          {formatPrice(previewProduct.basePrice)}
                        </p>
                      )}
                  </div>
                </div>
              </div>
            </article>
          </div>
        </aside>
        )}
      </div>

      {error && (
        <div className="mt-5 rounded-2xl bg-rose-50 px-4 py-3 text-sm font-bold text-rose-700">
          {error}
        </div>
      )}

      <div className="mt-5 flex flex-col-reverse gap-2 pb-1 sm:flex-row sm:justify-end">
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-full bg-slate-100 px-6 py-3 text-sm font-black text-slate-700 shadow-sm transition hover:bg-slate-200 sm:w-auto"
          >
            <X size={17} />
            Cancelar
          </button>
        )}

        {!isEditing && (
          <button
            type="submit"
            onClick={() => setNextSaveAction("addAnother")}
            disabled={isSaving}
            className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-full bg-white px-6 py-3 text-sm font-black text-slate-700 shadow-sm ring-1 ring-slate-100 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:text-slate-300 sm:w-auto"
          >
            <Save size={17} />
            {isSaving && saveAction === "addAnother"
              ? "Guardando"
              : "Guardar y agregar otro"}
          </button>
        )}

        <button
          type="submit"
          onClick={() => setNextSaveAction("close")}
          disabled={isSaving}
          className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-full bg-slate-950 px-6 py-3 text-sm font-black text-white shadow-sm transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-300 sm:w-auto"
        >
          <Save size={17} />
          {isSaving
            ? "Guardando"
            : isEditing
              ? "Guardar cambios"
              : "Guardar producto"}
        </button>
      </div>
    </form>
  );
}
