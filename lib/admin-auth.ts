import { logErrorInDevelopment } from "@/lib/safe-errors";
import type { User } from "firebase/auth";

export async function isAdminUser(user: User | null) {
  if (!user) return false;

  try {
    const tokenResult = await user.getIdTokenResult();
    return tokenResult.claims.admin === true;
  } catch (error) {
    logErrorInDevelopment("Admin claim check failed", error);
    return false;
  }
}

export async function refreshAndCheckAdminUser(user: User | null) {
  if (!user) return false;

  try {
    await user.getIdToken(true);
    return isAdminUser(user);
  } catch (error) {
    logErrorInDevelopment("Admin token refresh failed", error);
    return false;
  }
}
