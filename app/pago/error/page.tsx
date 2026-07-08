import PaymentResultView, {
  getOrderFolioFromQuery,
} from "@/app/pago/PaymentResultView";
import { AlertTriangle } from "lucide-react";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Pago no completado | Charly Alexa",
};

type PaymentReturnPageProps = {
  searchParams: Promise<{ orderId?: string | string[] }>;
};

export default async function FailedPaymentPage({
  searchParams,
}: PaymentReturnPageProps) {
  const params = await searchParams;

  return (
    <PaymentResultView
      icon={AlertTriangle}
      tone="error"
      title="No se pudo completar el pago"
      text="Puedes intentarlo de nuevo o contactar a la tienda por WhatsApp."
      orderId={getOrderFolioFromQuery(params.orderId)}
    />
  );
}
