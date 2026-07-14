import { sendPaidOrderNotifications } from "@/lib/admin-notifications";
import { getAdminFirestore } from "@/lib/firebase-admin";
import { logErrorInDevelopment } from "@/lib/safe-errors";
import { getStripe } from "@/lib/stripe";
import {
  findOrderIdByPaymentIntent,
  markStripeOrderFailed,
  markStripeOrderPaid,
  markStripeSessionExpired,
} from "@/lib/stripe-orders";
import { FieldValue } from "firebase-admin/firestore";
import type Stripe from "stripe";

export const runtime = "nodejs";

async function recordStripeEvent(event: Stripe.Event) {
  const firestore = getAdminFirestore();
  const eventRef = firestore.collection("stripeWebhookEvents").doc(event.id);
  let shouldProcess = false;

  await firestore.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(eventRef);
    if (snapshot.exists) return;

    transaction.set(eventRef, {
      type: event.type,
      createdAt: FieldValue.serverTimestamp(),
      stripeCreatedAt: event.created ? new Date(event.created * 1000) : null,
    });
    shouldProcess = true;
  });

  return shouldProcess;
}

async function handleStripeEvent(event: Stripe.Event) {
  if (!(await recordStripeEvent(event))) {
    return;
  }

  if (
    event.type === "checkout.session.completed" ||
    event.type === "checkout.session.async_payment_succeeded"
  ) {
    const session = event.data.object as Stripe.Checkout.Session;

    if (
      event.type === "checkout.session.completed" &&
      session.payment_status !== "paid"
    ) {
      return;
    }

    const result = await markStripeOrderPaid(session);
    if (result.shouldNotify && result.orderId) {
      await sendPaidOrderNotifications(result.orderId);
    }
    return;
  }

  if (event.type === "checkout.session.async_payment_failed") {
    const session = event.data.object as Stripe.Checkout.Session;
    await markStripeOrderFailed(
      String(session.metadata?.orderId ?? ""),
      typeof session.payment_intent === "string" ? session.payment_intent : undefined
    );
    return;
  }

  if (event.type === "checkout.session.expired") {
    await markStripeSessionExpired(event.data.object as Stripe.Checkout.Session);
    return;
  }

  if (event.type === "payment_intent.payment_failed") {
    const paymentIntent = event.data.object as Stripe.PaymentIntent;
    const orderId =
      String(paymentIntent.metadata?.orderId ?? "") ||
      (await findOrderIdByPaymentIntent(paymentIntent.id));

    await markStripeOrderFailed(orderId, paymentIntent.id);
  }
}

export async function POST(request: Request) {
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET?.trim();

  if (!webhookSecret) {
    return new Response("Webhook not configured", { status: 500 });
  }

  const signature = request.headers.get("stripe-signature");
  if (!signature) {
    return new Response("Missing signature", { status: 400 });
  }

  const rawBody = await request.text();
  let event: Stripe.Event;

  try {
    event = getStripe().webhooks.constructEvent(
      rawBody,
      signature,
      webhookSecret
    );
  } catch (error) {
    logErrorInDevelopment("Stripe webhook signature error", error);
    return new Response("Invalid signature", { status: 400 });
  }

  try {
    await handleStripeEvent(event);
    return Response.json({ received: true });
  } catch (error) {
    logErrorInDevelopment("Stripe webhook processing error", error);
    return Response.json({ received: true });
  }
}
