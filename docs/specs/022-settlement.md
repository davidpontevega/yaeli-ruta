---
id: 022
title: Liquidación de la hoja de ruta
status: done
module: delivery + orders + accounts
---

# 022 — Liquidación de la hoja de ruta

## Objetivo
Al volver el vehículo, el dueño cierra una hoja `EN_RUTA`: lo no entregado queda pendiente y sin hoja, el sobrante vuelve a su piso de origen, se registra el efectivo esperado vs. entregado y la hoja queda `LIQUIDADA` con el vehículo libre.

## Alcance
Incluye: panel "Liquidación" en `/reparto/[id]` (`EN_RUTA`) con pedidos pendientes → "Entregar" (página existente) y aviso de los que quedarán no entregados; efectivo esperado (cobros `EFECTIVO` de la hoja) vs. declarado; acción `settleSheet`; resumen de solo lectura en `LIQUIDADA`; enlazar cobros de entregas en ruta a la hoja.
No incluye: offline/PWA, venta en ruta, nota de entrega en imagen, motivo de no entrega, repartidor en la hoja, entrega masiva "todo completo", reabrir una hoja `LIQUIDADA`, cobros hechos desde Cuentas durante la ruta (no cuentan como de la hoja).

## Criterios de aceptación
- [ ] AC1 — `requireUser("DUENO")` en `settleSheet`; el panel solo existe en `/reparto/[id]` (ya DUENO). Sin costos ni márgenes en el panel.
- [ ] AC2 — `deliverOrder` de un pedido en hoja `EN_RUTA` guarda `hoja_ruta_id` en su `ABONO` y redirige a `/reparto/{hojaId}` (sin hoja o `PREPARANDO`: igual que hoy).
- [ ] AC3 — Panel `EN_RUTA`: pedidos `PENDIENTE` de la hoja con "Entregar" (`/pedidos/[id]/entregar`); entregados (cliente, #, total); vendido = Σ `CARGO` de esos pedidos; cobrado por medio (Σ `ABONO` con `hoja_ruta_id`); esperado = cobrado `EFECTIVO`; input "Efectivo entregado (S/)"; diferencia en vivo (verde 0, ámbar ≠ 0); sobrante del vehículo por producto en presentaciones (`formatQty`).
- [ ] AC4 — Liquidar (confirmación "N pedidos quedan como no entregados") en una tx: bloquea hoja (`EN_RUTA`) → pedidos `PENDIENTE` de la hoja (`FOR UPDATE`, orden id) → productos de los lotes cargados (orden id). Esos pedidos: `hoja_ruta_id = null`, siguen `PENDIENTE`.
- [ ] AC5 — Sobrante: con el neto `TRASLADO` de la hoja por (lote, piso) y el stock actual del vehículo por lote, `returnPlan` devuelve a cada piso de origen `min(resto, neto)`; `moveStock` vehículo → piso con `costo_promedio` y `documento_id = hoja`. `false` → "El stock cambió; recarga la página". Lo que no salió de esta hoja queda en el vehículo.
- [ ] AC6 — Guarda `efectivo_esperado` (recalculado en la tx, nunca del formulario), `efectivo_entregado`, `liquidada_en = now()`; hoja → `LIQUIDADA`. La diferencia no bloquea. El vehículo puede cargar otra hoja (el chequeo de `loadVehicle` solo mira `EN_RUTA`).
- [ ] AC7 — Auditoría `entity: "delivery_sheet"`, `sheet.settle` `{ expected, declared, difference, undeliveredOrderIds, returned: [{ lotId, locationId, quantity }] }`.
- [ ] AC8 — `LIQUIDADA`: el detalle muestra el resumen (entregados, cobrado por medio, esperado/entregado/diferencia, fecha) en lugar de picking y acciones. Cualquier acción sobre la hoja → error sin escribir.
- [ ] AC9 — Kardex: el retorno se ve como "Traslado · Hoja #N"; `stock` = Σ movimientos sigue cuadrando.

## Datos
Migración aditiva (`npm run db:generate`; revisar que solo tenga `ADD COLUMN`, `ADD CONSTRAINT` FK, `CREATE INDEX`):
| Tabla · columna (TS) | tipo | constraint |
|---|---|---|
| `hojas_ruta.efectivo_esperado` (`expectedCash`) | integer (céntimos) | NULL |
| `hojas_ruta.efectivo_entregado` (`declaredCash`) | integer (céntimos) | NULL |
| `hojas_ruta.liquidada_en` (`settledAt`) | timestamptz | NULL |
| `movimientos_cuenta.hoja_ruta_id` (`sheetId`) | uuid | NULL, FK `hojas_ruta`, index |

## Contratos
`src/modules/delivery/settlement.ts` (puro): `returnPlan(vehicle: { lotId; quantity }[], origins: { lotId; locationId; quantity }[])` → `{ lotId; locationId; quantity }[]` (por lote, orígenes en orden de `locationId`; omite 0).
`src/modules/delivery/queries.ts`:
- `sheetOrigins(sheetId, q: Tx | typeof db = db)` → neto `TRASLADO` < 0 por (lote, piso) con `productId` (se saca de `unloadVehicle`, que pasa a usarla).
- `getSettlement(sheetId)` → `{ delivered: { id; number; customerName; total }[]; byMethod: { method; amount }[]; expected (calculado ahora); leftovers: { productId; productName; baseQty }[]; packagings; expectedCash; declaredCash; settledAt }` (los 3 últimos: guardados, solo `LIQUIDADA`).
`src/modules/delivery/schemas.ts`: `settleSchema = sheetIdSchema.extend({ declared: solesSchema })`.
`src/modules/delivery/actions.ts`: `settleSheet(_: FormState, form: FormData)` → `revalidatePath` `/reparto/{id}`, `/reparto`, `/stock`, `/pedidos`.
`src/modules/accounts/ledger.ts`: `addPayment(tx, { …, sheetId?: string })`.

## Reutilizar
Verificado con Grep:
- `src/modules/delivery/actions.ts` — `lockSheet(tx, id, "EN_RUTA")`, `lockProducts`, `run`, `SheetError`, `revalidateLoad`; neto `TRASLADO` de `unloadVehicle` (se mueve a `sheetOrigins`).
- `src/modules/inventory/dispatch.ts` — `moveStock`; `src/modules/inventory` — `locationLots`.
- `src/modules/orders/actions.ts` — `deliverOrder` (+ `sheetOf`) tal cual para marcar entregado; `src/app/(app)/pedidos/[id]/entregar/page.tsx` ya descuenta del vehículo.
- `src/modules/accounts/ledger.ts` — `addPayment`. `src/lib/money-schema.ts` — `solesSchema`; `src/lib/money.ts` — `formatSoles`, `parseSoles`; `src/lib/quantity.ts` — `formatQty`; `src/lib/payment.ts` — etiquetas de medio.
- `src/components/ui/` — `Stat`, `EmptyState`; clases `.tarjeta`, `.lista`, `.fila`, `.chip`. Patrón de confirmación de `components/load-actions.tsx`.
Nuevo: `returnPlan` (no hay reparto de sobrante por origen) y `settlement-panel.tsx`.

## Tareas
- [x] T1 — Columnas de `hojas_ruta` y `movimientos_cuenta.sheetId` + índice; `db:generate` y revisar SQL · `src/server/db/schema.ts`, `drizzle/0016_*.sql`, `drizzle/meta/*`
- [x] T2 — `returnPlan` + test: 1 origen; lote de 2 pisos con resto parcial (llena en orden de `locationId`); resto > neto (exceso queda); lote sin origen; resto 0; vacío · `src/modules/delivery/settlement.ts`, `settlement.test.ts`
- [x] T3 — `addPayment` con `sheetId`; `deliverOrder` lo pasa y redirige a la hoja si `EN_RUTA` (AC2) · `src/modules/accounts/ledger.ts`, `src/modules/orders/actions.ts`
- [x] T4 — `sheetOrigins`, `getSettlement`; exports · `src/modules/delivery/queries.ts`, `src/modules/delivery/index.ts`
- [x] T5 — `settleSchema`, `settleSheet` (AC4–AC7); `unloadVehicle` usa `sheetOrigins` · `src/modules/delivery/schemas.ts`, `src/modules/delivery/actions.ts`
- [x] T6 — `SettlementPanel` (cliente: lista, efectivo, diferencia en vivo, confirmar; modo resumen en `LIQUIDADA`); la página lo compone y oculta picking/`LoadActions` en `LIQUIDADA` · `src/modules/delivery/components/settlement-panel.tsx`, `src/modules/delivery/index.ts`, `src/app/(app)/reparto/[id]/page.tsx`

## Paralelismo
T1 → Paralelo: [T2] [T3] [T4] → T5 → T6 (T6 toca `index.ts` después de T4).

## Notas
- Bloqueos: liquidar = hoja → pedidos → productos; `deliverOrder` = pedido → productos, lee la hoja sin bloquear. Si gana la liquidación, la entrega ve el pedido sin hoja y descuenta del almacén (el sobrante ya volvió). Sin ciclo.
- El stock del vehículo se lee después de bloquear los productos (si no, una entrega concurrente lo cambia).
- Pedidos no entregados conservan su `fecha_entrega` pasada: para replanificar se edita la fecha (`saveOrder` exige ≥ hoy) y entra como candidato de otra hoja.
- Cobros en ruta hechos antes de esta migración no tienen `hoja_ruta_id`: el esperado sale 0 para esas hojas (en producción no debería haber).

## Plan E2E (BD de producción: solo filas `__prueba__`)
1. Preparar como 021: hoja con 3 pedidos, cargar. Entregar #1 completo pagando efectivo, #2 parcial con Yape (vuelve a la hoja).
2. Panel: esperado = efectivo de #1; declarar −S/ 1 → diferencia ámbar. Liquidar → #3 `PENDIENTE` sin hoja; sobrante vuelve a su piso (2 `TRASLADO` por tramo); `LIQUIDADA`; resumen.
3. Cargar otra hoja con el mismo vehículo → permitido. Acciones sobre la liquidada → error.
4. Limpieza por ids como 021 (+ `movimientos_cuenta` de los pedidos de prueba).

## Preguntas
1. Marcar entregado en la liquidación: ¿enlace a la página "Entregar" existente, que vuelve a la hoja (recomendado: reutiliza `deliverOrder` sin cambios de lógica, cubre parcial y cobro) o un botón masivo "entregar completo" por fila (exige extraer `deliverOrder` a una función `deliverInTx` y pedir cobro por fila)?
2. Guardar la liquidación: ¿columnas en `hojas_ruta` (recomendado: es 1:1, sin JOIN) o tabla `liquidaciones` como en PLAN.md?
3. Stock del vehículo que no salió de esta hoja (p. ej. compra recibida en el vehículo): ¿se queda en el vehículo (recomendado: solo se devuelve lo trazable a un piso) o se pide un piso destino y se vacía el vehículo?

**Decisiones (aprobadas 21-nov-2026):** 1 = enlace a "Entregar" que vuelve a la hoja; 2 = columnas en `hojas_ruta`; 3 = stock ajeno a la hoja se queda en el vehículo.
