---
id: 015
title: Sugerencia de compra
status: done
module: inventory + purchases
---

# 015 — Sugerencia de compra

## Objetivo
El dueño ve cuánto vende por semana cada producto y cuántos días le alcanza el stock, y la lista de compra se llena con lo necesario para cubrir N días, no solo el mínimo.

## Alcance
Incluye: venta de los últimos 28 días (movimientos `VENTA`), cobertura en días, aviso "poca cobertura" en Stock bajo, cantidad sugerida en "Armar lista", "Agregar lo que falta de este proveedor" y "Agregar a la lista".
No incluye: pestaña "Sugerido" aparte (se usa Stock bajo); días de pedido por proveedor; contar la poca cobertura en Inicio (`getAlertCounts` sigue igual); tendencia o estacionalidad.

## Criterios de aceptación
- [x] AC1 — Venta del producto = `-SUM(movimientos_stock.cantidad)` de tipo `VENTA` de sus lotes con `creado_en` en los últimos 28 días. Hoy solo los crea `dispatchStock` (entrega desde la oficina, 010).
- [x] AC2 — `venta/semana = round(venta × 7 / 28)`. `días que alcanza = floor(total × 28 / venta)`; sin venta → sin dato (no se marca). `total` = el mismo de `listStock` (todas las ubicaciones).
- [x] AC3 — Poca cobertura: hay venta y `días que alcanza < 7`.
- [x] AC4 — En `/stock?falta=1`, solo para el dueño, salen los productos bajo mínimo, agotados **o** con poca cobertura. Cada fila muestra los chips "venta/sem X" y "alcanza N días" (ámbar si es poca cobertura). "Armar lista" y "Agregar a la lista" también salen en los de poca cobertura.
- [x] AC5 — El repartidor ve `/stock` y Stock bajo como hoy: sin venta, sin cobertura, sin poca cobertura y sin costos.
- [x] AC6 — Cantidad sugerida, en la presentación más grande: `missingToOrder(total, max(minStock, objetivo), factor)` con `objetivo = ceil(venta × 14 / 28)` (stock para 14 días). Sin venta se comporta igual que hoy (mínimo; agotado sin mínimo → 1).
- [x] AC7 — `listMissingBySupplier` usa la cantidad sugerida, así que "Armar lista" (`/compras/nueva?proveedor=`) y "Agregar lo que falta de este proveedor" traen esa cantidad, e incluyen los productos de poca cobertura.
- [x] AC8 — `addToPurchaseList` agrega `max(1, cantidad sugerida)`. Resto del comportamiento de 014 sin cambios.

## Datos
Sin cambios de esquema. La consulta filtra por `tipo` y `creado_en` sobre `movimientos_stock` (índice existente `movimientos_lote_idx (lote_id, creado_en)`).

## Contratos
- `recentSales(): Promise<Record<productId, number>>` en `src/modules/inventory/queries.ts`: unidades base vendidas en `SALES_WINDOW_DAYS`. Solo lectura, sin rol (la llaman páginas y acciones que ya hicieron `requireUser`).
- `listStock(f)` recibe `withSales?: boolean` (por defecto `false`). Con `true` cada item suma `weeklySales: number | null`, `coverageDays: number | null`, `target: number` (unidades base para 14 días; 0 sin venta) y `lowCoverage: boolean`; `onlyMissing` incluye `lowCoverage`. Con `false` esos campos van `null`/0/`false` y nada cambia.
- `addToPurchaseList`: antes de la transacción llama `recentSales()` (como `defaultCosts()`), y calcula `targetStock(sold)`. Rol y salida sin cambios.

## Reutilizar
Verificado con Grep:
- `src/modules/purchases/purchase-math.ts` — `missingToOrder`, `biggestPackaging` (sin cambios: el objetivo entra como `max(minStock, target)`).
- `src/modules/purchases/queries.ts` — `listMissingBySupplier` (ya alimenta `/compras/nueva` y `[id]` vía prop `missing`; `purchase-form.tsx` no cambia).
- `src/modules/purchases/actions.ts` — `addToPurchaseList` (línea con `missingToOrder`).
- `src/modules/inventory/queries.ts` — `listStock`; `src/modules/inventory/dispatch.ts` — origen de los `VENTA`.
- `src/lib/quantity.ts` — `formatQty`, `stockStatus`.
- `src/modules/inventory/components/stock-list.tsx` — `onlyMissing`, `canBuy`, `buyButton`, chips existentes.

Nuevo: `src/modules/inventory/coverage.ts` (puro): `SALES_WINDOW_DAYS = 28`, `LOW_COVERAGE_DAYS = 7`, `TARGET_COVERAGE_DAYS = 14`, `weeklySales(sold)`, `coverageDays(total, sold)`, `targetStock(sold)`, `isLowCoverage(total, sold)`. Vive en inventory porque `listStock` lo usa y purchases ya depende de inventory (al revés sería un ciclo).

## Tareas
- [x] T1 — `coverage.ts` y test: sin venta → `null`/0/`false`; venta 35 y total 5 → 9/sem, 4 días, objetivo 18, poca cobertura; total 0 con venta → 0 días; límite exacto 7 días → no es poca · `src/modules/inventory/coverage.ts`, `coverage.test.ts`
- [x] T2 — `recentSales` y `withSales` en `listStock`; exportar `recentSales`, `targetStock` en el index · `src/modules/inventory/queries.ts`, `src/modules/inventory/index.ts`
- [x] T3 — `listMissingBySupplier` con `withSales: true` y `max(p.minStock, p.target)` · `src/modules/purchases/queries.ts`
- [x] T4 — `addToPurchaseList` con la cantidad sugerida (AC8) · `src/modules/purchases/actions.ts`
- [x] T5 — `StockList`: chips "venta/sem" y "alcanza N días" (si `weeklySales !== null`); `lowCoverage` cuenta para "Armar lista", `buyButton` y el orden (poca cobertura después de agotados/bajos). La página pasa `withSales: isOwner` y ajusta el subtítulo ("…o que alcanzan menos de 7 días") · `src/modules/inventory/components/stock-list.tsx`, `src/app/(app)/stock/page.tsx`

## Paralelismo
Secuencial: T1 → T2. Después, en paralelo: [T3] [T4] [T5].

## Notas
- Producto con menos de 28 días de historia: la venta promedio sale baja (divide entre 4 semanas). Aceptado; se corrige solo con el tiempo.
- ponytail: `recentSales()` lee todos los productos aunque la acción use uno. Filtrar por `productId` si se vuelve lento.
- Fase 4: la venta en ruta también grabará `VENTA` (desde el vehículo); la consulta no filtra por ubicación, así que la cuenta sin cambios.

## Plan E2E (BD única de producción: solo filas `__prueba__`, limpieza por id, sin SQL destructivo fuera de ellas)
1. Crear proveedor `__prueba__ prov`, cliente `__prueba__ cli` (en una ruta existente o `__prueba__ ruta`) y tres productos de `prov`, sin mínimo, con `unidad ×1` y `caja ×12`. Recibir 40 u de `A`, 100 u de `B`, 30 u de `C`.
2. Pedidos de `cli` entregados desde la oficina (010): 35 u de `A`, 7 u de `B`, 10 u de `C`. Al movimiento `VENTA` de `C` (por su id) ponerle `creado_en = now() - 40 días`.
3. Dueño, `/stock?falta=1`: `A` sale con "venta/sem 9" y "alcanza 4 días" en ámbar; `B` (372 días) y `C` (sin venta en la ventana) no salen.
4. "Armar lista" de `prov` → `A` con 2 cajas (objetivo 18 − 5 = 13 u). En un borrador, "Agregar lo que falta de este proveedor" → igual.
5. Borrar esa línea en la lista, "Agregar a la lista" en `A` → 2 cajas.
6. Repartidor, `/stock?falta=1`: `A` no sale (status OK) y no hay chips de venta ni cobertura.
7. Limpieza filtrando por los ids creados: `compra_items`, `compras`, `movimientos_cuenta`, `pedido_items`, `pedidos`, `movimientos_stock`, `stock`, `lotes`, `recepcion_items`, `recepciones`, `auditoria` de esas entidades, presentaciones, productos, cliente, ruta (si se creó) y proveedor `__prueba__`.

## Preguntas abiertas
1. Umbral de poca cobertura: **recomendado 7 días fijos** (no hay calendario de compras por proveedor en la BD; agregarlo sería migración). ¿O por proveedor?
2. Objetivo de la sugerencia: **recomendado 14 días** de cobertura. ¿Otro N?
3. Ventana de la venta promedio: **recomendado 28 días** (4 semanas). ¿O 8 semanas para suavizar?

> Aprobado por el humano (2026-11-17): todas las decisiones abiertas con la opción recomendada.
