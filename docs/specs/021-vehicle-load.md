---
id: 021
title: Cargar vehículo
status: done
module: delivery + inventory + orders
---

# 021 — Cargar vehículo

## Objetivo
El dueño confirma la carga de una hoja `PREPARANDO`: el stock pasa de los pisos al vehículo según el picking FEFO, con kardex y auditoría en la misma transacción, y la hoja queda `EN_RUTA`.

## Alcance
Incluye: acción "Cargar vehículo" y "Devolver al almacén" (deshacer antes de entregar); tipo de movimiento `TRASLADO`; vista "Carga del vehículo" en el detalle `EN_RUTA`; bloquear editar/anular pedidos de una hoja `EN_RUTA`; la entrega desde oficina de esos pedidos descuenta del vehículo.
No incluye: editar cantidades de la carga, carga extra para venta en ruta, liquidación (`LIQUIDADA`, retorno de sobrantes, efectivo), PWA/offline, repartidor en la hoja, asignar a una hoja `EN_RUTA` pedidos nuevos.

## Criterios de aceptación
- [ ] AC1 — Solo el dueño: `requireUser("DUENO")` en `loadVehicle` y `unloadVehicle`. Los botones solo salen en `/reparto/[id]` (ya DUENO).
- [ ] AC2 — Cargar exige: hoja `PREPARANDO`, ≥ 1 pedido `PENDIENTE`, vehículo activo y sin otra hoja `EN_RUTA`. Si no, error sin escribir.
- [ ] AC3 — En una tx: bloquea la hoja, sus pedidos pendientes (`FOR UPDATE`) y sus productos en orden de id; recalcula `buildPicking` con `warehouseLots(ids, tx)` (no usa cantidades del formulario) y por cada tramo lote/piso mueve la cantidad: piso −q, vehículo +q (upsert), dos movimientos `TRASLADO` (−q en el piso, +q en el vehículo) con `costo_unitario = costo_promedio` y `documento_id = hoja`. Hoja → `EN_RUTA`.
- [ ] AC4 — Stock corto: carga lo que hay y no bloquea; el diálogo de confirmación avisa "N productos con faltante". Sin nada que cargar (todo falta) también se permite.
- [ ] AC5 — Auditoría `entity: "delivery_sheet"`: `sheet.load` `{ vehicleId, lines, short: [{ productId, missing }] }`, `sheet.unload` `{ vehicleId, lines }`.
- [ ] AC6 — `EN_RUTA`: agregar/quitar/eliminar ya fallan (`lockSheet`). `saveOrder` y `cancelOrder` de un pedido en hoja `EN_RUTA` → "El pedido está en ruta (hoja #N)". El detalle `/pedidos/[id]` muestra el resumen (sin formulario) con chip "En ruta · Hoja #N" y enlace a Entregar.
- [ ] AC7 — `deliverOrder` de un pedido en hoja `EN_RUTA` descuenta `VENTA` del vehículo (FEFO dentro del vehículo); `/pedidos/[id]/entregar` muestra como disponible el stock del vehículo. Sin hoja o hoja `PREPARANDO`: almacén, como hoy.
- [ ] AC8 — Detalle `EN_RUTA`: en lugar del picking, "Carga del vehículo" = `buildPicking` sobre los lotes del vehículo (producto → vence, en presentaciones), con "Falta" y peso/capacidad. Sin costos. Imprimir/WhatsApp igual que el picking.
- [ ] AC9 — "Devolver al almacén" (confirmación) en `EN_RUTA`: por cada (lote, piso) con neto `TRASLADO` de la hoja < 0, devuelve ese neto: vehículo −q (`WHERE cantidad >= q`, 0 filas → "Ya salió mercadería del vehículo; se resuelve en la liquidación"), piso +q, dos `TRASLADO`. Hoja → `PREPARANDO`. Usa el neto, así cargar/devolver varias veces cuadra.
- [ ] AC10 — Kardex: `TRASLADO` se lee "Traslado" y el documento "Hoja #N". El saldo por producto no cambia con un traslado; `stock` = Σ movimientos por ubicación sigue cuadrando. `/stock` ya muestra los lotes del vehículo con su nombre.

## Datos
Migración aditiva (`npm run db:generate`; revisar que solo tenga `ALTER TYPE … ADD VALUE`):
| Tabla · columna | tipo | cambio |
|---|---|---|
| enum `tipo_movimiento` (`movementTypeEnum`) | enum | + `TRASLADO` |

## Contratos
`src/modules/inventory/dispatch.ts`:
- `moveStock(tx, { lotId, fromId, toId, quantity, unitCost, documentId, userId })` → `boolean` (false si `from` no tiene `quantity`; no escribe nada en ese caso).
- `dispatchStock(tx, { …, fromId?: string })` — con `fromId` lee solo esa ubicación en vez de los pisos `ALMACEN`.
`src/modules/inventory/queries.ts`: `warehouseLots(ids, q: Tx | typeof db = db)`; `locationLots(locationId)` → `(StockLot & { productId })[]`; `warehouseStockByProduct()` → `stockByProduct(locationId?)` (sin argumento = pisos `ALMACEN`).
`src/modules/delivery/actions.ts` — `(_: FormState, form: FormData)`, DUENO, `sheetIdSchema`, `run()` + `SheetError`: `loadVehicle`, `unloadVehicle` → `revalidatePath("/reparto/{id}")`, `/reparto`, `/stock`.
`src/modules/delivery/queries.ts`: `getPicking(sheetId)` usa `locationLots(vehicleId)` si la hoja está `EN_RUTA`; devuelve también `status`.
`src/modules/orders/queries.ts`: `getOrder` agrega `sheet: { number; status; vehicleId } | null` (left join).

## Reutilizar
Verificado con Grep:
- `src/modules/delivery/picking.ts` — `buildPicking` (carga = mismo cálculo que se mostró); se agrega `lotId` a `PickingItem`.
- `src/modules/delivery/actions.ts` — `lockSheet`, `run`, `SheetError`; `schemas.ts` — `sheetIdSchema`.
- `src/modules/inventory/dispatch.ts` — `dispatchStock` (orden de bloqueo por producto); `src/lib/fefo.ts` — `fefoPick`, `StockLot`.
- `src/modules/inventory/actions.ts:149` — patrón upsert de `stockLevels` (`onConflictDoUpdate`).
- `src/modules/inventory/queries.ts` — `listMovements` (agregar `'Hoja #' || numero` al `coalesce` de documento); `components/movement-list.tsx` — mapa de tipos.
- `src/modules/delivery/components/picking-list.tsx` — se reusa para la carga (título según estado). `src/components/ui/share-buttons.tsx`.
- `src/server/db` — `db`, `audit`, `Tx`.
Nuevo: `moveStock` (no existe traslado entre ubicaciones) y `load-actions.tsx` (botones con confirmación).

## Tareas
- [x] T1 — `TRASLADO` en `movementTypeEnum`; `db:generate` y revisar SQL · `src/server/db/schema.ts`, `drizzle/0015_*.sql`, `drizzle/meta/*`
- [x] T2 — `lotId` en `PickingItem` + aserciones de `lotId` en los casos existentes y un caso "mismo lote en 2 pisos = 2 ítems" · `src/modules/delivery/picking.ts`, `picking.test.ts`
- [x] T3 — `moveStock`, `fromId` en `dispatchStock`, `warehouseLots(ids, q)`, `locationLots`, `stockByProduct` (actualizar su único llamador), kardex `TRASLADO`/"Hoja #N"; exports · `src/modules/inventory/dispatch.ts`, `queries.ts`, `index.ts`, `components/movement-list.tsx`, `src/app/(app)/pedidos/[id]/entregar/page.tsx`
- [x] T4 — `loadVehicle` y `unloadVehicle` (AC2–AC5, AC9) · `src/modules/delivery/actions.ts`
- [x] T5 — `getPicking` por estado (AC8) · `src/modules/delivery/queries.ts`
- [x] T6 — `getOrder` con hoja; `saveOrder`/`cancelOrder` rechazan `EN_RUTA`; `deliverOrder` con `fromId = vehicleId` si `EN_RUTA`; detalle y entregar con chip y stock del vehículo · `src/modules/orders/queries.ts`, `actions.ts`, `src/app/(app)/pedidos/[id]/page.tsx`, `src/app/(app)/pedidos/[id]/entregar/page.tsx`
- [x] T7 — `LoadActions` (cliente: "Cargar vehículo" con aviso de faltantes / "Devolver al almacén"); `PickingList` titula "Picking" o "Carga del vehículo"; página la compone · `src/modules/delivery/components/load-actions.tsx`, `components/picking-list.tsx`, `index.ts`, `src/app/(app)/reparto/[id]/page.tsx`

## Paralelismo
T1 → Paralelo: [T2] [T3] → Paralelo: [T4] [T5] [T6] → T7. (T3 y T6 comparten `entregar/page.tsx`: T6 va después.)

## Notas
- Bloqueos: `loadVehicle` toma hoja → pedidos → productos; `deliverOrder`/`saveOrder`/`cancelOrder` toman el pedido y luego leen la hoja sin bloquearla. Si la carga gana, la entrega espera y ve `EN_RUTA` (descuenta del vehículo); si gana la entrega, la carga relee el pedido `ENTREGADO` y lo excluye. Sin ciclo → sin deadlock.
- ponytail: una hoja `EN_RUTA` por vehículo y sin liquidación el vehículo queda ocupado tras la primera entrega desde él. La spec 022 (liquidación sin offline: sobrantes al almacén, pedidos no entregados a `PENDIENTE`) debe salir antes de usar esto en producción.
- Neon: `ADD VALUE` no puede usarse en la misma transacción de la migración; no insertar datos en ella.

## Plan E2E (BD de producción: solo filas `__prueba__`)
1. Preparar como 018 (2 pisos, 2 vencimientos, vehículo). Hoja con 2 pedidos, uno con faltante.
2. Cargar → `stock` del piso baja, del vehículo sube; 2 `TRASLADO` por tramo; `EN_RUTA`; "Falta" visible. Segunda hoja del mismo vehículo → no carga.
3. Editar/anular pedido → error. Entregar desde oficina → `VENTA` en el vehículo. Devolver al almacén → error.
4. Otra hoja: cargar, devolver → stock vuelve al piso original, `PREPARANDO`; cargar de nuevo cuadra.
5. Limpieza por ids como en 018 (+ `movimientos_stock` de la hoja).

## Preguntas
1. ¿Editar cantidades al cargar? Recomendado: no; se carga exactamente el picking recalculado. Para cambiarlo se edita/quita el pedido antes de cargar.
2. ¿Incluir "Devolver al almacén"? Recomendado: sí, solo mientras el vehículo conserve toda la carga (corrige un error de vehículo o de carga sin esperar la liquidación).
3. Entrega desde oficina de un pedido `EN_RUTA`: ¿descontar del vehículo (recomendado: es el puente hasta el offline) o bloquearla?

**Decisiones (aprobadas 20-nov-2026):** 1 = no se editan cantidades; 2 = sí "Devolver al almacén" mientras el carro esté completo; 3 = entrega desde oficina descuenta del vehículo.
