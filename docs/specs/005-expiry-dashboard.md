---
id: 005
title: Tablero de vencimientos, alertas en Inicio y stock de demostración
status: draft
module: inventory
---

# 005 — Tablero de vencimientos, alertas en Inicio y stock demo

## Objetivo
El dueño ve de un vistazo qué se vence (y dónde está) antes de que se pierda, y qué productos están por agotarse,
para no volver a pedir lo que ya tiene. Para la demo, el sistema arranca con stock ficticio que muestra todos los casos.

## Alcance
Incluye: pantalla `/vencimientos` (vencidos, 30, 60, 90 días, filtro por piso), alertas en Inicio (vencidos, por vencer en 30 días,
stock bajo), link en la cabecera, script de stock demo con lotes en todos los rangos.
No incluye: notificaciones push, dar de baja lo vencido (ajustes, spec posterior), FEFO al despachar (fase 3), pantalla de stock bajo propia
(la alerta enlaza a `/stock`).

## Criterios de aceptación
- [ ] AC1 — `/vencimientos` lista los lotes con stock > 0 que vencen en 90 días o menos (incluye vencidos), agrupados en
  "Vencidos", "En 30 días", "En 31–60 días", "En 61–90 días", ordenados por fecha. Cada fila: producto, piso, fecha (dd/mm/aaaa),
  "vence en N días" / "venció hace N días" y cantidad como "2 caja + 5 unidad".
- [ ] AC2 — Filtro por piso (GET `?piso=`); sin filtro, todos. Grupos vacíos no se muestran; sin nada que vencer, mensaje "Nada por vencer en 90 días".
- [ ] AC3 — El dueño ve el valor a costo de cada lote y el total por grupo; el repartidor ve la pantalla sin montos.
- [ ] AC4 — Los días se calculan con la fecha de hoy en Lima (`America/Lima`), no la del servidor (UTC). Vence hoy = 0 días = "En 30 días".
- [ ] AC5 — Inicio muestra 3 tarjetas con conteo: lotes vencidos (rojo), lotes que vencen en 30 días (ámbar), productos con stock bajo
  (total < stock mínimo, solo si el mínimo > 0). Cada una enlaza a su pantalla (`/vencimientos`, `/stock`). En 0, la tarjeta se ve en gris "Todo bien".
- [ ] AC6 — `npm run db:demo-stock` crea un saldo inicial de demostración (recepción con documento `DEMO`) para los productos demo
  repartidos en los 3 pisos: al menos 2 lotes vencidos, 4 en 30 días, 3 en 31–60, 3 en 61–90, el resto con fecha lejana o sin fecha, y
  3 productos bajo su mínimo. Fechas relativas a hoy. Idempotente: si ya existe la recepción `DEMO`, no hace nada.
- [ ] AC7 — El script usa la misma regla de costo (promedio ponderado) y deja movimientos `SALDO_INICIAL` coherentes con el saldo.

## Datos
Sin migración. Lee `lotes`, `stock`, `ubicaciones`, `productos` (`stock_minimo`, `costo_promedio`), `presentaciones`.

## Contratos
- `expiry.ts` (puro): `todayInLima(now?)` → `YYYY-MM-DD`; `daysUntil(expiresOn, today)` → entero; `expiryBucket(days)` →
  `"expired" | "30" | "60" | "90" | null`.
- `listExpiring({ locationId, withCost })` → lotes `{ productName, location, expiresOn, days, bucket, quantity, packagings, value | null }`.
- `getAlertCounts()` → `{ expired, within30, lowStock }`.

## Reutilizar
- `splitByPackaging` (`stock-math.ts`), `formatSoles`, patrón de `StockList`/`ProductFilters` (GET form), `listLocations`.
- `requireUser`, clases `.tarjeta`, `.btn-*`.
- Seed: conexión y estilo de `scripts/seed-demo.ts`; `weightedAverageCost`, `toBaseUnits`.

## Tareas
- [ ] T1 — Link "Vencimientos" en cabecera + script `db:demo-stock` en package.json · `src/components/app-header.tsx`, `package.json`
- [ ] T2 — Lógica pura de fechas + tests · `src/modules/inventory/expiry.ts`, `expiry.test.ts`
- [ ] T3 — Consultas `listExpiring`, `getAlertCounts` · `src/modules/inventory/queries.ts`
- [ ] T4 — Pantalla de vencimientos · `src/modules/inventory/components/expiry-list.tsx`, `src/app/(app)/vencimientos/page.tsx`, `index.ts`
- [ ] T5 — Alertas en Inicio · `src/modules/inventory/components/home-alerts.tsx`, `src/app/(app)/page.tsx`
- [ ] T6 — Stock demo · `scripts/seed-demo-stock.ts`

## Paralelismo
Grupo 0: T1 · Paralelo: [T2→T3→T4→T5] [T6] (T6 importa solo lógica pura de `stock-math.ts`).

## Notas
- Rangos fijos 30/60/90 (lo pidió el plan); configurables solo si el dueño lo pide.
- Limpieza de datos demo antes del uso real: script aparte (spec posterior), identifica por documento `DEMO` y productos del seed.
- ponytail: consultas sin índice por `vence_el`; con pocos miles de lotes basta. Índice si `/vencimientos` pasa de ~200 ms.
