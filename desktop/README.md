# Charly Alexa POS para Windows

Este paquete prepara una aplicacion de escritorio separada de la tienda publica.
La tienda y el panel web siguen desplegados con Firebase Hosting/App Hosting; el
POS no reemplaza rutas, checkout, Mercado Pago ni pedidos web.

## Decision de arquitectura

Se eligio **Tauri 2 + React/Vite + SQLite**.

| Criterio | Tauri | Electron |
| --- | --- | --- |
| Runtime | WebView2 del sistema + backend Rust | Chromium + Node incluidos |
| Instalador | NSIS `.exe` o WiX `.msi` | Requiere empaquetador como Electron Forge |
| Base local | SQLite mediante plugin oficial | SQLite mediante modulo Node nativo |
| Superficie privilegiada | Capacidades y comandos explicitos | Proceso main/preload/renderer |
| Ajuste al POS | Menor huella y API nativa acotada | Desarrollo JS mas directo, instalador mayor |

Electron sigue siendo una alternativa valida si el equipo no quiere mantener
Rust o necesita APIs Node especificas. Para una sola terminal Windows, Tauri
reduce la huella instalada y obliga a delimitar las capacidades nativas.

## Modelo offline-first

```text
React POS -> servicios de aplicacion -> repositorios -> SQLite local
                                   -> sync_queue -> adaptador Firebase (fase 2)
```

- SQLite es la fuente operativa mientras se vende. Crear una venta, descontar
  variantes y encolar la sincronizacion debe ocurrir en una sola transaccion.
- Cada registro local usa UUID y las ventas conservan `localFolio`. El
  `firebaseId` se agrega despues de una confirmacion idempotente del servidor.
- La tienda publica sigue online. El POS no crea pedidos web y no llama Mercado
  Pago. Una venta local solo se replica como venta de mostrador cuando hay red.
- Productos remotos se descargan por `updatedAt`. Un stock remoto mas nuevo no
  se pisa: se registra un conflicto y se reconcilian movimientos.
- Una falla nunca elimina la operacion; incrementa `attempts` y conserva la cola
  con estado `failed` para reintento.

Mensaje obligatorio en modo offline:

> Modo sin conexion: las ventas se guardaran en este equipo y se sincronizaran cuando vuelva internet.

## Estructura

- `src/domain`: tipos, permisos y reglas puras del POS.
- `src/pos`: calculo de ventas, pago mixto y ticket.
- `src/inventory`: validacion de stock y corrida mayoreo.
- `src/database`: contrato de persistencia local.
- `src/sync`: cola, estados y politica de conflictos; no contiene credenciales.
- `src-tauri/migrations`: esquema SQLite versionado.
- `src-tauri`: shell Tauri y configuracion de instalador NSIS.

El calculo definitivo de carrito debe reutilizar la semantica de
`../lib/wholesale.ts`. En fase 2 conviene convertir `lib/wholesale.ts` y
`lib/variant-utils.ts` en un paquete de dominio compartido por web y desktop;
no se movieron ahora para no alterar la tienda estable.

## Alcance preparado

La capa de dominio contempla busqueda por nombre/categoria/subcategoria/color/
talla, venta en espera, corrida por color, descuentos, pago mixto, apartados,
clientes, corte, tickets, inventario, roles y cola de sincronizacion. La
migracion incluye todas las tablas necesarias y tablas auxiliares para usuarios,
ventas en espera, articulos de apartado y conflictos.

La UI incluida es una consola inicial de arquitectura. La persistencia y los
casos de uso estan definidos por interfaces para implementar cada pantalla sin
acoplarla a Firebase.

## Fases

1. **Fase 1:** implementar repositorio Tauri/SQLite, login local con Argon2,
   venta rapida, venta en espera, ticket y corte; probar transacciones ante cierre
   inesperado.
2. **Fase 2:** backend idempotente de sincronizacion, clientes, apartados,
   inventario avanzado y resolucion de conflictos. Las reglas de Firebase deben
   revisarse en una tarea autorizada separada.
3. **Fase 3:** importacion Excel, reportes, firma de codigo, actualizador y
   publicacion del instalador.

## Preparar y compilar

Requisitos de Windows: Rust estable MSVC, Microsoft C++ Build Tools con
"Desktop development with C++" y WebView2. Despues:

```powershell
cd desktop
npm install
npm run build
npm run tauri build
```

`npm run tauri build` generara un instalador NSIS `-setup.exe`. Antes de
distribuirlo faltan iconos finales, certificado de firma, credenciales de
Firebase administradas de forma segura, pruebas E2E con perdida de red y la
implementacion del adaptador remoto.

Comprobacion de este equipo al crear el esqueleto: WebView2 esta instalado;
Rust, Cargo y Microsoft C++ Build Tools todavia no estan disponibles. Por eso se
valido el frontend, pero no se genero el binario nativo.

## Limites de conectividad

Funciona sin internet una vez implementados los repositorios: catalogo ya
sincronizado, venta, descuento local, inventario, ticket, apartado y corte.
El login diario sera local y funciona offline. Requieren internet: alta o
renovacion remota de una terminal, descarga de productos, subida de cola,
reconciliacion y cualquier operacion de Mercado Pago.

## Referencias de implementacion

- Tauri para Windows: https://v2.tauri.app/start/prerequisites/
- SQLite y migraciones Tauri: https://v2.tauri.app/plugin/sql/
- Instalador NSIS/MSI: https://v2.tauri.app/distribute/windows-installer/
- Modelo de procesos Electron: https://www.electronjs.org/docs/latest/tutorial/process-model
