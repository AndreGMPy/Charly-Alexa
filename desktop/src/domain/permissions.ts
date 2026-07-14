import type { UserRole } from "./models";

export type Permission = "sell" | "manage_layaways" | "view_products" | "close_sale"
  | "manage_products" | "manage_inventory" | "view_reports" | "close_cash_cut"
  | "manage_settings" | "change_base_price";

const ROLE_PERMISSIONS: Record<UserRole, ReadonlySet<Permission>> = {
  administrador: new Set(["sell", "manage_layaways", "view_products", "close_sale", "manage_products", "manage_inventory", "view_reports", "close_cash_cut", "manage_settings", "change_base_price"]),
  vendedor: new Set(["sell", "manage_layaways", "view_products", "close_sale", "close_cash_cut"]),
};

export function can(role: UserRole, permission: Permission) {
  return ROLE_PERMISSIONS[role].has(permission);
}
