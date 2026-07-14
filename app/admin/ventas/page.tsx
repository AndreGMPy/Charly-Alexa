"use client";

import ProductImageFrame from "@/components/ProductImageFrame";
import { buildWhatsAppUrlWithNumber, useSiteSettings } from "@/hooks/useSiteSettings";
import { db } from "@/lib/firebase";
import {
  adjustProductInventory,
  type InventoryAdjustmentReason,
} from "@/lib/firebase-services/inventory";
import { getProducts } from "@/lib/firebase-services/products";
import {
  cancelStoreSale,
  createCashClosure,
  createStoreSale,
  getStoreSales,
  type StoreSale,
} from "@/lib/firebase-services/sales";
import type {
  FirebaseDate,
  FirebaseOrderItem,
  FirebaseProduct,
  PaymentBreakdown,
  PaymentMethod,
  ProductCategoryValue,
} from "@/lib/firebase-types";
import { formatPrice } from "@/lib/products";
import { buildStoreReceiptText } from "@/lib/receipts";
import { getSafeSaleMessage, logErrorInDevelopment } from "@/lib/safe-errors";
import { getStockForVariant } from "@/lib/variant-utils";
import {
  calculateWholesaleCart,
  getWholesaleRunSizes,
  getWholesaleRunUnitPrice,
  type WholesaleProductLike,
} from "@/lib/wholesale";
import {
  Archive,
  CheckCircle2,
  Copy,
  Eye,
  PackageCheck,
  PauseCircle,
  Plus,
  Printer,
  RefreshCw,
  RotateCcw,
  Search,
  Send,
  Trash2,
  WalletCards,
  X,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

type SalesFilter = "today" | "week" | "month" | "quarter" | "all";
type PaymentFilter = "all" | PaymentMethod;
type DiscountType = "amount" | "percent";

type SaleLine = {
  id: string;
  productId: string;
  productName: string;
  slug: string;
  category?: ProductCategoryValue;
  subcategory?: string;
  color: string;
  size: string;
  quantity: number;
  regularPrice: number;
  mainImage: string;
  product: WholesaleProductLike;
};

type HeldSale = {
  id: string;
  label: string;
  lines: SaleLine[];
  customerName: string;
  customerPhone: string;
  customerNote: string;
  notes: string;
};

type TicketData = {
  folio: string;
  items: FirebaseOrderItem[];
  subtotal: number;
  discountTotal: number;
  total: number;
  paymentMethod: PaymentMethod;
  paymentBreakdown?: PaymentBreakdown;
  customerPhone: string;
  createdAt: Date;
};

const paymentMethods: PaymentMethod[] = [
  "Efectivo",
  "Transferencia",
  "Tarjeta",
  "Mixto",
];

const salesFilters: { value: SalesFilter; label: string }[] = [
  { value: "today", label: "Hoy" },
  { value: "week", label: "Semana" },
  { value: "month", label: "Mes" },
  { value: "quarter", label: "3 meses" },
  { value: "all", label: "Todo" },
];

function normalizeSearchText(text: string) {
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

function startOfWeek() {
  const now = new Date();
  const day = now.getDay() || 7;
  return new Date(now.getFullYear(), now.getMonth(), now.getDate() - day + 1).getTime();
}

function startOfCurrentMonth() {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), 1).getTime();
}

function startOfLastThreeMonths() {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth() - 2, 1).getTime();
}

function getProductColors(product: FirebaseProduct) {
  return product.colors.length > 0 ? product.colors : ["Sin color"];
}

function getProductSizes(product: FirebaseProduct) {
  if (product.sizes.length > 0) return product.sizes;
  const stockSizes = product.stockBySize.map((item) => item.size).filter(Boolean);
  return stockSizes.length > 0 ? stockSizes : ["Unitalla"];
}

function getStockForProductVariant(
  product: FirebaseProduct,
  color: string,
  size: string
) {
  return getStockForVariant(product, color, size);
}

function getAvailableColors(product: FirebaseProduct) {
  return getProductColors(product).filter((color) =>
    getProductSizes(product).some(
      (size) => getStockForProductVariant(product, color, size) > 0
    )
  );
}

function getAvailableSizes(product: FirebaseProduct, color: string) {
  return getProductSizes(product).filter(
    (size) => getStockForProductVariant(product, color, size) > 0
  );
}

function getPieceLabel(quantity: number) {
  return quantity === 1 ? "1 pieza" : `${quantity} piezas`;
}

function isSellableProduct(product: FirebaseProduct) {
  return product.isActive && product.stock > 0 && getAvailableColors(product).length > 0;
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
      product.subcategories?.join(" "),
      product.colors.join(" "),
      getProductSizes(product).join(" "),
      product.slug,
    ].join(" ")
  );

  return normalizedSearch
    .split(" ")
    .every((token) => tokenMatches(searchableText, token));
}

function productToWholesaleLike(product: FirebaseProduct): WholesaleProductLike {
  return {
    id: product.id,
    name: product.name,
    price: product.price,
    sizes: getProductSizes(product),
    wholesaleMode: product.wholesaleMode ?? "none",
    wholesalePrice: product.wholesalePrice ?? null,
    wholesaleMinQuantity: product.wholesaleMinQuantity ?? 0,
    wholesaleRunEnabled: Boolean(product.wholesaleRunEnabled),
    wholesaleRunPrice: product.wholesaleRunPrice ?? null,
    wholesaleRunSizes: product.wholesaleRunSizes ?? [],
  };
}

function createLineFromProduct(
  product: FirebaseProduct,
  color: string,
  size: string,
  quantity: number
): SaleLine {
  const mainImage = product.mainImage || product.images[0] || "";

  return {
    id: `${product.id}-${color}-${size}`,
    productId: product.id,
    productName: product.name,
    slug: product.slug,
    category: product.category,
    subcategory: product.subcategory,
    color,
    size,
    quantity,
    regularPrice: product.price,
    mainImage,
    product: productToWholesaleLike(product),
  };
}

function saleLineToOrderItems(
  line: SaleLine,
  pricing: ReturnType<typeof calculateWholesaleCart<SaleLine>>[number]
): FirebaseOrderItem[] {
  const baseItem = {
    productId: line.productId,
    productName: line.productName,
    name: line.productName,
    slug: line.slug,
    category: line.category,
    subcategory: line.subcategory,
    color: line.color,
    size: line.size,
    mainImage: line.mainImage,
    image: line.mainImage,
    regularPrice: line.regularPrice,
    wholesaleType: line.product.wholesaleMode as FirebaseOrderItem["wholesaleType"],
    wholesaleMinimum: line.product.wholesaleMinQuantity ?? 0,
    wholesaleRunPrice: line.product.wholesaleRunPrice ?? null,
  };
  const items: FirebaseOrderItem[] = [];

  if (pricing.wholesaleQuantity > 0) {
    const wholesalePrice =
      line.product.wholesaleRunEnabled && line.product.wholesaleRunPrice
        ? line.product.wholesaleRunPrice
        : pricing.unitPrice;

    items.push({
      ...baseItem,
      quantity: pricing.wholesaleQuantity,
      price: wholesalePrice,
      subtotal: wholesalePrice * pricing.wholesaleQuantity,
      wholesaleRunApplied: Boolean(line.product.wholesaleRunEnabled),
      priceLabel: line.product.wholesaleRunEnabled ? "wholesale_run" : "wholesale",
    });
  }

  if (pricing.regularQuantity > 0) {
    items.push({
      ...baseItem,
      quantity: pricing.regularQuantity,
      price: line.regularPrice,
      subtotal: line.regularPrice * pricing.regularQuantity,
      wholesaleRunApplied: false,
      priceLabel: "regular",
    });
  }

  return items;
}

function getSaleItemsText(sale: StoreSale) {
  if (sale.items.length === 0) return "Venta sin productos";

  const [firstItem] = sale.items;
  const firstText = `${firstItem.productName ?? firstItem.name} ${firstItem.color ?? "Sin color"} talla ${firstItem.size}`;
  const extraCount = sale.items.length - 1;

  return extraCount > 0 ? `${firstText} + ${extraCount} más` : firstText;
}

function isCancelledSale(sale: StoreSale) {
  return sale.status === "Cancelada" || sale.status === "cancelled";
}

function filterSales(
  sales: StoreSale[],
  filter: SalesFilter,
  paymentFilter: PaymentFilter,
  search: string
) {
  const startDate =
    filter === "today"
      ? startOfToday()
      : filter === "week"
        ? startOfWeek()
        : filter === "month"
          ? startOfCurrentMonth()
          : filter === "quarter"
            ? startOfLastThreeMonths()
            : 0;
  const normalizedSearch = normalizeSearchText(search);

  return sales.filter((sale) => {
    if (startDate && getDateValue(sale.createdAt) < startDate) return false;
    if (paymentFilter !== "all" && sale.paymentMethod !== paymentFilter) return false;
    if (!normalizedSearch) return true;

    const searchableText = normalizeSearchText(
      [
        sale.folio,
        sale.items.map((item) => item.productName ?? item.name).join(" "),
        sale.customer?.name,
        sale.customer?.phone,
      ].join(" ")
    );

    return normalizedSearch
      .split(" ")
      .every((token) => tokenMatches(searchableText, token));
  });
}

function getPaymentBreakdownTotal(breakdown: PaymentBreakdown) {
  return breakdown.cash + breakdown.transfer + breakdown.card;
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
  const [selectedColor, setSelectedColor] = useState("");
  const [selectedSize, setSelectedSize] = useState("");
  const [quantity, setQuantity] = useState(1);
  const [saleLines, setSaleLines] = useState<SaleLine[]>([]);
  const [heldSales, setHeldSales] = useState<HeldSale[]>([]);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("Efectivo");
  const [paymentBreakdown, setPaymentBreakdown] = useState<PaymentBreakdown>({
    cash: 0,
    transfer: 0,
    card: 0,
  });
  const [discountType, setDiscountType] = useState<DiscountType>("amount");
  const [discountValue, setDiscountValue] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [customerNote, setCustomerNote] = useState("");
  const [notes, setNotes] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [historySearch, setHistorySearch] = useState("");
  const [filter, setFilter] = useState<SalesFilter>("today");
  const [paymentFilter, setPaymentFilter] = useState<PaymentFilter>("all");
  const [expandedSaleId, setExpandedSaleId] = useState("");
  const [cashClosureNotes, setCashClosureNotes] = useState("");
  const [adjustProductId, setAdjustProductId] = useState("");
  const [adjustColor, setAdjustColor] = useState("");
  const [adjustSize, setAdjustSize] = useState("");
  const [adjustMode, setAdjustMode] = useState<"set" | "move">("set");
  const [adjustQuantity, setAdjustQuantity] = useState("");
  const [adjustReason, setAdjustReason] =
    useState<InventoryAdjustmentReason>("conteo físico");
  const [lastTicket, setLastTicket] = useState<TicketData | null>(null);
  const [isTicketVisible, setIsTicketVisible] = useState(true);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isClosingCash, setIsClosingCash] = useState(false);
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
        .slice(0, 10),
    [products, searchTerm]
  );
  const selectedProduct = useMemo(
    () => products.find((product) => product.id === selectedProductId),
    [products, selectedProductId]
  );
  const availableColors = useMemo(
    () => (selectedProduct ? getAvailableColors(selectedProduct) : []),
    [selectedProduct]
  );
  const availableSizes = useMemo(
    () =>
      selectedProduct && selectedColor
        ? getAvailableSizes(selectedProduct, selectedColor)
        : [],
    [selectedColor, selectedProduct]
  );
  const adjustProduct = useMemo(
    () => products.find((product) => product.id === adjustProductId),
    [adjustProductId, products]
  );
  const adjustColors = useMemo(
    () => (adjustProduct ? getProductColors(adjustProduct) : []),
    [adjustProduct]
  );
  const adjustSizes = useMemo(
    () => (adjustProduct ? getProductSizes(adjustProduct) : []),
    [adjustProduct]
  );
  const availableStock =
    selectedProduct && selectedColor && selectedSize
      ? getStockForProductVariant(selectedProduct, selectedColor, selectedSize)
      : 0;
  const quantityAlreadyInSale =
    selectedProduct && selectedColor && selectedSize
      ? saleLines
          .filter(
            (line) =>
              line.productId === selectedProduct.id &&
              line.color === selectedColor &&
              line.size === selectedSize
          )
          .reduce((total, line) => total + line.quantity, 0)
      : 0;
  const remainingStock = Math.max(availableStock - quantityAlreadyInSale, 0);
  const pricedLines = useMemo(
    () => calculateWholesaleCart(saleLines, settings.wholesaleSettings),
    [saleLines, settings.wholesaleSettings]
  );
  const subtotal = pricedLines.reduce((total, line) => total + line.subtotal, 0);
  const discountNumber = Math.max(Number(discountValue) || 0, 0);
  const discountTotal =
    discountType === "percent"
      ? Math.min(subtotal * (discountNumber / 100), subtotal)
      : Math.min(discountNumber, subtotal);
  const saleTotal = Math.max(subtotal - discountTotal, 0);
  const saleTotalItems = saleLines.reduce(
    (total, line) => total + line.quantity,
    0
  );
  const candidateLinePrice = useMemo(() => {
    if (!selectedProduct || !selectedColor || !selectedSize) {
      return selectedProduct?.price ?? 0;
    }

    const candidate = createLineFromProduct(
      selectedProduct,
      selectedColor,
      selectedSize,
      quantity
    );
    const [lastLine] = calculateWholesaleCart(
      [...saleLines, candidate],
      settings.wholesaleSettings
    ).slice(-1);

    return lastLine?.unitPrice ?? selectedProduct.price;
  }, [
    quantity,
    saleLines,
    selectedColor,
    selectedProduct,
    selectedSize,
    settings.wholesaleSettings,
  ]);
  const addLineDisabledReason = useMemo(() => {
    if (!selectedProduct) return "Selecciona un producto.";
    if (!selectedColor) return "Selecciona un color.";
    if (!selectedSize) return "Selecciona una talla.";
    if (quantity <= 0) return "Ingresa una cantidad válida.";
    if (quantity > remainingStock) return "No hay suficiente stock.";
    return "";
  }, [quantity, remainingStock, selectedColor, selectedProduct, selectedSize]);
  const filteredSales = useMemo(
    () => filterSales(sales, filter, paymentFilter, historySearch),
    [filter, historySearch, paymentFilter, sales]
  );
  const todaySales = useMemo(
    () => sales.filter((sale) => getDateValue(sale.createdAt) >= startOfToday()),
    [sales]
  );
  const cashTotals = useMemo(() => {
    const activeSales = todaySales.filter((sale) => !isCancelledSale(sale));
    const cancelled = todaySales.filter(isCancelledSale);

    return activeSales.reduce(
      (totals, sale) => {
        const breakdown = sale.paymentBreakdown;
        const paymentTotal = sale.total ?? 0;

        return {
          sold: totals.sold + paymentTotal,
          cash:
            totals.cash +
            (breakdown
              ? breakdown.cash
              : sale.paymentMethod === "Efectivo"
                ? paymentTotal
                : 0),
          transfer:
            totals.transfer +
            (breakdown
              ? breakdown.transfer
              : sale.paymentMethod === "Transferencia"
                ? paymentTotal
                : 0),
          card:
            totals.card +
            (breakdown
              ? breakdown.card
              : sale.paymentMethod === "Tarjeta"
                ? paymentTotal
                : 0),
          discounts: totals.discounts + (sale.discount?.total ?? 0),
          pieces: totals.pieces + (sale.totalItems ?? 0),
          cancelled: cancelled.length,
          salesCount: activeSales.length,
        };
      },
      {
        sold: 0,
        cash: 0,
        transfer: 0,
        card: 0,
        discounts: 0,
        pieces: 0,
        cancelled: cancelled.length,
        salesCount: activeSales.length,
      }
    );
  }, [todaySales]);
  const lowStockProducts = useMemo(
    () =>
      products
        .filter((product) => product.isActive && product.stock > 0 && product.stock <= 4)
        .slice(0, 6),
    [products]
  );
  const outOfStockProducts = useMemo(
    () =>
      products
        .filter((product) => product.isActive && product.stock <= 0)
        .slice(0, 6),
    [products]
  );

  function selectProduct(product: FirebaseProduct) {
    const [firstColor = ""] = getAvailableColors(product);
    const [firstSize = ""] = firstColor ? getAvailableSizes(product, firstColor) : [];

    setSelectedProductId(product.id);
    setSelectedColor(firstColor);
    setSelectedSize(firstSize);
    setQuantity(1);
    setSearchTerm(product.name);
  }

  function clearSelectedProduct() {
    setSelectedProductId("");
    setSelectedColor("");
    setSelectedSize("");
    setQuantity(1);
    setSearchTerm("");
  }

  function addLineToSale(nextLine: SaleLine) {
    setSaleLines((currentLines) => {
      const existingLine = currentLines.find((line) => line.id === nextLine.id);
      if (!existingLine) return [...currentLines, nextLine];

      return currentLines.map((line) =>
        line.id === existingLine.id
          ? { ...line, quantity: line.quantity + nextLine.quantity }
          : line
      );
    });
  }

  function handleAddLine() {
    if (addLineDisabledReason) {
      toast.error(addLineDisabledReason);
      return;
    }

    if (!selectedProduct || !selectedColor || !selectedSize) return;

    addLineToSale(
      createLineFromProduct(selectedProduct, selectedColor, selectedSize, quantity)
    );
    toast.success("Producto agregado a la venta");
    setQuantity(1);
  }

  function handleAddRun() {
    if (!selectedProduct) {
      toast.error("Selecciona un producto.");
      return;
    }

    const runPrice = getWholesaleRunUnitPrice(productToWholesaleLike(selectedProduct));
    const runSizes = getWholesaleRunSizes(productToWholesaleLike(selectedProduct));

    if (!selectedProduct.wholesaleRunEnabled || !runPrice || runSizes.length === 0) {
      toast.error("Este producto no tiene mayoreo corrido activo.");
      return;
    }

    if (!selectedColor) {
      toast.error("Selecciona un color.");
      return;
    }

    const missingStock = runSizes.find((size) => {
      const stock = getStockForProductVariant(selectedProduct, selectedColor, size);
      const alreadyInSale = saleLines
        .filter(
          (line) =>
            line.productId === selectedProduct.id &&
            line.color === selectedColor &&
            line.size === size
        )
        .reduce((total, line) => total + line.quantity, 0);

      return stock - alreadyInSale < 1;
    });

    if (missingStock) {
      toast.error("No hay piezas suficientes para completar la corrida en este color.");
      return;
    }

    runSizes.forEach((size) => {
      addLineToSale(createLineFromProduct(selectedProduct, selectedColor, size, 1));
    });
    toast.success("Corrida agregada a la venta");
  }

  function removeLine(lineId: string) {
    setSaleLines((currentLines) =>
      currentLines.filter((line) => line.id !== lineId)
    );
  }

  function putSaleOnHold() {
    if (saleLines.length === 0) {
      toast.error("Agrega productos antes de poner la venta en espera.");
      return;
    }

    const heldSale: HeldSale = {
      id: crypto.randomUUID(),
      label: customerName.trim() || `Venta ${heldSales.length + 1}`,
      lines: saleLines,
      customerName,
      customerPhone,
      customerNote,
      notes,
    };

    setHeldSales((current) => [heldSale, ...current]);
    resetCurrentSale();
    toast.success("Venta puesta en espera");
  }

  function recoverHeldSale(heldSale: HeldSale) {
    setSaleLines(heldSale.lines);
    setCustomerName(heldSale.customerName);
    setCustomerPhone(heldSale.customerPhone);
    setCustomerNote(heldSale.customerNote);
    setNotes(heldSale.notes);
    setHeldSales((current) => current.filter((item) => item.id !== heldSale.id));
    toast.success("Venta recuperada");
  }

  function cancelHeldSale(id: string) {
    setHeldSales((current) => current.filter((item) => item.id !== id));
    toast.success("Venta en espera cancelada");
  }

  function resetCurrentSale() {
    setSaleLines([]);
    setPaymentMethod("Efectivo");
    setPaymentBreakdown({ cash: 0, transfer: 0, card: 0 });
    setDiscountType("amount");
    setDiscountValue("");
    setCustomerName("");
    setCustomerPhone("");
    setCustomerNote("");
    setNotes("");
    clearSelectedProduct();
  }

  function buildSaleItems() {
    return pricedLines.flatMap((line) => saleLineToOrderItems(line.item, line));
  }

  function buildTicketText(ticket: TicketData) {
    return buildStoreReceiptText(ticket);
  }

  async function handleSaveSale() {
    if (saleLockRef.current || isSaving) return;
    saleLockRef.current = true;

    if (saleLines.length === 0) {
      toast.error("Agrega al menos un producto a la venta.");
      saleLockRef.current = false;
      return;
    }

    if (paymentMethod === "Mixto") {
      const breakdownTotal = getPaymentBreakdownTotal(paymentBreakdown);
      if (Math.abs(breakdownTotal - saleTotal) > 0.01) {
        toast.error("El pago mixto debe sumar el total de la venta.");
        saleLockRef.current = false;
        return;
      }
    }

    const items = buildSaleItems();

    try {
      setIsSaving(true);
      const result = await createStoreSale({
        items,
        subtotal,
        discount:
          discountTotal > 0
            ? {
                type: discountType,
                value: discountNumber,
                total: discountTotal,
              }
            : undefined,
        total: saleTotal,
        totalItems: saleTotalItems,
        paymentMethod,
        paymentBreakdown: paymentMethod === "Mixto" ? paymentBreakdown : undefined,
        customer:
          customerName.trim() || customerPhone.trim() || customerNote.trim()
            ? {
                name: customerName.trim(),
                phone: customerPhone.trim(),
                notes: customerNote.trim(),
              }
            : undefined,
        notes: notes.trim(),
        createdBy: "admin",
      });

      const ticket = {
        folio: result.folio,
        items,
        subtotal,
        discountTotal,
        total: saleTotal,
        paymentMethod,
        paymentBreakdown: paymentMethod === "Mixto" ? paymentBreakdown : undefined,
        customerPhone: customerPhone.trim(),
        createdAt: new Date(),
      };

      setLastTicket(ticket);
      setIsTicketVisible(true);
      toast.success("Venta registrada e inventario actualizado.");
      resetCurrentSale();
      await loadSalesData();
    } catch (saveError) {
      logErrorInDevelopment("Admin sale save error", saveError);
      toast.error(getSafeSaleMessage(saveError));
    } finally {
      setIsSaving(false);
      saleLockRef.current = false;
    }
  }

  async function handleCancelSale(sale: StoreSale) {
    if (isCancelledSale(sale)) return;
    const confirmed = window.confirm(
      `¿Cancelar la venta ${sale.folio ?? sale.id}? Se regresará el inventario.`
    );
    if (!confirmed) return;

    try {
      await cancelStoreSale(sale.id);
      toast.success("Venta cancelada e inventario regresado.");
      await loadSalesData();
    } catch (cancelError) {
      logErrorInDevelopment("Cancel sale error", cancelError);
      toast.error(getSafeSaleMessage(cancelError));
    }
  }

  async function handleCloseCash() {
    try {
      setIsClosingCash(true);
      await createCashClosure({
        date: new Date().toISOString().slice(0, 10),
        totals: cashTotals,
        notes: cashClosureNotes.trim(),
      });
      setCashClosureNotes("");
      toast.success("Corte de caja guardado.");
    } catch {
      toast.error("No se pudo cerrar el corte.");
    } finally {
      setIsClosingCash(false);
    }
  }

  async function handleAdjustInventory() {
    if (!adjustProduct) {
      toast.error("Selecciona un producto para ajustar.");
      return;
    }

    if (!adjustColor || !adjustSize) {
      toast.error("Selecciona color y talla.");
      return;
    }

    const quantity = Number(adjustQuantity);
    if (!Number.isFinite(quantity)) {
      toast.error("Ingresa una cantidad válida.");
      return;
    }

    try {
      await adjustProductInventory(db, {
        productId: adjustProduct.id,
        productName: adjustProduct.name,
        color: adjustColor,
        size: adjustSize,
        mode: adjustMode,
        quantity,
        reason: adjustReason,
        createdBy: "admin",
      });
      setAdjustQuantity("");
      toast.success("Inventario ajustado.");
      await loadSalesData();
    } catch (adjustError) {
      logErrorInDevelopment("Inventory adjustment error", adjustError);
      toast.error("No se pudo ajustar el inventario.");
    }
  }

  async function copyTicket() {
    if (!lastTicket) return;
    await navigator.clipboard.writeText(buildTicketText(lastTicket));
    toast.success("Ticket copiado");
  }

  function sendTicketWhatsApp() {
    if (!lastTicket || !lastTicket.customerPhone) {
      toast.error("Agrega teléfono del cliente para enviar por WhatsApp.");
      return;
    }

    window.open(
      buildWhatsAppUrlWithNumber(lastTicket.customerPhone, buildTicketText(lastTicket)),
      "_blank",
      "noopener,noreferrer"
    );
  }

  return (
    <section className="space-y-4 sm:space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.18em] text-lime-700">
            Punto de venta
          </p>
          <h1 className="mt-1 text-xl font-black text-slate-950 sm:mt-2 sm:text-4xl">
            Ventas de tienda
          </h1>
          <p className="mt-1 max-w-2xl text-sm font-medium leading-6 text-slate-500 sm:mt-2">
            Venta rápida por producto, color, talla y corrida.
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
                Venta rápida
              </h2>
              <p className="text-xs font-bold text-slate-500">
                Busca por nombre, color, talla o subcategoría.
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
                  placeholder="Nombre, color, talla o subcategoría"
                />
              </div>
            </label>

            <div className="space-y-2">
              {visibleProducts.map((product) => {
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
                        {product.subcategory} · {product.stock} pieza(s)
                      </span>
                    </span>
                    {isSelected && <CheckCircle2 className="shrink-0 text-lime-700" size={18} />}
                  </button>
                );
              })}
              {!isLoading && visibleProducts.length === 0 && (
                <div className="rounded-2xl bg-[#fffaf5] px-4 py-3 text-sm font-bold text-slate-600 ring-1 ring-rose-100">
                  No encontramos productos con esa búsqueda.
                </div>
              )}
            </div>

            {selectedProduct && (
              <div className="rounded-2xl bg-lime-50 p-3 ring-1 ring-lime-100">
                <div className="flex min-w-0 items-center justify-between gap-3">
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
                    Cancelar selección
                  </button>
                </div>

                <div className="mt-3 grid gap-3 sm:grid-cols-4">
                  <label className="block">
                    <span className="text-xs font-black uppercase text-slate-500">
                      Color
                    </span>
                    <select
                      value={selectedColor}
                      onChange={(event) => {
                        const nextColor = event.target.value;
                        const [firstSize = ""] = selectedProduct
                          ? getAvailableSizes(selectedProduct, nextColor)
                          : [];
                        setSelectedColor(nextColor);
                        setSelectedSize(firstSize);
                      }}
                      className="mt-1.5 w-full min-w-0 rounded-xl border border-slate-200 bg-white px-3 py-2 text-[16px] font-bold outline-none sm:mt-2 sm:rounded-2xl sm:text-sm"
                    >
                      {availableColors.map((color) => (
                        <option key={color} value={color}>
                          {color}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="block">
                    <span className="text-xs font-black uppercase text-slate-500">
                      Talla
                    </span>
                    <select
                      value={selectedSize}
                      onChange={(event) => setSelectedSize(event.target.value)}
                      className="mt-1.5 w-full min-w-0 rounded-xl border border-slate-200 bg-white px-3 py-2 text-[16px] font-bold outline-none sm:mt-2 sm:rounded-2xl sm:text-sm"
                    >
                      {availableSizes.map((size) => (
                        <option key={size} value={size}>
                          {size} · {getPieceLabel(getStockForProductVariant(selectedProduct, selectedColor, size))}
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
                      className="mt-1.5 w-full min-w-0 rounded-xl border border-slate-200 bg-white px-3 py-2 text-[16px] font-bold outline-none sm:mt-2 sm:rounded-2xl sm:text-sm"
                    />
                  </label>

                  <div className="rounded-2xl bg-white px-3 py-2 ring-1 ring-lime-100">
                    <p className="text-xs font-black uppercase text-slate-500">
                      Precio
                    </p>
                    <p className="mt-1 text-base font-black text-slate-950">
                      {formatPrice(candidateLinePrice)}
                    </p>
                  </div>
                </div>

                <div className="mt-3 grid gap-2 sm:grid-cols-2">
                  <button
                    type="button"
                    onClick={handleAddLine}
                    disabled={Boolean(addLineDisabledReason)}
                    className="inline-flex min-h-10 items-center justify-center gap-2 rounded-full bg-slate-950 px-4 py-2 text-xs font-black text-white shadow-sm transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-300 sm:min-h-12 sm:text-sm"
                  >
                    <Plus size={18} />
                    Agregar a venta
                  </button>
                  <button
                    type="button"
                    onClick={handleAddRun}
                    disabled={!selectedProduct.wholesaleRunEnabled}
                    className="inline-flex min-h-10 items-center justify-center gap-2 rounded-full bg-lime-600 px-4 py-2 text-xs font-black text-white shadow-sm transition hover:bg-lime-700 disabled:cursor-not-allowed disabled:bg-slate-300 sm:min-h-12 sm:text-sm"
                  >
                    <PackageCheck size={18} />
                    Agregar corrida
                  </button>
                </div>
                {addLineDisabledReason && (
                  <p className="mt-2 text-center text-xs font-bold text-slate-500">
                    {addLineDisabledReason}
                  </p>
                )}
              </div>
            )}

            <div className="rounded-2xl bg-white p-3 ring-1 ring-rose-100">
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm font-black text-slate-950">Ventas en espera</p>
                <button
                  type="button"
                  onClick={putSaleOnHold}
                  className="inline-flex min-h-9 items-center justify-center gap-1.5 rounded-full bg-slate-100 px-3 py-2 text-xs font-black text-slate-700 transition hover:bg-slate-200"
                >
                  <PauseCircle size={15} />
                  Poner venta en espera
                </button>
              </div>
              <div className="mt-3 space-y-2">
                {heldSales.length === 0 ? (
                  <p className="text-xs font-bold text-slate-500">No hay ventas en espera.</p>
                ) : (
                  heldSales.map((heldSale) => (
                    <div
                      key={heldSale.id}
                      className="flex items-center justify-between gap-3 rounded-xl bg-[#fffaf5] p-2 ring-1 ring-rose-100"
                    >
                      <div>
                        <p className="text-sm font-black text-slate-800">{heldSale.label}</p>
                        <p className="text-xs font-bold text-slate-500">
                          {heldSale.lines.length} línea(s)
                        </p>
                      </div>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => recoverHeldSale(heldSale)}
                          className="rounded-full bg-white px-3 py-2 text-xs font-black text-lime-700 ring-1 ring-lime-100"
                        >
                          Recuperar
                        </button>
                        <button
                          type="button"
                          onClick={() => cancelHeldSale(heldSale.id)}
                          className="rounded-full bg-white p-2 text-rose-600 ring-1 ring-rose-100"
                          aria-label="Cancelar venta en espera"
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
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
              pricedLines.map((line) => (
                <article
                  key={line.item.id}
                  className="grid gap-3 rounded-2xl bg-[#fffaf5] p-3 ring-1 ring-rose-100 sm:grid-cols-[1fr_auto]"
                >
                  <div className="min-w-0">
                    <p className="line-clamp-1 text-sm font-black text-slate-950">
                      {line.item.productName}
                    </p>
                    <p className="mt-1 text-xs font-bold text-slate-500">
                      {line.item.color} · Talla {line.item.size} ·{" "}
                      {getPieceLabel(line.item.quantity)}
                    </p>
                    <p className="mt-1 text-xs font-black text-lime-700">
                      {line.usesWholesalePrice
                        ? "Mayoreo corrido aplicado."
                        : line.message || formatPrice(line.item.regularPrice)}
                    </p>
                  </div>

                  <div className="flex items-center justify-between gap-3 sm:justify-end">
                    <p className="text-sm font-black text-slate-950">
                      {formatPrice(line.subtotal)}
                    </p>
                    <button
                      type="button"
                      onClick={() => removeLine(line.item.id)}
                      className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white text-rose-600 shadow-sm ring-1 ring-rose-100 transition hover:bg-rose-50"
                      aria-label={`Quitar ${line.item.productName}`}
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
                Descuento
              </span>
              <div className="mt-1.5 grid grid-cols-[0.8fr_1fr] gap-2">
                <select
                  value={discountType}
                  onChange={(event) => setDiscountType(event.target.value as DiscountType)}
                  className="rounded-xl border border-slate-200 bg-[#fffaf5] px-3 py-2 text-[16px] font-bold outline-none sm:rounded-2xl sm:text-sm"
                >
                  <option value="amount">Pesos</option>
                  <option value="percent">Porcentaje</option>
                </select>
                <input
                  type="number"
                  min={0}
                  value={discountValue}
                  onChange={(event) => setDiscountValue(event.target.value)}
                  className="rounded-xl border border-slate-200 bg-[#fffaf5] px-3 py-2 text-[16px] font-bold outline-none sm:rounded-2xl sm:text-sm"
                  placeholder="0"
                />
              </div>
            </label>

            <label className="block">
              <span className="text-xs font-black uppercase text-slate-500">
                Método de pago
              </span>
              <select
                value={paymentMethod}
                onChange={(event) => setPaymentMethod(event.target.value as PaymentMethod)}
                className="mt-1.5 w-full rounded-xl border border-slate-200 bg-[#fffaf5] px-3 py-2 text-[16px] font-bold outline-none sm:rounded-2xl sm:text-sm"
              >
                {paymentMethods.map((method) => (
                  <option key={method} value={method}>
                    {method}
                  </option>
                ))}
              </select>
            </label>
          </div>

          {paymentMethod === "Mixto" && (
            <div className="mt-3 grid gap-2 rounded-2xl bg-[#fffaf5] p-3 ring-1 ring-rose-100 sm:grid-cols-3">
              {[
                ["cash", "Efectivo"],
                ["transfer", "Transferencia"],
                ["card", "Tarjeta"],
              ].map(([key, label]) => (
                <label key={key} className="space-y-1">
                  <span className="text-xs font-black uppercase text-slate-500">
                    {label}
                  </span>
                  <input
                    type="number"
                    min={0}
                    value={paymentBreakdown[key as keyof PaymentBreakdown]}
                    onChange={(event) =>
                      setPaymentBreakdown((current) => ({
                        ...current,
                        [key]: Math.max(Number(event.target.value) || 0, 0),
                      }))
                    }
                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-[16px] font-bold outline-none sm:text-sm"
                  />
                </label>
              ))}
            </div>
          )}

          <div className="mt-3 grid gap-3 sm:grid-cols-3">
            <label className="block">
              <span className="text-xs font-black uppercase text-slate-500">
                Cliente
              </span>
              <input
                value={customerName}
                onChange={(event) => setCustomerName(event.target.value)}
                className="mt-1.5 w-full rounded-xl border border-slate-200 bg-[#fffaf5] px-3 py-2 text-[16px] font-bold outline-none sm:rounded-2xl sm:text-sm"
                placeholder="Nombre"
              />
            </label>
            <label className="block">
              <span className="text-xs font-black uppercase text-slate-500">
                Teléfono
              </span>
              <input
                value={customerPhone}
                onChange={(event) => setCustomerPhone(event.target.value)}
                className="mt-1.5 w-full rounded-xl border border-slate-200 bg-[#fffaf5] px-3 py-2 text-[16px] font-bold outline-none sm:rounded-2xl sm:text-sm"
                placeholder="WhatsApp"
              />
            </label>
            <label className="block">
              <span className="text-xs font-black uppercase text-slate-500">
                Nota cliente
              </span>
              <input
                value={customerNote}
                onChange={(event) => setCustomerNote(event.target.value)}
                className="mt-1.5 w-full rounded-xl border border-slate-200 bg-[#fffaf5] px-3 py-2 text-[16px] font-bold outline-none sm:rounded-2xl sm:text-sm"
                placeholder="Opcional"
              />
            </label>
          </div>

          <label className="mt-3 block">
            <span className="text-xs font-black uppercase text-slate-500">
              Nota de venta
            </span>
            <textarea
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              className="mt-1.5 min-h-14 w-full rounded-xl border border-slate-200 bg-[#fffaf5] px-3 py-2 text-[16px] font-bold outline-none sm:rounded-2xl sm:text-sm"
              placeholder="Ej. Venta en mostrador."
            />
          </label>

          <div className="mt-4 rounded-2xl bg-[#fffaf5] p-4 text-sm font-bold text-slate-600 ring-1 ring-rose-100">
            <div className="flex items-center justify-between">
              <span>Subtotal</span>
              <span className="font-black text-slate-950">{formatPrice(subtotal)}</span>
            </div>
            <div className="mt-1 flex items-center justify-between">
              <span>Descuento</span>
              <span className="font-black text-rose-600">{formatPrice(discountTotal)}</span>
            </div>
            <div className="mt-2 flex items-center justify-between border-t border-rose-100 pt-2">
              <span>Total</span>
              <span className="text-xl font-black text-slate-950">
                {formatPrice(saleTotal)}
              </span>
            </div>
          </div>

          <button
            type="button"
            onClick={() => void handleSaveSale()}
            disabled={isSaving || saleLines.length === 0}
            className="mt-4 inline-flex min-h-10 w-full items-center justify-center gap-2 rounded-full bg-lime-600 px-4 py-2 text-xs font-black text-white shadow-sm transition hover:bg-lime-700 disabled:cursor-not-allowed disabled:bg-slate-300 sm:min-h-12 sm:text-sm"
          >
            <PackageCheck size={18} />
            {isSaving ? "Registrando venta..." : "Registrar venta"}
          </button>
        </section>
      </div>

      {lastTicket && (
        <section className="rounded-[1.25rem] bg-white p-3 shadow-sm ring-1 ring-rose-100 sm:rounded-[1.75rem] sm:p-6 print:block">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.16em] text-lime-700">
                Ticket
              </p>
              <h2 className="mt-1 text-lg font-black text-slate-950">
                Venta #{lastTicket.folio}
              </h2>
              <p className="mt-1 text-sm font-bold text-slate-500">
                {lastTicket.createdAt.toLocaleString("es-MX")}
              </p>
            </div>
            <div className="grid gap-2 sm:flex">
              <button
                type="button"
                onClick={() => setIsTicketVisible((visible) => !visible)}
                className="inline-flex min-h-9 items-center justify-center gap-2 rounded-full bg-lime-50 px-4 py-2 text-xs font-black text-lime-700 ring-1 ring-lime-100"
              >
                <Eye size={15} />
                {isTicketVisible ? "Ocultar ticket" : "Ver ticket"}
              </button>
              <button
                type="button"
                onClick={() => window.print()}
                className="inline-flex min-h-9 items-center justify-center gap-2 rounded-full bg-slate-950 px-4 py-2 text-xs font-black text-white"
              >
                <Printer size={15} />
                Imprimir ticket
              </button>
              <button
                type="button"
                onClick={() => void copyTicket()}
                className="inline-flex min-h-9 items-center justify-center gap-2 rounded-full bg-white px-4 py-2 text-xs font-black text-slate-700 ring-1 ring-slate-100"
              >
                <Copy size={15} />
                Copiar ticket
              </button>
              <button
                type="button"
                onClick={sendTicketWhatsApp}
                className="inline-flex min-h-9 items-center justify-center gap-2 rounded-full bg-emerald-50 px-4 py-2 text-xs font-black text-emerald-700 ring-1 ring-emerald-100"
              >
                <Send size={15} />
                Enviar por WhatsApp
              </button>
            </div>
          </div>
          {isTicketVisible && (
            <pre className="mt-4 whitespace-pre-wrap rounded-2xl bg-[#fffaf5] p-4 text-xs font-bold leading-5 text-slate-700 ring-1 ring-rose-100">
              {buildTicketText(lastTicket)}
            </pre>
          )}
        </section>
      )}

      <div className="grid gap-3 sm:gap-4 xl:grid-cols-[0.9fr_1.1fr]">
        <section className="rounded-[1.25rem] bg-white p-3 shadow-sm ring-1 ring-rose-100 sm:rounded-[1.75rem] sm:p-6">
          <p className="text-xs font-black uppercase tracking-[0.16em] text-lime-700">
            Corte de caja
          </p>
          <h2 className="mt-1 text-lg font-black text-slate-950">Corte del día</h2>
          <div className="mt-4 grid grid-cols-2 gap-2">
            {[
              ["Ventas de hoy", formatPrice(cashTotals.sold)],
              ["Efectivo", formatPrice(cashTotals.cash)],
              ["Transferencia", formatPrice(cashTotals.transfer)],
              ["Tarjeta", formatPrice(cashTotals.card)],
              ["Descuentos", formatPrice(cashTotals.discounts)],
              ["Piezas vendidas", String(cashTotals.pieces)],
              ["Ventas canceladas", String(cashTotals.cancelled)],
              ["Número de ventas", String(cashTotals.salesCount)],
            ].map(([label, value]) => (
              <div key={label} className="rounded-2xl bg-[#fffaf5] p-3 ring-1 ring-rose-100">
                <p className="text-[11px] font-black uppercase text-slate-500">
                  {label}
                </p>
                <p className="mt-1 text-base font-black text-slate-950">{value}</p>
              </div>
            ))}
          </div>
          <textarea
            value={cashClosureNotes}
            onChange={(event) => setCashClosureNotes(event.target.value)}
            className="mt-3 min-h-16 w-full rounded-2xl border border-slate-200 bg-[#fffaf5] px-3 py-2 text-[16px] font-bold outline-none sm:text-sm"
            placeholder="Notas del corte"
          />
          <button
            type="button"
            onClick={() => void handleCloseCash()}
            disabled={isClosingCash}
            className="mt-3 inline-flex min-h-10 w-full items-center justify-center gap-2 rounded-full bg-slate-950 px-4 py-2 text-xs font-black text-white disabled:bg-slate-300 sm:min-h-11 sm:text-sm"
          >
            <Archive size={17} />
            {isClosingCash ? "Guardando corte..." : "Cerrar corte del día"}
          </button>
        </section>

        <section className="rounded-[1.25rem] bg-white p-3 shadow-sm ring-1 ring-rose-100 sm:rounded-[1.75rem] sm:p-6">
          <p className="text-xs font-black uppercase tracking-[0.16em] text-lime-700">
            Inventario
          </p>
          <h2 className="mt-1 text-lg font-black text-slate-950">
            Alertas rápidas
          </h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <div className="rounded-2xl bg-[#fffaf5] p-3 ring-1 ring-rose-100">
              <p className="text-sm font-black text-slate-950">Bajo stock</p>
              <div className="mt-2 space-y-2">
                {lowStockProducts.length === 0 ? (
                  <p className="text-xs font-bold text-slate-500">Sin alertas.</p>
                ) : (
                  lowStockProducts.map((product) => (
                    <p key={product.id} className="text-xs font-bold text-slate-600">
                      {product.name}: {product.stock} pieza(s)
                    </p>
                  ))
                )}
              </div>
            </div>
            <div className="rounded-2xl bg-[#fffaf5] p-3 ring-1 ring-rose-100">
              <p className="text-sm font-black text-slate-950">Agotados</p>
              <div className="mt-2 space-y-2">
                {outOfStockProducts.length === 0 ? (
                  <p className="text-xs font-bold text-slate-500">Sin agotados activos.</p>
                ) : (
                  outOfStockProducts.map((product) => (
                    <p key={product.id} className="text-xs font-bold text-slate-600">
                      {product.name}
                    </p>
                  ))
                )}
              </div>
            </div>
          </div>
          <div className="mt-4 rounded-2xl bg-[#fffaf5] p-3 ring-1 ring-rose-100">
            <p className="text-sm font-black text-slate-950">Ajustar inventario</p>
            <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              <label className="space-y-1 lg:col-span-3">
                <span className="text-xs font-black uppercase text-slate-500">
                  Producto
                </span>
                <select
                  value={adjustProductId}
                  onChange={(event) => {
                    const nextProduct = products.find(
                      (product) => product.id === event.target.value
                    );
                    const [firstColor = ""] = nextProduct
                      ? getProductColors(nextProduct)
                      : [];
                    const [firstSize = ""] = nextProduct ? getProductSizes(nextProduct) : [];
                    setAdjustProductId(event.target.value);
                    setAdjustColor(firstColor);
                    setAdjustSize(firstSize);
                  }}
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-[16px] font-bold outline-none sm:text-sm"
                >
                  <option value="">Selecciona producto</option>
                  {products.map((product) => (
                    <option key={product.id} value={product.id}>
                      {product.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="space-y-1">
                <span className="text-xs font-black uppercase text-slate-500">
                  Color
                </span>
                <select
                  value={adjustColor}
                  onChange={(event) => setAdjustColor(event.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-[16px] font-bold outline-none sm:text-sm"
                >
                  {adjustColors.map((color) => (
                    <option key={color} value={color}>
                      {color}
                    </option>
                  ))}
                </select>
              </label>
              <label className="space-y-1">
                <span className="text-xs font-black uppercase text-slate-500">
                  Talla
                </span>
                <select
                  value={adjustSize}
                  onChange={(event) => setAdjustSize(event.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-[16px] font-bold outline-none sm:text-sm"
                >
                  {adjustSizes.map((size) => (
                    <option key={size} value={size}>
                      {size}
                    </option>
                  ))}
                </select>
              </label>
              <label className="space-y-1">
                <span className="text-xs font-black uppercase text-slate-500">
                  Modo
                </span>
                <select
                  value={adjustMode}
                  onChange={(event) => setAdjustMode(event.target.value as "set" | "move")}
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-[16px] font-bold outline-none sm:text-sm"
                >
                  <option value="set">Cantidad nueva</option>
                  <option value="move">Movimiento +/-</option>
                </select>
              </label>
              <label className="space-y-1">
                <span className="text-xs font-black uppercase text-slate-500">
                  Cantidad
                </span>
                <input
                  type="number"
                  value={adjustQuantity}
                  onChange={(event) => setAdjustQuantity(event.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-[16px] font-bold outline-none sm:text-sm"
                  placeholder={adjustMode === "set" ? "Ej. 8" : "Ej. -1 o 5"}
                />
              </label>
              <label className="space-y-1">
                <span className="text-xs font-black uppercase text-slate-500">
                  Motivo
                </span>
                <select
                  value={adjustReason}
                  onChange={(event) =>
                    setAdjustReason(event.target.value as InventoryAdjustmentReason)
                  }
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-[16px] font-bold outline-none sm:text-sm"
                >
                  <option value="conteo físico">Conteo físico</option>
                  <option value="merma">Merma</option>
                  <option value="devolución">Devolución</option>
                  <option value="corrección">Corrección</option>
                  <option value="entrada de mercancía">Entrada de mercancía</option>
                </select>
              </label>
            </div>
            <button
              type="button"
              onClick={() => void handleAdjustInventory()}
              className="mt-3 inline-flex min-h-10 w-full items-center justify-center gap-2 rounded-full bg-white px-4 py-2 text-xs font-black text-slate-700 ring-1 ring-slate-100 transition hover:bg-slate-50 sm:text-sm"
            >
              <RefreshCw size={16} />
              Ajustar inventario
            </button>
          </div>
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

          <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
            <input
              value={historySearch}
              onChange={(event) => setHistorySearch(event.target.value)}
              className="min-h-9 rounded-full border border-slate-200 bg-[#fffaf5] px-4 text-sm font-bold outline-none"
              placeholder="Folio o producto"
            />
            <select
              value={paymentFilter}
              onChange={(event) => setPaymentFilter(event.target.value as PaymentFilter)}
              className="min-h-9 rounded-full border border-slate-200 bg-[#fffaf5] px-4 text-sm font-bold outline-none"
            >
              <option value="all">Todos los pagos</option>
              {paymentMethods.map((method) => (
                <option key={method} value={method}>
                  {method}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="-mx-1 mt-4 overflow-x-auto px-1">
          <div className="flex min-w-max gap-2">
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

        {isLoading ? (
          <div className="mt-4 rounded-2xl bg-[#fffaf5] px-4 py-3 text-sm font-bold text-slate-500 ring-1 ring-rose-100">
            Cargando ventas...
          </div>
        ) : filteredSales.length === 0 ? (
          <div className="mt-4 rounded-2xl bg-[#fffaf5] px-4 py-5 text-sm font-bold leading-6 text-slate-500 ring-1 ring-rose-100">
            Aún no hay ventas con esos filtros.
          </div>
        ) : (
          <div className="mt-4 grid gap-3 lg:grid-cols-2">
            {filteredSales.map((sale) => {
              const isExpanded = expandedSaleId === sale.id;
              const cancelled = isCancelledSale(sale);

              return (
                <article
                  key={sale.id}
                  className={`rounded-2xl p-3 ring-1 ${
                    cancelled
                      ? "bg-slate-50 ring-slate-200"
                      : "bg-[#fffaf5] ring-rose-100"
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-xs font-black uppercase text-slate-400">
                        Folio {sale.folio ?? sale.id.slice(-6).toUpperCase()}
                      </p>
                      <p className="line-clamp-1 text-sm font-black text-slate-950">
                        {getSaleItemsText(sale)}
                      </p>
                      <p className="mt-1 text-xs font-bold text-slate-500">
                        {formatDate(sale.createdAt)} · {sale.paymentMethod ?? "Pago no registrado"}
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
                            {item.productName ?? item.name}
                          </p>
                          <p className="mt-1 text-xs font-bold text-slate-500">
                            {item.color ?? "Sin color"} · Talla {item.size} ·{" "}
                            {getPieceLabel(item.quantity)} · {formatPrice(item.subtotal)}
                          </p>
                        </div>
                      ))}
                      {sale.customer?.name && (
                        <div className="rounded-2xl bg-white p-3">
                          <p className="text-xs font-black uppercase text-slate-500">
                            Cliente
                          </p>
                          <p className="mt-1 text-sm font-bold text-slate-600">
                            {sale.customer.name} {sale.customer.phone ? `· ${sale.customer.phone}` : ""}
                          </p>
                        </div>
                      )}
                    </div>
                  )}

                  <div className="mt-3 flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => setExpandedSaleId(isExpanded ? "" : sale.id)}
                      className="inline-flex min-h-9 items-center justify-center gap-2 rounded-full bg-white px-3 py-1.5 text-xs font-black text-slate-700 shadow-sm ring-1 ring-slate-100 transition hover:bg-slate-50"
                    >
                      <Eye size={15} />
                      {isExpanded ? "Ocultar detalle" : "Ver detalle"}
                    </button>
                    <button
                      type="button"
                      onClick={() => void handleCancelSale(sale)}
                      disabled={cancelled}
                      className="inline-flex min-h-9 items-center justify-center gap-2 rounded-full bg-white px-3 py-1.5 text-xs font-black text-rose-600 shadow-sm ring-1 ring-rose-100 transition hover:bg-rose-50 disabled:cursor-not-allowed disabled:text-slate-400"
                    >
                      <RotateCcw size={15} />
                      {cancelled ? "Cancelada" : "Cancelar venta"}
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>
    </section>
  );
}
