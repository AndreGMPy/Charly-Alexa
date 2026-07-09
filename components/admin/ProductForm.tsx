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
  ProductSection,
  WholesaleMode,
} from "@/lib/firebase-types";
import { mapFirebaseProductToProduct } from "@/lib/product-mappers";
import {
  calculateFinalCustomerPrice,
  DEFAULT_PAYMENT_FEE_PERCENT,
  MAX_PAYMENT_FEE_PERCENT,
  MIN_PAYMENT_FEE_PERCENT,
} from "@/lib/pricing";
import {
  categoryToSection,
  formatPrice,
  getSectionLabels,
  primaryCategoryFromSections,
  sectionOptions,
  subcategories as commonProductTypes,
} from "@/lib/products";
import { normalizeWholesaleMode } from "@/lib/wholesale";
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
  sections: ProductSection[];
  subcategory: string;
  basePrice: string;
  paymentFeePercent: string;
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
  wholesalePrice: string;
  wholesaleMinQuantity: string;
  wholesaleNote: string;
};

type BooleanField = "isOffer" | "isNew" | "isSeasonal" | "isActive";
type ProductFormStep = "photos" | "data" | "price" | "sale" | "review";

type ProductTemplate = {
  label: string;
  category: MainCategoryName;
  subcategory: string;
  sizes: string[];
};

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

function getSubcategorySourceCategories(
  sections: ProductSection[],
  fallbackCategory: MainCategoryName
): MainCategoryName[] {
  const categories: MainCategoryName[] = [];

  if (sections.includes("nina")) categories.push("Niña");
  if (sections.includes("nino")) categories.push("Niño");

  if (categories.length > 0) return categories;
  if (fallbackCategory === "Niña" || fallbackCategory === "Niño") {
    return [fallbackCategory];
  }

  return ["Niña", "Niño"];
}

function getSubcategoryFormOptions(items: FirebaseSubcategory[]) {
  const uniqueItems = new Map<string, FirebaseSubcategory>();

  for (const item of items) {
    const key = item.name.trim().toLowerCase();
    if (!key || uniqueItems.has(key)) continue;
    uniqueItems.set(key, item);
  }

  const savedOptions = Array.from(uniqueItems.values()).sort((a, b) =>
    a.name.localeCompare(b.name, "es-MX")
  );

  if (savedOptions.length > 0) return savedOptions;

  return commonProductTypes.map((name, index) => ({
    id: `common-${createSlug(name)}`,
    name,
    slug: createSlug(name),
    parentCategory: (index % 2 === 0 ? "Niña" : "Niño") as MainCategoryName,
    isActive: true,
    sortOrder: index + 1,
    createdAt: "",
    updatedAt: "",
  }));
}

const productFormSteps: Array<{
  id: ProductFormStep;
  label: string;
  helper: string;
}> = [
  { id: "photos", label: "Fotos", helper: "Agrega la foto principal del producto." },
  { id: "data", label: "Datos", helper: "Nombre, sección y textos de la prenda." },
  { id: "price", label: "Precio", helper: "Precio final, tallas y piezas." },
  { id: "sale", label: "Venta", helper: "Visibilidad, mayoreo y destacados." },
  { id: "review", label: "Revisar", helper: "Confirma el resumen antes de guardar." },
];

function getInitialValues(category: MainCategoryName = "Niña"): ProductFormValues {
  const initialSection = categoryToSection(category) ?? "nina";

  return {
    name: "",
    description: "",
    longDescription: "",
    category,
    sections: [initialSection],
    subcategory: "",
    basePrice: "",
    paymentFeePercent: String(DEFAULT_PAYMENT_FEE_PERCENT),
    sizes: defaultSizes.join(", "),
    colors: "Varios",
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
    wholesalePrice: "",
    wholesaleMinQuantity: "",
    wholesaleNote: "",
  };
}

const fieldClass =
  "w-full min-w-0 max-w-full rounded-xl border border-rose-100 bg-white px-3 py-2 text-[16px] font-bold text-slate-800 outline-none transition placeholder:text-slate-300 placeholder:font-semibold placeholder:opacity-70 focus:border-rose-300 focus:ring-4 focus:ring-rose-100 disabled:bg-slate-50 disabled:text-slate-400 sm:rounded-2xl sm:px-4 sm:py-3 sm:text-sm";

const labelClass =
  "text-[10px] font-black uppercase tracking-wide text-slate-600 sm:text-xs";

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
    label: "Producto activo",
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
  const sections = product.sections?.length
    ? product.sections
    : [categoryToSection(product.category) ?? "unisex"];
  const primaryCategory = primaryCategoryFromSections(
    sections,
    product.category
  );
  const [subcategorySourceCategory = "Niña"] = getSubcategorySourceCategories(
    sections,
    primaryCategory
  );

  return {
    name: product.name,
    description: product.description,
    longDescription: product.longDescription,
    category: subcategorySourceCategory,
    sections,
    subcategory: product.subcategory,
    basePrice: String(product.basePrice ?? product.price ?? ""),
    paymentFeePercent: String(
      product.paymentFeePercent ?? DEFAULT_PAYMENT_FEE_PERCENT
    ),
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
    wholesaleMode: normalizeWholesaleMode(product.wholesaleMode),
    wholesalePrice: product.wholesalePrice ? String(product.wholesalePrice) : "",
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
    <div className="mb-3 flex min-w-0 items-start gap-2 sm:mb-4 sm:gap-3">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-rose-50 text-rose-500 ring-1 ring-rose-100 sm:h-11 sm:w-11 sm:rounded-2xl">
        {icon}
      </span>
      <div className="min-w-0">
        <p className="text-[10px] font-black uppercase tracking-[0.14em] text-rose-500 sm:text-xs sm:tracking-[0.18em]">
          {eyebrow}
        </p>
        <h3 className="mt-0.5 break-words text-base font-black text-slate-950 sm:mt-1 sm:text-lg">
          {title}
        </h3>
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
      className="group min-w-0 overflow-hidden rounded-xl border border-rose-100 bg-[#fffaf5] px-3 py-2.5 sm:rounded-2xl sm:px-4 sm:py-3"
    >
      <summary className="flex cursor-pointer list-none items-center justify-between gap-2">
        <span className="min-w-0">
          <span className="block break-words text-sm font-black text-slate-800">
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
      <div className="mt-3 sm:mt-4">{children}</div>
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
  const [currentStep, setCurrentStep] = useState<ProductFormStep>("photos");
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
  const subcategorySourceCategories = useMemo(
    () => getSubcategorySourceCategories(form.sections, form.category),
    [form.category, form.sections]
  );
  const subcategorySourceKey = subcategorySourceCategories.join("|");
  const hasBasePriceInput = form.basePrice.trim().length > 0;
  const basePriceValue = Number(form.basePrice);
  const paymentFeePercentValue = Number(form.paymentFeePercent);
  const finalCustomerPrice = calculateFinalCustomerPrice(
    hasBasePriceInput ? basePriceValue : 0,
    paymentFeePercentValue
  );
  const currentStepIndex = productFormSteps.findIndex(
    (step) => step.id === currentStep
  );
  const currentStepMeta =
    productFormSteps[currentStepIndex] ?? productFormSteps[0];
  const isFirstStep = currentStepIndex <= 0;
  const isReviewStep = currentStep === "review";
  const canShowFinalPrice = hasBasePriceInput && finalCustomerPrice > 0;
  const finalPriceLabel = canShowFinalPrice
    ? formatPrice(finalCustomerPrice)
    : "Se calculará al escribir el precio base";
  const selectedSectionLabels = getSectionLabels({
    sections: form.sections,
    category: form.category,
  });

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
      sections: form.sections,
      subcategory: form.subcategory.trim() || "Subcategoría",
      price: finalCustomerPrice,
      basePrice: Number(form.basePrice) || undefined,
      paymentFeePercent: Number(form.paymentFeePercent) || 0,
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
      wholesalePrice: Number(form.wholesalePrice) || null,
      wholesaleMinQuantity: Number(form.wholesaleMinQuantity) || 0,
      wholesaleNote: form.wholesaleNote,
      createdAt: "",
      updatedAt: "",
    };

    return mapFirebaseProductToProduct(product);
  }, [
    finalCustomerPrice,
    form,
    previewImage,
    productPhotoUrls,
    productToEdit?.id,
    sizes,
    totalStock,
  ]);

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
      setCurrentStep("photos");
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
        const sourceCategories = subcategorySourceKey
          .split("|")
          .filter(Boolean) as MainCategoryName[];
        const categoryItems = await Promise.all(
          sourceCategories.map((category) => getSubcategoriesByCategory(category))
        );
        const items = categoryItems.flat();
        const selectableItems = items.filter(
          (item) => item.isActive || item.name === form.subcategory
        );
        const formOptions = getSubcategoryFormOptions(selectableItems);

        if (!isCurrent) return;

        setSubcategories(formOptions);
        setForm((current) => {
          if (current.subcategory || formOptions.length === 0) return current;
          return { ...current, subcategory: formOptions[0].name };
        });
      } catch {
        if (isCurrent) {
          setSubcategories(getSubcategoryFormOptions([]));
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
  }, [form.subcategory, subcategorySourceKey]);

  function updateField<Field extends keyof ProductFormValues>(
    field: Field,
    value: ProductFormValues[Field]
  ) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  function toggleSection(section: ProductSection) {
    setForm((current) => {
      const hasSection = current.sections.includes(section);
      const nextSections = hasSection
        ? current.sections.filter((item) => item !== section)
        : [...current.sections, section];
      const safeSections = nextSections.length > 0 ? nextSections : [section];
      const nextCategory = primaryCategoryFromSections(
        safeSections,
        current.category
      );

      return {
        ...current,
        sections: safeSections,
        category: nextCategory,
        subcategory:
          nextCategory === current.category ? current.subcategory : "",
      };
    });
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
    const templateSection = categoryToSection(template.category) ?? "unisex";

    setForm((current) => ({
      ...current,
      category: template.category,
      sections: [templateSection],
      subcategory: template.subcategory,
      sizes: template.sizes.join(", "),
      stockBySize: createEmptyStockBySize(template.sizes),
    }));
  }

  function setNextSaveAction(action: "close" | "addAnother") {
    saveActionRef.current = action;
    setSaveAction(action);
  }

  function goToStep(step: ProductFormStep) {
    setCurrentStep(step);
    setError("");
  }

  function goToPreviousStep() {
    const previousStep = productFormSteps[Math.max(currentStepIndex - 1, 0)];
    goToStep(previousStep.id);
  }

  function goToNextStep() {
    const nextStep =
      productFormSteps[
        Math.min(currentStepIndex + 1, productFormSteps.length - 1)
      ];
    goToStep(nextStep.id);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!isReviewStep) {
      goToNextStep();
      return;
    }

    setError("");
    const requestedSaveAction = saveActionRef.current;

    const basePrice = Number(form.basePrice);
    const paymentFeePercent = Number(form.paymentFeePercent);
    const price = calculateFinalCustomerPrice(basePrice, paymentFeePercent);
    const sections =
      form.sections.length > 0 ? form.sections : [categoryToSection(form.category) ?? "unisex"];
    const primaryCategory = primaryCategoryFromSections(sections, form.category);
    const wholesaleMode = normalizeWholesaleMode(form.wholesaleMode);
    const wholesalePrice = form.wholesalePrice.trim()
      ? Number(form.wholesalePrice)
      : null;
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

    if (sections.length === 0) {
      setError("Elige al menos una sección donde aparecerá.");
      return;
    }

    if (!Number.isFinite(basePrice) || basePrice <= 0) {
      setError("Agrega un precio base válido.");
      return;
    }

    if (
      !Number.isFinite(paymentFeePercent) ||
      paymentFeePercent < MIN_PAYMENT_FEE_PERCENT ||
      paymentFeePercent > MAX_PAYMENT_FEE_PERCENT
    ) {
      setError("El porcentaje debe estar entre 0 y 20.");
      return;
    }

    if (!Number.isFinite(price) || price <= 0) {
      setError("Agrega un precio base válido.");
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
      wholesaleMode !== "none" &&
      wholesalePrice !== null &&
      (!Number.isFinite(wholesalePrice) || wholesalePrice <= 0)
    ) {
      setError("Agrega un precio mayoreo válido o deja el campo vacío.");
      return;
    }

    if (wholesaleMode !== "none" && wholesalePrice !== null && wholesalePrice > price) {
      setError("El precio mayoreo debe ser menor o igual al precio normal.");
      return;
    }

    if (
      wholesaleMode === "product" &&
      (!Number.isFinite(wholesaleMinQuantity) || wholesaleMinQuantity < 2)
    ) {
      setError("Para mayoreo por producto agrega un mínimo de al menos 2 piezas.");
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
      category: primaryCategory,
      sections,
      subcategory,
      price,
      basePrice,
      paymentFeePercent,
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
      wholesaleMode,
      wholesalePrice: wholesaleMode === "none" ? null : wholesalePrice,
      wholesaleMinQuantity:
        wholesaleMode === "product" ? wholesaleMinQuantity : 0,
      wholesaleNote:
        wholesaleMode === "none" ? "" : form.wholesaleNote.trim(),
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
      className="relative rounded-[1.25rem] bg-white p-3 pb-24 shadow-sm ring-1 ring-rose-100 sm:rounded-[1.75rem] sm:p-5"
    >
      <div className="mb-3 flex min-w-0 flex-col gap-2 sm:mb-5 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <p className="text-[10px] font-black uppercase tracking-[0.14em] text-rose-500 sm:text-xs sm:tracking-[0.18em]">
            {isEditing ? "Editar" : "Nuevo producto"}
          </p>
          <h2 className="mt-1 break-words text-lg font-black text-slate-950 sm:text-2xl">
            {isEditing ? "Editar producto" : "Agregar producto"}
          </h2>
          <p className="mt-2 hidden max-w-xl text-sm font-semibold leading-6 text-slate-600 sm:block">
            Completa cada paso y guarda hasta revisar el producto.
          </p>
        </div>

        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="hidden min-h-11 w-full items-center justify-center gap-2 rounded-full bg-slate-100 px-4 py-2.5 text-sm font-black text-slate-700 transition hover:bg-slate-200 sm:inline-flex sm:w-auto"
          >
            <X size={16} />
            Cancelar
          </button>
        )}
      </div>

      <div className="mb-3 min-w-0 rounded-xl bg-[#fffaf5] p-2.5 ring-1 ring-rose-100 sm:mb-5 sm:rounded-2xl sm:p-4">
        <div className="flex min-w-0 items-start gap-2 sm:gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white text-rose-500 shadow-sm ring-1 ring-rose-100 sm:h-11 sm:w-11 sm:rounded-2xl">
            <WandSparkles size={18} />
          </span>
          <div className="min-w-0">
            <p className="text-sm font-black text-slate-950">
              {currentStepMeta.label}
            </p>
          <p className="mt-1 text-xs font-semibold leading-5 text-slate-500">
              {currentStepMeta.helper}
            </p>
          </div>
        </div>

        <div className="mt-3 grid min-w-0 grid-cols-5 gap-1.5 sm:gap-2">
          {productFormSteps.map((step, index) => {
            const isActive = step.id === currentStep;
            const isDone = index < currentStepIndex;

            return (
              <button
                key={step.id}
                type="button"
                onClick={() => goToStep(step.id)}
                className={`min-w-0 rounded-xl px-1.5 py-2 text-center text-[11px] font-black transition focus:outline-none focus:ring-4 focus:ring-rose-100 sm:flex sm:min-h-11 sm:items-center sm:justify-center sm:gap-2 sm:rounded-full sm:px-3 sm:text-xs ${
                  isActive
                    ? "bg-slate-950 text-white shadow-sm"
                    : isDone
                      ? "bg-rose-100 text-rose-700 hover:bg-rose-200"
                      : "bg-white text-slate-500 ring-1 ring-rose-100 hover:bg-rose-50 hover:text-slate-800"
                }`}
              >
                <span className="mx-auto flex h-5 w-5 items-center justify-center rounded-full bg-white/20 sm:mx-0">
                  {index + 1}
                </span>
                <span className="hidden truncate sm:inline">{step.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="grid min-w-0 gap-4 sm:gap-6">
        <div className="flex min-w-0 flex-col gap-4 sm:gap-7">
          <section
            className={`border-t border-rose-100 pt-4 sm:pt-5 ${
              currentStep === "data" ? "" : "hidden"
            }`}
          >
            <SectionHeader
              eyebrow="Información básica"
              title="Datos del producto"
              description="Nombre, categoría y textos visibles para el cliente."
              icon={<Shirt size={20} />}
            />

            <div className="mb-3 sm:mb-5">
            <details className="group mb-3 min-w-0 overflow-hidden rounded-xl border border-rose-100 bg-[#fffaf5] px-3 py-2.5 sm:mb-5 sm:rounded-2xl sm:px-4 sm:py-3">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-2">
                <span className="min-w-0">
                  <span className="block break-words text-sm font-black text-slate-800">
                    Plantillas rápidas
                  </span>
                  <span className="mt-1 hidden text-xs font-semibold leading-5 text-slate-600 sm:block">
                    Llena categoría, subcategoría y tallas disponibles.
                  </span>
                </span>
                <ChevronDown
                  size={18}
                  className="shrink-0 text-slate-400 transition group-open:rotate-180"
                />
              </summary>
            <div className="mt-3 space-y-3 sm:mt-4">
              <div className="hidden items-start gap-2 sm:flex">
                <WandSparkles className="mt-0.5 shrink-0 text-rose-500" size={17} />
                <div>
                  <p className="text-sm font-black text-slate-800">
                    Plantillas rápidas
                  </p>
                  <p className="mt-1 text-xs font-semibold leading-5 text-slate-600">
                    Elige una para llenar secciones, tipo de prenda y tallas.
                  </p>
                </div>
              </div>

              <div className="min-w-0">
                <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
                  {productTemplates.map((template) => (
                    <button
                      key={template.label}
                      type="button"
                      onClick={() => applyTemplate(template)}
                      className="inline-flex min-h-9 min-w-0 items-center justify-center rounded-full bg-white px-3 py-2 text-xs font-black text-slate-700 shadow-sm ring-1 ring-rose-100 transition hover:bg-rose-100 hover:text-rose-700 sm:min-h-10 sm:px-4"
                    >
                      {template.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            </details>
            </div>

            <div className="grid min-w-0 gap-3 sm:gap-4 lg:grid-cols-2">
              <label className="space-y-2">
                <span className={labelClass}>Nombre del producto</span>
                <input
                  value={form.name}
                  onChange={(event) => updateField("name", event.target.value)}
                  className={fieldClass}
                  placeholder="Ej. Vestido infantil floral"
                />
                <HelpText>Así aparecerá en la tienda y en la vista previa.</HelpText>
              </label>

              <div className="space-y-2">
                <span className={labelClass}>Secciones donde aparecerá</span>
                <div className="flex min-w-0 flex-wrap gap-2">
                  {sectionOptions.map((section) => {
                    const isSelected = form.sections.includes(section.value);

                    return (
                      <button
                        key={section.value}
                        type="button"
                        onClick={() => toggleSection(section.value)}
                        className={`min-h-9 rounded-full px-3 py-2 text-xs font-black transition focus:outline-none focus:ring-4 focus:ring-rose-100 sm:min-h-10 sm:px-4 ${
                          isSelected
                            ? "bg-slate-950 text-white shadow-sm"
                            : "bg-white text-slate-700 ring-1 ring-rose-100 hover:bg-rose-50"
                        }`}
                      >
                        {section.label}
                      </button>
                    );
                  })}
                </div>
                <HelpText>
                  Puede aparecer en una o varias secciones de la boutique.
                </HelpText>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between gap-3">
                  <span className={labelClass}>Tipo de prenda</span>
                  <Link
                    href="/admin/categorias"
                    className="text-xs font-black text-rose-500 transition hover:text-rose-600"
                  >
                    Agregar tipo
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
                  Ej. Vestidos, Conjuntos, Chamarras, Playeras o Accesorios.
                </HelpText>
              </div>

              <label className="space-y-2">
                <span className={labelClass}>Colores disponibles</span>
                <input
                  value={form.colors}
                  onChange={(event) => updateField("colors", event.target.value)}
                  className={fieldClass}
                  placeholder="Ej. Rosa, blanco"
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
                  className={`${fieldClass} min-h-20 resize-none sm:min-h-24`}
                  placeholder="Ej. Prenda cómoda para uso diario."
                />
              </label>

              <div className="space-y-3 lg:col-span-2">
                <CollapsibleBlock
                  title="Descripción larga"
                  description="Texto opcional para el detalle del producto."
                >
                  <label className="space-y-2">
                    <span className={labelClass}>Descripción para detalle</span>
                    <textarea
                      value={form.longDescription}
                      onChange={(event) =>
                        updateField("longDescription", event.target.value)
                      }
                      className={`${fieldClass} min-h-20 resize-none sm:min-h-24`}
                      placeholder="Ej. Cuenta cuándo se usa, cómo queda y qué la hace especial."
                    />
                  </label>
                </CollapsibleBlock>
              </div>
            </div>
          </section>

          <section
            className={`border-t border-rose-100 pt-4 sm:pt-5 ${
              currentStep === "price" ? "" : "hidden"
            }`}
          >
            <SectionHeader
              eyebrow="Precio y stock"
              title="Precio y stock"
              description="Escribe el precio interno y el sistema calcula el precio público."
              icon={<DollarSign size={20} />}
            />

            <div className="grid min-w-0 gap-3 rounded-xl bg-[#fffaf5] p-2.5 ring-1 ring-rose-100 sm:gap-4 sm:rounded-2xl sm:p-4 lg:grid-cols-2">
              <label className="space-y-2">
                <span className={labelClass}>Precio base de tienda</span>
                <input
                  value={form.basePrice}
                  onChange={(event) =>
                    updateField("basePrice", event.target.value)
                  }
                  className={fieldClass}
                  inputMode="decimal"
                  placeholder="Ej. 300"
                />
                <p className="text-[11px] font-semibold leading-4 text-slate-500 sm:text-xs sm:leading-5">
                  Precio antes del ajuste de pago.
                </p>
              </label>

              <label className="space-y-2">
                <span className={labelClass}>Ajuste de pago</span>
                <input
                  value={form.paymentFeePercent}
                  onChange={(event) =>
                    updateField("paymentFeePercent", event.target.value)
                  }
                  className={fieldClass}
                  inputMode="decimal"
                  placeholder={`Ej. ${DEFAULT_PAYMENT_FEE_PERCENT}`}
                />
                <p className="text-[11px] font-semibold leading-4 text-slate-500 sm:text-xs sm:leading-5">
                  Ej. 5 agrega 5% al precio final.
                </p>
              </label>

              <div className="space-y-2">
                <span className={labelClass}>Precio final al cliente</span>
                <div
                  className={`flex min-h-10 items-center rounded-xl border px-3 text-sm font-black sm:min-h-12 sm:rounded-2xl sm:px-4 ${
                    canShowFinalPrice
                      ? "border-emerald-100 bg-emerald-50 text-base text-emerald-800 sm:text-lg"
                      : "border-slate-100 bg-slate-50 text-slate-400"
                  }`}
                >
                  {finalPriceLabel}
                </div>
                <p className="rounded-xl bg-white px-3 py-2 text-xs font-black leading-5 text-slate-700 ring-1 ring-rose-100 sm:rounded-2xl sm:px-4 sm:py-3 sm:text-sm">
                  El cliente verá este precio en la tienda:{" "}
                  <span className="text-slate-950">
                    {canShowFinalPrice ? finalPriceLabel : "pendiente"}
                  </span>
                </p>
              </div>

              <div className="space-y-2">
                <span className={labelClass}>Piezas disponibles</span>
                <div className="flex min-h-10 items-center rounded-xl border border-rose-100 bg-slate-50 px-3 text-base font-black text-slate-950 sm:min-h-12 sm:rounded-2xl sm:px-4 sm:text-lg">
                  {totalStock}
                </div>
                <HelpText>Suma automática de todas las tallas.</HelpText>
              </div>

              <label className="space-y-2 lg:col-span-2">
                <span className={labelClass}>Tallas disponibles</span>
                <div className="flex min-w-0 flex-wrap gap-1.5 sm:gap-2">
                  {quickSizeOptions.map((size) => {
                    const isSelected = sizes.includes(size);

                    return (
                      <button
                        key={size}
                        type="button"
                        onClick={() => toggleQuickSize(size)}
                        className={`min-h-8 min-w-8 rounded-full px-2.5 py-1.5 text-xs font-black transition sm:min-h-10 sm:min-w-10 sm:px-3 sm:py-2 sm:text-sm ${
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
                  placeholder="Ej. 1, 2, 4, 6, 8"
                />
                <p className="text-[11px] font-black text-slate-500 sm:text-xs">
                  Tallas: {sizes.length > 0 ? sizes.join(", ") : "sin tallas"} · Piezas totales: {totalStock}
                </p>
              </label>
            </div>

            <div className="mt-3 space-y-3 sm:mt-4">
              <CollapsibleBlock
                title="Stock por talla"
                description="Llena cuántas piezas hay de cada talla."
              >
                {sizes.length > 0 ? (
                  <div className="space-y-3 sm:space-y-4">
                    <div className="rounded-xl bg-white p-2.5 ring-1 ring-rose-100 sm:rounded-2xl sm:p-3">
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
                          placeholder="Ej. 10"
                        />
                      </label>

                      <div className="mt-3 grid grid-cols-2 gap-2">
                        <button
                          type="button"
                          onClick={applyStockToAllSizes}
                          className="inline-flex min-h-9 items-center justify-center rounded-full bg-slate-950 px-3 py-2 text-xs font-black text-white transition hover:bg-slate-800 sm:min-h-11 sm:px-4 sm:py-2.5 sm:text-sm"
                        >
                          Aplicar
                        </button>
                        <button
                          type="button"
                          onClick={clearStockQuantities}
                          className="inline-flex min-h-9 items-center justify-center rounded-full bg-slate-100 px-3 py-2 text-xs font-black text-slate-700 transition hover:bg-slate-200 sm:min-h-11 sm:px-4 sm:py-2.5 sm:text-sm"
                        >
                          Limpiar
                        </button>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-2 sm:gap-3 lg:grid-cols-3">
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
                            placeholder="Ej. 0"
                          />
                        </label>
                      ))}
                    </div>
                  </div>
                ) : (
                  <HelpText>Agrega tallas para poder llenar las piezas disponibles.</HelpText>
                )}
              </CollapsibleBlock>

            </div>
          </section>

          <section
            className={`pt-1 sm:border-t sm:border-rose-100 sm:pt-5 ${
              currentStep === "photos" ? "" : "hidden"
            }`}
          >
            <SectionHeader
              eyebrow="Imágenes"
              title="Fotos del producto"
              description="La primera foto es la que más verá el cliente."
              icon={<Images size={20} />}
            />

            <ImageUploadField
              label="Foto principal"
              value={form.mainImage}
              onChange={(url) => {
                const currentMainImage = form.mainImage.trim();
                const remainingPhotos = productPhotoUrls.filter(
                  (photoUrl) => photoUrl !== currentMainImage
                );
                updateProductPhotos(url ? [url, ...remainingPhotos] : remainingPhotos);
              }}
              storagePath={`${imageStorageFolder}/principal`}
              helperText="Foto principal de la prenda."
              previewClassName="h-48 sm:h-56"
              previewFit="contain"
            />
            <HelpText>La primera foto será la principal.</HelpText>

              <div className="mt-3 space-y-3 sm:mt-4">
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
                  <div className="grid min-w-0 gap-3 lg:grid-cols-2">
                    <label className="space-y-2">
                      <span className={labelClass}>Enlace de foto principal</span>
                      <input
                        value={form.mainImage}
                        onChange={(event) =>
                          updateField("mainImage", event.target.value)
                        }
                        className={fieldClass}
                        placeholder="Ej. https://.../foto-principal.webp"
                      />
                    </label>

                    <label className="space-y-2">
                      <span className={labelClass}>Enlaces de fotos extra</span>
                      <input
                        value={form.images}
                        onChange={(event) => updateField("images", event.target.value)}
                        className={fieldClass}
                        placeholder="Ej. https://foto1.webp, https://foto2.webp"
                      />
                    </label>
                  </div>
                </CollapsibleBlock>
              </div>
          </section>

          {currentStep === "sale" && (
            <>
              <section className="order-4 border-t border-rose-100 pt-4 sm:pt-5">
                <SectionHeader
                  eyebrow="Opciones de venta"
                  title="Etiquetas"
                  description="Activa solo lo que ayude a vender este producto."
                  icon={<Tags size={20} />}
                />

            <CollapsibleBlock
              title="Opciones de venta"
              description="Oferta, nuevo, temporada y visibilidad."
            >
            <div className="grid gap-2 sm:grid-cols-2 sm:gap-3">
              {booleanFields.map((item) => (
                <label
                  key={item.field}
                  className="flex min-w-0 items-center justify-between gap-3 rounded-xl border border-rose-100 bg-white px-3 py-2.5 sm:rounded-2xl sm:px-4 sm:py-3"
                >
                  <span className="min-w-0">
                    <span className="block text-sm font-black text-slate-800">
                      {item.label}
                    </span>
                    <span className="mt-1 hidden text-xs font-semibold leading-5 text-slate-600 sm:block">
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
            </CollapsibleBlock>

            <div className="mt-3 sm:mt-4">
              <CollapsibleBlock
                title="Configuración avanzada"
                description="Opciones de aparición en la portada."
              >
                <div className="space-y-3">
                  <label className="flex min-w-0 items-center justify-between gap-3 rounded-xl border border-rose-100 bg-white px-3 py-2.5 sm:rounded-2xl sm:px-4 sm:py-3">
                    <span className="min-w-0">
                      <span className="block text-sm font-black text-slate-800">
                        Mostrar en inicio
                      </span>
                      <span className="mt-1 hidden text-xs font-semibold leading-5 text-slate-600 sm:block">
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

                  <div className="grid min-w-0 gap-3 lg:grid-cols-2">
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

              <section className="order-5 border-t border-rose-100 pt-4 sm:pt-5">
                <SectionHeader
                  eyebrow="Mayoreo"
                  title="Venta por mayoreo"
                  description="Déjalo cerrado si este producto se vende normal."
                  icon={<BadgePercent size={20} />}
                />

            <CollapsibleBlock
              title="Configurar mayoreo"
              description="Precio especial y regla de mínimo."
            >
              <div className="grid min-w-0 gap-3 sm:gap-4 lg:grid-cols-2">
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
                    <option value="mixed">Mayoreo surtido</option>
                    <option value="product">Mayoreo por producto</option>
                  </select>
                </label>

                {form.wholesaleMode !== "none" && (
                  <label className="space-y-2">
                    <span className={labelClass}>Precio mayoreo</span>
                    <input
                      value={form.wholesalePrice}
                      onChange={(event) =>
                        updateField("wholesalePrice", event.target.value)
                      }
                      className={fieldClass}
                      inputMode="decimal"
                      placeholder="Ej. 250"
                    />
                    <HelpText>Debe ser menor o igual al precio normal.</HelpText>
                  </label>
                )}

                <label className="space-y-2">
                  <span className={labelClass}>Mínimo por producto</span>
                  <input
                    value={form.wholesaleMinQuantity}
                    onChange={(event) =>
                      updateField("wholesaleMinQuantity", event.target.value)
                    }
                    className={fieldClass}
                    inputMode="numeric"
                    placeholder="Ej. 6"
                    disabled={form.wholesaleMode !== "product"}
                  />
                  <HelpText>Solo aplica para mayoreo por producto.</HelpText>
                </label>

                <label className="space-y-2 lg:col-span-2">
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
                <div className="mt-3 rounded-xl bg-white px-3 py-2.5 text-xs font-bold leading-5 text-slate-600 ring-1 ring-rose-100 sm:mt-4 sm:rounded-2xl sm:px-4 sm:py-3">
                  {form.wholesaleMode === "mixed"
                    ? "Mayoreo surtido: el mínimo se toma de la configuración general de tienda y permite combinar prendas elegibles."
                    : "Mayoreo por producto: el mínimo se completa con esta prenda, aunque cambie la talla."}
                </div>
              )}
            </CollapsibleBlock>
              </section>

              <section className="order-6 border-t border-rose-100 pt-4 sm:pt-5">
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
                <label className="flex min-w-0 items-center justify-between gap-3 rounded-xl border border-rose-100 bg-white px-3 py-2.5 sm:rounded-2xl sm:px-4 sm:py-3">
                  <span className="min-w-0">
                    <span className="block text-sm font-black text-slate-800">
                      Mostrar en ofertas destacadas
                    </span>
                    <span className="mt-1 hidden text-xs font-semibold leading-5 text-slate-600 sm:block">
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

          {currentStep === "review" && (
            <section className="border-t border-rose-100 pt-4 sm:pt-5">
              <SectionHeader
                eyebrow="Resumen"
                title="Revisar producto"
                description="Confirma la información principal antes de guardar."
                icon={<Sparkles size={20} />}
              />

              <div className="grid min-w-0 gap-3 rounded-xl bg-[#fffaf5] p-2.5 ring-1 ring-rose-100 sm:rounded-2xl sm:p-4 lg:grid-cols-[140px_minmax(0,1fr)]">
                <div className="min-h-32 overflow-hidden rounded-xl bg-white ring-1 ring-rose-100 sm:rounded-2xl">
                  <ProductVisual
                    product={previewProduct}
                    compact
                    showName={false}
                    showBadges={false}
                    className="h-32"
                  />
                </div>

                <div className="grid min-w-0 gap-2 sm:grid-cols-2">
                  <div className="rounded-xl bg-white px-3 py-2 ring-1 ring-rose-100">
                    <p className="text-[10px] font-black uppercase tracking-wide text-slate-400">
                      Nombre
                    </p>
                    <p className="mt-1 break-words text-sm font-black text-slate-950">
                      {form.name.trim() || "Sin nombre"}
                    </p>
                  </div>
                  <div className="rounded-xl bg-white px-3 py-2 ring-1 ring-rose-100">
                    <p className="text-[10px] font-black uppercase tracking-wide text-slate-400">
                      Secciones
                    </p>
                    <p className="mt-1 break-words text-sm font-black text-slate-950">
                      {selectedSectionLabels || form.category} ·{" "}
                      {form.subcategory || "Sin tipo"}
                    </p>
                  </div>
                  <div className="rounded-xl bg-white px-3 py-2 ring-1 ring-rose-100">
                    <p className="text-[10px] font-black uppercase tracking-wide text-slate-400">
                      Precio final
                    </p>
                    <p
                      className={`mt-1 text-sm font-black ${
                        canShowFinalPrice ? "text-slate-950" : "text-slate-400"
                      }`}
                    >
                      {canShowFinalPrice ? finalPriceLabel : "Pendiente"}
                    </p>
                  </div>
                  <div className="rounded-xl bg-white px-3 py-2 ring-1 ring-rose-100">
                    <p className="text-[10px] font-black uppercase tracking-wide text-slate-400">
                      Estado
                    </p>
                    <p className="mt-1 text-sm font-black text-slate-950">
                      {form.isActive ? "Visible" : "Pausado"}
                    </p>
                  </div>
                  <div className="rounded-xl bg-white px-3 py-2 ring-1 ring-rose-100 sm:col-span-2">
                    <p className="text-[10px] font-black uppercase tracking-wide text-slate-400">
                      Tallas y piezas
                    </p>
                    <p className="mt-1 break-words text-sm font-black text-slate-950">
                      Tallas: {sizes.length > 0 ? sizes.join(", ") : "sin tallas"} · Piezas: {totalStock}
                    </p>
                  </div>
                </div>
              </div>
            </section>
          )}
        </div>

        {currentStep === "review" && (
        <aside className="min-w-0 space-y-4 xl:sticky xl:top-6 xl:self-start">
          <CollapsibleBlock
            title="Vista previa"
            description="Revisa cómo verá el producto el cliente."
          >
          <div className="rounded-xl bg-[#fffaf5] p-2.5 ring-1 ring-rose-100 sm:rounded-[1.5rem] sm:p-4">
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
                  {selectedSectionLabels || previewProduct.category} ·{" "}
                  {previewProduct.subcategory}
                </p>
                <h3 className="mt-1.5 line-clamp-2 min-h-[2.4rem] text-base font-black leading-tight text-slate-950">
                  {previewProduct.name}
                </h3>
                <div className="mt-4">
                  <p className="text-[11px] font-bold text-slate-600">
                    El cliente verá
                  </p>
                  <p
                    className={`text-2xl font-black ${
                      canShowFinalPrice ? "text-slate-950" : "text-slate-400"
                    }`}
                  >
                    {canShowFinalPrice ? finalPriceLabel : "Pendiente"}
                  </p>
                </div>
              </div>
            </article>
          </div>
          </CollapsibleBlock>
        </aside>
        )}
      </div>

      {error && (
        <div className="mt-4 rounded-xl bg-rose-50 px-3 py-2.5 text-sm font-bold text-rose-700 sm:mt-5 sm:rounded-2xl sm:px-4 sm:py-3">
          {error}
        </div>
      )}

      <div className="mt-5 hidden flex-col-reverse gap-2 pb-1 sm:flex sm:flex-row sm:justify-end">
        {isFirstStep ? (
          onCancel && (
            <button
              type="button"
              onClick={onCancel}
              className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-full bg-slate-100 px-6 py-3 text-sm font-black text-slate-700 shadow-sm transition hover:bg-slate-200 sm:w-auto"
            >
              <X size={17} />
              Cancelar
            </button>
          )
        ) : (
          <button
            type="button"
            onClick={goToPreviousStep}
            className="inline-flex min-h-12 w-full items-center justify-center rounded-full bg-slate-100 px-6 py-3 text-sm font-black text-slate-700 shadow-sm transition hover:bg-slate-200 sm:w-auto"
          >
            Atrás
          </button>
        )}

        {!isReviewStep ? (
          <button
            type="button"
            onClick={goToNextStep}
            className="inline-flex min-h-12 w-full items-center justify-center rounded-full bg-slate-950 px-6 py-3 text-sm font-black text-white shadow-sm transition hover:bg-slate-800 sm:w-auto"
          >
            Siguiente
          </button>
        ) : (
          <>
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
          </>
        )}
      </div>

      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-rose-100 bg-white/95 px-3 py-2 shadow-[0_-10px_24px_rgba(15,23,42,0.08)] backdrop-blur sm:hidden">
        <div className="mx-auto grid max-w-lg grid-cols-[0.9fr_1.1fr] gap-2 pb-[env(safe-area-inset-bottom)]">
          {isFirstStep ? (
            onCancel ? (
              <button
                type="button"
                onClick={onCancel}
                className="inline-flex min-h-10 items-center justify-center gap-1.5 rounded-full bg-slate-100 px-3 py-2 text-xs font-black text-slate-700"
              >
                <X size={15} />
                Cancelar
              </button>
            ) : (
              <span />
            )
          ) : (
            <button
              type="button"
              onClick={goToPreviousStep}
              className="inline-flex min-h-10 items-center justify-center rounded-full bg-slate-100 px-3 py-2 text-xs font-black text-slate-700"
            >
              Atrás
            </button>
          )}

          {!isReviewStep ? (
            <button
              type="button"
              onClick={goToNextStep}
              className="inline-flex min-h-10 items-center justify-center rounded-full bg-slate-950 px-3 py-2 text-xs font-black text-white shadow-sm"
            >
              Siguiente
            </button>
          ) : (
            <button
              type="submit"
              onClick={() => setNextSaveAction("close")}
              disabled={isSaving}
              className="inline-flex min-h-10 items-center justify-center gap-1.5 rounded-full bg-slate-950 px-3 py-2 text-xs font-black text-white shadow-sm disabled:cursor-not-allowed disabled:bg-slate-300"
            >
              <Save size={15} />
              {isSaving
                ? "Guardando"
                : isEditing
                  ? "Guardar cambios"
                  : "Guardar producto"}
            </button>
          )}
        </div>
      </div>
    </form>
  );
}
