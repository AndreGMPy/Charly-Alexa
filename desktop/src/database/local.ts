import Database from "@tauri-apps/plugin-sql";
import type { LocalProduct, PaymentBreakdown, PaymentMethod, ProductVariant, SaleDraft, SaleTotals, UserRole } from "../domain/models";

type Row = Record<string, unknown>;

export type LocalUser = { id: string; username: string; role: UserRole };
export type StoredSale = {
  id: string;
  localFolio: string;
  subtotal: number;
  discount: number;
  total: number;
  paymentMethod: PaymentMethod;
  paymentBreakdown: PaymentBreakdown;
  status: "registrada" | "cancelada";
  createdAt: string;
  items: { id: string; productId: string; productName: string; color: string; size: string; quantity: number; unitPrice: number; appliedWholesale: boolean; total: number }[];
};

export type CashSummary = {
  totalSales: number;
  cash: number;
  transfer: number;
  card: number;
  mixed: number;
  discounts: number;
  canceledSales: number;
  piecesSold: number;
  salesCount: number;
};

let databasePromise: Promise<Database> | null = null;
const DATABASE_URL = "sqlite:charly-alexa-pos.db";
const id = () => crypto.randomUUID();
const json = (value: unknown) => JSON.stringify(value);

export async function openLocalDatabase() {
  console.info("[SQLite] Base solicitada:", DATABASE_URL);
  try {
    const database = await Database.load(DATABASE_URL);
    const probe = await database.select<Row[]>("SELECT 1 AS ok");
    console.info("[SQLite] SELECT 1 completado:", probe);
    return database;
  } catch (error) {
    console.error("[SQLite] Error real al inicializar:", error);
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`SQLite no pudo inicializarse: ${message}`);
  }
}

const db = () => (databasePromise ??= openLocalDatabase());

async function hashPassword(password: string) {
  const bytes = new TextEncoder().encode(password);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function parseList(value: unknown): string[] {
  try { return Array.isArray(value) ? value.map(String) : JSON.parse(String(value ?? "[]")); }
  catch { return []; }
}

function mapProduct(row: Row): LocalProduct {
  return {
    id: String(row.id), firebaseId: row.firebase_id ? String(row.firebase_id) : null,
    name: String(row.name), price: Number(row.price), basePrice: row.base_price == null ? null : Number(row.base_price),
    wholesaleRunEnabled: Boolean(row.wholesale_run_enabled),
    wholesaleRunPrice: row.wholesale_run_price == null ? null : Number(row.wholesale_run_price),
    wholesaleRunSizes: parseList(row.wholesale_run_sizes), categories: parseList(row.categories),
    subcategories: parseList(row.subcategories), colors: parseList(row.colors), active: Boolean(row.active),
    updatedAt: String(row.updated_at), syncStatus: String(row.sync_status) as LocalProduct["syncStatus"],
  };
}

function mapVariant(row: Row): ProductVariant {
  return { id: String(row.id), productId: String(row.product_id), color: String(row.color), size: String(row.size), stock: Number(row.stock), updatedAt: String(row.updated_at) };
}

async function enqueue(database: Database, entityType: string, entityId: string, action: "create" | "update" | "cancel", payload: unknown) {
  await database.execute(
    "INSERT INTO sync_queue (id, entity_type, entity_id, action, payload, created_at, status) VALUES (?, ?, ?, ?, ?, ?, 'pending')",
    [id(), entityType, entityId, action, json(payload), new Date().toISOString()]
  );
}

export async function initializeLocalDatabase() {
  const database = await db();
  const users = await database.select<Row[]>("SELECT id FROM local_users WHERE lower(username) = 'admin@charlyalexa.com' LIMIT 1");
  if (users.length === 0) {
    await database.execute(
      "INSERT INTO local_users (id, username, password_hash, role, active, created_at) VALUES (?, ?, ?, 'administrador', 1, ?)",
      [id(), "admin@charlyalexa.com", await hashPassword("admin123"), new Date().toISOString()]
    );
  }
}

export async function loginLocal(username: string, password: string): Promise<LocalUser | null> {
  const database = await db();
  const rows = await database.select<Row[]>("SELECT id, username, password_hash, role FROM local_users WHERE lower(username) = lower(?) AND active = 1 LIMIT 1", [username.trim()]);
  const row = rows[0];
  if (!row || String(row.password_hash) !== await hashPassword(password)) return null;
  await database.execute("UPDATE local_users SET last_login_at = ? WHERE id = ?", [new Date().toISOString(), row.id]);
  return { id: String(row.id), username: String(row.username), role: String(row.role) as UserRole };
}

export async function listProducts() {
  const database = await db();
  const rows = await database.select<Row[]>("SELECT * FROM products WHERE active = 1 ORDER BY name");
  return rows.map(mapProduct);
}

export async function listVariants(productId?: string) {
  const database = await db();
  const rows = productId
    ? await database.select<Row[]>("SELECT * FROM product_variants WHERE product_id = ? ORDER BY color, size", [productId])
    : await database.select<Row[]>("SELECT * FROM product_variants ORDER BY product_id, color, size");
  return rows.map(mapVariant);
}

export async function seedSampleProducts() {
  const database = await db();
  const count = await database.select<Row[]>("SELECT COUNT(*) AS total FROM products");
  if (Number(count[0]?.total) > 0) return false;
  const now = new Date().toISOString();
  const samples = [
    { name: "Vestido Floral Arcoíris", categories: ["Niña"], subcategories: ["Vestidos"], colors: ["Rosa", "Blanco", "Amarillo"], sizes: ["2", "4", "6", "8", "10", "12", "14", "16"], price: 315, run: true, runPrice: 250 },
    { name: "Chamarra Explorer", categories: ["Niño"], subcategories: ["Chamarras"], colors: ["Azul", "Beige"], sizes: ["2", "4", "6", "8", "10", "12"], price: 420, run: true, runPrice: 300 },
  ];
  await database.execute("BEGIN IMMEDIATE");
  try {
    for (const sample of samples) {
      const productId = id();
      await database.execute(
        "INSERT INTO products (id, name, price, wholesale_run_enabled, wholesale_run_price, wholesale_run_sizes, categories, subcategories, colors, active, updated_at, sync_status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, 'pending')",
        [productId, sample.name, sample.price, sample.run ? 1 : 0, sample.runPrice, json(sample.sizes), json(sample.categories), json(sample.subcategories), json(sample.colors), now]
      );
      for (const color of sample.colors) for (const size of sample.sizes) {
        await database.execute("INSERT INTO product_variants (id, product_id, color, size, stock, updated_at) VALUES (?, ?, ?, ?, 2, ?)", [id(), productId, color, size, now]);
      }
      await enqueue(database, "product", productId, "create", sample);
    }
    await database.execute("COMMIT");
    return true;
  } catch (error) { await database.execute("ROLLBACK"); throw error; }
}

export async function nextFolio() {
  const database = await db();
  const day = new Date().toISOString().slice(0, 10);
  const rows = await database.select<Row[]>("SELECT COUNT(*) AS total FROM sales WHERE created_at LIKE ?", [`${day}%`]);
  return `POS-${day.replaceAll("-", "")}-${String(Number(rows[0]?.total ?? 0) + 1).padStart(4, "0")}`;
}

export async function saveSale(sale: SaleDraft, totals: SaleTotals) {
  const database = await db();
  await database.execute("BEGIN IMMEDIATE");
  try {
    for (const item of sale.items) {
      const rows = await database.select<Row[]>("SELECT id, stock FROM product_variants WHERE product_id = ? AND color = ? AND size = ? LIMIT 1", [item.product.id, item.color, item.size]);
      const variant = rows[0];
      if (!variant || Number(variant.stock) < item.quantity) throw new Error(`Stock insuficiente para ${item.product.name}, ${item.color}, talla ${item.size}.`);
    }
    await database.execute("INSERT INTO sales (id, local_folio, customer_id, subtotal, discount, total, payment_method, payment_breakdown, status, created_at, sync_status) VALUES (?, ?, NULL, ?, ?, ?, ?, ?, 'registrada', ?, 'pending')", [sale.id, sale.localFolio, totals.subtotal, totals.discount, totals.total, sale.paymentMethod, json(sale.paymentBreakdown), sale.createdAt]);
    for (const item of sale.items) {
      const rows = await database.select<Row[]>("SELECT id, stock FROM product_variants WHERE product_id = ? AND color = ? AND size = ? LIMIT 1", [item.product.id, item.color, item.size]);
      const variant = rows[0];
      const previous = Number(variant.stock); const next = previous - item.quantity; const movementId = id();
      await database.execute("INSERT INTO sale_items (id, sale_id, product_id, product_name, color, size, quantity, unit_price, applied_wholesale, total) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)", [id(), sale.id, item.product.id, item.product.name, item.color, item.size, item.quantity, item.unitPrice, item.appliedWholesale ? 1 : 0, item.quantity * item.unitPrice]);
      await database.execute("UPDATE product_variants SET stock = ?, updated_at = ? WHERE id = ?", [next, sale.createdAt, variant.id]);
      await database.execute("INSERT INTO stock_movements (id, product_id, color, size, previous_stock, new_stock, difference, reason, created_at, sync_status) VALUES (?, ?, ?, ?, ?, ?, ?, 'venta', ?, 'pending')", [movementId, item.product.id, item.color, item.size, previous, next, -item.quantity, sale.createdAt]);
      await enqueue(database, "stock_movement", movementId, "create", { saleId: sale.id, productId: item.product.id, previous, next });
    }
    await enqueue(database, "sale", sale.id, "create", { folio: sale.localFolio, totals });
    await database.execute("COMMIT");
  } catch (error) { await database.execute("ROLLBACK"); throw error; }
}

export async function listSales(): Promise<StoredSale[]> {
  const database = await db();
  const sales = await database.select<Row[]>("SELECT * FROM sales ORDER BY created_at DESC");
  const items = await database.select<Row[]>("SELECT * FROM sale_items ORDER BY rowid");
  return sales.map((sale) => ({
    id: String(sale.id), localFolio: String(sale.local_folio), subtotal: Number(sale.subtotal), discount: Number(sale.discount), total: Number(sale.total),
    paymentMethod: String(sale.payment_method) as PaymentMethod, paymentBreakdown: JSON.parse(String(sale.payment_breakdown)) as PaymentBreakdown,
    status: String(sale.status) as StoredSale["status"], createdAt: String(sale.created_at),
    items: items.filter((item) => item.sale_id === sale.id).map((item) => ({ id: String(item.id), productId: String(item.product_id), productName: String(item.product_name), color: String(item.color), size: String(item.size), quantity: Number(item.quantity), unitPrice: Number(item.unit_price), appliedWholesale: Boolean(item.applied_wholesale), total: Number(item.total) })),
  }));
}

export async function cancelSale(saleId: string) {
  const database = await db();
  await database.execute("BEGIN IMMEDIATE");
  try {
    const sales = await database.select<Row[]>("SELECT status FROM sales WHERE id = ?", [saleId]);
    if (!sales[0]) throw new Error("No se encontró la venta.");
    if (sales[0].status === "cancelada") throw new Error("Esta venta ya estaba cancelada.");
    const items = await database.select<Row[]>("SELECT * FROM sale_items WHERE sale_id = ?", [saleId]);
    const now = new Date().toISOString();
    for (const item of items) {
      const variants = await database.select<Row[]>("SELECT id, stock FROM product_variants WHERE product_id = ? AND color = ? AND size = ?", [item.product_id, item.color, item.size]);
      const variant = variants[0]; const previous = Number(variant.stock); const next = previous + Number(item.quantity); const movementId = id();
      await database.execute("UPDATE product_variants SET stock = ?, updated_at = ? WHERE id = ?", [next, now, variant.id]);
      await database.execute("INSERT INTO stock_movements (id, product_id, color, size, previous_stock, new_stock, difference, reason, created_at, sync_status) VALUES (?, ?, ?, ?, ?, ?, ?, 'cancelacion', ?, 'pending')", [movementId, item.product_id, item.color, item.size, previous, next, item.quantity, now]);
      await enqueue(database, "stock_movement", movementId, "create", { saleId, previous, next });
    }
    await database.execute("UPDATE sales SET status = 'cancelada', sync_status = 'pending' WHERE id = ?", [saleId]);
    await enqueue(database, "sale", saleId, "cancel", { saleId });
    await database.execute("COMMIT");
  } catch (error) { await database.execute("ROLLBACK"); throw error; }
}

export async function getCashSummary(date = new Date().toISOString().slice(0, 10)): Promise<CashSummary> {
  const sales = (await listSales()).filter((sale) => sale.createdAt.startsWith(date));
  const active = sales.filter((sale) => sale.status === "registrada");
  return active.reduce<CashSummary>((summary, sale) => ({
    totalSales: summary.totalSales + sale.total,
    cash: summary.cash + sale.paymentBreakdown.cash,
    transfer: summary.transfer + sale.paymentBreakdown.transfer,
    card: summary.card + sale.paymentBreakdown.card,
    mixed: summary.mixed + (sale.paymentMethod === "Mixto" ? sale.total : 0),
    discounts: summary.discounts + sale.discount,
    canceledSales: sales.length - active.length,
    piecesSold: summary.piecesSold + sale.items.reduce((sum, item) => sum + item.quantity, 0),
    salesCount: active.length,
  }), { totalSales: 0, cash: 0, transfer: 0, card: 0, mixed: 0, discounts: 0, canceledSales: sales.length - active.length, piecesSold: 0, salesCount: active.length });
}

export async function closeCashCut(notes: string) {
  const database = await db(); const date = new Date().toISOString().slice(0, 10); const summary = await getCashSummary(date); const cutId = id();
  await database.execute("INSERT INTO cash_cuts (id, date, total_sales, total_cash, total_transfer, total_card, total_discounts, canceled_sales, pieces_sold, notes, closed_at, sync_status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending')", [cutId, date, summary.totalSales, summary.cash, summary.transfer, summary.card, summary.discounts, summary.canceledSales, summary.piecesSold, notes.trim(), new Date().toISOString()]);
  await enqueue(database, "cash_cut", cutId, "create", summary);
  return { id: cutId, date, summary, notes: notes.trim() };
}

export async function adjustVariantStock(variant: ProductVariant, newStock: number, reason: "conteo físico" | "entrada de mercancía" | "merma" | "corrección") {
  const database = await db(); const now = new Date().toISOString(); const movementId = id();
  const dbReason = reason === "entrada de mercancía" ? "entrada" : reason === "merma" ? "merma" : "correccion";
  await database.execute("BEGIN IMMEDIATE");
  try {
    await database.execute("UPDATE product_variants SET stock = ?, updated_at = ? WHERE id = ?", [newStock, now, variant.id]);
    await database.execute("INSERT INTO stock_movements (id, product_id, color, size, previous_stock, new_stock, difference, reason, created_at, sync_status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending')", [movementId, variant.productId, variant.color, variant.size, variant.stock, newStock, newStock - variant.stock, dbReason, now]);
    await enqueue(database, "stock_movement", movementId, "create", { reason, previous: variant.stock, next: newStock });
    await database.execute("COMMIT");
  } catch (error) { await database.execute("ROLLBACK"); throw error; }
}

export async function pendingSyncCount() {
  const database = await db(); const rows = await database.select<Row[]>("SELECT COUNT(*) AS total FROM sync_queue WHERE status = 'pending'");
  return Number(rows[0]?.total ?? 0);
}
