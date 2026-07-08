import PaymentResultView, {
  getOrderFolioFromQuery,
} from "@/app/pago/PaymentResultView";
import { Clock3 } from "lucide-react";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Pago pendiente | Charly Alexa",
};

type PaymentReturnPageProps = {
  searchParams: Promise<{ orderId?: string | string[] }>;
};

export default async function PendingPaymentPage({
  searchParams,
}: PaymentReturnPageProps) {
  const params = await searchParams;

  return (
    <PaymentResultView
      icon={Clock3}
      tone="pending"
      title="Pago pendiente"
      text="Tu pago está en proceso. Te avisaremos cuando se confirme."
      orderId={getOrderFolioFromQuery(params.orderId)}
    />
  );
}
