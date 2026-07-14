export const runtime = "nodejs";

export async function POST() {
  return Response.json(
    {
      message:
        "La integracion de Mercado Pago esta desactivada. Usa Stripe para nuevos pagos.",
    },
    { status: 410 }
  );
}
