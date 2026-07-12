export const MODULES = [
  { id: "pos", label: "Venta rapida", description: "Busqueda, variantes, corrida, descuentos y pago mixto.", phase: "Fase 1" },
  { id: "inventory", label: "Inventario", description: "Stock por color y talla, ajustes, entradas y merma.", phase: "Fase 1-2" },
  { id: "layaways", label: "Apartados", description: "Anticipos, vencimientos, liquidacion y cancelacion.", phase: "Fase 2" },
  { id: "customers", label: "Clientes", description: "Contacto, notas, compras y apartados activos.", phase: "Fase 2" },
  { id: "cash", label: "Corte de caja", description: "Ventas, metodos de pago, descuentos y piezas.", phase: "Fase 1" },
  { id: "tickets", label: "Tickets", description: "Vista imprimible, copiar y compartir por WhatsApp.", phase: "Fase 1" },
  { id: "sync", label: "Sincronizacion", description: "Cola durable, reintentos y conflictos de inventario.", phase: "Fase 2" },
  { id: "imports", label: "Importar Excel", description: "Altas, stock, precios y deteccion de duplicados.", phase: "Fase 3" },
] as const;
