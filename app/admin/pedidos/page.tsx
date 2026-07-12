"use client";

import {
  cancelOrder,
  deleteCancelledOrder,
  getOrders,
  restoreOrder,
  updateOrderStatus,
} from "@/lib/firebase-services/orders";
import type { FirebaseDate, FirebaseOrder, OrderStatus } from "@/lib/firebase-types";
import { getDeliveryAddressLines } from "@/lib/delivery-address";
import { formatPrice } from "@/lib/products";
import { buildWhatsAppUrlWithNumber } from "@/hooks/useSiteSettings";
import {
  ClipboardList,
  Copy,
  Eye,
  MessageCircle,
  PackageCheck,
  RefreshCw,
  Search,
  Trash2,
  XCircle,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

const orderStatuses: OrderStatus[] = [
  "Nuevo",
  "Confirmado",
  "Preparando",
  "Listo para entregar",
  "Entregado",
  "Cancelado",
];

type OrderFilter =
  | "Todos"
  | "Nuevos"
  | "Confirmados"
  | "Preparando"
  | "Listos"
  | "Entregados"
  | "Cancelados"
  | "Papelera";

const orderFilters: OrderFilter[] = [
  "Todos",
  "Nuevos",
  "Confirmados",
  "Preparando",
  "Listos",
  "Entregados",
  "Cancelados",
  "Papelera",
];

type CancelChoice = "returnInventory" | "keepInventory";
type ConfirmState =
  | { type: "cancel"; order: FirebaseOrder }
  | { type: "hide"; order: FirebaseOrder }
  | null;

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

function getOrderFolio(order: FirebaseOrder) {
  return order.orderNumber ?? order.id.slice(-6).toUpperCase();
}

function getSpanishStatus(status: FirebaseOrder["status"]): OrderStatus {
  const map: Partial<Record<FirebaseOrder["status"], OrderStatus>> = {
    pending: "Nuevo",
    confirmed: "Confirmado",
    preparing: "Preparando",
    ready: "Listo para entregar",
    delivered: "Entregado",
    cancelled: "Cancelado",
  };

  return map[status] ?? status;
}

function getItemName(item: FirebaseOrder["items"][number]) {
  return item.productName ?? item.name ?? "Producto";
}

function getShippingCost(order: FirebaseOrder) {
  return order.shippingCost ?? order.shipping?.cost ?? 0;
}

function orderRequiresShippingQuote(order: FirebaseOrder) {
  return Boolean(order.shipping?.requiresQuote);
}

function formatOrderShipping(order: FirebaseOrder) {
  if (orderRequiresShippingQuote(order)) return "Pendiente de cotizar";
  return formatPrice(getShippingCost(order));
}

function getOrderPayableProductsTotal(order: FirebaseOrder) {
  return orderRequiresShippingQuote(order) ? order.subtotal : order.total;
}

function getPaymentStatusLabel(order: FirebaseOrder) {
  const status = order.payment?.status;
  const quoteShipping = orderRequiresShippingQuote(order);

  if (status === "paid") return quoteShipping ? "Pagado: productos" : "Pagado";
  if (status === "pending") {
    return quoteShipping ? "Pendiente: productos" : "Pendiente";
  }
  if (status === "failed") return "Fallido";
  if (status === "manual") {
    return quoteShipping ? "Pago de productos por acordar" : "Manual / WhatsApp";
  }
  return "No registrado";
}

function getPaymentProviderLabel(order: FirebaseOrder) {
  const provider = order.payment?.provider;

  if (provider === "mercadopago") return "Mercado Pago";
  if (provider === "manual") return "Manual / WhatsApp";
  return "No registrado";
}

function getPaymentBadgeLabel(order: FirebaseOrder) {
  if (orderRequiresShippingQuote(order)) {
    if (order.payment?.status === "paid") return "Pago recibido: productos";
    if (order.payment?.status === "pending") return "Pago de productos pendiente";
    return "Pago de productos";
  }

  if (order.payment?.status === "paid") return "Pago confirmado";
  return getPaymentStatusLabel(order);
}

function getPaymentBadgeClass(order: FirebaseOrder) {
  const status = order.payment?.status;

  if (status === "paid") {
    return "bg-emerald-50 text-emerald-700 ring-emerald-100";
  }

  if (status === "failed") {
    return "bg-rose-50 text-rose-700 ring-rose-100";
  }

  if (status === "manual") {
    return "bg-sky-50 text-sky-700 ring-sky-100";
  }

  return "bg-amber-50 text-amber-700 ring-amber-100";
}

function getPaymentAmountPaid(order: FirebaseOrder) {
  return typeof order.payment?.amountPaid === "number"
    ? order.payment.amountPaid
    : null;
}

function getDeliveryMethodLabel(order: FirebaseOrder) {
  return order.deliveryMethod ?? order.shipping?.method ?? "Envío nacional";
}

function matchesOrderFilter(order: FirebaseOrder, filter: OrderFilter) {
  const status = getSpanishStatus(order.status);

  if (filter === "Todos") return true;
  if (filter === "Nuevos") return status === "Nuevo";
  if (filter === "Confirmados") return status === "Confirmado";
  if (filter === "Preparando") return status === "Preparando";
  if (filter === "Listos") return status === "Listo para entregar";
  if (filter === "Entregados") return status === "Entregado";
  if (filter === "Papelera") return true;
  return status === "Cancelado";
}

function matchesOrderSearch(order: FirebaseOrder, searchTerm: string) {
  const normalizedSearch = searchTerm.trim().toLowerCase();

  if (!normalizedSearch) return true;

  return [
    getOrderFolio(order),
    order.customerName ?? "",
    order.customerPhone ?? "",
  ]
    .join(" ")
    .toLowerCase()
    .includes(normalizedSearch);
}

function buildCustomerMessage(order: FirebaseOrder) {
  const productsText = order.items
    .map(
      (item) => `- ${getItemName(item)}
  Talla: ${item.size}
  Cantidad: ${item.quantity}`
    )
    .join("\n\n");
  const addressLines = getOrderDeliveryAddressLines(order);
  const deliveryText =
    order.deliveryMethod === "Recoger en tienda"
      ? "Entrega: Recoger en tienda"
      : [
          `Método de entrega: ${getDeliveryMethodLabel(order)}`,
          addressLines.length > 0
            ? `Dirección:\n${addressLines
                .map((line) => `${line.label}: ${line.value}`)
                .join("\n")}`
            : "",
        ]
          .filter(Boolean)
          .join("\n\n");
  const quoteText = order.shipping?.requiresQuote
    ? "\n\nEl envío queda pendiente de cotización y pago por separado."
    : "";
  const totalsText = orderRequiresShippingQuote(order)
    ? `Total de productos: ${formatPrice(order.subtotal)}
Envío: Pendiente de cotizar
Pago de productos: ${formatPrice(getOrderPayableProductsTotal(order))}`
    : `Subtotal: ${formatPrice(order.subtotal)}
Envío: ${formatOrderShipping(order)}
Total: ${formatPrice(order.total)}`;

  return `Hola ${order.customerName || "buen día"}, te escribo de Charly Alexa sobre tu pedido #${getOrderFolio(order)}.

${deliveryText}

Productos:
${productsText}

${totalsText}
Estado de pago: ${getPaymentStatusLabel(order)}
Método de pago: ${getPaymentProviderLabel(order)}${quoteText}

Estado actual: ${getSpanishStatus(order.status)}`;
}

function getOrderDeliveryAddressLines(order: FirebaseOrder) {
  const structuredLines = getDeliveryAddressLines(order.deliveryAddress);
  if (structuredLines.length > 0) return structuredLines;

  const fallbackAddress =
    order.address ?? order.customerAddress ?? order.customer?.address ?? "";

  return fallbackAddress.trim()
    ? [{ label: "Dirección", value: fallbackAddress.trim() }]
    : [];
}

function buildCopyAddressText(order: FirebaseOrder) {
  if (order.deliveryMethod === "Recoger en tienda") return "Recoger en tienda";

  const addressLines = getOrderDeliveryAddressLines(order);
  return addressLines.map((line) => `${line.label}: ${line.value}`).join("\n");
}

export default function AdminOrdersPage() {
  const [orders, setOrders] = useState<FirebaseOrder[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [busyOrderId, setBusyOrderId] = useState("");
  const [expandedOrderId, setExpandedOrderId] = useState("");
  const [orderFilter, setOrderFilter] = useState<OrderFilter>("Todos");
  const [searchTerm, setSearchTerm] = useState("");
  const [error, setError] = useState("");
  const [confirmState, setConfirmState] = useState<ConfirmState>(null);
  const isTrashView = orderFilter === "Papelera";

  const loadOrders = useCallback(async () => {
    try {
      setIsLoading(true);
      setError("");
      const savedOrders = await getOrders({ includeDeleted: true });
      setOrders(savedOrders);
    } catch {
      setError("No se pudieron cargar los pedidos.");
      setOrders([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    queueMicrotask(() => {
      void loadOrders();
    });
  }, [loadOrders]);

  const visibleOrders = useMemo(
    () =>
      orders
        .filter((order) => (isTrashView ? order.isDeleted : !order.isDeleted))
        .filter((order) => matchesOrderFilter(order, orderFilter))
        .filter((order) => matchesOrderSearch(order, searchTerm))
        .sort((a, b) => getDateValue(b.createdAt) - getDateValue(a.createdAt)),
    [isTrashView, orderFilter, orders, searchTerm]
  );

  async function handleStatusChange(order: FirebaseOrder, status: OrderStatus) {
    try {
      setBusyOrderId(order.id);
      await updateOrderStatus(order.id, status);
      setOrders((currentOrders) =>
        currentOrders.map((item) =>
          item.id === order.id ? { ...item, status } : item
        )
      );
      toast.success("Estado del pedido actualizado");
    } catch {
      toast.error("No se pudo actualizar el pedido");
    } finally {
      setBusyOrderId("");
      setConfirmState(null);
    }
  }

  async function handleCancelOrder(order: FirebaseOrder, choice: CancelChoice) {
    const returnInventory = choice === "returnInventory";
    /*
    const returnInventory = window.confirm(
      "¿Cancelar y devolver piezas al inventario?\n\nAceptar: cancelar y devolver inventario.\nCancelar: elegir otra opción."
    );

    let shouldCancel = returnInventory;

    if (!returnInventory) {
      shouldCancel = window.confirm(
        "¿Cancelar sin devolver inventario?\n\nAceptar: cancelar sin mover piezas.\nCancelar: no cancelar."
      );
    }

    if (!shouldCancel) return;
    */

    try {
      setBusyOrderId(order.id);
      await cancelOrder(order.id, { returnInventory });
      setOrders((currentOrders) =>
        currentOrders.map((item) =>
          item.id === order.id ? { ...item, status: "Cancelado" } : item
        )
      );
      toast.success("Pedido cancelado");
    } catch {
      toast.error("No se pudo cancelar el pedido");
    } finally {
      setBusyOrderId("");
      setConfirmState(null);
    }
  }

  async function handleDeleteOrder(order: FirebaseOrder) {
    const isCancelled = getSpanishStatus(order.status) === "Cancelado";

    if (!isCancelled) {
      toast.error("Solo puedes ocultar pedidos cancelados.");
      return;
    }

    const shouldDelete = true;
    /*
    const shouldDelete = window.confirm(
      "¿Eliminar este pedido cancelado? Esta acción lo quitará del panel, pero no debe afectar el inventario."
    );

    */
    if (!shouldDelete) return;

    try {
      setBusyOrderId(order.id);
      await deleteCancelledOrder(order.id);
      setOrders((currentOrders) =>
        currentOrders.map((item) =>
          item.id === order.id
            ? {
                ...item,
                isDeleted: true,
                deletedAt: new Date(),
                deletedBy: "admin",
              }
            : item
        )
      );
      toast.success("Pedido ocultado");
    } catch {
      toast.error("No se pudo ocultar el pedido");
    } finally {
      setBusyOrderId("");
      setConfirmState(null);
    }
  }

  async function handleRestoreOrder(order: FirebaseOrder) {
    try {
      setBusyOrderId(order.id);
      await restoreOrder(order.id);
      setOrders((currentOrders) =>
        currentOrders.map((item) =>
          item.id === order.id
            ? {
                ...item,
                isDeleted: false,
                deletedAt: null,
                deletedBy: null,
              }
            : item
        )
      );
      toast.success("Pedido restaurado");
    } catch {
      toast.error("No se pudo restaurar el pedido");
    } finally {
      setBusyOrderId("");
    }
  }

  function handleWhatsApp(order: FirebaseOrder) {
    if (!order.customerPhone) {
      toast.error("Este pedido no tiene teléfono guardado.");
      return;
    }

    window.open(
      buildWhatsAppUrlWithNumber(order.customerPhone, buildCustomerMessage(order)),
      "_blank",
      "noopener,noreferrer"
    );
  }

  async function handleCopyAddress(order: FirebaseOrder) {
    const addressText = buildCopyAddressText(order);

    if (!addressText) {
      toast.error("Este pedido no tiene dirección registrada.");
      return;
    }

    try {
      await navigator.clipboard.writeText(addressText);
      toast.success("Dirección copiada.");
    } catch {
      toast.error("No se pudo copiar la dirección.");
    }
  }

  return (
    <section className="space-y-4 sm:space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.18em] text-sky-600">
            Pedidos web
          </p>
          <h1 className="mt-1 text-xl font-black text-slate-950 sm:mt-2 sm:text-4xl">
            Pedidos web
          </h1>
          <p className="mt-1 text-sm font-medium leading-6 text-slate-500 sm:hidden">
            Gestiona pedidos y estados.
          </p>
          <p className="mt-2 hidden max-w-2xl text-sm font-medium leading-6 text-slate-500 sm:block">
            Revisa pedidos hechos desde la tienda, cambia su estado y contacta
            al cliente por WhatsApp.
          </p>
        </div>

        <button
          type="button"
          onClick={() => void loadOrders()}
          className="inline-flex min-h-10 items-center justify-center gap-2 rounded-full bg-white px-4 py-2 text-xs font-black text-slate-700 shadow-sm ring-1 ring-slate-100 transition hover:bg-slate-50 sm:min-h-11 sm:px-5 sm:py-3 sm:text-sm"
        >
          <RefreshCw size={17} />
          Actualizar
        </button>
      </div>

      <div className="space-y-3 rounded-[1.25rem] bg-white p-3 shadow-sm ring-1 ring-rose-100 sm:rounded-[1.5rem] sm:p-4">
        <div className="-mx-1 overflow-x-auto px-1">
          <div className="flex min-w-max gap-2 sm:min-w-0 sm:flex-wrap">
          {orderFilters.map((filter) => (
            <button
              key={filter}
              type="button"
              onClick={() => setOrderFilter(filter)}
              className={`min-h-9 whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-black transition sm:px-4 sm:py-2 ${
                orderFilter === filter
                  ? "bg-slate-950 text-white"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
            >
              {filter}
            </button>
          ))}
          </div>
        </div>

        <label className="flex min-w-0 items-center gap-2 rounded-xl border border-slate-200 bg-[#fffaf5] px-3 py-2 sm:rounded-2xl sm:px-4 sm:py-3">
          <Search size={17} className="text-slate-400" />
          <input
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
            className="w-full min-w-0 bg-transparent text-[16px] font-bold outline-none sm:text-sm"
            placeholder="Buscar por nombre, teléfono o folio"
          />
        </label>
      </div>

      {error && (
        <div className="rounded-2xl bg-rose-50 px-4 py-3 text-sm font-bold text-rose-700 ring-1 ring-rose-100">
          {error}
        </div>
      )}

      {isLoading && (
        <div className="rounded-2xl bg-white px-4 py-3 text-sm font-bold text-slate-500 ring-1 ring-rose-100">
          Cargando pedidos...
        </div>
      )}

      {!isLoading && orders.length === 0 && (
        <div className="rounded-[1.25rem] bg-white p-6 text-center shadow-sm ring-1 ring-rose-100 sm:rounded-[1.75rem] sm:p-8">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-sky-50 text-sky-600 ring-1 ring-sky-100 sm:h-14 sm:w-14">
            <ClipboardList size={22} />
          </div>
          <h2 className="mt-3 text-lg font-black text-slate-950 sm:mt-4 sm:text-xl">
            Sin pedidos registrados
          </h2>
          <p className="mx-auto mt-2 hidden max-w-md text-sm font-medium leading-6 text-slate-500 sm:block">
            Cuando entren pedidos desde la web, aparecerán aquí para darles
            seguimiento.
          </p>
        </div>
      )}

      {!isLoading && orders.length > 0 && visibleOrders.length === 0 && (
        <div className="rounded-[1.25rem] bg-white p-6 text-center shadow-sm ring-1 ring-rose-100 sm:rounded-[1.75rem] sm:p-8">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-sky-50 text-sky-600 ring-1 ring-sky-100 sm:h-14 sm:w-14">
            <Search size={22} />
          </div>
          <h2 className="mt-3 text-lg font-black text-slate-950 sm:mt-4 sm:text-xl">
            No hay pedidos con ese filtro
          </h2>
          <p className="mx-auto mt-2 hidden max-w-md text-sm font-medium leading-6 text-slate-500 sm:block">
            Prueba con otro estado o borra la búsqueda.
          </p>
        </div>
      )}

      <div className="grid gap-3 sm:gap-4">
        {visibleOrders.map((order) => {
          const status = getSpanishStatus(order.status);
          const isExpanded = expandedOrderId === order.id;
          const isCancelled = status === "Cancelado";
          const deliveryAddressLines = getOrderDeliveryAddressLines(order);
          const canCopyAddress =
            order.deliveryMethod !== "Recoger en tienda" &&
            deliveryAddressLines.length > 0;

          if (isTrashView) {
            return (
              <article
                key={order.id}
                className="rounded-[1.25rem] bg-white p-3 shadow-sm ring-1 ring-rose-100 sm:rounded-[1.75rem] sm:p-5"
              >
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded-full bg-sky-50 px-3 py-1.5 text-xs font-black text-sky-700 ring-1 ring-sky-100">
                        Folio #{getOrderFolio(order)}
                      </span>
                      <span className="rounded-full bg-slate-100 px-3 py-1.5 text-xs font-black text-slate-600 ring-1 ring-slate-200">
                        {status}
                      </span>
                    </div>

                    <h2 className="mt-2 line-clamp-1 text-base font-black text-slate-950 sm:mt-3 sm:text-lg">
                      {order.customerName || "Cliente sin nombre"}
                    </h2>
                    <p className="mt-1 text-sm font-bold text-slate-500">
                      {order.customerPhone || "Sin teléfono"}
                    </p>
                  </div>

                  <div className="rounded-2xl bg-[#fffaf5] px-3 py-2 ring-1 ring-rose-100 sm:px-4 sm:py-3 sm:text-right">
                    <p className="text-xs font-black uppercase text-slate-500">
                      {orderRequiresShippingQuote(order)
                        ? "Pago de productos"
                        : "Total"}
                    </p>
                    <p className="mt-1 text-lg font-black text-slate-950 sm:text-xl">
                      {formatPrice(getOrderPayableProductsTotal(order))}
                    </p>
                  </div>
                </div>

                <div className="mt-3 grid gap-2 sm:mt-4 sm:grid-cols-2">
                  <div className="rounded-2xl bg-[#fffaf5] p-2.5 ring-1 ring-rose-100 sm:p-3">
                    <p className="text-xs font-black uppercase text-slate-500">
                      Fecha original
                    </p>
                    <p className="mt-1 text-sm font-bold text-slate-700">
                      {formatDate(order.createdAt)}
                    </p>
                  </div>
                  <div className="rounded-2xl bg-[#fffaf5] p-2.5 ring-1 ring-rose-100 sm:p-3">
                    <p className="text-xs font-black uppercase text-slate-500">
                      Fecha en que se ocultó
                    </p>
                    <p className="mt-1 text-sm font-bold text-slate-700">
                      {formatDate(order.deletedAt ?? "")}
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => void handleRestoreOrder(order)}
                  disabled={busyOrderId === order.id}
                  className="mt-3 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-full bg-slate-950 px-4 py-2.5 text-sm font-black text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-300 sm:mt-4 sm:w-auto"
                >
                  <RefreshCw size={16} />
                  Restaurar pedido
                </button>
              </article>
            );
          }

          return (
            <article
              key={order.id}
              className="min-w-0 rounded-[1.1rem] bg-white p-3 shadow-sm ring-1 ring-rose-100 sm:rounded-[1.75rem] sm:p-5"
            >
              <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-full bg-sky-50 px-3 py-1.5 text-xs font-black text-sky-700 ring-1 ring-sky-100">
                      Folio #{getOrderFolio(order)}
                    </span>
                    <span className="rounded-full bg-rose-50 px-3 py-1.5 text-xs font-black text-rose-600 ring-1 ring-rose-100">
                      Web
                    </span>
                    <span
                      className={`rounded-full px-3 py-1.5 text-xs font-black ring-1 ${
                        isCancelled
                          ? "bg-slate-100 text-slate-500 ring-slate-200"
                          : "bg-emerald-50 text-emerald-700 ring-emerald-100"
                      }`}
                    >
                      {status}
                    </span>
                  </div>

                  <h2 className="mt-2 line-clamp-1 text-lg font-black text-slate-950 sm:mt-3 sm:text-xl">
                    {order.customerName || "Cliente sin nombre"}
                  </h2>
                  <p className="mt-1 text-xs font-bold text-slate-500 sm:text-sm">
                    {order.customerPhone || "Sin teléfono"} · {formatDate(order.createdAt)}
                  </p>
                  <p className="mt-1 text-xs font-bold text-slate-500 sm:text-sm">
                    Método de entrega: {getDeliveryMethodLabel(order)}
                  </p>
                </div>

                <div className="flex flex-col gap-2 sm:flex-row lg:flex-col">
                  <select
                    value={status}
                    onChange={(event) =>
                      void handleStatusChange(
                        order,
                        event.target.value as OrderStatus
                      )
                    }
                    disabled={busyOrderId === order.id}
                    className="min-h-10 w-full min-w-0 rounded-full border border-slate-200 bg-[#fffaf5] px-3 py-2 text-[16px] font-black text-slate-700 outline-none transition focus:border-sky-300 sm:min-h-11 sm:px-4 sm:py-3 sm:text-sm"
                  >
                    {orderStatuses.map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>

                  <button
                    type="button"
                    onClick={() => handleWhatsApp(order)}
                    className="inline-flex min-h-10 items-center justify-center gap-2 rounded-full bg-emerald-500 px-3 py-2 text-xs font-black text-white shadow-sm transition hover:bg-emerald-600 sm:min-h-11 sm:px-4 sm:py-3 sm:text-sm"
                  >
                    <MessageCircle size={17} />
                    <span className="sm:hidden">WhatsApp</span>
                    <span className="hidden sm:inline">Contactar por WhatsApp</span>
                  </button>
                </div>
              </div>

              <div className="mt-3 grid grid-cols-3 gap-2 sm:mt-5 sm:grid-cols-2 sm:gap-3 md:grid-cols-5">
                <div className="hidden rounded-2xl bg-[#fffaf5] p-2.5 sm:block sm:p-4">
                  <p className="text-[10px] font-black uppercase text-slate-500 sm:text-xs">
                    Subtotal
                  </p>
                  <p className="mt-1 break-words text-sm font-black text-slate-950 sm:text-xl">
                    {formatPrice(order.subtotal)}
                  </p>
                </div>
                <div className="hidden rounded-2xl bg-[#fffaf5] p-2.5 sm:block sm:p-4">
                  <p className="text-[10px] font-black uppercase text-slate-500 sm:text-xs">
                    Envío
                  </p>
                  <p className="mt-1 break-words text-sm font-black text-slate-950 sm:text-xl">
                    {formatOrderShipping(order)}
                  </p>
                </div>
                <div className="rounded-xl bg-[#fffaf5] p-2 sm:rounded-2xl sm:p-4">
                  <p className="text-[10px] font-black uppercase text-slate-500 sm:text-xs">
                    {orderRequiresShippingQuote(order)
                      ? "Pago de productos"
                      : "Total"}
                  </p>
                  <p className="mt-1 break-words text-sm font-black text-slate-950 sm:text-2xl">
                    {formatPrice(getOrderPayableProductsTotal(order))}
                  </p>
                </div>
                <div className="rounded-xl bg-[#fffaf5] p-2 sm:rounded-2xl sm:p-4">
                  <p className="text-[10px] font-black uppercase text-slate-500 sm:text-xs">
                    Pago
                  </p>
                  <span
                    className={`mt-1 inline-flex rounded-full px-2.5 py-1 text-[11px] font-black ring-1 sm:text-xs ${getPaymentBadgeClass(
                      order
                    )}`}
                  >
                    {getPaymentBadgeLabel(order)}
                  </span>
                  {order.payment?.paymentId && (
                    <p className="mt-1 break-all text-[10px] font-bold text-slate-500 sm:text-xs">
                      ID {order.payment.paymentId}
                    </p>
                  )}
                </div>
                <div className="rounded-xl bg-[#fffaf5] p-2 sm:rounded-2xl sm:p-4">
                  <p className="text-[10px] font-black uppercase text-slate-500 sm:text-xs">
                    Piezas
                  </p>
                  <p className="mt-1 text-base font-black text-slate-950 sm:text-2xl">
                    {order.totalItems ?? order.items.length}
                  </p>
                </div>
              </div>

              {isExpanded && (
                <div className="mt-3 space-y-2 rounded-[1.25rem] bg-[#fffaf5] p-3 ring-1 ring-rose-100 sm:mt-5 sm:space-y-3 sm:rounded-[1.5rem] sm:p-4">
                  <div className="grid gap-3 md:grid-cols-2">
                    <div className="rounded-2xl bg-white p-3">
                      <p className="text-xs font-black uppercase text-slate-400">
                        Folio
                      </p>
                      <p className="mt-1 text-sm font-black text-slate-950">
                        #{getOrderFolio(order)}
                      </p>
                    </div>
                    <div className="rounded-2xl bg-white p-3">
                      <p className="text-xs font-black uppercase text-slate-400">
                        Estado
                      </p>
                      <p className="mt-1 text-sm font-black text-slate-950">
                        {status}
                      </p>
                    </div>
                    <div className="rounded-2xl bg-white p-3">
                      <p className="text-xs font-black uppercase text-slate-400">
                        Cliente
                      </p>
                      <p className="mt-1 text-sm font-black text-slate-950">
                        {order.customerName || "Cliente sin nombre"}
                      </p>
                    </div>
                    <div className="rounded-2xl bg-white p-3">
                      <p className="text-xs font-black uppercase text-slate-400">
                        Teléfono
                      </p>
                      <p className="mt-1 text-sm font-black text-slate-950">
                        {order.customerPhone || "Sin teléfono"}
                      </p>
                    </div>
                    <div className="rounded-2xl bg-white p-3">
                      <p className="text-xs font-black uppercase text-slate-400">
                        Entrega
                      </p>
                      <p className="mt-1 text-sm font-black text-slate-950">
                        {getDeliveryMethodLabel(order)}
                      </p>
                    </div>
                    <div className="rounded-2xl bg-white p-3">
                      <p className="text-xs font-black uppercase text-slate-400">
                        Estado de pago
                      </p>
                      <span
                        className={`mt-2 inline-flex rounded-full px-3 py-1.5 text-xs font-black ring-1 ${getPaymentBadgeClass(
                          order
                        )}`}
                      >
                        {getPaymentBadgeLabel(order)}
                      </span>
                    </div>
                    <div className="rounded-2xl bg-white p-3">
                      <p className="text-xs font-black uppercase text-slate-400">
                        Método de pago
                      </p>
                      <p className="mt-1 text-sm font-black text-slate-950">
                        {getPaymentProviderLabel(order)}
                      </p>
                    </div>
                    {order.payment?.paymentId && (
                      <div className="rounded-2xl bg-white p-3">
                        <p className="text-xs font-black uppercase text-slate-400">
                          ID Mercado Pago
                        </p>
                        <p className="mt-1 break-all text-sm font-black text-slate-950">
                          {order.payment.paymentId}
                        </p>
                      </div>
                    )}
                    {order.payment?.paidAt && (
                      <div className="rounded-2xl bg-white p-3">
                        <p className="text-xs font-black uppercase text-slate-400">
                          Fecha de pago
                        </p>
                        <p className="mt-1 text-sm font-black text-slate-950">
                          {formatDate(order.payment.paidAt)}
                        </p>
                      </div>
                    )}
                    {getPaymentAmountPaid(order) !== null && (
                      <div className="rounded-2xl bg-white p-3">
                        <p className="text-xs font-black uppercase text-slate-400">
                          {orderRequiresShippingQuote(order)
                            ? "Pago recibido: productos"
                            : "Monto pagado"}
                        </p>
                        <p className="mt-1 text-sm font-black text-slate-950">
                          {formatPrice(getPaymentAmountPaid(order) ?? 0)}
                        </p>
                      </div>
                    )}
                    <div className="rounded-2xl bg-white p-3">
                      <p className="text-xs font-black uppercase text-slate-400">
                        Envío
                      </p>
                      <p className="mt-1 text-sm font-black text-slate-950">
                        {formatOrderShipping(order)}
                      </p>
                    </div>
                    <div className="rounded-2xl bg-white p-3">
                      <p className="text-xs font-black uppercase text-slate-400">
                        Cotización de envío
                      </p>
                      <p className="mt-1 text-sm font-black text-slate-950">
                        {orderRequiresShippingQuote(order)
                          ? "Pendiente de cotizar"
                          : "No requiere"}
                      </p>
                    </div>
                    <div className="rounded-2xl bg-white p-3">
                      <p className="text-xs font-black uppercase text-slate-400">
                        Fecha
                      </p>
                      <p className="mt-1 text-sm font-black text-slate-950">
                        {formatDate(order.createdAt)}
                      </p>
                    </div>
                  </div>

                  <div className="space-y-2">
                    {order.items.map((item, index) => (
                      <div
                        key={`${order.id}-${item.productId}-${item.size}-${index}`}
                        className="grid gap-2 rounded-2xl bg-white p-3 sm:grid-cols-[1fr_auto]"
                      >
                        <div>
                          <p className="text-sm font-black text-slate-950">
                            {getItemName(item)}
                          </p>
                          <p className="mt-1 text-xs font-bold text-slate-500">
                            Talla {item.size} · {item.quantity} pieza(s) ·{" "}
                            {formatPrice(item.price)} c/u
                          </p>
                        </div>
                        <p className="text-sm font-black text-slate-950">
                          {formatPrice(item.subtotal)}
                        </p>
                      </div>
                    ))}
                  </div>

                  <div className="rounded-2xl bg-white p-3">
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                      <p className="text-xs font-black uppercase text-slate-400">
                        Dirección de entrega
                      </p>
                      {canCopyAddress && (
                        <button
                          type="button"
                          onClick={() => void handleCopyAddress(order)}
                          className="inline-flex min-h-9 items-center justify-center gap-2 rounded-full bg-slate-100 px-3 py-2 text-xs font-black text-slate-700 transition hover:bg-slate-200"
                        >
                          <Copy size={14} />
                          Copiar dirección
                        </button>
                      )}
                    </div>
                    {order.deliveryMethod === "Recoger en tienda" ? (
                      <p className="mt-1 text-sm font-black text-slate-950">
                        Recoger en tienda
                      </p>
                    ) : deliveryAddressLines.length > 0 ? (
                      <dl className="mt-2 grid gap-2 text-sm leading-6 text-slate-600">
                        {deliveryAddressLines.map((line) => (
                          <div key={line.label}>
                            <dt className="font-black text-slate-700">
                              {line.label}
                            </dt>
                            <dd className="font-bold">{line.value}</dd>
                          </div>
                        ))}
                      </dl>
                    ) : (
                      <p className="mt-1 text-sm font-bold leading-6 text-slate-600">
                        Sin dirección registrada
                      </p>
                    )}
                  </div>

                  {order.notes && (
                    <div className="rounded-2xl bg-white p-3">
                      <p className="text-xs font-black uppercase text-slate-400">
                        Notas
                      </p>
                      <p className="mt-1 text-sm font-bold leading-6 text-slate-600">
                        {order.notes}
                      </p>
                    </div>
                  )}

                  <div className="rounded-2xl bg-white p-3">
                    <p className="text-xs font-black uppercase text-slate-400">
                      Totales
                    </p>
                    {orderRequiresShippingQuote(order) ? (
                      <div className="mt-2 space-y-2 text-sm font-bold text-slate-600">
                        <div className="flex items-center justify-between gap-3">
                          <span>Total de productos</span>
                          <span className="font-black text-slate-950">
                            {formatPrice(order.subtotal)}
                          </span>
                        </div>
                        <div className="flex items-center justify-between gap-3">
                          <span>Envío</span>
                          <span className="text-right font-black text-amber-700">
                            Pendiente de cotizar
                          </span>
                        </div>
                        <div className="flex items-center justify-between gap-3 border-t border-rose-100 pt-2">
                          <span>Pago de productos</span>
                          <span className="text-xl font-black text-slate-950">
                            {formatPrice(getOrderPayableProductsTotal(order))}
                          </span>
                        </div>
                      </div>
                    ) : (
                      <div className="mt-2 space-y-2 text-sm font-bold text-slate-600">
                        <div className="flex items-center justify-between gap-3">
                          <span>Subtotal</span>
                          <span className="font-black text-slate-950">
                            {formatPrice(order.subtotal)}
                          </span>
                        </div>
                        <div className="flex items-center justify-between gap-3">
                          <span>Envío</span>
                          <span className="font-black text-slate-950">
                            {formatOrderShipping(order)}
                          </span>
                        </div>
                        <div className="flex items-center justify-between gap-3 border-t border-rose-100 pt-2">
                          <span>Total</span>
                          <span className="text-xl font-black text-slate-950">
                            {formatPrice(order.total)}
                          </span>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              <div className="mt-3 flex flex-wrap gap-2 sm:mt-5">
                <button
                  type="button"
                  onClick={() =>
                    setExpandedOrderId(isExpanded ? "" : order.id)
                  }
                  className="inline-flex items-center justify-center gap-2 rounded-full bg-sky-50 px-4 py-2 text-xs font-black text-sky-700 transition hover:bg-sky-100"
                >
                  <Eye size={15} />
                  {isExpanded ? "Ocultar detalle" : "Ver detalle"}
                </button>

                {!isCancelled && (
                  <button
                    type="button"
                    onClick={() => setConfirmState({ type: "cancel", order })}
                    disabled={busyOrderId === order.id}
                    className="inline-flex items-center justify-center gap-2 rounded-full bg-rose-50 px-4 py-2 text-xs font-black text-rose-600 transition hover:bg-rose-100 disabled:cursor-not-allowed disabled:text-rose-300"
                  >
                    <XCircle size={15} />
                    Cancelar pedido
                  </button>
                )}

                {isCancelled && (
                  <button
                    type="button"
                    onClick={() => setConfirmState({ type: "hide", order })}
                    disabled={busyOrderId === order.id}
                    className="inline-flex items-center justify-center gap-2 rounded-full bg-rose-50 px-4 py-2 text-xs font-black text-rose-600 transition hover:bg-rose-100 disabled:cursor-not-allowed disabled:text-rose-300"
                  >
                    <Trash2 size={15} />
                    Ocultar pedido
                  </button>
                )}

                {status === "Entregado" && (
                  <span className="inline-flex items-center justify-center gap-2 rounded-full bg-emerald-50 px-4 py-2 text-xs font-black text-emerald-700 ring-1 ring-emerald-100">
                    <PackageCheck size={15} />
                    Pedido entregado
                  </span>
                )}
              </div>
            </article>
          );
        })}
      </div>

      {confirmState && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/45 px-4 py-4 sm:items-center">
          <div className="w-full max-w-lg rounded-[1.5rem] bg-white p-5 shadow-xl ring-1 ring-rose-100">
            {confirmState.type === "hide" ? (
              <>
                <h2 className="text-xl font-black text-slate-950">
                  Ocultar pedido cancelado
                </h2>
                <p className="mt-3 text-sm font-bold leading-6 text-slate-600">
                  ¿Seguro que quieres ocultar este pedido cancelado? Ya no
                  aparecerá en el panel principal, pero se guardará en la base
                  de datos por si necesitas recuperarlo después.
                </p>

                <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                  <button
                    type="button"
                    onClick={() => setConfirmState(null)}
                    className="inline-flex min-h-11 items-center justify-center rounded-full bg-slate-100 px-5 py-2.5 text-sm font-black text-slate-700 transition hover:bg-slate-200"
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleDeleteOrder(confirmState.order)}
                    disabled={busyOrderId === confirmState.order.id}
                    className="inline-flex min-h-11 items-center justify-center rounded-full bg-rose-600 px-5 py-2.5 text-sm font-black text-white transition hover:bg-rose-700 disabled:cursor-not-allowed disabled:bg-rose-300"
                  >
                    Ocultar pedido
                  </button>
                </div>
              </>
            ) : (
              <>
                <h2 className="text-xl font-black text-slate-950">
                  Cancelar pedido
                </h2>
                <p className="mt-3 text-sm font-bold leading-6 text-slate-600">
                  Elige si quieres devolver las piezas al inventario o solo
                  cambiar el estado del pedido a cancelado.
                </p>

                <div className="mt-5 grid gap-2">
                  <button
                    type="button"
                    onClick={() =>
                      void handleCancelOrder(
                        confirmState.order,
                        "returnInventory"
                      )
                    }
                    disabled={busyOrderId === confirmState.order.id}
                    className="inline-flex min-h-11 items-center justify-center rounded-full bg-slate-950 px-5 py-2.5 text-sm font-black text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-300"
                  >
                    Cancelar y devolver inventario
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      void handleCancelOrder(confirmState.order, "keepInventory")
                    }
                    disabled={busyOrderId === confirmState.order.id}
                    className="inline-flex min-h-11 items-center justify-center rounded-full bg-rose-50 px-5 py-2.5 text-sm font-black text-rose-700 transition hover:bg-rose-100 disabled:cursor-not-allowed disabled:text-rose-300"
                  >
                    Cancelar sin mover inventario
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmState(null)}
                    className="inline-flex min-h-11 items-center justify-center rounded-full bg-slate-100 px-5 py-2.5 text-sm font-black text-slate-700 transition hover:bg-slate-200"
                  >
                    No cancelar
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
