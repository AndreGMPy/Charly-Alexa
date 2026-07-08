import PaymentResultView, {
  getOrderFolioFromQuery,
} from "@/app/pago/PaymentResultView";
import { CheckCircle2 } from "lucide-react";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Pago recibido | Charly Alexa",
};

type PaymentReturnPageProps = {
  searchParams: Promise<{ orderId?: string | string[] }>;
};

export default async function SuccessfulPaymentPage({
  searchParams,
}: PaymentReturnPageProps) {
  const params = await searchParams;

  return (
    <PaymentResultView
      icon={CheckCircle2}
      tone="success"
      title="¡Gracias por tu compra!"
      text="Estamos verificando tu pago. Tu pedido ya fue recibido. En unos momentos la tienda confirmará tu compra."
      orderId={getOrderFolioFromQuery(params.orderId)}
    />
  );
}
