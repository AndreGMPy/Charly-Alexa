import "server-only";

import { getAdminAuth } from "@/lib/firebase-admin";

export async function requireAdminFromRequest(request: Request) {
  const authorization = request.headers.get("authorization") ?? "";
  const match = authorization.match(/^Bearer\s+(.+)$/i);
  const token = match?.[1];

  if (!token) return null;

  const decoded = await getAdminAuth().verifyIdToken(token);
  if (decoded.admin !== true) return null;

  return decoded;
}
