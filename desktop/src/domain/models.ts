export type SyncStatus = "pending" | "synced" | "failed";
export type UserRole = "administrador" | "vendedor";
export type PaymentMethod = "Efectivo" | "Transferencia" | "Tarjeta" | "Mixto";
export type LayawayStatus = "activo" | "liquidado" | "vencido" | "cancelado";
export type PaymentBreakdown = { cash: number; transfer: number; card: number };

export type LocalProduct = {
  id: string; firebaseId: string | null; name: string; price: number;
  basePrice: number | null; wholesaleRunEnabled: boolean;
  wholesaleRunPrice: number | null; wholesaleRunSizes: string[];
  categories: string[]; subcategories: string[]; colors: string[];
  active: boolean; updatedAt: string; syncStatus: SyncStatus;
};

export type ProductVariant = {
  id: string; productId: string; color: string; size: string;
  stock: number; updatedAt: string;
};

export type SaleItemDraft = {
  product: LocalProduct; color: string; size: string; quantity: number;
  unitPrice: number; appliedWholesale: boolean;
};

export type SaleDraft = {
  id: string; localFolio: string; customerId: string | null;
  items: SaleItemDraft[]; discount: { type: "amount" | "percent"; value: number } | null;
  paymentMethod: PaymentMethod; paymentBreakdown: PaymentBreakdown; createdAt: string;
};

export type SaleTotals = { subtotal: number; discount: number; total: number; pieces: number };

export type SyncQueueItem = {
  id: string; entityType: "sale" | "stock_movement" | "cash_cut" | "layaway" | "customer";
  entityId: string; action: "create" | "update" | "cancel"; payload: unknown;
  createdAt: string; syncedAt: string | null; attempts: number; status: SyncStatus;
};
