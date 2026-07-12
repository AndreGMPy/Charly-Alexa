import type { LocalProduct, ProductVariant, SaleDraft, SaleTotals, SyncQueueItem } from "../domain/models";

export type ProductSearch = {
  text?: string; category?: string; subcategory?: string;
  color?: string; size?: string; lowStockOnly?: boolean;
};

export interface PosRepository {
  searchProducts(filter: ProductSearch): Promise<LocalProduct[]>;
  getVariants(productId: string): Promise<ProductVariant[]>;
  saveSaleAtomically(sale: SaleDraft, totals: SaleTotals): Promise<void>;
  holdSale(sale: SaleDraft): Promise<void>;
  restoreHeldSale(id: string): Promise<SaleDraft | null>;
  cancelHeldSale(id: string): Promise<void>;
  closeCashCut(date: string, notes: string): Promise<string>;
  pendingSyncItems(limit: number): Promise<SyncQueueItem[]>;
  markSyncResult(id: string, status: "synced" | "failed", syncedAt?: string): Promise<void>;
}

// saveSaleAtomically must insert sale/items, decrement every variant, create
// stock_movements and enqueue both entities in one SQLite transaction.
