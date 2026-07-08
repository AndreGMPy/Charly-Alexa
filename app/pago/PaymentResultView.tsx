import { buildWhatsAppUrl } from "@/lib/site";
import type { LucideIcon } from "lucide-react";
import { Home, MessageCircle } from "lucide-react";
import Link from "next/link";

type PaymentResultTone = "success" | "pending" | "error";

type PaymentResultViewProps = {
  icon: LucideIcon;
  tone: PaymentResultTone;
  title: string;
  text: string;
  orderId?: string;
};

const toneClasses: Record<
  PaymentResultTone,
  { icon: string; ring: string; badge: string }
> = {
  success: {
    icon: "bg-emerald-50 text-emerald-600 ring-emerald-100",
    ring: "ring-emerald-100",
    badge: "bg-emerald-50 text-emerald-700 ring-emerald-100",
  },
  pending: {
    icon: "bg-amber-50 text-amber-600 ring-amber-100",
    ring: "ring-amber-100",
    badge: "bg-amber-50 text-amber-700 ring-amber-100",
  },
  error: {
    icon: "bg-rose-50 text-rose-600 ring-rose-100",
    ring: "ring-rose-100",
    badge: "bg-rose-50 text-rose-700 ring-rose-100",
  },
};

export function getOrderFolioFromQuery(value: string | string[] | undefined) {
  const rawValue = Array.isArray(value) ? value[0] : value;
  const cleanValue = rawValue?.replace(/[^\w-]/g, "").trim() ?? "";

  return cleanValue ? cleanValue.slice(-6).toUpperCase() : "";
}

export default function PaymentResultView({
  icon: Icon,
  tone,
  title,
  text,
  orderId,
}: PaymentResultViewProps) {
  const classes = toneClasses[tone];
  const whatsappUrl = buildWhatsAppUrl(
    `Hola, necesito ayuda con mi pedido${orderId ? ` #${orderId}` : ""}.`
  );

  return (
    <main className="min-h-screen bg-[#fffaf5] px-4 py-24 text-slate-900 sm:px-6 lg:px-8">
      <section className="mx-auto flex max-w-xl flex-col items-center text-center">
        <div
          className={`flex h-20 w-20 items-center justify-center rounded-[1.5rem] ring-1 ${classes.icon}`}
        >
          <Icon size={38} strokeWidth={2.4} />
        </div>

        <div
          className={`mt-6 w-full rounded-[1.75rem] bg-white px-5 py-7 shadow-sm ring-1 ${classes.ring} sm:px-8 sm:py-9`}
        >
          {orderId && (
            <p
              className={`mx-auto mb-4 inline-flex rounded-full px-3 py-1.5 text-xs font-black ring-1 ${classes.badge}`}
            >
              Pedido #{orderId}
            </p>
          )}

          <h1 className="text-2xl font-black text-slate-950 sm:text-3xl">
            {title}
          </h1>
          <p className="mx-auto mt-3 max-w-md text-sm font-bold leading-6 text-slate-500 sm:text-base sm:leading-7">
            {text}
          </p>

          <div className="mt-7 grid gap-2 sm:grid-cols-2">
            <Link
              href="/"
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full bg-slate-950 px-5 py-3 text-sm font-black text-white transition hover:bg-slate-800"
            >
              <Home size={17} />
              Volver al inicio
            </Link>
            <a
              href={whatsappUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full bg-emerald-500 px-5 py-3 text-sm font-black text-white transition hover:bg-emerald-600"
            >
              <MessageCircle size={17} />
              Contactar por WhatsApp
            </a>
          </div>
        </div>
      </section>
    </main>
  );
}
