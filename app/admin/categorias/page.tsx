"use client";

import { ImageUploadField } from "@/components/admin/ImageUploadField";
import {
  cleanupDuplicateBaseCategories,
  createSubcategory,
  deleteSubcategory,
  ensureBaseCategories,
  getCategories,
  getSubcategories,
  getUniqueMainCategories,
  updateCategory,
  updateSubcategory,
} from "@/lib/firebase-services/categories";
import { getProductsBySubcategory } from "@/lib/firebase-services/products";
import type {
  FirebaseCategory,
  FirebaseSubcategory,
  MainCategoryName,
} from "@/lib/firebase-types";
import {
  ArrowDown,
  ArrowUp,
  CheckCircle2,
  ImageIcon,
  Pencil,
  Plus,
  RefreshCw,
  Save,
  Tags,
  Trash2,
  X,
} from "lucide-react";
import type { FormEvent } from "react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

type SubcategoryFormValues = {
  name: string;
  imageUrl: string;
  isActive: boolean;
};

const mainCategoryDefaults: Array<{
  id: string;
  name: MainCategoryName;
  slug: string;
}> = [
  { id: "nina", name: "Niña", slug: "nina" },
  { id: "nino", name: "Niño", slug: "nino" },
  { id: "unisex", name: "Unisex", slug: "unisex" },
];

const initialSubcategoryForm: SubcategoryFormValues = {
  name: "",
  imageUrl: "",
  isActive: true,
};

const fieldClass =
  "w-full min-w-0 rounded-xl border border-rose-100 bg-white px-3 py-2 text-[16px] font-bold text-slate-800 outline-none transition placeholder:text-slate-300 placeholder:opacity-70 focus:border-rose-300 focus:ring-4 focus:ring-rose-100 sm:rounded-2xl sm:px-4 sm:py-3 sm:text-sm";

const labelClass =
  "text-[10px] font-black uppercase tracking-wide text-slate-600 sm:text-xs";

function createSlug(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

function getCategoryTone(category: MainCategoryName) {
  if (category === "Niña") return "bg-rose-50 text-rose-600 ring-rose-100";
  if (category === "Niño") return "bg-sky-50 text-sky-700 ring-sky-100";
  return "bg-amber-50 text-amber-700 ring-amber-100";
}

function sortSubcategories(items: FirebaseSubcategory[]) {
  return [...items].sort((a, b) => {
    if (a.parentCategory !== b.parentCategory) {
      return a.parentCategory.localeCompare(b.parentCategory, "es-MX");
    }

    if (a.sortOrder !== b.sortOrder) return a.sortOrder - b.sortOrder;
    return a.name.localeCompare(b.name, "es-MX");
  });
}

function getDuplicateBaseCount(categories: FirebaseCategory[]) {
  return mainCategoryDefaults.reduce((count, baseCategory) => {
    const matches = categories.filter((category) => {
      const slug = createSlug(category.slug || category.name);
      return slug === baseCategory.slug;
    });
    const hasWrongDocument = matches.some(
      (category) => category.id !== baseCategory.id
    );

    return count + (matches.length > 1 || hasWrongDocument ? 1 : 0);
  }, 0);
}

function getNextSubcategoryOrder(
  subcategories: FirebaseSubcategory[],
  parentCategory: MainCategoryName
) {
  const sameCategory = subcategories.filter(
    (subcategory) => subcategory.parentCategory === parentCategory
  );

  if (sameCategory.length === 0) return 1;

  return Math.max(...sameCategory.map((subcategory) => subcategory.sortOrder)) + 1;
}

export default function AdminCategoriesPage() {
  const [categories, setCategories] = useState<FirebaseCategory[]>([]);
  const [allCategories, setAllCategories] = useState<FirebaseCategory[]>([]);
  const [subcategories, setSubcategories] = useState<FirebaseSubcategory[]>([]);
  const [selectedCategory, setSelectedCategory] =
    useState<MainCategoryName>("Niña");
  const [form, setForm] =
    useState<SubcategoryFormValues>(initialSubcategoryForm);
  const [editingSubcategory, setEditingSubcategory] =
    useState<FirebaseSubcategory | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [busyId, setBusyId] = useState("");
  const [error, setError] = useState("");

  const sortedSubcategories = useMemo(
    () => sortSubcategories(subcategories),
    [subcategories]
  );
  const selectedSubcategories = useMemo(
    () =>
      sortedSubcategories.filter(
        (subcategory) => subcategory.parentCategory === selectedCategory
      ),
    [selectedCategory, sortedSubcategories]
  );
  const duplicateBaseCount = useMemo(
    () => getDuplicateBaseCount(allCategories),
    [allCategories]
  );
  const hasSavedBaseCategories = mainCategoryDefaults.every((baseCategory) =>
    allCategories.some((category) => category.id === baseCategory.id)
  );

  const subcategoryImageStoragePath = useMemo(() => {
    return `subcategories/${
      editingSubcategory?.id || createSlug(form.name) || "nueva"
    }`;
  }, [editingSubcategory?.id, form.name]);
  const selectedCategoryTitle =
    selectedCategory === "Unisex"
      ? "Subcategorías Unisex"
      : `Subcategorías de ${selectedCategory}`;
  const subcategoryFormTitle = editingSubcategory
    ? `Editar subcategoría de ${selectedCategory}`
    : `Agregar subcategoría a ${selectedCategory}`;

  const loadCategories = useCallback(async () => {
    try {
      setIsLoading(true);
      setError("");

      const [uniqueCategories, categoryItems, subcategoryItems] =
        await Promise.all([
          getUniqueMainCategories(),
          getCategories(),
          getSubcategories(),
        ]);

      setCategories(uniqueCategories);
      setAllCategories(categoryItems);
      setSubcategories(sortSubcategories(subcategoryItems));
    } catch {
      setError("No se pudieron cargar las categorías.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    queueMicrotask(() => {
      void loadCategories();
    });
  }, [loadCategories]);

  function updateForm<Field extends keyof SubcategoryFormValues>(
    field: Field,
    value: SubcategoryFormValues[Field]
  ) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  function selectCategory(category: MainCategoryName) {
    setSelectedCategory(category);

    if (category !== selectedCategory) {
      resetForm();
      setError("");
    }
  }

  async function handleEnsureBaseCategories() {
    try {
      setIsSaving(true);
      await ensureBaseCategories();
      toast.success("Categorías principales guardadas");
      await loadCategories();
    } catch {
      toast.error("No se pudieron guardar las categorías principales");
    } finally {
      setIsSaving(false);
    }
  }

  async function handleCleanupDuplicates() {
    const shouldClean = window.confirm(
      "Se eliminarán categorías principales repetidas. No se borrarán productos ni subcategorías."
    );

    if (!shouldClean) return;

    try {
      setIsSaving(true);
      await cleanupDuplicateBaseCategories();
      toast.success("Categorías duplicadas corregidas");
      await loadCategories();
    } catch {
      toast.error("No se pudieron corregir las categorías duplicadas");
    } finally {
      setIsSaving(false);
    }
  }

  async function handleToggleCategory(category: FirebaseCategory) {
    try {
      setBusyId(category.id);
      await ensureBaseCategories();
      await updateCategory(category.id, { isActive: !category.isActive });
      setCategories((current) =>
        current.map((item) =>
          item.id === category.id
            ? { ...item, isActive: !item.isActive }
            : item
        )
      );
      toast.success(category.isActive ? "Categoría pausada" : "Categoría activa");
    } catch {
      toast.error("No se pudo actualizar la categoría");
    } finally {
      setBusyId("");
    }
  }

  function resetForm() {
    setForm(initialSubcategoryForm);
    setEditingSubcategory(null);
  }

  function startEdit(subcategory: FirebaseSubcategory) {
    setSelectedCategory(subcategory.parentCategory);
    setEditingSubcategory(subcategory);
    setForm({
      name: subcategory.name,
      imageUrl: subcategory.imageUrl ?? "",
      isActive: subcategory.isActive,
    });
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");

    const name = form.name.trim();

    if (!name) {
      setError("Agrega el nombre de la subcategoría.");
      return;
    }

    const parentChanged =
      Boolean(editingSubcategory) &&
      editingSubcategory?.parentCategory !== selectedCategory;
    const sortOrder =
      editingSubcategory && !parentChanged
        ? editingSubcategory.sortOrder
        : getNextSubcategoryOrder(subcategories, selectedCategory);

    const payload = {
      name,
      slug: createSlug(name),
      parentCategory: selectedCategory,
      imageUrl: form.imageUrl.trim(),
      isActive: form.isActive,
      sortOrder,
    };

    try {
      setIsSaving(true);

      if (editingSubcategory) {
        await updateSubcategory(editingSubcategory.id, payload);
        toast.success("Subcategoría actualizada");
      } else {
        await createSubcategory(payload);
        toast.success("Subcategoría agregada");
      }

      resetForm();
      await loadCategories();
    } catch {
      setError("No se pudo guardar la subcategoría.");
      toast.error("No se pudo guardar la subcategoría");
    } finally {
      setIsSaving(false);
    }
  }

  async function handleToggleSubcategory(subcategory: FirebaseSubcategory) {
    try {
      setBusyId(subcategory.id);
      await updateSubcategory(subcategory.id, {
        isActive: !subcategory.isActive,
      });
      setSubcategories((current) =>
        current.map((item) =>
          item.id === subcategory.id
            ? { ...item, isActive: !item.isActive }
            : item
        )
      );
      toast.success(
        subcategory.isActive ? "Subcategoría pausada" : "Subcategoría activa"
      );
    } catch {
      toast.error("No se pudo actualizar la subcategoría");
    } finally {
      setBusyId("");
    }
  }

  function getSiblings(subcategory: FirebaseSubcategory) {
    if (subcategory.parentCategory !== selectedCategory) return [];
    return selectedSubcategories;
  }

  function canMoveUp(subcategory: FirebaseSubcategory) {
    return getSiblings(subcategory).findIndex((item) => item.id === subcategory.id) > 0;
  }

  function canMoveDown(subcategory: FirebaseSubcategory) {
    const siblings = getSiblings(subcategory);
    const index = siblings.findIndex((item) => item.id === subcategory.id);
    return index >= 0 && index < siblings.length - 1;
  }

  async function handleMoveSubcategory(
    subcategory: FirebaseSubcategory,
    direction: "up" | "down"
  ) {
    const siblings = getSiblings(subcategory);
    const currentIndex = siblings.findIndex((item) => item.id === subcategory.id);
    const nextIndex = direction === "up" ? currentIndex - 1 : currentIndex + 1;

    if (currentIndex < 0 || nextIndex < 0 || nextIndex >= siblings.length) return;

    const reordered = [...siblings];
    const [movedItem] = reordered.splice(currentIndex, 1);
    reordered.splice(nextIndex, 0, movedItem);

    try {
      setBusyId(subcategory.id);

      await Promise.all(
        reordered.map((item, index) =>
          updateSubcategory(item.id, { sortOrder: index + 1 })
        )
      );

      setSubcategories((current) =>
        sortSubcategories(
          current.map((item) => {
            const nextItem = reordered.find((ordered) => ordered.id === item.id);
            return nextItem
              ? { ...item, sortOrder: reordered.indexOf(nextItem) + 1 }
              : item;
          })
        )
      );
      toast.success("Subcategoría movida");
    } catch {
      toast.error("No se pudo mover la subcategoría");
    } finally {
      setBusyId("");
    }
  }

  async function handleDeleteSubcategory(subcategory: FirebaseSubcategory) {
    const shouldDelete = window.confirm("¿Eliminar esta subcategoría?");

    if (!shouldDelete) return;

    try {
      setBusyId(subcategory.id);

      const productsUsingSubcategory = await getProductsBySubcategory(
        subcategory.parentCategory,
        subcategory.name
      );

      if (productsUsingSubcategory.length > 0) {
        const message =
          "No puedes eliminar esta subcategoría porque tiene productos asignados. Primero cambia esos productos.";
        setError(message);
        toast.error("No puedes eliminar esta subcategoría", {
          description: message,
        });
        return;
      }

      await deleteSubcategory(subcategory.id);
      setSubcategories((current) =>
        current.filter((item) => item.id !== subcategory.id)
      );
      toast.success("Subcategoría eliminada");
    } catch {
      toast.error("No se pudo eliminar la subcategoría");
    } finally {
      setBusyId("");
    }
  }

  function renderOrderButtons(subcategory: FirebaseSubcategory) {
    return (
      <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
        <button
          type="button"
          onClick={() => void handleMoveSubcategory(subcategory, "up")}
          disabled={!canMoveUp(subcategory) || busyId === subcategory.id}
          className="inline-flex min-h-10 items-center justify-center gap-1 rounded-full bg-white px-3 py-2 text-xs font-black text-slate-700 shadow-sm ring-1 ring-slate-100 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:text-slate-300 sm:min-h-11"
        >
          <ArrowUp size={14} />
          Subir
        </button>
        <button
          type="button"
          onClick={() => void handleMoveSubcategory(subcategory, "down")}
          disabled={!canMoveDown(subcategory) || busyId === subcategory.id}
          className="inline-flex min-h-10 items-center justify-center gap-1 rounded-full bg-white px-3 py-2 text-xs font-black text-slate-700 shadow-sm ring-1 ring-slate-100 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:text-slate-300 sm:min-h-11"
        >
          <ArrowDown size={14} />
          Bajar
        </button>
      </div>
    );
  }

  function renderSubcategoryImage(subcategory: FirebaseSubcategory) {
    if (subcategory.imageUrl) {
      return (
        <div
          className="h-10 w-10 shrink-0 rounded-2xl bg-cover bg-center ring-1 ring-rose-100 sm:h-12 sm:w-12"
          style={{ backgroundImage: `url(${subcategory.imageUrl})` }}
        />
      );
    }

    return (
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-rose-50 text-rose-500 ring-1 ring-rose-100 sm:h-12 sm:w-12">
        <ImageIcon size={18} />
      </div>
    );
  }

  return (
    <section className="space-y-4 sm:space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.18em] text-rose-500">
            Catálogo
          </p>
          <h1 className="mt-1 text-xl font-black text-slate-950 sm:mt-2 sm:text-4xl">
            Categorías
          </h1>
          <p className="mt-1 text-sm font-medium leading-6 text-slate-600 sm:hidden">
            Ordena categorías y subcategorías.
          </p>
          <p className="mt-2 hidden max-w-2xl text-sm font-medium leading-6 text-slate-600 sm:block">
            Organiza las secciones de la tienda con nombres claros. Usa las flechas para acomodar el orden.
          </p>
        </div>

        <div className="grid gap-2 sm:flex sm:flex-wrap">
          <button
            type="button"
            onClick={() => void loadCategories()}
            className="inline-flex min-h-10 w-full items-center justify-center gap-2 rounded-full bg-white px-4 py-2 text-xs font-black text-slate-700 shadow-sm ring-1 ring-slate-100 transition hover:bg-slate-50 sm:min-h-12 sm:w-auto sm:px-5 sm:py-3 sm:text-sm"
          >
            <RefreshCw size={17} />
            Actualizar
          </button>

          {!hasSavedBaseCategories && (
            <button
              type="button"
              onClick={() => void handleEnsureBaseCategories()}
              disabled={isSaving}
              className="inline-flex min-h-10 w-full items-center justify-center gap-2 rounded-full bg-slate-950 px-4 py-2 text-xs font-black text-white shadow-sm transition hover:bg-slate-800 disabled:bg-slate-300 sm:min-h-12 sm:w-auto sm:px-5 sm:py-3 sm:text-sm"
            >
              <Save size={17} />
              Guardar categorías base
            </button>
          )}

          {duplicateBaseCount > 0 && (
            <button
              type="button"
              onClick={() => void handleCleanupDuplicates()}
              disabled={isSaving}
              className="inline-flex min-h-10 w-full items-center justify-center gap-2 rounded-full bg-amber-50 px-4 py-2 text-xs font-black text-amber-700 shadow-sm ring-1 ring-amber-100 transition hover:bg-amber-100 disabled:text-amber-300 sm:min-h-12 sm:w-auto sm:px-5 sm:py-3 sm:text-sm"
            >
              <Trash2 size={16} />
              Limpiar duplicados
            </button>
          )}
        </div>
      </div>

      {error && (
        <div className="rounded-2xl bg-rose-50 px-4 py-3 text-sm font-bold text-rose-700 ring-1 ring-rose-100">
          {error}
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-3">
        {categories.map((category) => {
          const isSelected = selectedCategory === category.name;

          return (
            <article
              key={category.id}
              aria-pressed={isSelected}
              role="button"
              tabIndex={0}
              onClick={() => selectCategory(category.name)}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  selectCategory(category.name);
                }
              }}
              className={`cursor-pointer rounded-[1.25rem] p-3 shadow-sm outline-none transition focus:ring-4 focus:ring-rose-100 sm:rounded-[1.5rem] sm:p-5 ${
                isSelected
                  ? "bg-rose-50/80 ring-2 ring-rose-300"
                  : "bg-white ring-1 ring-rose-100 hover:bg-[#fffaf5]"
              }`}
            >
              <div
                className={`flex h-10 w-10 items-center justify-center rounded-2xl ring-1 sm:h-12 sm:w-12 ${getCategoryTone(
                  category.name
                )}`}
              >
                <Tags size={20} />
              </div>

              <div className="mt-3 flex items-start justify-between gap-3 sm:mt-4">
                <div>
                  <h2 className="text-lg font-black text-slate-950 sm:text-xl">
                    {category.name}
                  </h2>
                  <p className="mt-1 hidden text-xs font-bold text-slate-600 sm:block">
                    {category.name === "Unisex" ? "Opcional" : "Principal"}
                  </p>
                </div>

                <div className="flex shrink-0 flex-col items-end gap-2">
                  <span
                    className={`rounded-full px-2.5 py-1 text-[11px] font-black sm:px-3 sm:py-1.5 sm:text-xs ${
                      category.isActive
                        ? "bg-emerald-50 text-emerald-700"
                        : "bg-slate-100 text-slate-700"
                    }`}
                  >
                    {category.isActive ? "Activa" : "Pausada"}
                  </span>
                  {isSelected && (
                    <span className="rounded-full bg-white px-2.5 py-1 text-[11px] font-black text-rose-600 ring-1 ring-rose-100 sm:px-3 sm:py-1.5 sm:text-xs">
                      Seleccionada
                    </span>
                  )}
                </div>
              </div>

              <button
                type="button"
                onClick={(event) => {
                  event.stopPropagation();
                  void handleToggleCategory(category);
                }}
                disabled={busyId === category.id}
                className="mt-3 inline-flex min-h-10 w-full items-center justify-center gap-2 rounded-full bg-slate-100 px-3 py-2 text-xs font-black text-slate-700 transition hover:bg-slate-200 disabled:cursor-not-allowed disabled:text-slate-400 sm:mt-4 sm:min-h-11 sm:px-4 sm:py-2.5 sm:text-sm"
              >
                <CheckCircle2 size={16} />
                {category.isActive ? "Pausar" : "Activar"}
              </button>
              <p className="mt-2 hidden text-center text-xs font-semibold text-slate-600 sm:block">
                Pausar oculta sin borrar.
              </p>
            </article>
          );
        })}
      </div>

      <form
        onSubmit={handleSubmit}
        className="rounded-[1.25rem] bg-white p-4 shadow-sm ring-1 ring-rose-100 sm:rounded-[1.75rem] sm:p-6"
      >
        <div className="mb-5 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.18em] text-rose-500">
              {editingSubcategory ? "Editar" : "Agregar"}
            </p>
            <h2 className="mt-1 text-lg font-black text-slate-950 sm:text-xl">
              {subcategoryFormTitle}
            </h2>
            <p className="mt-1 hidden text-sm font-medium text-slate-600 sm:block">
              La imagen es opcional. Sirve para mostrar esta sección de forma visual en la tienda.
            </p>
            <p className="mt-2 inline-flex rounded-full bg-[#fffaf5] px-3 py-1.5 text-xs font-black text-slate-600 ring-1 ring-rose-100 sm:mt-3">
              {editingSubcategory ? "Se guardará en:" : "Se agregará en:"}{" "}
              {selectedCategory}
            </p>
          </div>

          {editingSubcategory && (
            <button
              type="button"
              onClick={resetForm}
              className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-full bg-slate-100 px-4 py-2.5 text-sm font-black text-slate-700 transition hover:bg-slate-200 sm:w-auto"
            >
              <X size={16} />
              Cancelar edición
            </button>
          )}
        </div>

        <div className="grid gap-4 lg:grid-cols-[1fr_150px]">
          <div className="hidden lg:col-span-2 sm:block">
            <ImageUploadField
              label="Imagen opcional"
              value={form.imageUrl}
              onChange={(url) => updateForm("imageUrl", url)}
              storagePath={subcategoryImageStoragePath}
              helperText="La imagen es opcional. Sirve para mostrar esta sección de forma visual en la tienda."
              previewClassName="h-36 sm:h-48"
            />
          </div>

          <label className="space-y-2">
            <span className={labelClass}>Nombre</span>
            <input
              value={form.name}
              onChange={(event) => updateForm("name", event.target.value)}
              className={fieldClass}
              placeholder="Ej. Vestidos"
            />
          </label>

          <label className="flex items-center justify-between gap-3 rounded-2xl border border-rose-100 bg-[#fffaf5] px-4 py-3 lg:mt-6">
            <span className="text-sm font-black text-slate-800">Activa</span>
            <input
              type="checkbox"
              checked={form.isActive}
              onChange={(event) =>
                updateForm("isActive", event.target.checked)
              }
              className="h-5 w-5 accent-rose-500"
            />
          </label>
        </div>

        <div className="mt-5 flex justify-end">
          <button
            type="submit"
            disabled={isSaving}
            className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-full bg-rose-500 px-5 py-2.5 text-sm font-black text-white shadow-sm transition hover:bg-rose-600 disabled:cursor-not-allowed disabled:bg-rose-300 sm:min-h-12 sm:w-auto sm:px-6 sm:py-3"
          >
            <Plus size={17} />
            {isSaving
              ? "Guardando"
              : editingSubcategory
                ? "Guardar edición"
                : `Agregar subcategoría a ${selectedCategory}`}
          </button>
        </div>
      </form>

      <div className="space-y-4">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h2 className="text-xl font-black text-slate-950 sm:text-2xl">
              {selectedCategoryTitle}
            </h2>
            <p className="mt-1 hidden text-sm font-medium text-slate-600 sm:block">
              Usa las flechas para acomodar el orden dentro de esta sección.
            </p>
          </div>

          <div
            aria-label="Seleccionar sección de subcategorías"
            className="-mx-1 overflow-x-auto px-1"
            role="tablist"
          >
            <div className="flex min-w-max gap-2 sm:min-w-0 sm:flex-wrap">
              {mainCategoryDefaults.map((category) => {
                const isSelected = selectedCategory === category.name;

                return (
                  <button
                    key={`tab-${category.name}`}
                    type="button"
                    aria-selected={isSelected}
                    onClick={() => selectCategory(category.name)}
                    className={`inline-flex min-h-10 items-center justify-center whitespace-nowrap rounded-full px-4 py-2 text-sm font-black transition ${
                      isSelected
                        ? "bg-slate-950 text-white shadow-sm"
                        : "bg-white text-slate-700 ring-1 ring-slate-100 hover:bg-slate-50"
                    }`}
                    role="tab"
                  >
                    {category.name}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {!isLoading && selectedSubcategories.length === 0 ? (
          <div className="rounded-[1.25rem] bg-white px-4 py-6 text-center shadow-sm ring-1 ring-rose-100 sm:rounded-[1.75rem] sm:px-5 sm:py-8">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-rose-50 text-rose-500 ring-1 ring-rose-100">
              <Tags size={20} />
            </div>
            <h3 className="mt-3 text-base font-black text-slate-950 sm:mt-4 sm:text-lg">
              Todavía no hay subcategorías en {selectedCategory}.
            </h3>
            <p className="mt-2 hidden text-sm font-medium text-slate-600 sm:block">
              Agrega la primera subcategoría para organizar los productos.
            </p>
          </div>
        ) : (
          <>
            <div className="hidden overflow-hidden rounded-[1.75rem] bg-white shadow-sm ring-1 ring-rose-100 lg:block">
              <table className="w-full border-collapse text-left">
                <thead className="bg-[#fffaf5] text-xs font-black uppercase tracking-wide text-slate-600">
                  <tr>
                    <th className="px-5 py-4">Subcategoría</th>
                    <th className="px-5 py-4">Estado</th>
                    <th className="px-5 py-4">Ordenar</th>
                    <th className="px-5 py-4 text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {selectedSubcategories.map((subcategory) => (
                    <tr key={subcategory.id}>
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-3">
                          {renderSubcategoryImage(subcategory)}
                          <p className="text-sm font-black text-slate-950">
                            {subcategory.name}
                          </p>
                        </div>
                      </td>
                      <td className="px-5 py-4">
                        <span
                          className={`inline-flex rounded-full px-3 py-1.5 text-xs font-black ${
                            subcategory.isActive
                              ? "bg-emerald-50 text-emerald-700"
                              : "bg-slate-100 text-slate-700"
                          }`}
                        >
                          {subcategory.isActive ? "Activa" : "Pausada"}
                        </span>
                      </td>
                      <td className="px-5 py-4">
                        {renderOrderButtons(subcategory)}
                      </td>
                      <td className="px-5 py-4">
                        <div className="flex justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => startEdit(subcategory)}
                            className="inline-flex items-center justify-center gap-2 rounded-full bg-slate-100 px-4 py-2 text-xs font-black text-slate-700 transition hover:bg-slate-200"
                          >
                            <Pencil size={15} />
                            Editar
                          </button>

                          <button
                            type="button"
                            onClick={() =>
                              void handleToggleSubcategory(subcategory)
                            }
                            disabled={busyId === subcategory.id}
                            className="inline-flex items-center justify-center gap-2 rounded-full bg-slate-100 px-4 py-2 text-xs font-black text-slate-700 transition hover:bg-slate-200 disabled:text-slate-400"
                          >
                            <CheckCircle2 size={15} />
                            {subcategory.isActive ? "Pausar" : "Activar"}
                          </button>

                          <button
                            type="button"
                            onClick={() =>
                              void handleDeleteSubcategory(subcategory)
                            }
                            disabled={busyId === subcategory.id}
                            className="inline-flex items-center justify-center gap-2 rounded-full bg-rose-50 px-4 py-2 text-xs font-black text-rose-600 transition hover:bg-rose-100 disabled:text-rose-300"
                          >
                            <Trash2 size={15} />
                            Eliminar
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {isLoading && (
                <div className="border-t border-slate-100 px-5 py-4 text-sm font-bold text-slate-600">
                  Cargando categorías...
                </div>
              )}
            </div>

            <div className="grid gap-3 lg:hidden">
              {selectedSubcategories.map((subcategory) => (
                <article
                  key={`card-${subcategory.id}`}
                  className="rounded-[1.25rem] bg-white p-3 shadow-sm ring-1 ring-rose-100"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex min-w-0 items-center gap-3">
                      {renderSubcategoryImage(subcategory)}
                      <h2 className="line-clamp-2 text-sm font-black leading-tight text-slate-950">
                        {subcategory.name}
                      </h2>
                    </div>

                    <span
                      className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-black ${
                        subcategory.isActive
                          ? "bg-emerald-50 text-emerald-700"
                          : "bg-slate-100 text-slate-700"
                      }`}
                    >
                      {subcategory.isActive ? "Activa" : "Pausada"}
                    </span>
                  </div>

                  <div className="mt-3 rounded-2xl bg-[#fffaf5] p-2.5">
                    <p className="mb-2 text-[11px] font-black uppercase tracking-wide text-slate-600">
                      Ordenar
                    </p>
                    {renderOrderButtons(subcategory)}
                  </div>

                  <div className="mt-3 grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => startEdit(subcategory)}
                      className="inline-flex min-h-10 items-center justify-center gap-1 rounded-full bg-slate-100 px-3 py-2 text-xs font-black text-slate-700"
                    >
                      <Pencil size={14} />
                      Editar
                    </button>

                    <button
                      type="button"
                      onClick={() => void handleToggleSubcategory(subcategory)}
                      disabled={busyId === subcategory.id}
                      className="inline-flex min-h-10 items-center justify-center gap-1 rounded-full bg-slate-100 px-3 py-2 text-xs font-black text-slate-700 disabled:text-slate-400"
                    >
                      <CheckCircle2 size={14} />
                      {subcategory.isActive ? "Pausar" : "Activar"}
                    </button>

                    <button
                      type="button"
                      onClick={() => void handleDeleteSubcategory(subcategory)}
                      disabled={busyId === subcategory.id}
                      className="col-span-2 inline-flex min-h-10 items-center justify-center gap-1 rounded-full bg-rose-50 px-3 py-2 text-xs font-black text-rose-600 disabled:text-rose-300"
                    >
                      <Trash2 size={14} />
                      Eliminar
                    </button>
                  </div>
                </article>
              ))}

              {isLoading && (
                <div className="rounded-2xl bg-white px-4 py-3 text-sm font-bold text-slate-600 ring-1 ring-rose-100">
                  Cargando categorías...
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </section>
  );
}
