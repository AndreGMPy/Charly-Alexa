import {
  SafeCheckoutError,
  createStripeCheckoutFromPayload,
} from "@/lib/stripe-orders";
import { logErrorInDevelopment } from "@/lib/safe-errors";

export const runtime = "nodejs";

function json(message: string, status: number) {
  return Response.json({ message }, { status });
}

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => null);
    const checkout = await createStripeCheckoutFromPayload(body);

    if (!checkout.checkoutUrl) {
      return json("No pudimos iniciar el pago. Intenta nuevamente.", 502);
    }

    return Response.json(checkout);
  } catch (error) {
    logErrorInDevelopment("Stripe checkout error", error);

    if (error instanceof SafeCheckoutError) {
      return json(error.message, 400);
    }

    return json("No pudimos iniciar el pago. Intenta nuevamente.", 500);
  }
}
