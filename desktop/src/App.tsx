import { useCallback, useEffect, useMemo, useState } from "react";
import {
  adjustVariantStock, cancelSale, closeCashCut, getCashSummary, initializeLocalDatabase,
  listProducts, listSales, listVariants, loginLocal, nextFolio, pendingSyncCount,
  saveSale, seedSampleProducts, type CashSummary, type LocalUser, type StoredSale,
} from "./database/local";
import type { LocalProduct, PaymentBreakdown, PaymentMethod, ProductVariant, SaleDraft, SaleItemDraft, SaleTotals } from "./domain/models";
import { can } from "./domain/permissions";
import { buildWholesaleRun } from "./inventory/wholesale-run";
import { calculateSaleTotals, validatePayment } from "./pos/sale";
import { buildTicketHtml, buildTicketText } from "./pos/ticket";

type Tab = "venta" | "historial" | "inventario" | "corte";
const EMPTY_PAYMENT: PaymentBreakdown = { cash: 0, transfer: 0, card: 0 };
const EMPTY_SUMMARY: CashSummary = { totalSales: 0, cash: 0, transfer: 0, card: 0, mixed: 0, discounts: 0, canceledSales: 0, piecesSold: 0, salesCount: 0 };
const money = (value: number) => new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" }).format(value);

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

function Login({ onLogin }: { onLogin: (user: LocalUser) => void }) {
  const [username, setUsername] = useState("admin@charlyalexa.com");
  const [password, setPassword] = useState("admin123");
  const [error, setError] = useState(""); const [busy, setBusy] = useState(false);
  async function submit(event: React.FormEvent) {
    event.preventDefault(); setBusy(true); setError("");
    try { const user = await loginLocal(username, password); if (!user) setError("Correo o contraseña incorrectos."); else onLogin(user); }
    catch (reason) { setError(errorMessage(reason)); } finally { setBusy(false); }
  }
  return <main className="login-shell"><form className="login-card" onSubmit={submit}>
    <p className="eyebrow">CHARLY ALEXA · POS LOCAL</p><h1>Iniciar sesión</h1>
    <p className="muted">Las ventas se guardan en este equipo y funcionan sin internet.</p>
    <label>Correo<input value={username} onChange={(e) => setUsername(e.target.value)} autoComplete="username" /></label>
    <label>Contraseña<input type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" /></label>
    {error && <p className="error">{error}</p>}<button className="primary" disabled={busy}>{busy ? "Entrando..." : "Entrar al POS"}</button>
    <small>Acceso inicial: admin@charlyalexa.com / admin123</small>
  </form></main>;
}

export function App() {
  const [ready, setReady] = useState(false); const [startupError, setStartupError] = useState("");
  const [user, setUser] = useState<LocalUser | null>(null); const [tab, setTab] = useState<Tab>("venta");
  const [products, setProducts] = useState<LocalProduct[]>([]); const [variants, setVariants] = useState<ProductVariant[]>([]);
  const [sales, setSales] = useState<StoredSale[]>([]); const [pending, setPending] = useState(0);
  const [cashSummary, setCashSummary] = useState<CashSummary>(EMPTY_SUMMARY); const [message, setMessage] = useState("");
  const [search, setSearch] = useState(""); const [category, setCategory] = useState(""); const [subcategory, setSubcategory] = useState("");
  const [selectedProductId, setSelectedProductId] = useState(""); const [color, setColor] = useState(""); const [size, setSize] = useState(""); const [quantity, setQuantity] = useState(1);
  const [cart, setCart] = useState<SaleItemDraft[]>([]); const [discountType, setDiscountType] = useState<"amount" | "percent">("amount"); const [discountValue, setDiscountValue] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("Efectivo"); const [mixed, setMixed] = useState<PaymentBreakdown>(EMPTY_PAYMENT);
  const [ticket, setTicket] = useState<{ sale: SaleDraft; totals: SaleTotals } | null>(null); const [expandedSale, setExpandedSale] = useState("");
  const [historySearch, setHistorySearch] = useState(""); const [historyDate, setHistoryDate] = useState("");
  const [cutNotes, setCutNotes] = useState(""); const [cutText, setCutText] = useState("");
  const [adjustVariantId, setAdjustVariantId] = useState(""); const [adjustStock, setAdjustStock] = useState(""); const [adjustReason, setAdjustReason] = useState<"conteo físico" | "entrada de mercancía" | "merma" | "corrección">("conteo físico");

  const refresh = useCallback(async () => {
    const [nextProducts, nextVariants, nextSales, nextPending, nextCash] = await Promise.all([listProducts(), listVariants(), listSales(), pendingSyncCount(), getCashSummary()]);
    setProducts(nextProducts); setVariants(nextVariants); setSales(nextSales); setPending(nextPending); setCashSummary(nextCash);
  }, []);

  const start = useCallback(async () => {
    console.info("[POS] Inicio de la app");
    setReady(false); setStartupError("");
    try {
      await initializeLocalDatabase();
      await refresh();
      setReady(true);
    } catch (error) {
      const detail = errorMessage(error);
      console.error("[POS] Error real de arranque:", error);
      setStartupError(`No se pudo iniciar SQLite: ${detail}`);
    }
  }, [refresh]);

  useEffect(() => { void start(); }, [start]);

  const selectedProduct = products.find((product) => product.id === selectedProductId) ?? null;
  const selectedVariants = variants.filter((variant) => variant.productId === selectedProductId);
  const colors = selectedProduct ? selectedProduct.colors : [];
  const sizes = selectedProduct ? Array.from(new Set(selectedVariants.filter((variant) => variant.color === color).map((variant) => variant.size))) : [];
  const selectedVariant = selectedVariants.find((variant) => variant.color === color && variant.size === size);
  const inCart = cart.filter((item) => item.product.id === selectedProductId && item.color === color && item.size === size).reduce((sum, item) => sum + item.quantity, 0);
  const available = Math.max((selectedVariant?.stock ?? 0) - inCart, 0);
  const totals = useMemo(() => calculateSaleTotals({ items: cart, discount: discountValue ? { type: discountType, value: Number(discountValue) || 0 } : null }), [cart, discountType, discountValue]);
  const categories = Array.from(new Set(products.flatMap((product) => product.categories)));
  const subcategories = Array.from(new Set(products.flatMap((product) => product.subcategories)));
  const filteredProducts = products.filter((product) => !search || product.name.toLocaleLowerCase("es").includes(search.toLocaleLowerCase("es"))).filter((product) => !category || product.categories.includes(category)).filter((product) => !subcategory || product.subcategories.includes(subcategory));
  const filteredSales = sales.filter((sale) => !historySearch || sale.localFolio.toLocaleLowerCase("es").includes(historySearch.toLocaleLowerCase("es"))).filter((sale) => !historyDate || sale.createdAt.startsWith(historyDate));
  const syncStatusLabel = pending > 0 ? `Pendientes por sincronizar: ${pending}` : "Sincronizado";

  function selectProduct(product: LocalProduct) {
    setSelectedProductId(product.id); const productVariants = variants.filter((variant) => variant.productId === product.id && variant.stock > 0); const first = productVariants[0];
    setColor(first?.color ?? product.colors[0] ?? ""); setSize(first?.size ?? ""); setQuantity(1); setMessage("");
  }
  function clearSelection() { setSelectedProductId(""); setColor(""); setSize(""); setQuantity(1); setMessage(""); }
  function mergeItems(next: SaleItemDraft[]) {
    setCart((current) => { const result = [...current]; for (const item of next) { const found = result.find((line) => line.product.id === item.product.id && line.color === item.color && line.size === item.size && line.unitPrice === item.unitPrice); if (found) found.quantity += item.quantity; else result.push({ ...item }); } return result; });
  }
  function addItem() {
    if (!selectedProduct || !color || !size) return setMessage("Selecciona producto, color y talla.");
    if (quantity < 1 || quantity > available) return setMessage("Stock insuficiente.");
    mergeItems([{ product: selectedProduct, color, size, quantity, unitPrice: selectedProduct.price, appliedWholesale: false }]); setQuantity(1); setMessage("Producto agregado a la venta.");
  }
  function addRun() {
    if (!selectedProduct || !color) return setMessage("Selecciona un producto y color.");
    try {
      const run = buildWholesaleRun(selectedProduct, color, selectedVariants);
      const insufficient = run.some((item) => { const variant = selectedVariants.find((candidate) => candidate.color === item.color && candidate.size === item.size); const used = cart.filter((line) => line.product.id === item.product.id && line.color === item.color && line.size === item.size).reduce((sum, line) => sum + line.quantity, 0); return (variant?.stock ?? 0) - used < 1; });
      if (insufficient) throw new Error(); mergeItems(run); setMessage("Corrida agregada con precio de mayoreo.");
    } catch { setMessage("No hay stock suficiente para completar la corrida en este color."); }
  }
  function setLineQuantity(index: number, next: number) {
    const line = cart[index]; const variant = variants.find((item) => item.productId === line.product.id && item.color === line.color && item.size === line.size);
    if (next <= 0) return setCart((current) => current.filter((_, itemIndex) => itemIndex !== index));
    const other = cart.filter((_, itemIndex) => itemIndex !== index).filter((item) => item.product.id === line.product.id && item.color === line.color && item.size === line.size).reduce((sum, item) => sum + item.quantity, 0);
    if (next + other > (variant?.stock ?? 0)) return setMessage("Stock insuficiente."); setCart((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, quantity: next } : item));
  }
  function paymentBreakdown(): PaymentBreakdown {
    if (paymentMethod === "Mixto") return mixed;
    return { cash: paymentMethod === "Efectivo" ? totals.total : 0, transfer: paymentMethod === "Transferencia" ? totals.total : 0, card: paymentMethod === "Tarjeta" ? totals.total : 0 };
  }
  async function registerSale() {
    if (cart.length === 0) return setMessage("Agrega productos antes de registrar la venta.");
    try {
      const breakdown = paymentBreakdown(); validatePayment(totals.total, breakdown);
      const sale: SaleDraft = { id: crypto.randomUUID(), localFolio: await nextFolio(), customerId: null, items: cart, discount: discountValue ? { type: discountType, value: Number(discountValue) || 0 } : null, paymentMethod, paymentBreakdown: breakdown, createdAt: new Date().toISOString() };
      await saveSale(sale, totals); setTicket({ sale, totals }); setCart([]); setDiscountValue(""); setPaymentMethod("Efectivo"); setMixed(EMPTY_PAYMENT); clearSelection(); await refresh(); setMessage("Venta guardada en este equipo.");
    } catch (error) { setMessage(errorMessage(error)); }
  }
  // La impresión directa a térmica se integrará después con plugin/controlador específico en la app desktop.
  function printTicket() { if (!ticket) return; const popup = window.open("", "ticket", "width=420,height=700"); if (!popup) return setMessage("No se pudo abrir la vista de impresión."); popup.document.write(buildTicketHtml(ticket.sale, ticket.totals)); popup.document.close(); popup.focus(); popup.print(); }
  async function copyTicket() { if (!ticket) return; await navigator.clipboard.writeText(buildTicketText(ticket.sale, ticket.totals)); setMessage("Ticket copiado."); }
  async function cancelStoredSale(sale: StoredSale) { if (!user || !can(user.role, "manage_inventory")) return setMessage("Solo un administrador puede cancelar ventas."); if (!window.confirm(`¿Cancelar ${sale.localFolio} y regresar inventario?`)) return; try { await cancelSale(sale.id); await refresh(); setMessage("Venta cancelada e inventario regresado."); } catch (error) { setMessage(errorMessage(error)); } }
  async function seed() { try { const inserted = await seedSampleProducts(); await refresh(); setMessage(inserted ? "Productos de prueba cargados." : "Ya existen productos locales; no se duplicaron."); } catch (error) { setMessage(errorMessage(error)); } }
  function cashText(summary: CashSummary) { return `Corte Charly Alexa\nFecha: ${new Date().toLocaleDateString("es-MX")}\nVentas: ${summary.salesCount}\nTotal ventas: ${money(summary.totalSales)}\nEfectivo: ${money(summary.cash)}\nTransferencia: ${money(summary.transfer)}\nTarjeta: ${money(summary.card)}\nPagos mixtos: ${money(summary.mixed)}\nDescuentos: ${money(summary.discounts)}\nPiezas: ${summary.piecesSold}\nCanceladas: ${summary.canceledSales}`; }
  async function closeCut() { if (!user || !can(user.role, "close_cash_cut")) return setMessage("No tienes permiso para cerrar el corte."); try { const cut = await closeCashCut(cutNotes); setCutText(cashText(cut.summary)); setCutNotes(""); await refresh(); setMessage("Corte guardado en este equipo."); } catch (error) { setMessage(errorMessage(error)); } }
  async function adjustStockNow() { const variant = variants.find((item) => item.id === adjustVariantId); const next = Number(adjustStock); if (!variant || !Number.isInteger(next) || next < 0) return setMessage("Selecciona una variante y una cantidad válida."); try { await adjustVariantStock(variant, next, adjustReason); setAdjustStock(""); await refresh(); setMessage("Inventario actualizado."); } catch (error) { setMessage(errorMessage(error)); } }

  if (startupError) return <main className="login-shell"><div className="login-card"><h1>No se pudo iniciar el POS</h1><p className="error">No fue posible abrir la base de datos local.</p><details><summary>Detalle tecnico</summary><pre>{startupError}</pre></details><button className="primary" onClick={() => void start()}>Reintentar</button></div></main>;
  if (!ready) return <main className="login-shell"><p>Cargando base local...</p></main>;
  if (!user) return <Login onLogin={setUser} />;

  return <main className="app-shell">
    <header className="topbar"><div><p className="eyebrow">CHARLY ALEXA · TERMINAL LOCAL</p><h1>Punto de venta</h1></div><div className="top-actions"><span className="connection"><i /> Sin conexión</span><span>{user.username} · {user.role}</span><button onClick={() => setUser(null)}>Salir</button></div></header>
    <section className="offline-note"><strong>Trabajando local</strong><span>Las ventas se guardan en este equipo.</span><small>{syncStatusLabel}</small></section>
    <nav className="tabs">{([['venta','Venta rápida'],['historial','Historial'],['inventario','Inventario'],['corte','Corte de caja']] as [Tab,string][]).map(([value,label]) => <button className={tab === value ? "active" : ""} onClick={() => setTab(value)} key={value}>{label}</button>)}</nav>
    {message && <div className="notice" role="status">{message}<button onClick={() => setMessage("")}>×</button></div>}

    {tab === "venta" && <section className="pos-layout">
      <div className="panel catalog"><div className="section-title"><div><p className="eyebrow">CATÁLOGO LOCAL</p><h2>Productos</h2></div><button onClick={() => void seed()}>Cargar productos de prueba</button></div>
        <input placeholder="Buscar producto" value={search} onChange={(e) => setSearch(e.target.value)} />
        <div className="filters"><select value={category} onChange={(e) => setCategory(e.target.value)}><option value="">Todas las categorías</option>{categories.map((item) => <option key={item}>{item}</option>)}</select><select value={subcategory} onChange={(e) => setSubcategory(e.target.value)}><option value="">Todas las subcategorías</option>{subcategories.map((item) => <option key={item}>{item}</option>)}</select></div>
        <div className="product-list">{filteredProducts.map((product) => { const stock = variants.filter((variant) => variant.productId === product.id).reduce((sum, variant) => sum + variant.stock, 0); return <button className={selectedProductId === product.id ? "product active" : "product"} key={product.id} onClick={() => selectProduct(product)}><span><strong>{product.name}</strong><small>{product.subcategories.join(" · ")}</small></span><span><b>{money(product.price)}</b><small>{stock} piezas</small></span></button>; })}{products.length === 0 && <p className="empty">Carga los productos de prueba para comenzar.</p>}</div>
      </div>
      <div className="panel selection"><p className="eyebrow">SELECCIÓN</p><h2>{selectedProduct?.name ?? "Elige un producto"}</h2>
        {selectedProduct && <><label>Color<select value={color} onChange={(e) => { setColor(e.target.value); const first = selectedVariants.find((variant) => variant.color === e.target.value && variant.stock > 0); setSize(first?.size ?? ""); }}><option value="">Selecciona</option>{colors.map((item) => <option key={item}>{item}</option>)}</select></label><label>Talla<select value={size} onChange={(e) => setSize(e.target.value)}><option value="">Selecciona</option>{sizes.map((item) => <option key={item}>{item}</option>)}</select></label><label>Cantidad<input type="number" min="1" max={available} value={quantity} onChange={(e) => setQuantity(Number(e.target.value))} /><small>Stock disponible: {available}</small></label><div className="price-row"><span>Precio unitario</span><strong>{money(selectedProduct.price)}</strong></div><button className="primary" onClick={addItem}>Agregar a venta</button>{selectedProduct.wholesaleRunEnabled && selectedProduct.wholesaleRunPrice && <button className="wholesale" onClick={addRun}>Agregar corrida · {money(selectedProduct.wholesaleRunPrice)} c/u</button>}<button onClick={clearSelection}>Cancelar selección</button></>}
      </div>
      <div className="panel current-sale"><p className="eyebrow">VENTA ACTUAL</p><h2>{totals.pieces} piezas</h2><div className="cart-lines">{cart.map((item,index) => <article className="cart-line" key={`${item.product.id}-${item.color}-${item.size}-${item.unitPrice}`}><div><strong>{item.product.name}</strong><small>{item.color} · Talla {item.size}{item.appliedWholesale ? " · Mayoreo corrido" : ""}</small></div><div className="qty"><button onClick={() => setLineQuantity(index,item.quantity-1)}>−</button><span>{item.quantity}</span><button onClick={() => setLineQuantity(index,item.quantity+1)}>+</button></div><b>{money(item.quantity*item.unitPrice)}</b><button className="danger" onClick={() => setLineQuantity(index,0)}>Quitar</button></article>)}{cart.length === 0 && <p className="empty">Aún no hay productos en la venta.</p>}</div>
        <div className="discount"><select value={discountType} onChange={(e) => setDiscountType(e.target.value as "amount"|"percent")}><option value="amount">Descuento en pesos</option><option value="percent">Descuento en porcentaje</option></select><input type="number" min="0" value={discountValue} onChange={(e) => setDiscountValue(e.target.value)} placeholder="0" /></div>
        <label>Método de pago<select value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value as PaymentMethod)}>{(["Efectivo","Transferencia","Tarjeta","Mixto"] as PaymentMethod[]).map((item) => <option key={item}>{item}</option>)}</select></label>
        {paymentMethod === "Mixto" && <div className="mixed-grid"><label>Efectivo<input type="number" min="0" value={mixed.cash} onChange={(e) => setMixed({...mixed,cash:Number(e.target.value)})}/></label><label>Transferencia<input type="number" min="0" value={mixed.transfer} onChange={(e) => setMixed({...mixed,transfer:Number(e.target.value)})}/></label><label>Tarjeta<input type="number" min="0" value={mixed.card} onChange={(e) => setMixed({...mixed,card:Number(e.target.value)})}/></label></div>}
        <div className="totals"><span>Subtotal <b>{money(totals.subtotal)}</b></span><span>Descuento <b>{money(totals.discount)}</b></span><strong>Total <b>{money(totals.total)}</b></strong></div><button className="primary large" disabled={cart.length===0} onClick={() => void registerSale()}>Registrar venta</button>
      </div>
    </section>}

    {ticket && tab === "venta" && <section className="panel ticket-panel"><div className="section-title"><div><p className="eyebrow">TICKET</p><h2>Venta {ticket.sale.localFolio}</h2></div><div><button onClick={printTicket}>Imprimir ticket</button><button onClick={() => void copyTicket()}>Copiar ticket</button><button className="primary" onClick={() => setTicket(null)}>Nueva venta</button></div></div><pre>{buildTicketText(ticket.sale,ticket.totals)}</pre></section>}

    {tab === "historial" && <section className="panel"><div className="section-title"><div><p className="eyebrow">VENTAS LOCALES</p><h2>Historial</h2></div><button onClick={() => void refresh()}>Actualizar</button></div><div className="history-filters"><input placeholder="Buscar por folio" value={historySearch} onChange={(e)=>setHistorySearch(e.target.value)} /><input type="date" value={historyDate} onChange={(e)=>setHistoryDate(e.target.value)} /><button onClick={()=>{setHistorySearch("");setHistoryDate("");}}>Limpiar filtros</button></div><div className="history">{filteredSales.map((sale) => <article key={sale.id} className={sale.status === "cancelada" ? "sale-card canceled" : "sale-card"}><div><strong>{sale.localFolio}</strong><small>{new Date(sale.createdAt).toLocaleString("es-MX")} · {sale.paymentMethod}</small></div><b>{money(sale.total)}</b><span className="status">{sale.status}</span><button onClick={() => setExpandedSale(expandedSale===sale.id?"":sale.id)}>Ver detalle</button><button className="danger" disabled={sale.status === "cancelada" || !can(user.role,"manage_inventory")} onClick={() => void cancelStoredSale(sale)}>Cancelar venta</button>{expandedSale===sale.id && <div className="sale-detail">{sale.items.map((item) => <p key={item.id}>{item.productName} · {item.color} · Talla {item.size} · {item.quantity} × {money(item.unitPrice)}</p>)}</div>}</article>)}{filteredSales.length === 0 && <p className="empty">No hay ventas con esos filtros.</p>}</div></section>}

    {tab === "inventario" && <section className="panel"><div className="section-title"><div><p className="eyebrow">EXISTENCIAS LOCALES</p><h2>Inventario por color y talla</h2></div></div><div className="inventory-grid">{products.map((product) => <article key={product.id}><h3>{product.name}</h3>{variants.filter((variant)=>variant.productId===product.id).map((variant)=><button className={variant.stock===0?"variant out":variant.stock<=1?"variant low":"variant"} key={variant.id} onClick={()=>{setAdjustVariantId(variant.id);setAdjustStock(String(variant.stock));}}><span>{variant.color} · {variant.size}</span><b>{variant.stock}</b></button>)}</article>)}</div>{can(user.role,"manage_inventory") && <div className="adjust"><h3>Ajuste manual</h3><select value={adjustVariantId} onChange={(e)=>setAdjustVariantId(e.target.value)}><option value="">Producto, color y talla</option>{variants.map((variant)=>{const product=products.find((item)=>item.id===variant.productId);return <option value={variant.id} key={variant.id}>{product?.name} · {variant.color} · {variant.size}</option>})}</select><input type="number" min="0" value={adjustStock} onChange={(e)=>setAdjustStock(e.target.value)} placeholder="Cantidad nueva"/><select value={adjustReason} onChange={(e)=>setAdjustReason(e.target.value as typeof adjustReason)}>{["conteo físico","entrada de mercancía","merma","corrección"].map((reason)=><option key={reason}>{reason}</option>)}</select><button className="primary" onClick={()=>void adjustStockNow()}>Guardar ajuste</button></div>}</section>}

    {tab === "corte" && <section className="panel cut"><p className="eyebrow">CAJA LOCAL</p><h2>Corte del día</h2><div className="summary-grid">{[["Total ventas",cashSummary.totalSales],["Efectivo",cashSummary.cash],["Transferencia",cashSummary.transfer],["Tarjeta",cashSummary.card],["Pagos mixtos",cashSummary.mixed],["Descuentos",cashSummary.discounts]].map(([label,value])=><div key={String(label)}><small>{label}</small><strong>{money(Number(value))}</strong></div>)}<div><small>Ventas</small><strong>{cashSummary.salesCount}</strong></div><div><small>Piezas</small><strong>{cashSummary.piecesSold}</strong></div><div><small>Canceladas</small><strong>{cashSummary.canceledSales}</strong></div></div><textarea value={cutNotes} onChange={(e)=>setCutNotes(e.target.value)} placeholder="Notas del corte"/><button className="primary" disabled={!can(user.role,"close_cash_cut")} onClick={()=>void closeCut()}>Cerrar corte del día</button>{cutText&&<div className="cut-result"><pre>{cutText}</pre><button onClick={()=>void navigator.clipboard.writeText(cutText)}>Copiar corte</button><button onClick={()=>window.print()}>Imprimir corte</button></div>}</section>}
  </main>;
}
