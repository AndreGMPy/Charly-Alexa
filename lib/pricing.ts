export const DEFAULT_PAYMENT_FEE_PERCENT = 5;
export const MIN_PAYMENT_FEE_PERCENT = 0;
export const MAX_PAYMENT_FEE_PERCENT = 20;

export function calculateFinalCustomerPrice(
  basePrice: number,
  paymentFeePercent: number
) {
  if (
    !Number.isFinite(basePrice) ||
    !Number.isFinite(paymentFeePercent) ||
    basePrice <= 0
  ) {
    return 0;
  }

  return Math.round(basePrice + (basePrice * paymentFeePercent) / 100);
}
