PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS products (
  id TEXT PRIMARY KEY NOT NULL,
  firebase_id TEXT UNIQUE,
  name TEXT NOT NULL,
  price REAL NOT NULL CHECK (price >= 0),
  base_price REAL CHECK (base_price IS NULL OR base_price >= 0),
  wholesale_run_enabled INTEGER NOT NULL DEFAULT 0 CHECK (wholesale_run_enabled IN (0, 1)),
  wholesale_run_price REAL CHECK (wholesale_run_price IS NULL OR wholesale_run_price > 0),
  wholesale_run_sizes TEXT NOT NULL DEFAULT '[]' CHECK (json_valid(wholesale_run_sizes)),
  categories TEXT NOT NULL DEFAULT '[]' CHECK (json_valid(categories)),
  subcategories TEXT NOT NULL DEFAULT '[]' CHECK (json_valid(subcategories)),
  colors TEXT NOT NULL DEFAULT '[]' CHECK (json_valid(colors)),
  active INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0, 1)),
  updated_at TEXT NOT NULL,
  sync_status TEXT NOT NULL DEFAULT 'synced' CHECK (sync_status IN ('pending', 'synced', 'failed'))
);

CREATE TABLE IF NOT EXISTS product_variants (
  id TEXT PRIMARY KEY NOT NULL,
  product_id TEXT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  color TEXT NOT NULL,
  size TEXT NOT NULL,
  stock INTEGER NOT NULL DEFAULT 0 CHECK (stock >= 0),
  updated_at TEXT NOT NULL,
  UNIQUE (product_id, color, size)
);

CREATE TABLE IF NOT EXISTS customers (
  id TEXT PRIMARY KEY NOT NULL,
  firebase_id TEXT UNIQUE,
  name TEXT NOT NULL,
  phone TEXT NOT NULL DEFAULT '',
  notes TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  sync_status TEXT NOT NULL DEFAULT 'pending' CHECK (sync_status IN ('pending', 'synced', 'failed'))
);

CREATE TABLE IF NOT EXISTS sales (
  id TEXT PRIMARY KEY NOT NULL,
  local_folio TEXT NOT NULL UNIQUE,
  firebase_id TEXT UNIQUE,
  customer_id TEXT REFERENCES customers(id) ON DELETE SET NULL,
  subtotal REAL NOT NULL CHECK (subtotal >= 0),
  discount REAL NOT NULL DEFAULT 0 CHECK (discount >= 0),
  total REAL NOT NULL CHECK (total >= 0),
  payment_method TEXT NOT NULL CHECK (payment_method IN ('Efectivo', 'Transferencia', 'Tarjeta', 'Mixto')),
  payment_breakdown TEXT NOT NULL CHECK (json_valid(payment_breakdown)),
  status TEXT NOT NULL DEFAULT 'registrada' CHECK (status IN ('registrada', 'cancelada')),
  created_at TEXT NOT NULL,
  synced_at TEXT,
  sync_status TEXT NOT NULL DEFAULT 'pending' CHECK (sync_status IN ('pending', 'synced', 'failed'))
);

CREATE TABLE IF NOT EXISTS sale_items (
  id TEXT PRIMARY KEY NOT NULL,
  sale_id TEXT NOT NULL REFERENCES sales(id) ON DELETE CASCADE,
  product_id TEXT NOT NULL REFERENCES products(id),
  product_name TEXT NOT NULL,
  color TEXT NOT NULL,
  size TEXT NOT NULL,
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  unit_price REAL NOT NULL CHECK (unit_price >= 0),
  applied_wholesale INTEGER NOT NULL DEFAULT 0 CHECK (applied_wholesale IN (0, 1)),
  total REAL NOT NULL CHECK (total >= 0)
);

CREATE TABLE IF NOT EXISTS layaways (
  id TEXT PRIMARY KEY NOT NULL,
  firebase_id TEXT UNIQUE,
  customer_id TEXT NOT NULL REFERENCES customers(id),
  status TEXT NOT NULL DEFAULT 'activo' CHECK (status IN ('activo', 'liquidado', 'vencido', 'cancelado')),
  total REAL NOT NULL CHECK (total >= 0),
  deposit REAL NOT NULL CHECK (deposit >= 0),
  remaining REAL NOT NULL CHECK (remaining >= 0),
  due_date TEXT NOT NULL,
  notes TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  sync_status TEXT NOT NULL DEFAULT 'pending' CHECK (sync_status IN ('pending', 'synced', 'failed'))
);

CREATE TABLE IF NOT EXISTS layaway_items (
  id TEXT PRIMARY KEY NOT NULL,
  layaway_id TEXT NOT NULL REFERENCES layaways(id) ON DELETE CASCADE,
  product_id TEXT NOT NULL REFERENCES products(id),
  product_name TEXT NOT NULL,
  color TEXT NOT NULL,
  size TEXT NOT NULL,
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  unit_price REAL NOT NULL CHECK (unit_price >= 0)
);

CREATE TABLE IF NOT EXISTS cash_cuts (
  id TEXT PRIMARY KEY NOT NULL,
  date TEXT NOT NULL,
  total_sales REAL NOT NULL DEFAULT 0,
  total_cash REAL NOT NULL DEFAULT 0,
  total_transfer REAL NOT NULL DEFAULT 0,
  total_card REAL NOT NULL DEFAULT 0,
  total_discounts REAL NOT NULL DEFAULT 0,
  canceled_sales INTEGER NOT NULL DEFAULT 0,
  pieces_sold INTEGER NOT NULL DEFAULT 0,
  notes TEXT NOT NULL DEFAULT '',
  closed_at TEXT NOT NULL,
  sync_status TEXT NOT NULL DEFAULT 'pending' CHECK (sync_status IN ('pending', 'synced', 'failed'))
);

CREATE TABLE IF NOT EXISTS stock_movements (
  id TEXT PRIMARY KEY NOT NULL,
  product_id TEXT NOT NULL REFERENCES products(id),
  color TEXT NOT NULL,
  size TEXT NOT NULL,
  previous_stock INTEGER NOT NULL,
  new_stock INTEGER NOT NULL CHECK (new_stock >= 0),
  difference INTEGER NOT NULL,
  reason TEXT NOT NULL CHECK (reason IN ('venta', 'cancelacion', 'entrada', 'merma', 'correccion', 'apartado', 'liberacion_apartado')),
  created_at TEXT NOT NULL,
  sync_status TEXT NOT NULL DEFAULT 'pending' CHECK (sync_status IN ('pending', 'synced', 'failed'))
);

CREATE TABLE IF NOT EXISTS sync_queue (
  id TEXT PRIMARY KEY NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  action TEXT NOT NULL CHECK (action IN ('create', 'update', 'cancel')),
  payload TEXT NOT NULL CHECK (json_valid(payload)),
  created_at TEXT NOT NULL,
  synced_at TEXT,
  attempts INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'synced', 'failed')),
  last_error TEXT
);

CREATE TABLE IF NOT EXISTS held_sales (
  id TEXT PRIMARY KEY NOT NULL,
  local_folio TEXT NOT NULL,
  payload TEXT NOT NULL CHECK (json_valid(payload)),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS local_users (
  id TEXT PRIMARY KEY NOT NULL,
  username TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('administrador', 'vendedor')),
  active INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0, 1)),
  created_at TEXT NOT NULL,
  last_login_at TEXT
);

CREATE TABLE IF NOT EXISTS sync_conflicts (
  id TEXT PRIMARY KEY NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  local_updated_at TEXT NOT NULL,
  remote_updated_at TEXT NOT NULL,
  local_payload TEXT NOT NULL CHECK (json_valid(local_payload)),
  remote_payload TEXT NOT NULL CHECK (json_valid(remote_payload)),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'resolved_local', 'resolved_remote', 'merged')),
  created_at TEXT NOT NULL,
  resolved_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_products_name ON products(name);
CREATE INDEX IF NOT EXISTS idx_variants_lookup ON product_variants(product_id, color, size);
CREATE INDEX IF NOT EXISTS idx_sales_created_at ON sales(created_at);
CREATE INDEX IF NOT EXISTS idx_layaways_status ON layaways(status, due_date);
CREATE INDEX IF NOT EXISTS idx_movements_product ON stock_movements(product_id, created_at);
CREATE INDEX IF NOT EXISTS idx_sync_queue_status ON sync_queue(status, created_at);
