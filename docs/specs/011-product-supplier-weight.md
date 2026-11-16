---
id: 011
title: Proveedor y peso por producto; productos y stock por proveedor
status: draft
module: catalog + inventory
---

# 011 — Proveedor y peso por producto

## Objetivo
El dueño piensa por proveedor: "de ALICORP necesito esto, de MOLITALIA tengo esto". Cada producto queda con su proveedor principal
y con el estado de su stock, para ver de un vistazo qué falta de cada proveedor. Además se guarda el peso de cada presentación,
que necesita la lista de compra (spec 013) para calcular la carga del camión.

## Alcance
Incluye:
- Proveedor principal por producto: se llena solo con la última compra y se puede cambiar.
- Peso por presentación, en kg (opcional).
- Filtro por proveedor en Productos y Stock.
- Stock agrupado por proveedor con estado (OK / bajo el mínimo / agotado), y un filtro "Solo lo que falta".

No incluye:
- Varios proveedores por producto.
- Lista de compra ni "Armar pedido a este proveedor" (spec 013).
- Sugerencia de cantidades (spec 014).

## Criterios de aceptación
- [ ] AC1 — Formulario de producto: campo "Proveedor" (select con los proveedores existentes, opcional) y, por presentación, "Peso kg" (opcional, hasta 3 decimales, de 0 a 1000).
  - El producto guarda `proveedor_id`. La presentación guarda el peso en gramos enteros (12.5 kg → 12500).
- [ ] AC2 — La migración llena `proveedor_id` de cada producto con el proveedor de su última COMPRA.
  - Al guardar una compra, cada producto del ingreso **sin proveedor** toma el de la compra. Si ya tiene, no se cambia.
- [ ] AC3 — Productos: filtro "Todos los proveedores / X / Sin proveedor" y el nombre del proveedor en cada producto.
- [ ] AC4 — Stock: el mismo filtro de proveedor, más la casilla "Solo lo que falta".
  - La lista sale agrupada por proveedor (alfabético, "Sin proveedor" al final). Cada grupo dice cuántos productos tiene bajos o agotados.
- [ ] AC5 — Estado por producto en Stock, con lógica pura y tests:
  - "Agotado" (rojo) si el total es 0.
  - "Bajo" (ámbar) si el total es menor que el stock mínimo.
  - "OK" si no.
  - Si está bajo, se muestra cuánto falta para llegar al mínimo, en presentaciones ("faltan 2 caja + 3 und").
- [ ] AC6 — En `/proveedores`, el nombre de cada proveedor lleva a `/stock?proveedor=<id>`.
  - El repartidor ve la agrupación y el estado en Stock, pero no costos (como hoy).

## Datos (migración nueva)
- `productos.proveedor_id` uuid null, FK a `proveedores`.
- `presentaciones.peso_gramos` integer null, CHECK > 0.
- Migración de datos: `UPDATE productos SET proveedor_id = (proveedor de la última recepción COMPRA con ese producto)`, solo donde hay compra.

## Contratos
- `src/lib/quantity.ts`: `stockStatus(total, minStock)` → `"out" | "low" | "ok"`, con tests.
- `src/lib/weight.ts`: `parseKg("12.5")` → 12500 | null y `formatKg(12500)` → "12.5 kg", con tests.
- Catálogo:
  - `listCatalogOptions` suma `suppliers`.
  - `listProducts({ …, supplierId })` acepta `""`, un id o `"none"`, y devuelve `supplierName`.
  - `productSchema` suma `supplierId` y `packagings[].weightKg`. `saveProduct` los guarda.
  - `ProductFilters` suma el select de proveedor.
- Inventario: `listStock({ …, supplierId, onlyMissing })` devuelve `supplierName`, `minStock` y `status`. `receiveGoods` completa el proveedor faltante.

## Reutilizar
- `listProducts`, `ProductFilters`, `ProductForm` y `StockList` (se amplían, no se duplican). `formatQty` y `splitByPackaging` para "faltan …".
- La consulta de alertas de `getAlertCounts` (bajo el mínimo) como referencia del mismo criterio.
- Patrón de migración con SQL a mano del spec 006 (backfill de proveedores).

## Tareas
- [ ] T1 — Esquema y migración con backfill · `src/server/db/schema.ts`, `drizzle/*`
- [ ] T2 — Estado y peso puros, con tests · `src/lib/quantity.ts`, `quantity.test.ts`, `src/lib/weight.ts`, `weight.test.ts`
- [ ] T3 — Formulario de producto: proveedor y peso · `src/modules/catalog/schemas.ts`, `actions.ts`, `queries.ts`, `components/product-form.tsx`, `src/app/(app)/productos/nuevo/page.tsx`, `productos/[id]/page.tsx`
- [ ] T4 — Filtro de proveedor en Productos · `src/modules/catalog/components/product-filters.tsx`, `product-list.tsx`, `src/app/(app)/productos/page.tsx`
- [ ] T5 — La compra completa el proveedor del producto · `src/modules/inventory/actions.ts`
- [ ] T6 — Stock por proveedor con estado y "Solo lo que falta" · `src/modules/inventory/queries.ts`, `components/stock-list.tsx`, `src/app/(app)/stock/page.tsx`
- [ ] T7 — Link desde Proveedores · `src/modules/inventory/components/supplier-list.tsx`

## Paralelismo
Grupo 0: T1. Luego en paralelo T2 y T5. Después T3 → T4 (catálogo) y T6 → T7 (inventario), y estos dos en paralelo.

## Notas
- Decisiones del dueño (16-nov-2026): un proveedor principal por producto; peso para la carga del camión; flete a mano y aparte (spec 013); un % de ganancia por producto (spec 012).
- El stock mínimo se sigue guardando en unidades base, como hoy.
- ponytail: la agrupación se hace en memoria sobre el resultado de `listStock` (máximo 200 productos, el límite de `listProducts`).
