"use client";

import { getOrders } from "@/lib/firebase-services/orders";
import { getProducts } from "@/lib/firebase-services/products";
import { getStoreSales, type StoreSale } from "@/lib/firebase-services/sales";
import type { FirebaseDate, FirebaseOrder, FirebaseProduct } from "@/lib/firebase-types";
import { formatPrice } from "@/lib/products";
import {
  BarChart3,
  ClipboardList,
  Home,
  Megaphone,
  Package,
  PackageCheck,
  PackageX,
  Plus,
  ShoppingBag,
  Store,
  TrendingUp,
} from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";

type PeriodFilter = "month" | "quarter" | "all";

type TopProduct = {
  key: string;
  name: string;
  quantity: number;
  total: number;
};

type SaleRecord = {
  items: FirebaseOrder["items"];
  total: number;
  status?: string;
  source?: string;
  isDeleted?: boolean;
  createdAt: FirebaseDate;
};

const quickActions = [
  {
    label: "Agregar producto",
    href: "/admin/productos?nuevo=1",
    icon: Package,
    className: "bg-rose-500 text-white hover:bg-rose-600",
  },
  {
    label: "Ver pedidos",
    href: "/admin/pedidos",
    icon: ShoppingBag,
    className: "bg-slate-950 text-white hover:bg-slate-800",
  },
  {
    label: "Registrar venta",
    href: "/admin/ventas",
    icon: Plus,
    className: "bg-lime-50 text-lime-700 ring-1 ring-lime-100 hover:bg-lime-100",
  },
  {
    label: "Cambiar ofertas",
    href: "/admin/inicio",
    icon: Megaphone,
    className: "bg-amber-50 text-amber-700 ring-1 ring-amber-100 hover:bg-amber-100",
  },
  {
    label: "Editar portada",
    href: "/admin/inicio",
    icon: Home,
    className: "bg-sky-50 text-sky-700 ring-1 ring-sky-100 hover:bg-sky-100",
  },
  {
    label: "Editar datos de tienda",
    href: "/admin/configuracion",
    icon: Store,
    className: "bg-white text-slate-700 ring-1 ring-slate-100 hover:bg-slate-50",
  },
];

const periodOptions: { value: PeriodFilter; label: string }[] = [
  { value: "month", label: "Este mes" },
  { value: "quarter", label: "Últimos 3 meses" },
  { value: "all", label: "Todo el historial" },
];

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

function startOfCurrentMonth() {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), 1).getTime();
}

function startOfLastThreeMonths() {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth() - 2, 1).getTime();
}

function isCompletedSale(sale: SaleRecord) {
  return (
    !sale.isDeleted &&
    sale.status !== "cancelled" &&
    sale.status !== "Cancelado"
  );
}

function isPendingOrder(order: FirebaseOrder) {
  if (order.isDeleted) return false;

  return [
    "Nuevo",
    "Confirmado",
    "Preparando",
    "pending",
    "confirmed",
    "preparing",
  ].includes(order.status);
}

function getSalesForPeriod(sales: SaleRecord[], period: PeriodFilter) {
  const validSales = sales.filter(isCompletedSale);

  if (period === "all") return validSales;

  const startDate =
    period === "month" ? startOfCurrentMonth() : startOfLastThreeMonths();

  return validSales.filter((sale) => getDateValue(sale.createdAt) >= startDate);
}

function sumSaleTotal(sales: SaleRecord[]) {
  return sales.reduce((total, sale) => total + (sale.total ?? 0), 0);
}

function countWebOrders(sales: SaleRecord[]) {
  return sales.filter((sale) => sale.source !== "store").length;
}

function countStoreSales(sales: SaleRecord[]) {
  return sales.filter((sale) => sale.source === "store").length;
}

function getTopProducts(sales: SaleRecord[]) {
  const productMap = new Map<string, TopProduct>();

  sales.forEach((sale) => {
    sale.items.forEach((item) => {
      const itemName = item.productName ?? item.name ?? "Producto";
      const key = item.productId || item.slug || itemName;
      const current = productMap.get(key) ?? {
        key,
        name: itemName,
        quantity: 0,
        total: 0,
      };
      const quantity = item.quantity ?? 0;
      const total = item.subtotal ?? item.price * quantity;

      productMap.set(key, {
        ...current,
        quantity: current.quantity + quantity,
        total: current.total + total,
      });
    });
  });

  return Array.from(productMap.values())
    .sort((a, b) => b.quantity - a.quantity)
    .slice(0, 5);
}

export default function AdminDashboardPage() {
  const [products, setProducts] = useState<FirebaseProduct[]>([]);
  const [orders, setOrders] = useState<FirebaseOrder[]>([]);
  const [storeSales, setStoreSales] = useState<StoreSale[]>([]);
  const [period, setPeriod] = useState<PeriodFilter>("month");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  const loadDashboard = useCallback(async () => {
    try {
      setIsLoading(true);
      setError("");

      const [productItems, orderItems, saleItems] = await Promise.all([
        getProducts(),
        getOrders(),
        getStoreSales(),
      ]);

      setProducts(productItems);
      setOrders(orderItems);
      setStoreSales(saleItems);
    } catch {
      setError("No se pudieron cargar las estadísticas.");
      setProducts([]);
      setOrders([]);
      setStoreSales([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    queueMicrotask(() => {
      void loadDashboard();
    });
  }, [loadDashboard]);

  const activeProducts = useMemo(
    () => products.filter((product) => product.isActive),
    [products]
  );
  const outOfStockProducts = useMemo(
    () => products.filter((product) => product.isActive && product.stock <= 0),
    [products]
  );
  const totalAvailablePieces = useMemo(
    () =>
      activeProducts.reduce(
        (total, product) => total + Math.max(product.stock ?? 0, 0),
        0
      ),
    [activeProducts]
  );

  const salesRecords = useMemo<SaleRecord[]>(
    () => [
      ...orders.map((order) => ({
        items: order.items ?? [],
        total: order.total,
        status: order.status,
        source: order.source ?? "web",
        isDeleted: order.isDeleted,
        createdAt: order.createdAt,
      })),
      ...storeSales.map((sale) => ({
        items: sale.items ?? [],
        total: sale.total,
        status: sale.status,
        source: "store",
        createdAt: sale.createdAt,
      })),
    ],
    [orders, storeSales]
  );
  const monthSales = useMemo(
    () => getSalesForPeriod(salesRecords, "month"),
    [salesRecords]
  );
  const quarterSales = useMemo(
    () => getSalesForPeriod(salesRecords, "quarter"),
    [salesRecords]
  );
  const allSales = useMemo(
    () => getSalesForPeriod(salesRecords, "all"),
    [salesRecords]
  );
  const visibleSales = useMemo(
    () => getSalesForPeriod(salesRecords, period),
    [salesRecords, period]
  );
  const topProducts = useMemo(() => getTopProducts(visibleSales), [visibleSales]);
  const maxTopQuantity = Math.max(...topProducts.map((product) => product.quantity), 1);
  const pendingOrders = orders.filter(isPendingOrder).length;

  const salesCards = [
    {
      label: "Ventas del mes",
      value: formatPrice(sumSaleTotal(monthSales)),
      detail:
        monthSales.length > 0
          ? `${countWebOrders(monthSales)} pedido(s) web · ${countStoreSales(
              monthSales
            )} venta(s) de tienda`
          : "Aún no hay ventas este mes",
      icon: TrendingUp,
      className: "bg-rose-50 text-rose-600 ring-rose-100",
    },
    {
      label: "Ventas últimos 3 meses",
      value: formatPrice(sumSaleTotal(quarterSales)),
      detail:
        quarterSales.length > 0
          ? `${countWebOrders(quarterSales)} pedido(s) web · ${countStoreSales(
              quarterSales
            )} venta(s) de tienda`
          : "Sin ventas en este periodo",
      icon: BarChart3,
      className: "bg-amber-50 text-amber-700 ring-amber-100",
    },
    {
      label: "Ventas históricas",
      value: formatPrice(sumSaleTotal(allSales)),
      detail:
        allSales.length > 0
          ? `${countWebOrders(allSales)} pedido(s) web · ${countStoreSales(
              allSales
            )} venta(s) de tienda`
          : "Aún no hay ventas registradas",
      icon: ShoppingBag,
      className: "bg-sky-50 text-sky-700 ring-sky-100",
    },
    {
      label: "Pedidos pendientes",
      value: String(pendingOrders),
      detail: pendingOrders > 0 ? "Revisar pedidos" : "Todo al día",
      icon: ClipboardList,
      className: "bg-lime-50 text-lime-700 ring-lime-100",
    },
    {
      label: "Productos activos",
      value: String(activeProducts.length),
      detail: "Visibles en tienda",
      icon: PackageCheck,
      className: "bg-emerald-50 text-emerald-700 ring-emerald-100",
    },
    {
      label: "Productos agotados",
      value: String(outOfStockProducts.length),
      detail:
        outOfStockProducts.length > 0
          ? "Necesitan piezas"
          : "Sin agotados activos",
      icon: PackageX,
      className: "bg-slate-100 text-slate-600 ring-slate-200",
    },
    {
      label: "Piezas disponibles",
      value: String(totalAvailablePieces),
      detail: "Suma de productos activos",
      icon: Package,
      className: "bg-white text-slate-700 ring-slate-100",
    },
  ];

  const periodSales = [
    { label: "Este mes", value: sumSaleTotal(monthSales), sales: monthSales },
    {
      label: "Últimos 3 meses",
      value: sumSaleTotal(quarterSales),
      sales: quarterSales,
    },
    { label: "Todo", value: sumSaleTotal(allSales), sales: allSales },
  ];
  const maxPeriodSales = Math.max(...periodSales.map((item) => item.value), 1);

  return (
    <section className="space-y-4 sm:space-y-6">
      <div className="rounded-[1.25rem] bg-gradient-to-br from-rose-50 via-white to-sky-50 p-3 shadow-sm ring-1 ring-rose-100 sm:rounded-[2rem] sm:p-7">
        <p className="text-xs font-black uppercase tracking-[0.18em] text-rose-500">
          Dashboard
        </p>
          <h1 className="mt-1 text-xl font-black text-slate-950 sm:mt-2 sm:text-4xl">
          Panel vendedor
        </h1>
        <p className="mt-1 text-sm font-medium leading-6 text-slate-500 sm:hidden">
          Revisa ventas, pedidos y productos.
        </p>
        <p className="mt-1 hidden max-w-2xl text-sm font-medium leading-6 text-slate-500 sm:mt-3 sm:block sm:text-base">
          Revisa ventas, pedidos y productos sin entrar a pantallas técnicas.
        </p>

        <div className="mt-4 sm:mt-6">
          <p className="mb-3 text-xs font-black uppercase tracking-[0.18em] text-slate-400">
            Acciones rápidas
          </p>
          <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:gap-3">
            {quickActions.map((action) => {
              const Icon = action.icon;

              return (
                <Link
                  key={action.label}
                  href={action.href}
                  className={`inline-flex min-h-9 min-w-0 items-center justify-center gap-1.5 rounded-full px-3 py-2 text-xs font-black shadow-sm transition sm:min-h-10 sm:gap-2 sm:px-5 sm:py-3 sm:text-sm ${action.className}`}
                >
                  <Icon size={17} />
                  {action.label}
                </Link>
              );
            })}
          </div>
        </div>
      </div>

      {error && (
        <div className="rounded-2xl bg-rose-50 px-4 py-3 text-sm font-bold text-rose-700 ring-1 ring-rose-100">
          {error}
        </div>
      )}

      <div className="grid grid-cols-2 gap-2.5 sm:gap-4 xl:grid-cols-4">
        {salesCards.map((stat) => {
          const Icon = stat.icon;

          return (
            <article
              key={stat.label}
              className="min-w-0 rounded-[1.1rem] bg-white p-2.5 shadow-sm ring-1 ring-rose-100 sm:rounded-[1.75rem] sm:p-5"
            >
              <div
                className={`flex h-9 w-9 items-center justify-center rounded-2xl ring-1 sm:h-12 sm:w-12 ${stat.className}`}
              >
                <Icon size={18} />
              </div>
              <p className="mt-2 text-[11px] font-black text-slate-500 sm:mt-5 sm:text-sm">
                {stat.label}
              </p>
              <p className="mt-1 break-words text-lg font-black text-slate-950 sm:text-3xl">
                {isLoading ? "..." : stat.value}
              </p>
              <p className="mt-1 line-clamp-2 text-[11px] font-bold text-slate-500 sm:text-xs">
                {stat.detail}
              </p>
            </article>
          );
        })}
      </div>

      <div className="grid gap-3 sm:gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <section className="rounded-[1.25rem] bg-white p-3 shadow-sm ring-1 ring-rose-100 sm:rounded-[1.75rem] sm:p-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.18em] text-rose-500">
                Productos más vendidos
              </p>
              <h2 className="mt-1 text-xl font-black text-slate-950">
                Top 5 productos
              </h2>
            </div>

            <div className="flex flex-wrap gap-2">
              {periodOptions.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setPeriod(option.value)}
                  className={`rounded-full px-4 py-2 text-xs font-black transition ${
                    period === option.value
                      ? "bg-slate-950 text-white"
                      : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>

          {topProducts.length === 0 ? (
            <div className="mt-5 rounded-2xl bg-[#fffaf5] px-4 py-6 text-sm font-bold leading-6 text-slate-500 ring-1 ring-rose-100">
              Aún no hay ventas registradas. Cuando lleguen pedidos, aquí verás tus productos más vendidos.
            </div>
          ) : (
            <div className="mt-5 space-y-4">
              {topProducts.map((product) => (
                <div key={product.key}>
                  <div className="mb-2 flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-black text-slate-950">
                        {product.name}
                      </p>
                      <p className="mt-0.5 text-xs font-bold text-slate-400">
                        {product.quantity} pieza(s) · {formatPrice(product.total)}
                      </p>
                    </div>
                  </div>
                  <div className="h-3 overflow-hidden rounded-full bg-rose-50">
                    <div
                      className="h-full rounded-full bg-rose-500"
                      style={{
                        width: `${Math.max(
                          (product.quantity / maxTopQuantity) * 100,
                          8
                        )}%`,
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="rounded-[1.25rem] bg-white p-3 shadow-sm ring-1 ring-rose-100 sm:rounded-[1.75rem] sm:p-6">
          <p className="text-xs font-black uppercase tracking-[0.18em] text-rose-500">
            Ventas por periodo
          </p>
          <h2 className="mt-1 text-xl font-black text-slate-950">
            Resumen rápido
          </h2>

          <div className="mt-5 space-y-4">
            {periodSales.map((item) => (
              <div key={item.label}>
                <div className="mb-2 flex items-center justify-between gap-3">
                  <p className="text-sm font-black text-slate-700">
                    {item.label}
                  </p>
                  <p className="text-sm font-black text-slate-950">
                    {formatPrice(item.value)}
                  </p>
                </div>
                <p className="mb-2 text-xs font-bold text-slate-400">
                  {countWebOrders(item.sales)} pedido(s) web ·{" "}
                  {countStoreSales(item.sales)} venta(s) de tienda
                </p>
                <div className="h-3 overflow-hidden rounded-full bg-sky-50">
                  <div
                    className="h-full rounded-full bg-sky-500"
                    style={{
                      width: `${Math.max((item.value / maxPeriodSales) * 100, 5)}%`,
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>
    </section>
  );
}
