import type {
  CheckoutDeliveryMethod,
  DeliveryMethod,
  OrderShipping,
} from "@/lib/firebase-types";

export const checkoutDeliveryMethods: CheckoutDeliveryMethod[] = [
  "Recoger en tienda",
  "Entrega local",
  "Envío nacional",
];

export const NATIONAL_DELIVERY_METHOD: CheckoutDeliveryMethod = "Envío nacional";
export const checkoutDeliveryOptions: {
  method: CheckoutDeliveryMethod;
  publicCheckoutEnabled: boolean;
}[] = [
  { method: "Recoger en tienda", publicCheckoutEnabled: false },
  { method: "Entrega local", publicCheckoutEnabled: false },
  { method: NATIONAL_DELIVERY_METHOD, publicCheckoutEnabled: true },
];

export const publicCheckoutDeliveryMethods = checkoutDeliveryOptions
  .filter((option) => option.publicCheckoutEnabled)
  .map((option) => option.method);

export function isCheckoutDeliveryMethod(
  value: unknown
): value is CheckoutDeliveryMethod {
  return checkoutDeliveryMethods.includes(value as CheckoutDeliveryMethod);
}

export function isDeliveryMethod(value: unknown): value is DeliveryMethod {
  return isCheckoutDeliveryMethod(value) || value === "Envío a domicilio";
}

export function isDeliveryAddressRequired(
  method: DeliveryMethod | null | undefined
) {
  return (
    method === "Entrega local" ||
    method === "Envío nacional" ||
    method === "Envío a domicilio"
  );
}

export function calculateOrderShipping({
  method,
}: {
  method: DeliveryMethod;
  totalItems: number;
  hasWholesale: boolean;
}): OrderShipping {
  if (method === "Recoger en tienda") {
    return {
      method,
      cost: 0,
      status: "pickup",
      requiresQuote: false,
    };
  }

  return {
    method,
    cost: 0,
    status: "quote_required",
    requiresQuote: true,
  };
}
