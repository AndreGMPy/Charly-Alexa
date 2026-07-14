import "server-only";

import { getAdminAuth } from "@/lib/firebase-admin";

export async function requireAdminFromRequest(request: Request) {
  const authorization = request.headers.get("authorization") ?? "";
  const match = authorization.match(/^Bearer\s+(.+)$/i);
  const token = match?.[1];

  if (!token) return null;

  try {
    const decoded = await getAdminAuth().verifyIdToken(token);
    if (decoded.admin !== true) return null;

    return decoded;
  } catch (error) {
    const code =
      error && typeof error === "object" && "code" in error
        ? String(error.code)
        : "";

    if (code.startsWith("auth/")) return null;
    throw error;
  }
}
