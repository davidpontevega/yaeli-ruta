---
id: 002
title: Stock por lote y recepción de mercadería
status: draft
module: inventory
---

# 002 — Stock por lote y recepción de mercadería

## Objetivo
El dueño registra la mercadería que llega (o el saldo inicial) con fecha de vencimiento y piso,
y cualquiera ve cuánto stock hay de cada producto, dónde y en qué lotes.

## Alcance
Incluye: lotes, saldo por lote y ubicación, movimientos (kardex en BD), recepción "Compra" y "Saldo inicial",
costo promedio ponderado y último costo, vista de stock.
No incluye: proveedores como tabla (texto libre por ahora), pantalla de kardex, precio sugerido (spec 004),
tablero de vencimientos y stock demo (spec 003), salidas y ajustes.

## Criterios de aceptación
- [ ] AC1 — Dado un dueño, cuando registra una recepción con "Chocman: 2 cajas (×96) a S/ 60.00, vence 2027-03-31, Piso 2",
  entonces el stock de Chocman sube 192 unidades en Piso 2 en un lote con esa fecha.
- [ ] AC2 — Cada línea genera un movimiento `INGRESO` (o `SALDO_INICIAL`) con cantidad en unidad base y costo por unidad base.
- [ ] AC3 — El costo promedio del producto se recalcula ponderado con el stock previo; el último costo queda guardado.
- [ ] AC4 — Misma fecha de vencimiento y producto → se suma al lote existente; otra fecha → lote nuevo. Sin vencimiento → lote sin fecha.
- [ ] AC5 — `/stock` muestra por producto: total en la presentación mayor + resto ("2 cajas + 5 unidad"), y al expandir, lotes por ubicación
  con vencimiento. El valor (S/) solo lo ve el dueño.
- [ ] AC6 — Recepción, saldo, movimientos, costo y auditoría ocurren en una sola transacción; si una línea falla, no se guarda nada.
- [ ] AC7 — Un repartidor no puede abrir `/recepciones/nueva` ni ejecutar la action.

## Datos (migración nueva)
- enum `tipo_movimiento`: `INGRESO`, `SALDO_INICIAL`. enum `tipo_recepcion`: `COMPRA`, `SALDO_INICIAL`.
- `lotes`: id, producto_id FK, vence_el date null, creado_en.
- `stock`: ubicacion_id FK, lote_id FK, cantidad int `CHECK (cantidad >= 0)`, PK (ubicacion_id, lote_id).
- `movimientos_stock`: id, tipo, lote_id FK, ubicacion_id FK, cantidad int (±), costo_unitario int, documento_id uuid, usuario_id FK, creado_en.
  Índice (lote_id, creado_en).
- `recepciones`: id, tipo, proveedor text null, documento text null, total int, usuario_id FK, creado_en.
- `recepcion_items`: id, recepcion_id FK, presentacion_id FK, lote_id FK, ubicacion_id FK, cantidad int (en presentaciones), costo int (por presentación).
TS keys en inglés (`lots`, `stockLevels`, `stockMovements`, `receipts`, `receiptItems`).

## Contratos
- `receiveGoods(state, form)` — rol DUENO; `receiptSchema`: `{ type, supplier?, document?, items: [{ packagingId, quantity ≥1, unitCost (soles), expiresOn?: YYYY-MM-DD, locationId }] ≥1 }`.
  Éxito → redirect `/stock`.
- `listStock({ q })` — productos activos con total base, presentaciones y lotes `{ location, expiresOn, quantity }`; costo solo si se pide para dueño.
- Lógica pura `stock-math.ts`: `toBaseUnits(qty, factor)`, `weightedAverageCost(stockQty, avgCost, inQty, inUnitCost)`,
  `splitByPackaging(baseQty, packagings)` → `[{ name, count }]`.

## Reutilizar
- `requireUser`, `audit`, `db.transaction`, `isUniqueViolation` — `src/server/`.
- `parseSoles`, `formatSoles` — `src/lib/money.ts`. `FormState` — `src/lib/form-state.ts`.
- `listProducts` (con presentaciones) — `@/modules/catalog` para elegir producto en el formulario.
- Clases `.tarjeta`, `.campo`, `.btn-*`; patrón de lista/expandir de `modules/catalog/components/product-list.tsx`.

## Tareas
- [ ] T1 — Esquema + migración + links "Stock" y "Recibir" en la cabecera · `src/server/db/schema.ts`, `drizzle/*`, `src/components/app-header.tsx`
- [ ] T2 — Lógica pura + tests · `src/modules/inventory/stock-math.ts`, `stock-math.test.ts`
- [ ] T3 — Schema Zod + action `receiveGoods` · `src/modules/inventory/schemas.ts`, `actions.ts`
- [ ] T4 — Consultas `listStock`, `listLocations` · `src/modules/inventory/queries.ts`
- [ ] T5 — Formulario de recepción · `src/modules/inventory/components/receipt-form.tsx`, `src/app/(app)/recepciones/nueva/page.tsx`
- [ ] T6 — Vista de stock · `src/modules/inventory/components/stock-list.tsx`, `src/app/(app)/stock/page.tsx`, `src/modules/inventory/index.ts`

## Paralelismo
Grupo 0: T1 · Paralelo: [T2→T3] [T4→T6] · Al final: T5 (usa T3 y T4).

## Notas
- Saldo con `INSERT … ON CONFLICT (ubicacion_id, lote_id) DO UPDATE SET cantidad = stock.cantidad + excluded.cantidad`.
- Costo promedio usa el stock total del producto leído dentro de la misma tx (`FOR UPDATE` sobre el producto) para no pisarse con otra recepción.
- El formulario recibe los productos activos completos y filtra en el cliente (catálogo chico). ponytail: paginar si pasa de ~1000.
