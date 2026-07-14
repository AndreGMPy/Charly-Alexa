export const runtime = "nodejs";

export async function POST() {
  return Response.json({ received: true, legacy: true });
}
