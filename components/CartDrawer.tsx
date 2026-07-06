"use client";

import { buildWhatsAppUrlWithNumber, useSiteSettings } from "@/hooks/useSiteSettings";
import { createWebOrder } from "@/lib/firebase-services/orders";
import type { DeliveryMethod, FirebaseOrderItem } from "@/lib/firebase-types";
import { formatPrice, getProductStockForSize } from "@/lib/products";
import {
  getWholesaleLabel,
  isWholesaleProduct,
  validateWholesaleCart,
} from "@/lib/wholesale";
import { useCartStore, type CartItem } from "@/store/cart-store";
import {
  AlertCircle,
  CheckCircle2,
  ChevronLeft,
  Minus,
  Plus,
  Send,
  ShoppingBag,
  Trash2,
  Truck,
  UserRound,
  X,
} from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useMemo, useRef, useState } from "react";
import { toast } from "sonner";

type CheckoutStep = 1 | 2 | 3;

type CustomerForm = {
  customerName: string;
  customerPhone: string;
  deliveryMethod: DeliveryMethod;
  address: string;
  notes: string;
};

type Confirmation = {
  orderNumber: string;
  whatsappUrl: string;
};

const initialCustomerForm: CustomerForm = {
  customerName: "",
  customerPhone: "",
  deliveryMethod: "Recoger en tienda",
  address: "",
  notes: "",
};

const checkoutSteps: { step: CheckoutStep; label: string }[] = [
  { step: 1, label: "Productos" },
  { step: 2, label: "Datos" },
  { step: 3, label: "Confirmar" },
];

function getCartImage(item: CartItem) {
  return (
    item.product.imageUrl ||
    item.product.images?.[0] ||
    item.product.galleryImages?.[0] ||
    ""
  );
}

function ProductThumb({ item }: { item: CartItem }) {
  const imageUrl = getCartImage(item);

  if (imageUrl) {
    return (
      <div
        className="h-24 w-24 shrink-0 rounded-2xl bg-cover bg-center shadow-sm ring-1 ring-slate-100"
        style={{ backgroundImage: `url(${imageUrl})` }}
      />
    );
  }

  return (
    <div
      className={`flex h-24 w-24 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br ${item.product.gradient}`}
    >
      <ShoppingBag className="text-slate-700" />
    </div>
  );
}

export default function CartDrawer() {
  const { settings } = useSiteSettings();
  const {
    items,
    isOpen,
    closeCart,
    increaseItem,
    decreaseItem,
    removeItem,
    clearCart,
    totalItems,
    totalPrice,
  } = useCartStore();

  const [step, setStep] = useState<CheckoutStep>(1);
  const [customerForm, setCustomerForm] =
    useState<CustomerForm>(initialCustomerForm);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [confirmation, setConfirmation] = useState<Confirmation | null>(null);
  const submitLockRef = useRef(false);

  const total = totalPrice();
  const totalPieces = totalItems();
  const wholesaleValidation = validateWholesaleCart(items);
  const stockMessages = useMemo(
    () =>
      items
        .map((item) => {
          const availablePieces = getProductStockForSize(
            item.product,
            item.selectedSize
          );

          if (availablePieces <= 0) return "Esta talla ya no está disponible.";
          if (item.quantity <= availablePieces) return "";

          return `No hay suficientes piezas de ${item.product.name} talla ${item.selectedSize}.`;
        })
        .filter(Boolean),
    [items]
  );
  const canContinue = wholesaleValidation.canCheckout && stockMessages.length === 0;
  function updateCustomerForm<Key extends keyof CustomerForm>(
    key: Key,
    value: CustomerForm[Key]
  ) {
    setCustomerForm((current) => ({
      ...current,
      [key]: value,
    }));
  }

  function resetCartState() {
    setStep(1);
    setCustomerForm(initialCustomerForm);
    setConfirmation(null);
  }

  function handleCloseCart() {
    resetCartState();
    closeCart();
  }

  function buildOrderItems(): FirebaseOrderItem[] {
    return items.map((item) => {
      const subtotal = item.product.price * item.quantity;
      const mainImage = getCartImage(item);

      return {
        productId: item.productId,
        productName: item.product.name,
        name: item.product.name,
        slug: item.slug,
        category: item.product.category,
        subcategory: item.product.subcategory,
        size: item.selectedSize,
        quantity: item.quantity,
        price: item.product.price,
        subtotal,
        mainImage,
        image: mainImage,
        wholesaleType: item.product.wholesaleMode ?? "none",
        wholesaleMinimum: item.product.wholesaleMinQuantity ?? 0,
      };
    });
  }

  function buildOrderMessage(
    orderNumber: string,
    orderItems: FirebaseOrderItem[],
    orderTotal: number
  ) {
    const productsText = orderItems
      .map(
        (item) => `- ${item.productName ?? item.name}
  Talla: ${item.size}
  Cantidad: ${item.quantity}
  Subtotal: ${formatPrice(item.subtotal)}`
      )
      .join("\n\n");

    const deliveryText =
      customerForm.deliveryMethod === "Envío a domicilio" && customerForm.address
        ? `Entrega: ${customerForm.deliveryMethod}\nDirección: ${customerForm.address}`
        : `Entrega: ${customerForm.deliveryMethod}`;

    return `Hola, quiero confirmar este pedido:

Pedido: #${orderNumber}
Nombre: ${customerForm.customerName}
${deliveryText}

Productos:
${productsText}

Total: ${formatPrice(orderTotal)}

Notas:
${customerForm.notes || "Sin notas."}`;
  }

  function validateCart() {
    if (items.length === 0) {
      toast.error("El carrito está vacío.");
      return false;
    }

    if (!wholesaleValidation.canCheckout) {
      toast.error("Pedido mínimo de mayoreo incompleto", {
        description: wholesaleValidation.messages[0],
      });
      return false;
    }

    if (stockMessages.length > 0) {
      toast.error("Revisa las piezas disponibles", {
        description: stockMessages[0],
      });
      return false;
    }

    return true;
  }

  function validateCustomerData() {
    if (!customerForm.customerName.trim()) {
      toast.error("Agrega el nombre del cliente.");
      return false;
    }

    if (!customerForm.customerPhone.trim()) {
      toast.error("Agrega el teléfono del cliente.");
      return false;
    }

    if (
      customerForm.deliveryMethod === "Envío a domicilio" &&
      !customerForm.address.trim()
    ) {
      toast.error("Agrega la dirección para el envío.");
      return false;
    }

    return true;
  }

  function handleNextStep() {
    if (step === 1 && !validateCart()) return;
    if (step === 2 && !validateCustomerData()) return;

    setStep((current) => Math.min(current + 1, 3) as CheckoutStep);
  }

  function handleIncreaseItem(item: CartItem) {
    const availablePieces = getProductStockForSize(
      item.product,
      item.selectedSize
    );

    if (item.quantity >= availablePieces) {
      toast.error("No hay más piezas disponibles de esta talla.");
      return;
    }

    increaseItem(item.id);
  }

  async function handleConfirmOrder() {
    if (submitLockRef.current || isSubmitting) return;

    submitLockRef.current = true;

    if (!validateCart() || !validateCustomerData()) {
      submitLockRef.current = false;
      return;
    }

    const orderItems = buildOrderItems();
    const orderTotal = total;

    try {
      setIsSubmitting(true);
      const result = await createWebOrder({
        customerName: customerForm.customerName.trim(),
        customerPhone: customerForm.customerPhone.trim(),
        deliveryMethod: customerForm.deliveryMethod,
        address:
          customerForm.deliveryMethod === "Envío a domicilio"
            ? customerForm.address.trim()
            : "",
        notes: customerForm.notes.trim(),
        items: orderItems,
        total: orderTotal,
        totalItems: totalPieces,
        wholesaleValidation,
      });

      toast.success("Pedido enviado", {
        description: `Folio #${result.orderNumber}. Se abrirá WhatsApp para confirmarlo.`,
      });

      const whatsappUrl = buildWhatsAppUrlWithNumber(
        settings.whatsappInternational,
        buildOrderMessage(result.orderNumber, orderItems, orderTotal)
      );

      clearCart();
      setConfirmation({ orderNumber: result.orderNumber, whatsappUrl });
      setStep(1);

      window.open(whatsappUrl, "_blank", "noopener,noreferrer");
    } catch (error) {
      const rawMessage =
        error instanceof Error ? error.message : "No se pudo enviar el pedido.";
      const message = rawMessage.includes("No hay suficientes piezas")
        ? "Lo sentimos, ya no hay suficientes piezas de esta talla."
        : `${rawMessage} Intenta de nuevo.`;

      toast.error(message);
    } finally {
      setIsSubmitting(false);
      submitLockRef.current = false;
    }
  }

  const validationMessages = [
    ...wholesaleValidation.messages,
    ...stockMessages,
  ];

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.button
            type="button"
            aria-label="Cerrar carrito"
            className="fixed inset-0 z-[998] bg-slate-950/40 backdrop-blur-sm"
            onClick={handleCloseCart}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          />

          <motion.aside
            className="fixed right-0 top-0 z-[999] flex h-full w-full max-w-md flex-col bg-[#fffaf5] shadow-2xl"
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", stiffness: 220, damping: 28 }}
          >
            <div className="flex items-center justify-between border-b border-rose-100 bg-white/80 p-5">
              <div>
                <p className="text-xs font-black uppercase text-rose-500">
                  Pedido
                </p>
                <h2 className="text-2xl font-black text-slate-950">
                  Carrito
                </h2>
              </div>

              <button
                type="button"
                onClick={handleCloseCart}
                className="rounded-full bg-slate-100 p-3 text-slate-700 transition hover:bg-slate-200"
                aria-label="Cerrar carrito"
              >
                <X />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-5 pb-32 sm:pb-24">
              {confirmation ? (
                <div className="flex min-h-full flex-col items-center justify-center text-center">
                  <div className="mb-5 flex h-24 w-24 items-center justify-center rounded-[2rem] bg-emerald-50 text-emerald-600 ring-1 ring-emerald-100">
                    <CheckCircle2 size={44} />
                  </div>
                  <h3 className="text-2xl font-black text-slate-950">
                    Pedido enviado
                  </h3>
                  <p className="mt-2 text-sm font-bold text-slate-500">
                    Folio #{confirmation.orderNumber}
                  </p>
                  <p className="mt-2 max-w-xs text-sm leading-6 text-slate-500">
                    Tu pedido se guardó correctamente. Te llevaremos a WhatsApp
                    para confirmar con la tienda.
                  </p>
                  <button
                    type="button"
                    onClick={() =>
                      window.open(
                        confirmation.whatsappUrl,
                        "_blank",
                        "noopener,noreferrer"
                      )
                    }
                    className="mt-6 inline-flex items-center justify-center gap-2 rounded-full bg-emerald-500 px-5 py-3 text-sm font-black text-white shadow-sm transition hover:bg-emerald-600"
                  >
                    <Send size={17} />
                    Abrir WhatsApp otra vez
                  </button>
                </div>
              ) : items.length === 0 ? (
                <div className="flex h-full flex-col items-center justify-center text-center">
                  <div className="mb-5 flex h-24 w-24 items-center justify-center rounded-[2rem] bg-rose-50">
                    <ShoppingBag className="h-12 w-12 text-rose-400" />
                  </div>
                  <h3 className="text-2xl font-black text-slate-950">
                    Carrito vacío
                  </h3>
                  <p className="mt-2 text-slate-500">
                    Agrega productos para generar tu pedido.
                  </p>
                </div>
              ) : (
                <div className="space-y-5">
                  <div className="grid grid-cols-3 gap-2">
                    {checkoutSteps.map((item) => (
                      <button
                        key={item.step}
                        type="button"
                        onClick={() => {
                          if (item.step < step) setStep(item.step);
                        }}
                        className={`rounded-2xl px-3 py-2 text-xs font-black transition ${
                          step === item.step
                            ? "bg-slate-950 text-white"
                            : item.step < step
                              ? "bg-white text-slate-700 ring-1 ring-slate-100"
                              : "bg-slate-100 text-slate-400"
                        }`}
                      >
                        Paso {item.step}
                        <span className="block text-[10px] opacity-80">
                          {item.label}
                        </span>
                      </button>
                    ))}
                  </div>

                  {validationMessages.length > 0 && (
                    <div className="rounded-[1.25rem] border border-amber-200 bg-amber-50 p-4 text-amber-800">
                      <div className="flex items-start gap-3">
                        <AlertCircle className="mt-0.5 shrink-0" size={18} />
                        <div>
                          <p className="text-sm font-black">
                            Revisa antes de enviar
                          </p>
                          <ul className="mt-2 space-y-1 text-xs font-bold leading-5">
                            {validationMessages.map((message) => (
                              <li key={message}>{message}</li>
                            ))}
                          </ul>
                        </div>
                      </div>
                    </div>
                  )}

                  {step === 1 && (
                    <div className="space-y-4">
                      {items.map((item) => (
                        <div
                          key={item.id}
                          className="rounded-[1.5rem] border border-slate-100 bg-white p-4 shadow-sm"
                        >
                          <div className="flex gap-4">
                            <ProductThumb item={item} />

                            <div className="min-w-0 flex-1">
                              <div className="flex items-start justify-between gap-2">
                                <h3 className="font-black leading-tight text-slate-950">
                                  {item.product.name}
                                </h3>

                                {isWholesaleProduct(item.product) && (
                                  <span className="shrink-0 rounded-full bg-amber-50 px-2.5 py-1 text-[10px] font-black uppercase text-amber-700 ring-1 ring-amber-100">
                                    Mayoreo
                                  </span>
                                )}
                              </div>

                              <p className="mt-1 text-sm text-slate-500">
                                {formatPrice(item.product.price)} c/u
                              </p>
                              <p className="mt-1 text-xs font-bold text-slate-400">
                                Talla: {item.selectedSize}
                              </p>

                              {isWholesaleProduct(item.product) && (
                                <p className="mt-1 text-xs font-black text-amber-700">
                                  {getWholesaleLabel(item.product)}
                                </p>
                              )}

                              <p className="mt-1 text-sm font-black text-slate-950">
                                Subtotal:{" "}
                                {formatPrice(item.product.price * item.quantity)}
                              </p>

                              <div className="mt-3 flex items-center justify-between">
                                <div className="flex items-center gap-2 rounded-full bg-[#fffaf5] p-1 shadow-sm">
                                  <button
                                    type="button"
                                    onClick={() => decreaseItem(item.id)}
                                    className="rounded-full bg-white p-2 transition hover:bg-slate-100"
                                    aria-label="Disminuir cantidad"
                                  >
                                    <Minus size={14} />
                                  </button>

                                  <span className="w-7 text-center text-sm font-black">
                                    {item.quantity}
                                  </span>

                                  <button
                                    type="button"
                                    onClick={() => handleIncreaseItem(item)}
                                    className="rounded-full bg-white p-2 transition hover:bg-slate-100"
                                    aria-label="Aumentar cantidad"
                                  >
                                    <Plus size={14} />
                                  </button>
                                </div>

                                <button
                                  type="button"
                                  onClick={() => removeItem(item.id)}
                                  className="rounded-full bg-red-50 p-2 text-red-500 transition hover:bg-red-100"
                                  aria-label="Eliminar producto"
                                >
                                  <Trash2 size={17} />
                                </button>
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {step === 2 && (
                    <div className="space-y-4 rounded-[1.5rem] bg-white p-4 shadow-sm ring-1 ring-rose-100">
                      <div className="flex items-center gap-3">
                        <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-rose-50 text-rose-500">
                          <UserRound size={20} />
                        </div>
                        <div>
                          <h3 className="text-lg font-black text-slate-950">
                            Datos del cliente
                          </h3>
                          <p className="text-xs font-bold text-slate-400">
                            Solo pedimos lo necesario para confirmar.
                          </p>
                        </div>
                      </div>

                      <label className="block">
                        <span className="text-xs font-black uppercase text-slate-400">
                          Nombre del cliente
                        </span>
                        <input
                          value={customerForm.customerName}
                          onChange={(event) =>
                            updateCustomerForm(
                              "customerName",
                              event.target.value
                            )
                          }
                          className="mt-2 w-full rounded-2xl border border-slate-200 bg-[#fffaf5] px-4 py-3 text-sm font-bold outline-none transition focus:border-rose-300 focus:bg-white"
                          placeholder="María López"
                        />
                      </label>

                      <label className="block">
                        <span className="text-xs font-black uppercase text-slate-400">
                          Teléfono
                        </span>
                        <input
                          value={customerForm.customerPhone}
                          onChange={(event) =>
                            updateCustomerForm(
                              "customerPhone",
                              event.target.value
                            )
                          }
                          className="mt-2 w-full rounded-2xl border border-slate-200 bg-[#fffaf5] px-4 py-3 text-sm font-bold outline-none transition focus:border-rose-300 focus:bg-white"
                          placeholder="10 dígitos"
                        />
                      </label>

                      <div>
                        <span className="text-xs font-black uppercase text-slate-400">
                          Método de entrega
                        </span>
                        <div className="mt-2 grid gap-2">
                          {(["Recoger en tienda", "Envío a domicilio"] as const).map(
                            (method) => (
                              <button
                                key={method}
                                type="button"
                                onClick={() =>
                                  updateCustomerForm("deliveryMethod", method)
                                }
                                className={`flex items-center gap-3 rounded-2xl px-4 py-3 text-left text-sm font-black transition ${
                                  customerForm.deliveryMethod === method
                                    ? "bg-slate-950 text-white"
                                    : "bg-[#fffaf5] text-slate-700 ring-1 ring-slate-100 hover:bg-rose-50"
                                }`}
                              >
                                <Truck size={17} />
                                {method}
                              </button>
                            )
                          )}
                        </div>
                      </div>

                      {customerForm.deliveryMethod === "Envío a domicilio" && (
                        <label className="block">
                          <span className="text-xs font-black uppercase text-slate-400">
                            Dirección
                          </span>
                          <textarea
                            value={customerForm.address}
                            onChange={(event) =>
                              updateCustomerForm("address", event.target.value)
                            }
                            className="mt-2 min-h-24 w-full rounded-2xl border border-slate-200 bg-[#fffaf5] px-4 py-3 text-sm font-bold outline-none transition focus:border-rose-300 focus:bg-white"
                            placeholder="Calle, número, colonia y referencias"
                          />
                        </label>
                      )}

                      <label className="block">
                        <span className="text-xs font-black uppercase text-slate-400">
                          Notas opcionales
                        </span>
                        <textarea
                          value={customerForm.notes}
                          onChange={(event) =>
                            updateCustomerForm("notes", event.target.value)
                          }
                          className="mt-2 min-h-20 w-full rounded-2xl border border-slate-200 bg-[#fffaf5] px-4 py-3 text-sm font-bold outline-none transition focus:border-rose-300 focus:bg-white"
                          placeholder="Ej. Lo paso a recoger mañana."
                        />
                      </label>
                    </div>
                  )}

                  {step === 3 && (
                    <div className="space-y-4 rounded-[1.5rem] bg-white p-4 shadow-sm ring-1 ring-rose-100">
                      <h3 className="text-lg font-black text-slate-950">
                        Confirmar pedido
                      </h3>

                      <div className="rounded-2xl bg-[#fffaf5] p-4">
                        <p className="text-xs font-black uppercase text-slate-400">
                          Cliente
                        </p>
                        <p className="mt-1 text-sm font-black text-slate-950">
                          {customerForm.customerName}
                        </p>
                        <p className="text-xs font-bold text-slate-500">
                          {customerForm.customerPhone}
                        </p>
                      </div>

                      <div className="rounded-2xl bg-[#fffaf5] p-4">
                        <p className="text-xs font-black uppercase text-slate-400">
                          Entrega
                        </p>
                        <p className="mt-1 text-sm font-black text-slate-950">
                          {customerForm.deliveryMethod}
                        </p>
                        {customerForm.deliveryMethod === "Envío a domicilio" && (
                          <p className="mt-1 text-xs font-bold leading-5 text-slate-500">
                            {customerForm.address}
                          </p>
                        )}
                      </div>

                      <div className="space-y-2">
                        {items.map((item) => (
                          <div
                            key={`summary-${item.id}`}
                            className="flex items-start justify-between gap-3 rounded-2xl bg-[#fffaf5] p-3"
                          >
                            <div>
                              <p className="text-sm font-black text-slate-950">
                                {item.product.name}
                              </p>
                              <p className="mt-1 text-xs font-bold text-slate-500">
                                Talla {item.selectedSize} · {item.quantity} pieza(s)
                              </p>
                            </div>
                            <p className="text-sm font-black text-slate-950">
                              {formatPrice(item.product.price * item.quantity)}
                            </p>
                          </div>
                        ))}
                      </div>

                      {customerForm.notes && (
                        <div className="rounded-2xl bg-[#fffaf5] p-4">
                          <p className="text-xs font-black uppercase text-slate-400">
                            Notas
                          </p>
                          <p className="mt-1 text-sm font-bold leading-6 text-slate-600">
                            {customerForm.notes}
                          </p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="shrink-0 border-t border-rose-100 bg-white/85 p-5">
              {confirmation ? (
                <div className="grid gap-3">
                  <button
                    type="button"
                    onClick={handleCloseCart}
                    className="w-full rounded-full bg-slate-950 px-5 py-4 font-black text-white shadow-lg shadow-slate-200 transition hover:bg-slate-800"
                  >
                    Cerrar
                  </button>
                  <button
                    type="button"
                    onClick={handleCloseCart}
                    className="w-full rounded-full bg-white px-5 py-3 font-black text-slate-700 shadow-sm ring-1 ring-slate-100 transition hover:bg-rose-50"
                  >
                    Volver a la tienda
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      window.open(
                        confirmation.whatsappUrl,
                        "_blank",
                        "noopener,noreferrer"
                      )
                    }
                    className="w-full rounded-full bg-emerald-50 px-5 py-3 font-black text-emerald-700 ring-1 ring-emerald-100 transition hover:bg-emerald-100"
                  >
                    Abrir WhatsApp otra vez
                  </button>
                </div>
              ) : (
                <>
                  <div className="mb-4 flex items-center justify-between">
                    <span className="text-slate-500">Total</span>
                    <strong className="text-3xl text-slate-950">
                      {formatPrice(total)}
                    </strong>
                  </div>

                  <div className="grid gap-3">
                    {step > 1 && (
                      <button
                        type="button"
                        onClick={() =>
                          setStep((current) =>
                            Math.max(current - 1, 1) as CheckoutStep
                          )
                        }
                        className="flex items-center justify-center gap-2 rounded-full bg-white px-5 py-3 font-black text-slate-700 shadow-sm ring-1 ring-slate-100 transition hover:bg-rose-50"
                      >
                        <ChevronLeft size={18} />
                        Regresar
                      </button>
                    )}

                    {step < 3 ? (
                      <button
                        type="button"
                        onClick={handleNextStep}
                        disabled={items.length === 0 || !canContinue}
                        className="rounded-full bg-rose-500 px-5 py-4 font-black text-white shadow-lg shadow-rose-100 transition hover:scale-[1.02] hover:bg-rose-600 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:shadow-none"
                      >
                        Continuar
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => void handleConfirmOrder()}
                        disabled={isSubmitting || items.length === 0 || !canContinue}
                        className="flex items-center justify-center gap-2 rounded-full bg-emerald-500 px-5 py-4 font-black text-white shadow-lg shadow-emerald-100 transition hover:scale-[1.02] hover:bg-emerald-600 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:shadow-none"
                      >
                        <Send size={18} />
                        {isSubmitting
                          ? "Enviando pedido..."
                          : "Enviar pedido por WhatsApp"}
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={closeCart}
                      className="rounded-full bg-white px-5 py-3 font-black text-slate-700 shadow-sm ring-1 ring-slate-100 transition hover:bg-rose-50"
                    >
                      Seguir comprando
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        clearCart();
                        resetCartState();
                      }}
                      className="rounded-full bg-slate-100 px-5 py-3 font-black text-slate-700 transition hover:bg-slate-200 disabled:cursor-not-allowed disabled:text-slate-400"
                      disabled={items.length === 0}
                    >
                      Vaciar carrito
                    </button>
                  </div>
                </>
              )}
            </div>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}
