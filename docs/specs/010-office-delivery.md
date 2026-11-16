---
id: 010
title: Entrega desde la oficina (salida FEFO, cargo y cobro)
status: draft
module: orders (+ inventory, accounts)
---

# 010 — Entrega desde la oficina

## Objetivo
Marcar un pedido como entregado sin hoja de ruta. En un solo paso:
1. Descuenta el stock del almacén, primero lo que vence antes (FEFO).
2. Carga el importe a la cuenta del cliente.
3. Registra lo que pagó en ese momento.

Con esto pedidos, stock y fiado quedan al día sin papel antes de la fase 4. La fase 4 reutiliza la salida FEFO y el cargo.

## Alcance
Incluye:
- Pantalla "Entregar" desde un pedido pendiente, con la cantidad entregada por línea (puede ser menor que la pedida, o 0).
- Salida de stock FEFO entre los pisos del almacén. Movimiento VENTA en el kardex.
- Cargo en la cuenta y cobro opcional en el mismo paso.
- Estado ENTREGADO, con vista de solo lectura.

No incluye:
- Hoja de ruta, picking, carga al vehículo ni entrega en ruta (fase 4).
- Devoluciones después de entregar. Por ahora, el error de cuenta se corrige con un ajuste del spec 009.
- Nota de entrega en imagen (fase 4) y estados PARCIAL / NO_ENTREGADO.

## Criterios de aceptación
- [ ] AC1 — En `/pedidos/[id]` de un pedido PENDIENTE hay un botón "Entregar" que lleva a `/pedidos/[id]/entregar` (dueño). Ahí se ve por línea:
  - Producto, cantidad pedida, campo "Entregado" (por defecto lo pedido, de 0 a lo pedido), precio del pedido y subtotal.
  - Debajo de la línea, el stock del almacén en la presentación.
  - Abajo, el total entregado.
- [ ] AC2 — Cobro en el mismo paso: "Pagó ahora" (S/, por defecto vacío = 0) y medio de pago (los 4 del spec 009), con un botón "Pagó todo" que copia el total.
  - Lo pagado no puede pasar de saldo anterior + total entregado.
- [ ] AC3 — "Confirmar entrega" hace todo en una transacción:
  1. Bloquea el pedido (debe seguir PENDIENTE) y los productos en orden de id.
  2. Descuenta cada línea entregada en unidades base de los lotes con stock de ubicaciones ALMACEN, por vencimiento más cercano primero (sin fecha al final) y luego por nombre de ubicación.
  3. Crea un movimiento VENTA negativo por cada lote y ubicación tocados, con el costo promedio del producto y `documento_id` = pedido.
  4. Guarda la cantidad entregada por ítem y el total entregado, y deja el pedido ENTREGADO.
  5. Si el total > 0, crea un CARGO con `pedido_id` y fecha de hoy.
  6. Si pagó > 0, crea un ABONO con su medio.
  7. Audita `order.deliver` con el total y lo pagado.
- [ ] AC4 — Si falta stock en alguna línea, no se guarda nada y se avisa "Falta stock de <producto>: hay <cantidad>". El dueño baja lo entregado o recibe mercadería.
  - Todas las líneas en 0 → "No hay nada que entregar; anula el pedido".
- [ ] AC5 — Selección FEFO pura con tests: `fefoPick(lots, qty)` → `[{ lotId, locationId, quantity }]`, o `null` si no alcanza.
- [ ] AC6 — Pedido ENTREGADO en solo lectura: se muestra la cantidad pedida y la entregada cuando difieren, el total entregado y "Entregado".
  - `/pedidos` lista pendientes y entregados, cada uno con su estado. El total del día suma ambos y "Ver anulados" sigue igual.
- [ ] AC7 — Kardex: la salida se ve como "Venta" con el cliente y "Pedido #N".
  - Cuenta del cliente: el cargo se ve como "Entrega · Pedido #N".
  - "Repetir último pedido" usa la cantidad pedida.

## Datos (migración nueva)
- `estado_pedido` + `ENTREGADO`. `tipo_movimiento` + `VENTA`. Los dos con `ALTER TYPE … ADD VALUE`.
- `pedido_items.cantidad_entregada` integer null (null = sin entregar), con CHECK entre 0 y `cantidad`.
- `pedidos.entregado_en` timestamptz null.
- `movimientos_cuenta.pedido_id` uuid null, FK a `pedidos`.

## Contratos
- Inventario:
  - `fefo.ts` (puro, con tests): `fefoPick`.
  - `dispatchStock(tx, { productId, baseQty, orderId, userId })` exportado: hace el lock, elige con FEFO, actualiza `stock` e inserta los movimientos. Devuelve `{ ok: true } | { ok: false, available }`.
  - `listMovements` suma el cliente y el número de pedido para VENTA.
- Cuentas: `addCharge(tx, { customerId, orderId, amount, userId })`, `addPayment(tx, { customerId, amount, method, userId })` y `balanceOf(tx, customerId)` exportados. Se usan dentro de la transacción del pedido; `registerPayment` reutiliza `addPayment`.
- Pedidos:
  - `deliverySchema`: `{ orderId, lines: [{ packagingId, delivered }], paid, method }`.
  - `deliverOrder(state, form)`.
  - `components/delivery-form.tsx` y `OrderSummary` ampliado.
  - Página `/pedidos/[id]/entregar`.

## Reutilizar
- El patrón de `receiveGoods`: lock de producto `FOR UPDATE` ordenado por id, `toBaseUnits` y `formatQty`.
- `PaymentForm` / `METHODS` del spec 009 (los medios se mueven a `accounts/schemas.ts`), `solesSchema`, `formatSoles`, `todayInLima`, `requireUser` y `audit`.
- `warehouseStockByProduct` para mostrar el stock.

## Tareas
- [ ] T1 — Esquema y migración · `src/server/db/schema.ts`, `drizzle/*`
- [ ] T2 — FEFO puro, con tests · `src/modules/inventory/fefo.ts`, `fefo.test.ts`
- [ ] T3 — `dispatchStock` y kardex con ventas · `src/modules/inventory/dispatch.ts`, `queries.ts`, `components/movement-list.tsx`, `index.ts`
- [ ] T4 — Cargo, abono y saldo en transacción · `src/modules/accounts/ledger.ts`, `actions.ts`, `index.ts`, `components/account-view.tsx`
- [ ] T5 — `deliverOrder` · `src/modules/orders/schemas.ts`, `actions.ts`
- [ ] T6 — Pantalla de entrega · `src/modules/orders/components/delivery-form.tsx`, `src/app/(app)/pedidos/[id]/entregar/page.tsx`, `index.ts`
- [ ] T7 — Pedido entregado en solo lectura, lista con estados y botón Entregar · `components/order-list.tsx`, `order-form.tsx`, `queries.ts`, `src/app/(app)/pedidos/[id]/page.tsx`

## Paralelismo
Grupo 0: T1. Luego en paralelo T2 → T3 (inventario) y T4 (cuentas). Después T5 → T6 → T7.

## Notas
- Las ubicaciones VEHICULO no se tocan: esta entrega sale del almacén.
- Se entrega al precio guardado en el pedido (el de la última edición), no al precio del día.
- ponytail: sin devoluciones. Si se entregó de más, se ajusta la cuenta y se ingresa el stock como saldo inicial. Las devoluciones van en un spec aparte si hacen falta.
