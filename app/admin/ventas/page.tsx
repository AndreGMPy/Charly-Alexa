"use client";

import ProductImageFrame from "@/components/ProductImageFrame";
import { useSiteSettings } from "@/hooks/useSiteSettings";
import { getProducts } from "@/lib/firebase-services/products";
import {
  createStoreSale,
  getStoreSales,
  type StoreSale,
} from "@/lib/firebase-services/sales";
import type {
  FirebaseDate,
  FirebaseOrderItem,
  FirebaseProduct,
  MainCategoryName,
  PaymentMethod,
  WholesaleMode,
} from "@/lib/firebase-types";
import { formatPrice } from "@/lib/products";
import { getSafeSaleMessage, logErrorInDevelopment } from "@/lib/safe-errors";
import {
  calculateWholesaleCart,
  normalizeWholesaleMode,
  type WholesaleProductLike,
} from "@/lib/wholesale";
import {
  CheckCircle2,
  Eye,
  PackageCheck,
  Plus,
  RefreshCw,
  Search,
  Trash2,
  WalletCards,
  X,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

type SalesFilter = "today" | "month" | "quarter" | "all";

type SaleLine = {
  id: string;
  productId: string;
  productName: string;
  slug: string;
  category?: MainCategoryName;
  subcategory?: string;
  size: string;
  quantity: number;
  price: number;
  regularPrice: number;
  subtotal: number;
  mainImage: string;
  wholesaleType?: WholesaleMode;
  wholesalePrice?: number | null;
  wholesaleMinimum?: number;
};

const paymentMethods: PaymentMethod[] = [
  "Efectivo",
  "Transferencia",
  "Tarjeta",
  "Otro",
];

const salesFilters: { value: SalesFilter; label: string }[] = [
  { value: "today", label: "Hoy" },
  { value: "month", label: "Mes" },
  { value: "quarter", label: "3 meses" },
  { value: "all", label: "Todo" },
];

export function normalizeSearchText(text: string) {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .replace(/\s+/g, " ");
}

function getDateValue(value: FirebaseDate) {
  if (value instanceof Date) return value.getTime();
  if (typeof value === "string") return Date.parse(value) || 0;
  if (
    value &&
    typeof value === "object" &&
    "toMillis" in value &&
    typeof value.toMillis === "function"
  ) {
    return value.toMillis();
  }

  return 0;
}

function formatDate(value: FirebaseDate) {
  const timestamp = getDateValue(value);

  if (!timestamp) return "Fecha pendiente";

  return new Intl.DateTimeFormat("es-MX", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(timestamp));
}

function startOfToday() {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
}

function startOfCurrentMonth() {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), 1).getTime();
}

function startOfLastThreeMonths() {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth() - 2, 1).getTime();
}

function getProductSizes(product: FirebaseProduct) {
  if (product.sizes.length > 0) return product.sizes;

  const stockSizes = product.stockBySize.map((item) => item.size).filter(Boolean);
  if (stockSizes.length > 0) return stockSizes;

  return product.stock > 0 ? ["Unitalla"] : [];
}

function getStockForSize(product: FirebaseProduct, size: string) {
  const sizeStock = product.stockBySize.find((item) => item.size === size);

  if (sizeStock) return Math.max(sizeStock.stock, 0);
  if (product.stockBySize.length === 0) return Math.max(product.stock, 0);

  return 0;
}

function getAvailableSizes(product: FirebaseProduct) {
  return getProductSizes(product).filter(
    (size) => getStockForSize(product, size) > 0
  );
}

function getPieceLabel(quantity: number) {
  return quantity === 1 ? "1 pieza" : `${quantity} piezas`;
}

function getSizeOptionLabel(product: FirebaseProduct, size: string) {
  return `Talla ${size} — ${getPieceLabel(getStockForSize(product, size))}`;
}

function isSellableProduct(product: FirebaseProduct) {
  return (
    product.isActive &&
    product.stock > 0 &&
    getAvailableSizes(product).length > 0
  );
}

function tokenMatches(searchableText: string, token: string) {
  if (searchableText.includes(token)) return true;

  const singularToken =
    token.length > 3 && token.endsWith("s") ? token.slice(0, -1) : token;

  return singularToken !== token && searchableText.includes(singularToken);
}

function matchesProductSearch(product: FirebaseProduct, searchTerm: string) {
  const normalizedSearch = normalizeSearchText(searchTerm);

  if (!normalizedSearch) return true;

  const searchableText = normalizeSearchText(
    [
      product.name,
      product.category,
      product.subcategory,
      product.colors.join(" "),
      getProductSizes(product).join(" "),
      product.slug,
    ].join(" ")
  );

  return normalizedSearch
    .split(" ")
    .every((token) => tokenMatches(searchableText, token));
}

function getItemName(item: FirebaseOrderItem) {
  return item.productName ?? item.name ?? "Producto";
}

function getSaleItemsText(sale: StoreSale) {
  if (sale.items.length === 0) return "Venta sin productos";

  const [firstItem] = sale.items;
  const firstText = `${getItemName(firstItem)} talla ${firstItem.size}`;
  const extraCount = sale.items.length - 1;

  return extraCount > 0 ? `${firstText} + ${extraCount} más` : firstText;
}

function filterSales(sales: StoreSale[], filter: SalesFilter) {
  if (filter === "all") return sales;

  const startDate =
    filter === "today"
      ? startOfToday()
      : filter === "month"
        ? startOfCurrentMonth()
        : startOfLastThreeMonths();

  return sales.filter((sale) => getDateValue(sale.createdAt) >= startDate);
}

function createLineFromProduct(
  product: FirebaseProduct,
  size: string,
  quantity: number,
  price: number
): SaleLine {
  const mainImage = product.mainImage || product.images[0] || "";

  return {
    id: `${product.id}-${size}-${price}`,
    productId: product.id,
    productName: product.name,
    slug: product.slug,
    category: product.category,
    subcategory: product.subcategory,
    size,
    quantity,
    price,
    regularPrice: product.price,
    subtotal: quantity * price,
    mainImage,
    wholesaleType: product.wholesaleMode,
    wholesalePrice: product.wholesalePrice ?? null,
    wholesaleMinimum: product.wholesaleMinQuantity,
  };
}

function productToWholesaleLike(product: FirebaseProduct): WholesaleProductLike {
  return {
    id: product.id,
    name: product.name,
    price: product.price,
    wholesaleMode: normalizeWholesaleMode(product.wholesaleMode),
    wholesalePrice: product.wholesalePrice ?? null,
    wholesaleMinQuantity: product.wholesaleMinQuantity,
  };
}

function saleLineToWholesaleLike(line: SaleLine): WholesaleProductLike {
  return {
    id: line.productId,
    name: line.productName,
    price: line.regularPrice,
    wholesaleMode: normalizeWholesaleMode(line.wholesaleType),
    wholesalePrice: line.wholesalePrice ?? null,
    wholesaleMinQuantity: line.wholesaleMinimum ?? 0,
  };
}

function saleLineToOrderItem(line: SaleLine): FirebaseOrderItem {
  return {
    productId: line.productId,
    productName: line.productName,
    name: line.productName,
    slug: line.slug,
    category: line.category,
    subcategory: line.subcategory,
    size: line.size,
    quantity: line.quantity,
    price: line.price,
    subtotal: line.subtotal,
    mainImage: line.mainImage,
    image: line.mainImage,
    wholesaleType: line.wholesaleType,
    wholesaleMinimum: line.wholesaleMinimum,
  };
}

function ProductThumb({ product }: { product: FirebaseProduct }) {
  const imageUrl = product.mainImage || product.images[0] || "";

  if (!imageUrl) {
    return (
      <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-rose-50 text-xs font-black text-rose-500 ring-1 ring-rose-100">
        CA
      </div>
    );
  }

  return (
    <ProductImageFrame
      src={imageUrl}
      alt={product.name}
      className="h-14 w-14 shrink-0 rounded-2xl shadow-sm ring-1 ring-slate-100"
    />
  );
}

export default function AdminSalesPage() {
  const { settings } = useSiteSettings();
  const [products, setProducts] = useState<FirebaseProduct[]>([]);
  const [sales, setSales] = useState<StoreSale[]>([]);
  const [selectedProductId, setSelectedProductId] = useState("");
  const [selectedSize, setSelectedSize] = useState("");
  const [quantity, setQuantity] = useState(1);
  const [price, setPrice] = useState(0);
  const [isPriceManuallyEdited, setIsPriceManuallyEdited] = useState(false);
  const [saleLines, setSaleLines] = useState<SaleLine[]>([]);
  const [paymentMethod, setPaymentMethod] =
    useState<PaymentMethod>("Efectivo");
  const [notes, setNotes] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [filter, setFilter] = useState<SalesFilter>("month");
  const [expandedSaleId, setExpandedSaleId] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState("");
  const saleLockRef = useRef(false);

  const loadSalesData = useCallback(async () => {
    try {
      setIsLoading(true);
      setError("");

      const [productItems, saleItems] = await Promise.all([
        getProducts(),
        getStoreSales(),
      ]);

      setProducts(productItems);
      setSales(saleItems);
    } catch {
      setError("No se pudieron cargar las ventas.");
      setProducts([]);
      setSales([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    queueMicrotask(() => {
      void loadSalesData();
    });
  }, [loadSalesData]);

  const visibleProducts = useMemo(
    () =>
      products
        .filter(isSellableProduct)
        .filter((product) => matchesProductSearch(product, searchTerm))
        .slice(0, 8),
    [products, searchTerm]
  );

  const selectedProduct = useMemo(
    () => products.find((product) => product.id === selectedProductId),
    [products, selectedProductId]
  );
  const availableSizes = useMemo(
    () => (selectedProduct ? getAvailableSizes(selectedProduct) : []),
    [selectedProduct]
  );
  const availableStock =
    selectedProduct && selectedSize
      ? getStockForSize(selectedProduct, selectedSize)
      : 0;
  const quantityAlreadyInSale =
    selectedProduct && selectedSize
      ? saleLines
          .filter(
            (line) =>
              line.productId === selectedProduct.id && line.size === selectedSize
          )
          .reduce((total, line) => total + line.quantity, 0)
      : 0;
  const remainingStock = Math.max(availableStock - quantityAlreadyInSale, 0);
  const saleTotal = saleLines.reduce((total, line) => total + line.subtotal, 0);
  const saleTotalItems = saleLines.reduce(
    (total, line) => total + line.quantity,
    0
  );
  const filteredSales = filterSales(sales, filter);
  const showNoResults =
    normalizeSearchText(searchTerm).length > 0 && visibleProducts.length === 0;
  const candidateWholesalePrice = useMemo(() => {
    if (!selectedProduct || !selectedSize || quantity <= 0) {
      return selectedProduct?.price ?? 0;
    }

    const cartLines = [
      ...saleLines.map((line) => ({
        productId: line.productId,
        product: saleLineToWholesaleLike(line),
        quantity: line.quantity,
      })),
      {
        productId: selectedProduct.id,
        product: productToWholesaleLike(selectedProduct),
        quantity,
      },
    ];
    const pricedLines = calculateWholesaleCart(
      cartLines,
      settings.wholesaleSettings
    );

    return pricedLines[pricedLines.length - 1]?.unitPrice ?? selectedProduct.price;
  }, [quantity, saleLines, selectedProduct, selectedSize, settings.wholesaleSettings]);
  const effectivePrice = isPriceManuallyEdited ? price : candidateWholesalePrice;
  const lineSubtotal = effectivePrice * quantity;
  const addLineDisabledReason = useMemo(() => {
    if (!selectedProduct) return "Selecciona un producto.";
    if (!selectedSize) return "Selecciona una talla.";
    if (quantity <= 0) return "Ingresa una cantidad válida.";
    if (effectivePrice <= 0) return "Ingresa un precio válido.";
    if (quantity > remainingStock) return "No hay suficiente stock.";
    return "";
  }, [effectivePrice, quantity, remainingStock, selectedProduct, selectedSize]);
  const canAddLine = addLineDisabledReason.length === 0;
  const registerSaleDisabledReason =
    saleLines.length === 0 ? "Agrega al menos un producto a la venta." : "";

  function selectProduct(product: FirebaseProduct) {
    const [firstSize = ""] = getAvailableSizes(product);

    setSelectedProductId(product.id);
    setSelectedSize(firstSize);
    setPrice(product.price);
    setIsPriceManuallyEdited(false);
    setQuantity(1);
    setSearchTerm(product.name);
  }

  function clearSelectedProduct() {
    setSelectedProductId("");
    setSelectedSize("");
    setPrice(0);
    setIsPriceManuallyEdited(false);
    setQuantity(1);
    setSearchTerm("");
  }

  function handleAddLine() {
    if (!canAddLine) {
      toast.error(addLineDisabledReason);
      return;
    }

    if (!selectedProduct || !selectedSize) return;

    const nextLine = createLineFromProduct(
      selectedProduct,
      selectedSize,
      quantity,
      effectivePrice
    );

    setSaleLines((currentLines) => {
      const existingLine = currentLines.find(
        (line) =>
          line.productId === nextLine.productId &&
          line.size === nextLine.size &&
          line.price === nextLine.price
      );

      if (!existingLine) return [...currentLines, nextLine];

      return currentLines.map((line) =>
        line.id === existingLine.id && line.price === existingLine.price
          ? {
              ...line,
              quantity: line.quantity + nextLine.quantity,
              subtotal: (line.quantity + nextLine.quantity) * line.price,
            }
          : line
      );
    });

    toast.success("Producto agregado a la venta");
    setQuantity(1);
  }

  function removeLine(lineId: string) {
    setSaleLines((currentLines) =>
      currentLines.filter((line) => line.id !== lineId)
    );
  }

  async function handleSaveSale() {
    if (saleLockRef.current || isSaving) return;

    saleLockRef.current = true;

    if (saleLines.length === 0) {
      toast.error("Agrega al menos un producto a la venta.");
      saleLockRef.current = false;
      return;
    }

    const items = saleLines.map(saleLineToOrderItem);

    try {
      setIsSaving(true);
      await createStoreSale({
        items,
        total: saleTotal,
        totalItems: saleTotalItems,
        paymentMethod,
        notes: notes.trim(),
        createdBy: "admin",
      });

      toast.success("Venta registrada e inventario actualizado.");
      setSelectedProductId("");
      setSelectedSize("");
      setQuantity(1);
      setPrice(0);
      setIsPriceManuallyEdited(false);
      setSaleLines([]);
      setPaymentMethod("Efectivo");
      setNotes("");
      setSearchTerm("");
      await loadSalesData();
    } catch (saveError) {
      logErrorInDevelopment("Admin sale save error", saveError);
      toast.error(getSafeSaleMessage(saveError));
    } finally {
      setIsSaving(false);
      saleLockRef.current = false;
    }
  }

  return (
    <section className="space-y-4 sm:space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.18em] text-lime-700">
            Ventas de tienda
          </p>
          <h1 className="mt-1 text-xl font-black text-slate-950 sm:mt-2 sm:text-4xl">
            Ventas de tienda
          </h1>
          <p className="mt-1 max-w-2xl text-sm font-medium leading-6 text-slate-500 sm:mt-2">
            Registra ventas y descuenta inventario.
          </p>
        </div>

        <button
          type="button"
          onClick={() => void loadSalesData()}
          className="inline-flex min-h-10 items-center justify-center gap-2 rounded-full bg-white px-4 py-2 text-xs font-black text-slate-700 shadow-sm ring-1 ring-slate-100 transition hover:bg-slate-50 sm:min-h-11 sm:px-5 sm:py-3 sm:text-sm"
        >
          <RefreshCw size={17} />
          Actualizar
        </button>
      </div>

      {error && (
        <div className="rounded-2xl bg-rose-50 px-4 py-3 text-sm font-bold text-rose-700 ring-1 ring-rose-100">
          {error}
        </div>
      )}

      <div className="grid min-w-0 gap-3 sm:gap-4 xl:grid-cols-[0.95fr_1.05fr]">
        <section className="min-w-0 rounded-[1.25rem] bg-white p-3 shadow-sm ring-1 ring-rose-100 sm:rounded-[1.75rem] sm:p-6">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-lime-50 text-lime-700 ring-1 ring-lime-100 sm:h-12 sm:w-12">
              <WalletCards size={20} />
            </div>
            <div>
              <h2 className="text-lg font-black text-slate-950 sm:text-xl">
                Agregar producto
              </h2>
              <p className="text-xs font-bold text-slate-500">
                Busca, elige talla y cantidad.
              </p>
            </div>
          </div>

          <div className="mt-3 space-y-3 sm:mt-5 sm:space-y-4">
            <label className="block">
              <span className="text-xs font-black uppercase text-slate-500">
                Buscar producto
              </span>
              <div className="mt-1.5 flex min-w-0 items-center gap-2 rounded-xl border border-slate-200 bg-[#fffaf5] px-3 py-2 sm:mt-2 sm:rounded-2xl sm:px-4 sm:py-3">
                <Search size={17} className="text-slate-400" />
                <input
                  value={searchTerm}
                  onChange={(event) => setSearchTerm(event.target.value)}
                  className="w-full min-w-0 bg-transparent text-[16px] font-bold outline-none sm:text-sm"
                  placeholder="Nombre, talla, color o categoría"
                />
              </div>
            </label>

            <div className="space-y-2">
              {showNoResults ? (
                <div className="rounded-2xl bg-[#fffaf5] px-4 py-3 text-sm font-bold text-slate-600 ring-1 ring-rose-100">
                  No encontramos productos con esa búsqueda.
                </div>
              ) : (
                visibleProducts.map((product) => {
                  const isSelected = product.id === selectedProductId;

                  return (
                    <button
                      key={product.id}
                      type="button"
                      onClick={() => selectProduct(product)}
                      className={`flex min-w-0 w-full items-center gap-3 rounded-xl p-2.5 text-left transition sm:rounded-2xl sm:p-3 ${
                        isSelected
                          ? "bg-lime-50 ring-2 ring-lime-300"
                          : "bg-[#fffaf5] ring-1 ring-rose-100 hover:bg-rose-50"
                      }`}
                    >
                      <ProductThumb product={product} />
                      <span className="min-w-0 flex-1">
                        <span className="line-clamp-1 text-sm font-black text-slate-950">
                          {product.name}
                        </span>
                        <span className="mt-0.5 block text-xs font-bold text-slate-500">
                          {product.category} · {product.subcategory} ·{" "}
                          {product.stock} pieza(s)
                        </span>
                      </span>
                      {isSelected && (
                        <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-lime-600 px-2.5 py-1 text-[10px] font-black uppercase text-white">
                          <CheckCircle2 size={12} />
                          Seleccionado
                        </span>
                      )}
                    </button>
                  );
                })
              )}
            </div>

            {selectedProduct && (
              <div className="flex min-w-0 flex-col gap-2 rounded-2xl bg-lime-50 px-3 py-2.5 ring-1 ring-lime-100 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <p className="text-[11px] font-black uppercase tracking-wide text-lime-700">
                    Producto seleccionado
                  </p>
                  <p className="mt-0.5 truncate text-sm font-black text-slate-950">
                    {selectedProduct.name}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={clearSelectedProduct}
                  className="inline-flex min-h-9 items-center justify-center gap-1.5 rounded-full bg-white px-3 py-2 text-xs font-black text-slate-700 shadow-sm ring-1 ring-lime-100 transition hover:bg-lime-50"
                >
                  <X size={14} />
                  Quitar selección
                </button>
              </div>
            )}

            <div className="grid gap-3 sm:grid-cols-3">
              <label className="block sm:col-span-1">
                <span className="text-xs font-black uppercase text-slate-500">
                  Talla
                </span>
                <select
                  value={selectedSize}
                  onChange={(event) => {
                    setSelectedSize(event.target.value);
                    setIsPriceManuallyEdited(false);
                  }}
                  className="mt-1.5 w-full min-w-0 rounded-xl border border-slate-200 bg-[#fffaf5] px-3 py-2 text-[16px] font-bold outline-none transition focus:border-lime-300 focus:bg-white sm:mt-2 sm:rounded-2xl sm:px-4 sm:py-3 sm:text-sm"
                  disabled={!selectedProduct}
                >
                  <option value="">Talla</option>
                  {availableSizes.map((size) => (
                    <option key={size} value={size}>
                      {selectedProduct
                        ? getSizeOptionLabel(selectedProduct, size)
                        : `Talla ${size}`}
                    </option>
                  ))}
                </select>
              </label>

              <label className="block">
                <span className="text-xs font-black uppercase text-slate-500">
                  Cantidad
                </span>
                <input
                  type="number"
                  min={1}
                  max={remainingStock || 1}
                  value={quantity}
                  onChange={(event) =>
                    setQuantity(Math.max(Number(event.target.value) || 1, 1))
                  }
                  className="mt-1.5 w-full min-w-0 rounded-xl border border-slate-200 bg-[#fffaf5] px-3 py-2 text-[16px] font-bold outline-none transition focus:border-lime-300 focus:bg-white sm:mt-2 sm:rounded-2xl sm:px-4 sm:py-3 sm:text-sm"
                />
              </label>

              <label className="block">
                <span className="text-xs font-black uppercase text-slate-500">
                  Precio
                </span>
                <input
                  type="number"
                  min={0}
                  value={effectivePrice}
                  onChange={(event) => {
                    setIsPriceManuallyEdited(true);
                    setPrice(Math.max(Number(event.target.value) || 0, 0));
                  }}
                  className="mt-1.5 w-full min-w-0 rounded-xl border border-slate-200 bg-[#fffaf5] px-3 py-2 text-[16px] font-bold outline-none transition focus:border-lime-300 focus:bg-white sm:mt-2 sm:rounded-2xl sm:px-4 sm:py-3 sm:text-sm"
                />
                <p className="mt-1 text-[11px] font-semibold leading-4 text-slate-500">
                  Puedes modificarlo si hiciste un descuento.
                </p>
              </label>
            </div>

            <div className="flex flex-col gap-2 rounded-2xl bg-lime-50 px-3 py-2.5 text-xs font-black text-lime-800 ring-1 ring-lime-100 sm:flex-row sm:items-center sm:justify-between sm:px-4 sm:py-3">
              <span>
                {selectedProduct && selectedSize
                  ? `${getPieceLabel(remainingStock)} disponibles para agregar.`
                  : "Selecciona producto y talla."}
              </span>
              <span>{formatPrice(lineSubtotal || 0)}</span>
            </div>

            <button
              type="button"
              onClick={handleAddLine}
              disabled={!canAddLine}
              className="inline-flex min-h-10 w-full items-center justify-center gap-2 rounded-full bg-slate-950 px-4 py-2 text-xs font-black text-white shadow-sm transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-300 sm:min-h-12 sm:px-5 sm:py-3 sm:text-sm"
            >
              <Plus size={18} />
              Agregar a la venta
            </button>
            {addLineDisabledReason && (
              <p className="text-center text-xs font-bold text-slate-500">
                {addLineDisabledReason}
              </p>
            )}
          </div>
        </section>

        <section className="min-w-0 rounded-[1.25rem] bg-white p-3 shadow-sm ring-1 ring-rose-100 sm:rounded-[1.75rem] sm:p-6">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.16em] text-lime-700">
                Venta actual
              </p>
              <h2 className="mt-1 text-lg font-black text-slate-950 sm:text-xl">
                Productos agregados
              </h2>
            </div>
            <div className="rounded-2xl bg-[#fffaf5] px-3 py-2 text-right ring-1 ring-rose-100">
              <p className="text-[11px] font-black uppercase text-slate-500">
                Total
              </p>
              <p className="text-xl font-black text-slate-950">
                {formatPrice(saleTotal)}
              </p>
            </div>
          </div>

          <div className="mt-4 space-y-2">
            {saleLines.length === 0 ? (
              <div className="rounded-2xl bg-[#fffaf5] px-4 py-5 text-sm font-bold text-slate-500 ring-1 ring-rose-100">
                Aún no has agregado productos a esta venta.
              </div>
            ) : (
              saleLines.map((line) => (
                <article
                  key={`${line.id}-${line.price}`}
                  className="grid gap-3 rounded-2xl bg-[#fffaf5] p-3 ring-1 ring-rose-100 sm:grid-cols-[1fr_auto]"
                >
                  <div className="min-w-0">
                    <p className="line-clamp-1 text-sm font-black text-slate-950">
                      {line.productName}
                    </p>
                    <p className="mt-1 text-xs font-bold text-slate-500">
                      Talla {line.size} · {getPieceLabel(line.quantity)} ·{" "}
                      {formatPrice(line.price)} c/u
                    </p>
                  </div>

                  <div className="flex items-center justify-between gap-3 sm:justify-end">
                    <p className="text-sm font-black text-slate-950">
                      {formatPrice(line.subtotal)}
                    </p>
                    <button
                      type="button"
                      onClick={() => removeLine(line.id)}
                      className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white text-rose-600 shadow-sm ring-1 ring-rose-100 transition hover:bg-rose-50"
                      aria-label={`Quitar ${line.productName} talla ${line.size}`}
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                </article>
              ))
            )}
          </div>

          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <label className="block">
              <span className="text-xs font-black uppercase text-slate-500">
                Método de pago
              </span>
              <select
                value={paymentMethod}
                onChange={(event) =>
                  setPaymentMethod(event.target.value as PaymentMethod)
                }
                className="mt-1.5 w-full min-w-0 rounded-xl border border-slate-200 bg-[#fffaf5] px-3 py-2 text-[16px] font-bold outline-none transition focus:border-lime-300 focus:bg-white sm:mt-2 sm:rounded-2xl sm:px-4 sm:py-3 sm:text-sm"
              >
                {paymentMethods.map((method) => (
                  <option key={method} value={method}>
                    {method}
                  </option>
                ))}
              </select>
            </label>

            <div className="rounded-2xl bg-[#fffaf5] px-4 py-3 ring-1 ring-rose-100">
              <p className="text-xs font-black uppercase text-slate-500">
                Piezas
              </p>
              <p className="mt-1 text-xl font-black text-slate-950">
                {saleTotalItems}
              </p>
            </div>
          </div>

          <label className="mt-3 block">
            <span className="text-xs font-black uppercase text-slate-500">
              Nota opcional
            </span>
            <textarea
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              className="mt-1.5 min-h-14 w-full min-w-0 rounded-xl border border-slate-200 bg-[#fffaf5] px-3 py-2 text-[16px] font-bold outline-none transition focus:border-lime-300 focus:bg-white sm:mt-2 sm:min-h-16 sm:rounded-2xl sm:px-4 sm:py-3 sm:text-sm"
              placeholder="Ej. Venta en mostrador."
            />
          </label>

          <button
            type="button"
            onClick={() => void handleSaveSale()}
            disabled={isSaving || saleLines.length === 0}
            className="mt-4 inline-flex min-h-10 w-full items-center justify-center gap-2 rounded-full bg-lime-600 px-4 py-2 text-xs font-black text-white shadow-sm transition hover:bg-lime-700 disabled:cursor-not-allowed disabled:bg-slate-300 sm:min-h-12 sm:px-5 sm:py-3 sm:text-sm"
          >
            <PackageCheck size={18} />
            {isSaving ? "Registrando venta..." : "Registrar venta"}
          </button>
          {registerSaleDisabledReason && (
            <p className="mt-2 text-center text-xs font-bold text-slate-500">
              {registerSaleDisabledReason}
            </p>
          )}
        </section>
      </div>

      <section className="min-w-0 rounded-[1.25rem] bg-white p-3 shadow-sm ring-1 ring-rose-100 sm:rounded-[1.75rem] sm:p-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.16em] text-lime-700">
              Historial
            </p>
            <h2 className="mt-1 text-lg font-black text-slate-950 sm:text-xl">
              Ventas registradas
            </h2>
          </div>

          <div className="-mx-1 overflow-x-auto px-1">
            <div className="flex min-w-max gap-2 sm:min-w-0 sm:flex-wrap">
              {salesFilters.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setFilter(option.value)}
                  className={`min-h-9 whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-black transition sm:px-4 sm:py-2 ${
                    filter === option.value
                      ? "bg-slate-950 text-white"
                      : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {isLoading ? (
          <div className="mt-4 rounded-2xl bg-[#fffaf5] px-4 py-3 text-sm font-bold text-slate-500 ring-1 ring-rose-100">
            Cargando ventas...
          </div>
        ) : filteredSales.length === 0 ? (
          <div className="mt-4 rounded-2xl bg-[#fffaf5] px-4 py-5 text-sm font-bold leading-6 text-slate-500 ring-1 ring-rose-100">
            Aún no hay ventas físicas registradas.
          </div>
        ) : (
          <div className="mt-4 grid gap-3 lg:grid-cols-2">
            {filteredSales.map((sale) => {
              const isExpanded = expandedSaleId === sale.id;

              return (
                <article
                  key={sale.id}
                  className="rounded-2xl bg-[#fffaf5] p-3 ring-1 ring-rose-100"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="line-clamp-1 text-sm font-black text-slate-950">
                        {getSaleItemsText(sale)}
                      </p>
                      <p className="mt-1 text-xs font-bold text-slate-500">
                        {formatDate(sale.createdAt)} ·{" "}
                        {sale.paymentMethod ?? "Pago no registrado"}
                      </p>
                    </div>
                    <p className="shrink-0 text-base font-black text-slate-950">
                      {formatPrice(sale.total)}
                    </p>
                  </div>

                  {isExpanded && (
                    <div className="mt-3 space-y-2">
                      {sale.items.map((item, index) => (
                        <div
                          key={`${sale.id}-${item.productId}-${index}`}
                          className="rounded-2xl bg-white p-3"
                        >
                          <p className="text-sm font-black text-slate-950">
                            {getItemName(item)}
                          </p>
                          <p className="mt-1 text-xs font-bold text-slate-500">
                            Talla {item.size} · {getPieceLabel(item.quantity)} ·{" "}
                            {formatPrice(item.subtotal)}
                          </p>
                        </div>
                      ))}

                      {sale.notes && (
                        <div className="rounded-2xl bg-white p-3">
                          <p className="text-xs font-black uppercase text-slate-500">
                            Nota
                          </p>
                          <p className="mt-1 text-sm font-bold leading-6 text-slate-600">
                            {sale.notes}
                          </p>
                        </div>
                      )}
                    </div>
                  )}

                  <button
                    type="button"
                    onClick={() => setExpandedSaleId(isExpanded ? "" : sale.id)}
                    className="mt-3 inline-flex min-h-9 items-center justify-center gap-2 rounded-full bg-white px-3 py-1.5 text-xs font-black text-slate-700 shadow-sm ring-1 ring-slate-100 transition hover:bg-slate-50"
                  >
                    <Eye size={15} />
                    {isExpanded ? "Ocultar detalle" : "Ver detalle"}
                  </button>
                </article>
              );
            })}
          </div>
        )}
      </section>
    </section>
  );
}
