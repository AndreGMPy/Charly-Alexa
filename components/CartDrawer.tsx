"use client";

import { buildWhatsAppUrlWithNumber, useSiteSettings } from "@/hooks/useSiteSettings";
import {
  emptyDeliveryAddress,
  formatDeliveryAddressText,
  getDeliveryAddressLines,
  getDeliveryAddressValidationMessage,
} from "@/lib/delivery-address";
import { createWebOrder } from "@/lib/firebase-services/orders";
import type {
  CheckoutDeliveryMethod,
  DeliveryAddress,
  FirebaseOrderItem,
  OrderShipping,
} from "@/lib/firebase-types";
import { formatPrice, getProductStockForColorAndSize } from "@/lib/products";
import {
  getSafeOrderMessage,
  getSafePaymentMessage,
  logErrorInDevelopment,
} from "@/lib/safe-errors";
import {
  calculateOrderShipping,
  isDeliveryAddressRequired,
  NATIONAL_DELIVERY_METHOD,
} from "@/lib/shipping";
import {
  calculateWholesaleCart,
  getWholesaleLabel,
  isWholesaleProduct,
  validateWholesaleCart,
} from "@/lib/wholesale";
import { useCartStore, type CartItem } from "@/store/cart-store";
import {
  AlertCircle,
  CheckCircle2,
  ChevronLeft,
  CreditCard,
  Minus,
  Plus,
  Send,
  ShoppingBag,
  Trash2,
  UserRound,
  X,
} from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useMemo, useRef, useState } from "react";
import { toast } from "sonner";

type CheckoutStep = 1 | 2 | 3;
type PaymentPreference = "pay_now" | "whatsapp";

type CustomerForm = {
  customerName: string;
  customerPhone: string;
  deliveryMethod: CheckoutDeliveryMethod;
  deliveryAddress: DeliveryAddress;
  paymentPreference: PaymentPreference;
  notes: string;
};

type Confirmation = {
  orderId: string;
  orderNumber: string;
  whatsappUrl: string;
  paymentPreference: PaymentPreference;
};

function createInitialCustomerForm(): CustomerForm {
  return {
    customerName: "",
    customerPhone: "",
    deliveryMethod: NATIONAL_DELIVERY_METHOD,
    deliveryAddress: { ...emptyDeliveryAddress },
    paymentPreference: "pay_now",
    notes: "",
  };
}

const checkoutSteps: { step: CheckoutStep; label: string }[] = [
  { step: 1, label: "Productos" },
  { step: 2, label: "Datos" },
  { step: 3, label: "Confirmar" },
];

const shippingQuoteConfirmationText =
  "Confirmo que entiendo que el pago en línea cubre únicamente los productos. El costo de envío se cotizará por WhatsApp y se pagará por separado según el acuerdo con la tienda.";

const shippingQuoteRequiredText =
  "Debes confirmar que entiendes cómo se cotiza el envío antes de continuar.";

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
  } = useCartStore();

  const [step, setStep] = useState<CheckoutStep>(1);
  const [customerForm, setCustomerForm] =
    useState<CustomerForm>(() => createInitialCustomerForm());
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isStartingPayment, setIsStartingPayment] = useState(false);
  const [confirmation, setConfirmation] = useState<Confirmation | null>(null);
  const [shippingQuoteAcknowledged, setShippingQuoteAcknowledged] =
    useState(false);
  const submitLockRef = useRef(false);

  const wholesaleLines = useMemo(
    () => calculateWholesaleCart(items, settings.wholesaleSettings),
    [items, settings.wholesaleSettings]
  );
  const wholesaleLineById = useMemo(
    () =>
      new Map(
        wholesaleLines.map((line) => [
          line.item.cartItemId || line.item.id,
          line,
        ])
      ),
    [wholesaleLines]
  );
  const subtotal = wholesaleLines.reduce((sum, line) => sum + line.subtotal, 0);
  const totalPieces = totalItems();
  const wholesaleValidation = validateWholesaleCart(
    items,
    settings.wholesaleSettings
  );
  const hasWholesaleItems = items.some((item) => isWholesaleProduct(item.product));
  const shipping = calculateOrderShipping({
    method: customerForm.deliveryMethod,
    totalItems: totalPieces,
    hasWholesale: hasWholesaleItems,
  });
  const payableShipping = shipping.requiresQuote
    ? { ...shipping, cost: 0 }
    : shipping;
  const shippingCost = payableShipping.cost;
  const total = subtotal + shippingCost;
  const needsDeliveryAddress = isDeliveryAddressRequired(
    customerForm.deliveryMethod
  );
  const shippingDisplay = shipping.requiresQuote
    ? "Se cotiza por WhatsApp"
    : formatPrice(shippingCost);
  const paymentStatusText =
    customerForm.paymentPreference === "pay_now"
      ? shipping.requiresQuote
        ? "Pendiente: productos"
        : "Pendiente"
      : shipping.requiresQuote
        ? "Pago de productos por acordar"
        : "Manual / acordar por WhatsApp";
  const paymentPreferenceText =
    customerForm.paymentPreference === "pay_now"
      ? "Pagar ahora"
      : "Acordar por WhatsApp";
  const quotedShippingPaymentLabel =
    customerForm.paymentPreference === "pay_now"
      ? "Pago ahora"
      : "Pago de productos";
  const stockMessages = useMemo(
    () =>
      items
        .map((item) => {
          const availablePieces = getProductStockForColorAndSize(
            item.product,
            item.selectedColor,
            item.selectedSize
          );

          if (availablePieces <= 0) return "Esta talla ya no está disponible.";
          if (item.quantity <= availablePieces) return "";

          return `No hay suficientes piezas de ${item.product.name} color ${item.selectedColor ?? "Sin color"} talla ${item.selectedSize}.`;
        })
        .filter(Boolean),
    [items]
  );
  const canContinue = wholesaleValidation.canCheckout && stockMessages.length === 0;
  const canConfirmOrder =
    canContinue && (!shipping.requiresQuote || shippingQuoteAcknowledged);
  function updateCustomerForm<Key extends keyof CustomerForm>(
    key: Key,
    value: CustomerForm[Key]
  ) {
    setCustomerForm((current) => ({
      ...current,
      [key]: value,
    }));
  }

  function updateDeliveryAddress<Key extends keyof DeliveryAddress>(
    key: Key,
    value: DeliveryAddress[Key]
  ) {
    setCustomerForm((current) => ({
      ...current,
      deliveryAddress: {
        ...current.deliveryAddress,
        [key]: value,
      },
    }));
  }

  function getCleanDeliveryAddress() {
    const address = customerForm.deliveryAddress;

    return {
      street: address.street.trim(),
      exteriorNumber: address.exteriorNumber.trim(),
      interiorNumber: address.interiorNumber?.trim() ?? "",
      neighborhood: address.neighborhood.trim(),
      city: address.city.trim(),
      state: address.state.trim(),
      zipCode: address.zipCode.trim(),
      references: address.references?.trim() ?? "",
    };
  }

  function getFormattedDeliveryAddress() {
    return formatDeliveryAddressText(getCleanDeliveryAddress(), {
      numberLabel: "Número",
      interiorLabel: "Interior",
      cityLabel: "Municipio/Ciudad",
      zipLabel: "CP",
    });
  }

  function resetCartState() {
    setStep(1);
    setCustomerForm(createInitialCustomerForm());
    setConfirmation(null);
    setShippingQuoteAcknowledged(false);
  }

  function handleCloseCart() {
    resetCartState();
    closeCart();
  }

  function buildOrderItems(): FirebaseOrderItem[] {
    return items.flatMap((item) => {
      const pricedLine = wholesaleLineById.get(item.cartItemId || item.id);
      const mainImage = getCartImage(item);
      const baseItem = {
        productId: item.productId,
        productName: item.product.name,
        name: item.product.name,
        slug: item.slug,
        category: item.product.category,
        subcategory: item.product.subcategory,
        size: item.selectedSize,
        color: item.selectedColor ?? "Sin color",
        mainImage,
        image: mainImage,
        regularPrice: item.product.price,
        wholesaleType: item.product.wholesaleMode ?? "none",
        wholesaleMinimum: item.product.wholesaleMinQuantity ?? 0,
        wholesaleRunPrice: item.product.wholesaleRunPrice ?? null,
      };

      if (!pricedLine) {
        return [
          {
            ...baseItem,
            quantity: item.quantity,
            price: item.product.price,
            subtotal: item.product.price * item.quantity,
            priceLabel: "regular" as const,
          },
        ];
      }

      const orderItems: FirebaseOrderItem[] = [];

      if (pricedLine.wholesaleQuantity > 0) {
        orderItems.push({
          ...baseItem,
          quantity: pricedLine.wholesaleQuantity,
          price:
            item.product.wholesaleRunEnabled && item.product.wholesaleRunPrice
              ? item.product.wholesaleRunPrice
              : pricedLine.unitPrice,
          subtotal: pricedLine.wholesaleSubtotal,
          wholesaleRunApplied: Boolean(item.product.wholesaleRunEnabled),
          priceLabel: item.product.wholesaleRunEnabled
            ? "wholesale_run"
            : "wholesale",
        });
      }

      if (pricedLine.regularQuantity > 0) {
        orderItems.push({
          ...baseItem,
          quantity: pricedLine.regularQuantity,
          price: item.product.price,
          subtotal: pricedLine.regularSubtotal,
          priceLabel: "regular",
        });
      }

      return orderItems;
    });
  }

  function buildOrderMessage(
    orderNumber: string,
    orderItems: FirebaseOrderItem[],
    orderSubtotal: number,
    orderShipping: OrderShipping,
    orderTotal: number
  ) {
    const productsText = orderItems
      .map(
        (item) => `- ${item.productName ?? item.name}
  Color: ${item.color ?? "Sin color"}
  Talla: ${item.size}
  Cantidad: ${item.quantity}
  Subtotal: ${formatPrice(item.subtotal)}`
      )
      .join("\n\n");

    const deliveryAddressText = needsDeliveryAddress
      ? getFormattedDeliveryAddress()
      : "";
    const deliveryText = deliveryAddressText
      ? `Método de entrega: ${customerForm.deliveryMethod}\n\nDirección:\n${deliveryAddressText}`
      : `Entrega: ${customerForm.deliveryMethod}`;
    const quoteText = orderShipping.requiresQuote
      ? "\n\nEl envío queda pendiente de cotización y pago por separado."
      : "";
    const totalsText = orderShipping.requiresQuote
      ? `Total de productos: ${formatPrice(orderSubtotal)}
Envío: Se cotiza por WhatsApp
${quotedShippingPaymentLabel}: ${formatPrice(orderSubtotal)}`
      : `Subtotal: ${formatPrice(orderSubtotal)}
Envío nacional: ${formatPrice(orderShipping.cost)}
Total: ${formatPrice(orderTotal)}`;

    return `Hola, quiero confirmar este pedido:

Pedido: #${orderNumber}
Nombre: ${customerForm.customerName}
${deliveryText}

Productos:
${productsText}

${totalsText}
Forma de pago: ${paymentPreferenceText}
${quoteText}

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
      toast.error("Agrega tu nombre.");
      return false;
    }

    const phoneDigits = customerForm.customerPhone.replace(/\D/g, "");

    if (phoneDigits.length < 10 || phoneDigits.length > 15) {
      toast.error("Agrega un teléfono válido.");
      return false;
    }

    if (needsDeliveryAddress) {
      const validationMessage = getDeliveryAddressValidationMessage(
        getCleanDeliveryAddress()
      );

      if (validationMessage) {
        toast.error(validationMessage);
        return false;
      }
    }

    return true;
  }

  function handleNextStep() {
    if (step === 1 && !validateCart()) return;
    if (step === 2 && !validateCustomerData()) return;

    setStep((current) => Math.min(current + 1, 3) as CheckoutStep);
  }

  function handleIncreaseItem(item: CartItem) {
    const availablePieces = getProductStockForColorAndSize(
      item.product,
      item.selectedColor,
      item.selectedSize
    );

    if (item.quantity >= availablePieces) {
      toast.error("No hay más piezas disponibles de esta talla.");
      return;
    }

    increaseItem(item.id);
  }

  async function startPaymentForOrder(orderId: string) {
    let didRedirect = false;

    try {
      setIsStartingPayment(true);
      const response = await fetch(
        "/api/payments/mercadopago/create-preference",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ orderId }),
        }
      );
      const responseBody = (await response.json().catch(() => null)) as
        | { message?: string; initPoint?: string }
        | null;

      if (!response.ok || !responseBody?.initPoint) {
        throw new Error(
          responseBody?.message ?? "No se pudo iniciar el pago. Intenta de nuevo."
        );
      }

      clearCart();
      didRedirect = true;
      window.location.assign(responseBody.initPoint);
      return true;
    } catch (error) {
      logErrorInDevelopment("Mercado Pago preference error", error);
      toast.error(getSafePaymentMessage(error));
      return false;
    } finally {
      if (!didRedirect) {
        setIsStartingPayment(false);
      }
    }
  }

  async function handleConfirmOrder() {
    if (submitLockRef.current || isSubmitting || isStartingPayment) return;

    submitLockRef.current = true;

    if (!validateCart() || !validateCustomerData()) {
      submitLockRef.current = false;
      return;
    }

    if (shipping.requiresQuote && !shippingQuoteAcknowledged) {
      toast.error(shippingQuoteRequiredText);
      submitLockRef.current = false;
      return;
    }

    const orderItems = buildOrderItems();
    const orderSubtotal = subtotal;
    const orderShipping = payableShipping;
    const orderTotal = total;
    const payment =
      customerForm.paymentPreference === "pay_now"
        ? { status: "pending" as const, provider: "mercadopago" as const }
        : { status: "manual" as const, provider: "manual" as const };
    const shouldPayNow = customerForm.paymentPreference === "pay_now";
    let didStartPayment = false;

    try {
      setIsSubmitting(true);
      if (shouldPayNow) {
        setIsStartingPayment(true);
      }

      const cleanDeliveryAddress = getCleanDeliveryAddress();
      const formattedDeliveryAddress =
        needsDeliveryAddress
          ? formatDeliveryAddressText(cleanDeliveryAddress)
          : "";
      const result = await createWebOrder({
        customerName: customerForm.customerName.trim(),
        customerPhone: customerForm.customerPhone.trim(),
        deliveryMethod: customerForm.deliveryMethod,
        deliveryAddress: needsDeliveryAddress ? cleanDeliveryAddress : undefined,
        shipping: orderShipping,
        address: formattedDeliveryAddress,
        notes: customerForm.notes.trim(),
        items: orderItems,
        subtotal: orderSubtotal,
        shippingCost: orderShipping.cost,
        total: orderTotal,
        payment,
        totalItems: totalPieces,
        wholesaleValidation,
      });

      if (!shouldPayNow) {
        toast.success("Pedido confirmado", {
          description: `Folio #${result.orderNumber}. Se abrirá WhatsApp para confirmarlo.`,
        });
      }

      const whatsappUrl = buildWhatsAppUrlWithNumber(
        settings.whatsappInternational,
        buildOrderMessage(
          result.orderNumber,
          orderItems,
          orderSubtotal,
          orderShipping,
          orderTotal
        )
      );

      const nextConfirmation = {
        orderId: result.id,
        orderNumber: result.orderNumber,
        whatsappUrl,
        paymentPreference: customerForm.paymentPreference,
      };

      setConfirmation(nextConfirmation);
      setStep(1);

      if (shouldPayNow) {
        didStartPayment = await startPaymentForOrder(result.id);
        return;
      }

      clearCart();
      if (customerForm.paymentPreference === "whatsapp") {
        window.open(whatsappUrl, "_blank", "noopener,noreferrer");
      }
    } catch (error) {
      logErrorInDevelopment("Checkout order error", error);
      toast.error(getSafeOrderMessage(error));
    } finally {
      if (!didStartPayment) {
        setIsStartingPayment(false);
      }
      setIsSubmitting(false);
      submitLockRef.current = false;
    }
  }

  async function handleStartPayment() {
    if (!confirmation || isStartingPayment) return;

    await startPaymentForOrder(confirmation.orderId);
  }

  const validationMessages = [
    ...wholesaleValidation.messages,
    ...stockMessages,
  ];
  const confirmationAddressLines =
    needsDeliveryAddress
      ? getDeliveryAddressLines(getCleanDeliveryAddress())
      : [];

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

            <div className="flex-1 overflow-y-auto p-4 sm:p-5">
              {confirmation ? (
                <div className="flex min-h-full flex-col items-center justify-center text-center">
                  <div className="mb-5 flex h-24 w-24 items-center justify-center rounded-[2rem] bg-emerald-50 text-emerald-600 ring-1 ring-emerald-100">
                    <CheckCircle2 size={44} />
                  </div>
                  <h3 className="text-2xl font-black text-slate-950">
                    Pedido confirmado
                  </h3>
                  <p className="mt-2 text-sm font-bold text-slate-500">
                    Folio #{confirmation.orderNumber}
                  </p>
                  <p className="mt-2 max-w-xs text-sm leading-6 text-slate-500">
                    {confirmation.paymentPreference === "pay_now"
                      ? "Tu pedido se guardó correctamente. Continúa al pago cuando estés listo."
                      : "Tu pedido se guardó correctamente. Te llevaremos a WhatsApp para confirmar con la tienda."}
                  </p>
                  {confirmation.paymentPreference === "pay_now" ? (
                    <button
                      type="button"
                      onClick={() => void handleStartPayment()}
                      disabled={isStartingPayment}
                      className="mt-6 inline-flex items-center justify-center gap-2 rounded-full bg-emerald-500 px-5 py-3 text-sm font-black text-white shadow-sm transition hover:bg-emerald-600 disabled:cursor-not-allowed disabled:bg-slate-300"
                    >
                      <CreditCard size={17} />
                      {isStartingPayment
                        ? "Preparando pago..."
                        : "Continuar al pago"}
                    </button>
                  ) : (
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
                  )}
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
                      {items.map((item) => {
                        const pricedLine =
                          wholesaleLineById.get(item.cartItemId || item.id);
                        const unitPrice =
                          pricedLine?.unitPrice ?? item.product.price;
                        const itemSubtotal =
                          pricedLine?.subtotal ?? unitPrice * item.quantity;
                        const hasSplitRunPrice =
                          Boolean(item.product.wholesaleRunEnabled) &&
                          Boolean(pricedLine?.wholesaleQuantity) &&
                          Boolean(pricedLine?.regularQuantity);

                        return (
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
                                {hasSplitRunPrice
                                  ? `${pricedLine?.wholesaleQuantity} pza(s) corrida + ${pricedLine?.regularQuantity} normal`
                                  : `${formatPrice(unitPrice)} c/u`}
                                {pricedLine?.usesWholesalePrice && (
                                  <span className="ml-2 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-black uppercase text-emerald-700 ring-1 ring-emerald-100">
                                    Mayoreo corrido aplicado
                                  </span>
                                )}
                              </p>
                              <p className="mt-1 text-xs font-bold text-slate-400">
                                Color: {item.selectedColor ?? "Sin color"} · Talla: {item.selectedSize}
                              </p>

                              {isWholesaleProduct(item.product) && (
                                <p className="mt-1 text-xs font-black text-amber-700">
                                  {pricedLine?.message ||
                                    getWholesaleLabel(
                                      item.product,
                                      settings.wholesaleSettings
                                    )}
                                </p>
                              )}

                              <p className="mt-1 text-sm font-black text-slate-950">
                                Subtotal:{" "}
                                {formatPrice(itemSubtotal)}
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
                        );
                      })}
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
                            Completa los datos para enviar tu pedido.
                          </p>
                        </div>
                      </div>

                      <p className="rounded-2xl bg-[#fffaf5] px-4 py-3 text-sm font-bold leading-6 text-slate-600 ring-1 ring-slate-100">
                        Tu pedido se enviará a la dirección indicada.
                      </p>

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

                      {needsDeliveryAddress && (
                        <div className="rounded-2xl bg-[#fffaf5] p-3 ring-1 ring-slate-100">
                          <div className="mb-3">
                            <p className="text-sm font-black text-slate-950">
                              Dirección de entrega
                            </p>
                            <p className="mt-1 text-xs font-bold text-slate-500">
                              Completa los datos para enviar tu pedido.
                            </p>
                          </div>

                          <div className="grid gap-3">
                            <label className="block">
                              <span className="text-xs font-black uppercase text-slate-400">
                                Calle
                              </span>
                              <input
                                value={customerForm.deliveryAddress.street}
                                onChange={(event) =>
                                  updateDeliveryAddress("street", event.target.value)
                                }
                                autoComplete="address-line1"
                                className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold outline-none transition focus:border-rose-300"
                                placeholder="Hidalgo"
                              />
                            </label>

                            <div className="grid gap-3 sm:grid-cols-2">
                              <label className="block">
                                <span className="text-xs font-black uppercase text-slate-400">
                                  Número exterior
                                </span>
                                <input
                                  value={customerForm.deliveryAddress.exteriorNumber}
                                  onChange={(event) =>
                                    updateDeliveryAddress(
                                      "exteriorNumber",
                                      event.target.value
                                    )
                                  }
                                  autoComplete="address-line2"
                                  className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold outline-none transition focus:border-rose-300"
                                  placeholder="123"
                                />
                              </label>

                              <label className="block">
                                <span className="text-xs font-black uppercase text-slate-400">
                                  Interior opcional
                                </span>
                                <input
                                  value={customerForm.deliveryAddress.interiorNumber}
                                  onChange={(event) =>
                                    updateDeliveryAddress(
                                      "interiorNumber",
                                      event.target.value
                                    )
                                  }
                                  className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold outline-none transition focus:border-rose-300"
                                  placeholder="2B"
                                />
                              </label>
                            </div>

                            <label className="block">
                              <span className="text-xs font-black uppercase text-slate-400">
                                Colonia
                              </span>
                              <input
                                value={customerForm.deliveryAddress.neighborhood}
                                onChange={(event) =>
                                  updateDeliveryAddress(
                                    "neighborhood",
                                    event.target.value
                                  )
                                }
                                className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold outline-none transition focus:border-rose-300"
                                placeholder="Centro"
                              />
                            </label>

                            <div className="grid gap-3 sm:grid-cols-2">
                              <label className="block">
                                <span className="text-xs font-black uppercase text-slate-400">
                                  Municipio / Ciudad
                                </span>
                                <input
                                  value={customerForm.deliveryAddress.city}
                                  onChange={(event) =>
                                    updateDeliveryAddress("city", event.target.value)
                                  }
                                  autoComplete="address-level2"
                                  className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold outline-none transition focus:border-rose-300"
                                  placeholder="Uriangato"
                                />
                              </label>

                              <label className="block">
                                <span className="text-xs font-black uppercase text-slate-400">
                                  Estado
                                </span>
                                <input
                                  value={customerForm.deliveryAddress.state}
                                  onChange={(event) =>
                                    updateDeliveryAddress("state", event.target.value)
                                  }
                                  autoComplete="address-level1"
                                  className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold outline-none transition focus:border-rose-300"
                                  placeholder="Ej. Guanajuato, Jalisco, Ciudad de México"
                                />
                              </label>
                            </div>

                            <label className="block sm:max-w-[11rem]">
                              <span className="text-xs font-black uppercase text-slate-400">
                                Código postal
                              </span>
                              <input
                                value={customerForm.deliveryAddress.zipCode}
                                onChange={(event) =>
                                  updateDeliveryAddress(
                                    "zipCode",
                                    event.target.value.replace(/\D/g, "").slice(0, 5)
                                  )
                                }
                                inputMode="numeric"
                                maxLength={5}
                                autoComplete="postal-code"
                                className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold outline-none transition focus:border-rose-300"
                                placeholder="38980"
                              />
                            </label>

                            <label className="block">
                              <span className="text-xs font-black uppercase text-slate-400">
                                Referencias de entrega
                              </span>
                              <textarea
                                value={customerForm.deliveryAddress.references}
                                onChange={(event) =>
                                  updateDeliveryAddress(
                                    "references",
                                    event.target.value
                                  )
                                }
                                rows={2}
                                className="mt-2 min-h-16 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold outline-none transition focus:border-rose-300"
                                placeholder="Casa azul frente a la tienda"
                              />
                            </label>
                          </div>
                        </div>
                      )}

                      {shipping.requiresQuote && (
                        <p className="rounded-2xl bg-amber-50 px-4 py-3 text-sm font-bold leading-6 text-amber-800 ring-1 ring-amber-100">
                          El envío se cotiza por WhatsApp y se paga por separado según el acuerdo con la tienda.
                        </p>
                      )}

                      <div className="rounded-2xl bg-[#fffaf5] p-3 ring-1 ring-slate-100">
                        <div className="flex items-center gap-3">
                          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white text-rose-500 ring-1 ring-rose-100">
                            <CreditCard size={18} />
                          </div>
                          <div>
                            <p className="text-sm font-black text-slate-950">
                              Forma de pago
                            </p>
                            <p className="mt-1 text-xs font-bold leading-5 text-slate-500">
                              Puedes pagar ahora de forma segura o acordar detalles por WhatsApp.
                            </p>
                          </div>
                        </div>

                        <div className="mt-3 grid gap-2 sm:grid-cols-2">
                          {([
                            { value: "pay_now", label: "Pagar ahora" },
                            {
                              value: "whatsapp",
                              label: "Acordar por WhatsApp",
                            },
                          ] as const).map((option) => (
                            <button
                              key={option.value}
                              type="button"
                              onClick={() =>
                                updateCustomerForm(
                                  "paymentPreference",
                                  option.value
                                )
                              }
                              className={`rounded-2xl px-4 py-3 text-left text-sm font-black transition ${
                                customerForm.paymentPreference === option.value
                                  ? "bg-slate-950 text-white"
                                  : "bg-white text-slate-700 ring-1 ring-slate-100 hover:bg-rose-50"
                              }`}
                            >
                              {option.label}
                            </button>
                          ))}
                        </div>

                        {customerForm.paymentPreference === "pay_now" && (
                          <p className="mt-3 rounded-2xl bg-white px-4 py-3 text-xs font-bold leading-5 text-slate-500 ring-1 ring-slate-100">
                            {shipping.requiresQuote
                              ? "El pago en línea cubre únicamente los productos. El envío se cotiza por WhatsApp y se paga por separado."
                              : "La disponibilidad y el envío se validan con la tienda. Recibirás confirmación por WhatsApp."}
                          </p>
                        )}
                      </div>

                      <details className="group rounded-2xl bg-[#fffaf5] p-3 ring-1 ring-slate-100">
                        <summary className="cursor-pointer list-none text-sm font-black text-slate-700">
                          + Agregar nota para la tienda
                        </summary>
                        <textarea
                          value={customerForm.notes}
                          onChange={(event) =>
                            updateCustomerForm("notes", event.target.value)
                          }
                          rows={2}
                          className="mt-3 min-h-16 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold outline-none transition focus:border-rose-300"
                          placeholder="Ej. Tocar el timbre o entregar por la tarde."
                        />
                      </details>
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
                        {confirmationAddressLines.length > 0 && (
                          <dl className="mt-2 grid gap-1 text-xs font-bold leading-5 text-slate-500">
                            {confirmationAddressLines.map((line) => (
                              <div key={line.label} className="grid gap-0.5">
                                <dt className="font-black text-slate-600">
                                  {line.label}
                                </dt>
                                <dd>{line.value}</dd>
                              </div>
                            ))}
                          </dl>
                        )}
                      </div>

                      <div className="space-y-2">
                        {items.map((item) => {
                          const pricedLine =
                            wholesaleLineById.get(item.cartItemId || item.id);
                          const itemSubtotal =
                            pricedLine?.subtotal ?? item.product.price * item.quantity;

                          return (
                            <div
                              key={`summary-${item.id}`}
                              className="flex items-start justify-between gap-3 rounded-2xl bg-[#fffaf5] p-3"
                            >
                              <div>
                                <p className="text-sm font-black text-slate-950">
                                  {item.product.name}
                                </p>
                                <p className="mt-1 text-xs font-bold text-slate-500">
                                  Color {item.selectedColor ?? "Sin color"} · Talla {item.selectedSize} · {item.quantity} pieza(s)
                                </p>
                              </div>
                              <p className="text-sm font-black text-slate-950">
                                {formatPrice(itemSubtotal)}
                              </p>
                            </div>
                          );
                        })}
                      </div>

                      <div className="rounded-2xl bg-[#fffaf5] p-4">
                        {shipping.requiresQuote ? (
                          <div className="space-y-2 text-sm font-bold text-slate-600">
                            <div className="flex items-center justify-between gap-3">
                              <span>Total de productos</span>
                              <span className="font-black text-slate-950">
                                {formatPrice(subtotal)}
                              </span>
                            </div>
                            <div className="flex items-center justify-between gap-3">
                              <span>Envío</span>
                              <span className="text-right font-black text-amber-700">
                                Se cotiza por WhatsApp
                              </span>
                            </div>
                            <div className="flex items-center justify-between gap-3 border-t border-rose-100 pt-2">
                              <span>{quotedShippingPaymentLabel}</span>
                              <span className="text-lg font-black text-slate-950">
                                {formatPrice(subtotal)}
                              </span>
                            </div>
                            <p className="rounded-2xl bg-white px-4 py-3 text-xs font-bold leading-5 text-amber-800 ring-1 ring-amber-100">
                              El envío queda pendiente de cotización y pago por separado.
                            </p>
                          </div>
                        ) : (
                          <div className="space-y-2 text-sm font-bold text-slate-600">
                            <div className="flex items-center justify-between gap-3">
                              <span>Subtotal</span>
                              <span className="font-black text-slate-950">
                                {formatPrice(subtotal)}
                              </span>
                            </div>
                            <div className="flex items-center justify-between gap-3">
                              <span>Envío nacional</span>
                              <span className="font-black text-slate-950">
                                {shippingDisplay}
                              </span>
                            </div>
                            <div className="flex items-center justify-between gap-3 border-t border-rose-100 pt-2">
                              <span>Total</span>
                              <span className="text-lg font-black text-slate-950">
                                {formatPrice(total)}
                              </span>
                            </div>
                          </div>
                        )}
                      </div>

                      <div className="rounded-2xl bg-[#fffaf5] p-4">
                        <p className="text-xs font-black uppercase text-slate-400">
                          Forma de pago
                        </p>
                        <p className="mt-1 text-sm font-black text-slate-950">
                          {paymentPreferenceText}
                        </p>
                        <p className="mt-1 text-xs font-bold text-slate-500">
                          Estado de pago: {paymentStatusText}
                        </p>
                      </div>

                      <div className="rounded-2xl bg-white p-4 text-sm font-bold leading-6 text-slate-600 ring-1 ring-slate-100">
                        <p>
                          La disponibilidad y el envío se validan con la tienda. Recibirás confirmación por WhatsApp.
                        </p>
                        <p className="mt-2">
                          Tu pedido se enviará a la dirección indicada.
                        </p>
                        {shipping.requiresQuote && (
                          <p className="mt-2">
                            El envío queda pendiente de cotización y pago por separado.
                          </p>
                        )}
                      </div>

                      {shipping.requiresQuote && (
                        <div className="rounded-2xl bg-amber-50 p-4 ring-1 ring-amber-100">
                          <label className="flex cursor-pointer items-start gap-3 text-sm font-bold leading-6 text-amber-900">
                            <input
                              type="checkbox"
                              checked={shippingQuoteAcknowledged}
                              onChange={(event) =>
                                setShippingQuoteAcknowledged(event.target.checked)
                              }
                              className="mt-1 h-5 w-5 shrink-0 accent-slate-950"
                            />
                            <span>{shippingQuoteConfirmationText}</span>
                          </label>
                          {!shippingQuoteAcknowledged && (
                            <p className="mt-2 text-xs font-black text-amber-800">
                              {shippingQuoteRequiredText}
                            </p>
                          )}
                        </div>
                      )}

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

            <div className="shrink-0 border-t border-rose-100 bg-white/90 px-3 pb-[calc(0.625rem+env(safe-area-inset-bottom))] pt-2 shadow-[0_-10px_30px_rgba(15,23,42,0.06)] backdrop-blur-xl sm:p-4">
              {confirmation ? (
                <div className="grid gap-2">
                  <button
                    type="button"
                    onClick={handleCloseCart}
                    className="w-full rounded-full bg-slate-950 px-4 py-3 text-sm font-black text-white shadow-sm shadow-slate-200 transition hover:bg-slate-800"
                  >
                    Cerrar
                  </button>
                  <button
                    type="button"
                    onClick={handleCloseCart}
                    className="w-full rounded-full bg-white px-4 py-2.5 text-sm font-black text-slate-700 shadow-sm ring-1 ring-slate-100 transition hover:bg-rose-50"
                  >
                    Volver a la tienda
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (confirmation.paymentPreference === "pay_now") {
                        void handleStartPayment();
                        return;
                      }

                      window.open(
                        confirmation.whatsappUrl,
                        "_blank",
                        "noopener,noreferrer"
                      );
                    }}
                    disabled={isStartingPayment}
                    className="w-full rounded-full bg-emerald-50 px-4 py-2.5 text-sm font-black text-emerald-700 ring-1 ring-emerald-100 transition hover:bg-emerald-100 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400"
                  >
                    {confirmation.paymentPreference === "pay_now"
                      ? isStartingPayment
                        ? "Preparando pago..."
                        : "Continuar al pago"
                      : "Abrir WhatsApp otra vez"}
                  </button>
                </div>
              ) : (
                <>
                  <div className="mb-2 sm:hidden">
                    {shipping.requiresQuote ? (
                      <>
                        <p className="truncate text-[11px] font-bold text-slate-500">
                          Total de productos {formatPrice(subtotal)} · Envío a cotizar
                        </p>
                        <div className="mt-0.5 flex items-center justify-between gap-3">
                          <span className="text-xs font-black text-slate-600">
                            {quotedShippingPaymentLabel}
                          </span>
                          <strong className="text-2xl font-black leading-none text-slate-950">
                            {formatPrice(subtotal)}
                          </strong>
                        </div>
                        <p className="mt-1 rounded-xl bg-amber-50 px-2.5 py-1 text-[10px] font-bold leading-4 text-amber-800 ring-1 ring-amber-100">
                          Envío: se cotiza por WhatsApp y se paga por separado.
                        </p>
                      </>
                    ) : (
                      <>
                        <p className="truncate text-[11px] font-bold text-slate-500">
                          Subtotal {formatPrice(subtotal)} · Envío{" "}
                          {formatPrice(shippingCost)}
                        </p>
                        <div className="mt-0.5 flex items-center justify-between gap-3">
                          <span className="text-xs font-black text-slate-600">
                            Total
                          </span>
                          <strong className="text-2xl font-black leading-none text-slate-950">
                            {formatPrice(total)}
                          </strong>
                        </div>
                      </>
                    )}
                  </div>

                  <div className="mb-3 hidden space-y-1.5 sm:block">
                    {shipping.requiresQuote ? (
                      <>
                        <div className="flex items-center justify-between text-xs font-bold text-slate-500 sm:text-sm">
                          <span>Total de productos</span>
                          <span className="text-slate-950">
                            {formatPrice(subtotal)}
                          </span>
                        </div>
                        <div className="flex items-center justify-between text-xs font-bold text-slate-500 sm:text-sm">
                          <span>Envío</span>
                          <span className="text-right text-amber-700">
                            Se cotiza por WhatsApp
                          </span>
                        </div>
                        <div className="flex items-center justify-between border-t border-rose-100 pt-1.5">
                          <span className="text-sm font-black text-slate-600">
                            {quotedShippingPaymentLabel}
                          </span>
                          <strong className="text-xl font-black text-slate-950 sm:text-2xl">
                            {formatPrice(subtotal)}
                          </strong>
                        </div>
                        <p className="rounded-2xl bg-amber-50 px-3 py-1.5 text-[11px] font-bold leading-5 text-amber-800 ring-1 ring-amber-100">
                          El envío se cotiza por WhatsApp y se paga por separado.
                        </p>
                      </>
                    ) : (
                      <>
                        <div className="flex items-center justify-between text-xs font-bold text-slate-500 sm:text-sm">
                          <span>Subtotal</span>
                          <span className="text-slate-950">
                            {formatPrice(subtotal)}
                          </span>
                        </div>
                        <div className="flex items-center justify-between text-xs font-bold text-slate-500 sm:text-sm">
                          <span>Envío nacional</span>
                          <span className="text-slate-950">{shippingDisplay}</span>
                        </div>
                        <div className="flex items-center justify-between border-t border-rose-100 pt-1.5">
                          <span className="text-sm font-black text-slate-600">
                            Total
                          </span>
                          <strong className="text-xl font-black text-slate-950 sm:text-2xl">
                            {formatPrice(total)}
                          </strong>
                        </div>
                      </>
                    )}
                  </div>

                  <div className="grid gap-2">
                    {step > 1 && (
                      <button
                        type="button"
                        onClick={() =>
                          setStep((current) =>
                            Math.max(current - 1, 1) as CheckoutStep
                          )
                        }
                        className="hidden items-center justify-center gap-2 rounded-full bg-white px-4 py-2.5 text-sm font-black text-slate-700 shadow-sm ring-1 ring-slate-100 transition hover:bg-rose-50 sm:flex"
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
                        className="rounded-full bg-rose-500 px-4 py-2.5 text-sm font-black text-white shadow-md shadow-rose-100 transition hover:scale-[1.01] hover:bg-rose-600 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:shadow-none sm:py-3"
                      >
                        Continuar
                      </button>
                    ) : (
                      <>
                        {shipping.requiresQuote && !shippingQuoteAcknowledged && (
                          <p className="rounded-xl bg-amber-50 px-3 py-2 text-[11px] font-black leading-4 text-amber-800 ring-1 ring-amber-100">
                            {shippingQuoteRequiredText}
                          </p>
                        )}

                        <button
                          type="button"
                          onClick={() => void handleConfirmOrder()}
                          disabled={
                            isSubmitting ||
                            isStartingPayment ||
                            items.length === 0 ||
                            !canConfirmOrder
                          }
                          className="flex items-center justify-center gap-2 rounded-full bg-emerald-500 px-4 py-2.5 text-sm font-black text-white shadow-md shadow-emerald-100 transition hover:scale-[1.01] hover:bg-emerald-600 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:shadow-none sm:py-3"
                        >
                          {customerForm.paymentPreference === "pay_now" ? (
                            <CreditCard size={17} />
                          ) : (
                            <Send size={17} />
                          )}
                          {isSubmitting
                            ? customerForm.paymentPreference === "pay_now"
                              ? "Preparando pago..."
                              : "Guardando pedido..."
                            : customerForm.paymentPreference === "pay_now"
                              ? "Continuar al pago"
                              : "Enviar pedido por WhatsApp"}
                        </button>
                      </>
                    )}

                    <div className="flex flex-wrap items-center justify-center gap-2 sm:grid sm:gap-2">
                      {step > 1 && (
                        <button
                          type="button"
                          onClick={() =>
                            setStep((current) =>
                              Math.max(current - 1, 1) as CheckoutStep
                            )
                          }
                          className="inline-flex items-center justify-center gap-1 rounded-full px-2.5 py-1.5 text-xs font-black text-slate-600 transition hover:bg-slate-100 sm:hidden"
                        >
                          <ChevronLeft size={14} />
                          Regresar
                        </button>
                      )}

                      <button
                        type="button"
                        onClick={closeCart}
                        className="rounded-full px-2.5 py-1.5 text-xs font-black text-slate-600 transition hover:bg-rose-50 sm:bg-white sm:px-4 sm:py-2.5 sm:text-sm sm:text-slate-700 sm:shadow-sm sm:ring-1 sm:ring-slate-100"
                      >
                        Seguir comprando
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          clearCart();
                          resetCartState();
                        }}
                        className="rounded-full px-2.5 py-1.5 text-xs font-black text-slate-500 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:text-slate-300 sm:bg-slate-100 sm:px-4 sm:py-2.5 sm:text-sm sm:text-slate-700 sm:hover:bg-slate-200"
                        disabled={items.length === 0}
                      >
                        Vaciar carrito
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>

            <AnimatePresence>
              {isStartingPayment && (
                <motion.div
                  className="absolute inset-0 z-20 flex items-center justify-center bg-white/70 px-6 backdrop-blur-sm"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                >
                  <div className="w-full max-w-xs rounded-[1.5rem] bg-white px-6 py-7 text-center shadow-xl ring-1 ring-emerald-100">
                    <div className="mx-auto h-11 w-11 animate-spin rounded-full border-4 border-emerald-100 border-t-emerald-500" />
                    <h3 className="mt-4 text-lg font-black text-slate-950">
                      Preparando tu pago...
                    </h3>
                    <p className="mt-2 text-sm font-bold leading-6 text-slate-500">
                      Te redirigiremos de forma segura a Mercado Pago.
                    </p>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}
