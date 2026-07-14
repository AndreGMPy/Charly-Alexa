import PaymentStatusRefresh from "@/app/pedido/exito/PaymentStatusRefresh";
import { getOrderByStripeSession } from "@/lib/stripe-orders";
import { formatPrice } from "@/lib/products";
import { CheckCircle2, Clock3, Home } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Pedido confirmado | Charly Alexa",
};

type SuccessPageProps = {
  searchParams: Promise<{ session_id?: string | string[] }>;
};

function readParam(value: string | string[] | undefined) {
  return (Array.isArray(value) ? value[0] : value)?.trim() ?? "";
}

function orderFolio(orderId: string, orderNumber?: string) {
  return orderNumber ?? orderId.slice(-6).toUpperCase();
}

export default async function StripeSuccessPage({ searchParams }: SuccessPageProps) {
  const params = await searchParams;
  const sessionId = readParam(params.session_id);
  const order = sessionId ? await getOrderByStripeSession(sessionId).catch(() => null) : null;
  const isPaid = order?.paymentStatus === "paid" || order?.payment?.status === "paid";

  if (!order) {
    return (
      <main className="min-h-screen bg-[#fffaf5] px-4 py-24 text-slate-900 sm:px-6">
        <section className="mx-auto max-w-xl rounded-[1.5rem] bg-white p-6 text-center shadow-sm ring-1 ring-rose-100 sm:p-8">
          <Clock3 className="mx-auto text-amber-600" size={42} />
          <h1 className="mt-4 text-2xl font-black text-slate-950">
            Estamos confirmando tu pago...
          </h1>
          <p className="mt-3 text-sm font-bold leading-6 text-slate-500">
            Si el cargo fue aprobado, tu pedido aparecera confirmado en unos momentos.
          </p>
          <Link
            href="/"
            className="mt-6 inline-flex min-h-11 items-center justify-center gap-2 rounded-full bg-slate-950 px-5 py-3 text-sm font-black text-white"
          >
            <Home size={17} />
            Regresar a la tienda
          </Link>
        </section>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#fffaf5] px-4 py-20 text-slate-900 sm:px-6 lg:px-8">
      <PaymentStatusRefresh enabled={!isPaid} />
      <section className="mx-auto max-w-3xl">
        <div className="rounded-[1.5rem] bg-white p-5 shadow-sm ring-1 ring-rose-100 sm:p-8">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.18em] text-rose-500">
                Pedido #{orderFolio(order.id, order.orderNumber)}
              </p>
              <h1 className="mt-2 text-2xl font-black text-slate-950 sm:text-3xl">
                {isPaid ? "Gracias por tu compra" : "Estamos confirmando tu pago..."}
              </h1>
              <p className="mt-2 text-sm font-bold leading-6 text-slate-500">
                {isPaid
                  ? "Tu pago fue confirmado. La tienda preparara tu pedido y te contactara para el envio."
                  : "El webhook de Stripe puede tardar unos segundos. Actualizaremos esta pagina automaticamente."}
              </p>
            </div>
            <div
              className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl ring-1 ${
                isPaid
                  ? "bg-emerald-50 text-emerald-600 ring-emerald-100"
                  : "bg-amber-50 text-amber-600 ring-amber-100"
              }`}
            >
              {isPaid ? <CheckCircle2 size={28} /> : <Clock3 size={28} />}
            </div>
          </div>

          <div className="mt-6 grid gap-3 sm:grid-cols-2">
            <div className="rounded-2xl bg-[#fffaf5] p-4">
              <p className="text-xs font-black uppercase text-slate-400">
                Comprador
              </p>
              <p className="mt-1 text-sm font-black text-slate-950">
                {order.customerName || order.customer?.name || "Cliente"}
              </p>
            </div>
            <div className="rounded-2xl bg-[#fffaf5] p-4">
              <p className="text-xs font-black uppercase text-slate-400">
                Estado del pago
              </p>
              <p className="mt-1 text-sm font-black text-slate-950">
                {isPaid ? "Pagado" : "Pendiente de confirmacion"}
              </p>
            </div>
          </div>

          <div className="mt-6 space-y-2">
            {order.items.map((item, index) => (
              <div
                key={`${item.productId}-${item.size}-${index}`}
                className="grid gap-2 rounded-2xl bg-[#fffaf5] p-3 sm:grid-cols-[1fr_auto]"
              >
                <div>
                  <p className="text-sm font-black text-slate-950">
                    {item.productName ?? item.name ?? "Producto"}
                  </p>
                  <p className="mt-1 text-xs font-bold text-slate-500">
                    Color {item.color ?? "Sin color"} · Talla {item.size} · {item.quantity} pieza(s)
                  </p>
                </div>
                <p className="text-sm font-black text-slate-950">
                  {formatPrice(item.subtotal)}
                </p>
              </div>
            ))}
          </div>

          <div className="mt-6 rounded-2xl bg-slate-950 p-4 text-white">
            <div className="flex items-center justify-between gap-3 text-sm font-bold">
              <span>Total</span>
              <strong className="text-2xl font-black">
                {formatPrice(order.total)}
              </strong>
            </div>
            {order.shipping?.requiresQuote && (
              <p className="mt-2 text-xs font-bold leading-5 text-white/70">
                El envio se cotiza por WhatsApp y se paga por separado.
              </p>
            )}
          </div>

          <Link
            href="/"
            className="mt-6 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-full bg-rose-500 px-5 py-3 text-sm font-black text-white transition hover:bg-rose-600 sm:w-auto"
          >
            <Home size={17} />
            Regresar a la tienda
          </Link>
        </div>
      </section>
    </main>
  );
}
