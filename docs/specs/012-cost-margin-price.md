---
id: 012
title: Costo, % de ganancia y precio al registrar el producto
status: draft
module: catalog
---

# 012 — Costo · % · Precio en el formulario del producto

## Objetivo
Al registrar o editar un producto, el dueño escribe lo que le costó y cuánto quiere ganar, y el precio de venta sale solo.
Ejemplo: detergente Ace, bolsa a S/ 10.00 con 20% → precio S/ 12.00. Así no calcula a mano y no vende bajo costo.

## Alcance
Incluye:
- "% de ganancia" visible en el formulario: un % por producto, el mismo `margen_pct` de hoy.
- Por presentación: Costo S/ y Precio S/. El precio se calcula con costo × (1 + %), redondeado hacia arriba a S/ 0.10.
- Se puede cambiar el precio a mano. Entonces se muestra lo que realmente se gana ("ganas 18%").
- El costo escrito se guarda como último costo del producto, el mismo que usa `/precios`.

No incluye:
- Un % distinto por presentación (se decidió uno por producto).
- El flete dentro del costo (spec 013, al recibir).
- Cambiar el costo promedio: solo cambia con los ingresos.

## Criterios de aceptación
- [ ] AC1 — El campo "% de ganancia" sale de "Más opciones" y queda visible arriba, junto al proveedor. Por defecto es 15 en un producto nuevo y lo que tenga en uno existente.
- [ ] AC2 — Cada presentación (unidad y cajas) tiene "Costo S/" (opcional) y "Precio S/":
  - Al escribir o cambiar el costo o el %, el precio se recalcula: `suggestedPrice(costo, 1, %)` (10 + 20% = 12.00; 0.83 + 15% = 0.96 → 1.00).
  - Si el dueño cambia el precio a mano, se queda así hasta que vuelva a cambiar el costo o el %.
- [ ] AC3 — Debajo de cada presentación con costo y precio se ve "ganas X%" (`realMarginPct`). Si es menor que el % elegido, sale en ámbar. Si el precio es menor que el costo, sale en rojo "vendes bajo costo".
- [ ] AC4 — Al guardar, si alguna presentación tiene costo, el producto guarda `ultimo_costo` = costo ÷ factor de la presentación más chica que tenga costo, redondeado al céntimo.
  - Se audita en `product.update` / `product.create` con `{ lastCost }`.
  - Sin costo, `ultimo_costo` no cambia.
- [ ] AC5 — Al editar, cada presentación viene con su costo: el de su último ingreso (`getLastCosts`). Si no tiene ingresos, último costo × factor. Si tampoco hay, queda vacío.
- [ ] AC6 — Lógica pura con tests: `priceFromCost(cost, pct)` y `baseUnitCost(packagings)`, la presentación más chica con costo → costo por unidad base.

## Datos
Sin migración. Se usan `productos.margen_pct` y `productos.ultimo_costo`.

## Contratos
- `catalog/pricing.ts`: `priceFromCost(cost, marginPct)` → céntimos (reutiliza `suggestedPrice`) y `baseUnitCost([{ factor, cost | null }])` → céntimos | null.
- `productSchema.packagings[].cost`: "" → null; si no, `solesSchema`.
- `saveProduct` guarda `lastCost` si hay costo.
- `ProductForm` y `ProductDraft.packagings[].cost`.
- Página de editar: costos iniciales con `getLastCosts` (inventario) y `lastCost`.

## Reutilizar
- `suggestedPrice` y `realMarginPct` (`pricing.ts`, spec 006), `parseSoles`, `formatSoles`, `toSolesInput`, `solesSchema`.
- `getLastCosts` (inventario, costo del último ingreso por presentación).

## Tareas
- [ ] T1 — Funciones puras con tests · `src/modules/catalog/pricing.ts`, `pricing.test.ts`
- [ ] T2 — Costo en el esquema y en `saveProduct` · `src/modules/catalog/schemas.ts`, `actions.ts`
- [ ] T3 — Formulario: % visible y Costo / Precio / "ganas X%" por presentación · `src/modules/catalog/components/product-form.tsx`
- [ ] T4 — Costos iniciales en editar y nuevo · `src/app/(app)/productos/[id]/page.tsx`, `productos/nuevo/page.tsx`

## Paralelismo
T1 y T2 en paralelo. Después T3 y luego T4.

## Notas
- Fórmula: ganancia sobre el costo (10 → 12 es 20%), la misma de `/precios`.
- El costo es por presentación porque la caja suele costar menos por unidad que la unidad suelta. Por eso el último costo se toma de la presentación más chica con costo.
