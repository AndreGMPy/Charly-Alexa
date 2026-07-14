# Charly Alexa POS para Windows

Aplicacion de escritorio separada de la tienda publica. No reemplaza la tienda,
checkout, Mercado Pago ni pedidos web. El POS trabaja localmente con Tauri 2,
React/Vite y SQLite.

## Requisitos en Windows

- Node.js LTS.
- Rust y Cargo estables con toolchain MSVC.
- Microsoft C++ Build Tools con "Desktop development with C++".
- Microsoft Edge WebView2 Runtime.

## Instalacion rapida

Desde la raiz del proyecto:

```powershell
npm install
cd desktop
npm install
npm.cmd run build
npm.cmd run tauri build
```

El instalador debe quedar en alguna de estas rutas:

- `desktop/src-tauri/target/release/bundle/nsis/`
- `desktop/src-tauri/target/release/bundle/msi/`

El build configurado usa NSIS, por lo que el archivo esperado es un `.exe` tipo
setup dentro de `bundle/nsis`.

## Scripts utiles

Dentro de `desktop`:

- `npm.cmd run typecheck`: valida TypeScript sin emitir archivos.
- `npm.cmd run build`: valida TypeScript y compila Vite.
- `npm.cmd run check`: alias de validacion completa del frontend desktop.
- `npm.cmd run tauri dev`: abre la app Tauri en modo desarrollo.
- `npm.cmd run tauri build`: genera el binario y el instalador de Windows.

Desde la raiz:

- `npm.cmd run desktop:build`
- `npm.cmd run desktop:tauri:build`

## Acceso inicial

- Usuario: `admin@charlyalexa.com`
- Contrasena: `admin123`

El usuario se crea en SQLite local si no existe. En esta fase la contrasena se
guarda con hash SHA-256 para mantener el POS funcional sin dependencias nativas
extra; para produccion debe migrarse a Argon2 o bcrypt con sal.

## Funciona offline en Fase 1

- Login local.
- Boton `Cargar productos de prueba`, solo en SQLite local.
- Busqueda y filtros de productos locales.
- Venta por producto, color, talla y cantidad.
- Descuentos en pesos o porcentaje.
- Pago en efectivo, transferencia, tarjeta o mixto.
- Validacion de pago mixto contra el total.
- Mayoreo corrido por producto/color con stock por cada talla.
- Registro de venta en SQLite.
- Descuento de inventario transaccional.
- Ticket visible, copiar ticket e imprimir con `window.print()`.
- Historial de ventas con busqueda por folio y filtro por fecha.
- Cancelacion de venta con devolucion de inventario.
- Inventario por color/talla, bajo stock, agotados y ajuste manual.
- Corte de caja local y cola `sync_queue` con estado `pending`.

## Productos de prueba

El boton `Cargar productos de prueba` inserta datos solo si la tabla de
productos esta vacia. No sube nada a Firebase.

- Vestido Floral Arcoiris: Nina, Vestidos, colores Rosa/Blanco/Amarillo,
  tallas 2 a 16, precio 315, mayoreo corrido 250 por pieza.
- Chamarra Explorer: Nino, Chamarras, colores Azul/Beige, tallas 2 a 12,
  precio 420, mayoreo corrido 300 por pieza.

## Roles

- `administrador`: vender, cancelar ventas, ajustar inventario, cerrar corte y
  operar configuraciones sensibles.
- `vendedor`: vender, ver productos y cerrar corte. No puede ajustar inventario,
  modificar productos ni cambiar precios base.

## Impresion

La impresion actual usa `window.print()` con formato de ticket termico
aproximado de 80 mm. La impresion directa o silenciosa a impresora termica se
integrara despues con un plugin/controlador especifico para Windows/Tauri.

## Sincronizacion

La app muestra `Trabajando local`, `Sin conexion`, `Pendientes por sincronizar`
o `Sincronizado` segun la cola local. En esta fase no se conecta a Firebase.

Quedan stubs claros para Fase 2:

- `pullProductsFromFirebase()`
- `pushPendingSalesToFirebase()`
- `pushStockMovementsToFirebase()`
- `pushCashCutsToFirebase()`

## Requiere internet o Fase 2

- Sincronizacion real con Firebase.
- Descarga de productos remotos.
- Subida de ventas, movimientos y cortes.
- Reconciliacion de conflictos.
- Mercado Pago, pedidos web y actualizaciones publicas de la tienda.
- Firma de codigo, icono final, instalador definitivo y actualizaciones.
