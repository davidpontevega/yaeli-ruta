---
id: 006
title: Proveedores, movimientos por producto (kardex) y precio sugerido
status: draft
module: inventory + catalog
---

# 006 — Proveedores, kardex y precio sugerido

## Objetivo
1. **Proveedores:** saber a quién se le compró cada cosa, cuánto y cuándo.
2. **Kardex:** ver el historial de entradas de cada producto con su saldo.
3. **Precio sugerido:** cuando sube el costo, el sistema propone el nuevo precio de venta con el margen del producto. Solo el dueño lo aplica.

## Alcance
Incluye:
- Tabla de proveedores, que se crea sola al recibir (sin formulario aparte).
- Pantalla `/proveedores` con lo comprado a cada uno y su teléfono.
- Pantalla de movimientos por producto.
- Pantalla `/precios` con los precios por debajo del sugerido, para aplicar con un toque.
- Enviar a `/precios` después de un ingreso que deja precios bajos.

No incluye:
- Alias de lectura por proveedor.
- RUC leído de la factura.
- Pedidos a proveedores ni cuentas por pagar.
- Salidas en el kardex (llegan con ventas y ajustes).
- Redondeos configurables.

## Criterios de aceptación
- [ ] AC1 — Al guardar una COMPRA con proveedor escrito, se busca sin distinguir mayúsculas ni espacios extra y, si no existe, se crea. La recepción guarda `proveedor_id`.
  - El campo "Proveedor" sugiere los existentes mientras escribes (`datalist`).
  - La migración pasa los textos de las compras existentes a la tabla.
- [ ] AC2 — `/proveedores` (dueño) lista cada proveedor con: N° de compras, total comprado, fecha de la última compra y teléfono editable.
  - Ordenado por última compra.
  - Se llega desde un link en Catálogo.
- [ ] AC3 — `/productos/[id]/movimientos` (dueño) muestra los últimos 100 movimientos del producto, del más nuevo al más viejo, con estos datos:
  - Fecha y hora de Lima.
  - Tipo ("Compra" o "Saldo inicial") con el proveedor y el N° de documento.
  - Piso y vencimiento del lote.
  - Cantidad ("+2 caja") y costo por unidad base.
  - **Saldo** después del movimiento.

  Se llega desde Stock (link "Movimientos" en el detalle, solo dueño) y desde Productos.
- [ ] AC4 — Precio sugerido por presentación = costo × factor × (1 + margen %), **redondeado hacia arriba a 10 céntimos**.
  - El costo es el último costo; si es 0, el costo promedio; si los dos son 0, no hay sugerencia.
  - Es lógica pura, con tests.
- [ ] AC5 — `/precios` (dueño) lista las presentaciones de productos activos cuyo precio actual está por debajo del sugerido. Por cada una muestra:
  - Costo, precio actual, sugerido y margen real % (en rojo si es menor al objetivo).
  - Un check, marcado por defecto.

  "Aplicar precios" actualiza los marcados en una transacción con auditoría `price.update` (antes y después), y la lista se vuelve a calcular. Sin nada por revisar: "Todos los precios cubren su margen".
- [ ] AC6 — Si un ingreso deja al menos una presentación de esos productos por debajo del sugerido, al guardar va a `/precios?recepcion=1`, con el aviso "Subió el costo de X productos". Si no, va a `/stock` como antes.
- [ ] AC7 — Inicio suma una 4.ª tarjeta, "precios por revisar", con su conteo, que lleva a `/precios`. El repartidor no ve `/proveedores`, `/precios` ni movimientos con costo: lo redirige `requireUser("DUENO")`.

## Datos (migración nueva)
- `proveedores`: id, `nombre` text unique, `telefono` text null, `creado_en`. Clave TS `suppliers`.
- `recepciones.proveedor_id` uuid null, FK a `proveedores`. Se mantiene `proveedor` (texto) por historia.
- Migración de datos: insertar el `proveedor` distinto de las COMPRA existentes y llenar `proveedor_id`.

## Contratos
- Catálogo, `pricing.ts` (puro):
  - `suggestedPrice(unitCost, factor, marginPct)` → céntimos | null.
  - `realMarginPct(price, unitCost, factor)` → entero | null.
  - `priceUnitCost(lastCost, averageCost)`.
- Catálogo, consultas y acción:
  - `listPriceReview()` → `[{ packagingId, productName, packagingName, factor, cost, price, suggested, marginPct, targetPct }]`.
  - `countPriceReview()`.
  - `applyPrices(form)`: rol DUENO, ids marcados, tx + auditoría.
- Inventario:
  - `listSuppliers()` y `listSupplierStats()`.
  - `updateSupplierPhone(state, form)`.
  - `listMovements(productId)` → filas con saldo acumulado.
  - `receiveGoods` resuelve el proveedor y decide la redirección.

## Reutilizar
- `requireUser`, `audit`, `isUniqueViolation`, `formatSoles`, `formatQty`, `formatDate`, `toSolesInput`.
- `HomeAlerts` (se agrega una tarjeta), `ReceiptForm` (`datalist` en el proveedor), `StockList` (link), `ProductList` (link).
- El patrón de lista y tarjeta de `catalog-summary.tsx` y el de formulario corto de `add-name-form.tsx`.

## Tareas
- [ ] T1 — Esquema y migración con datos; link "Proveedores" en Catálogo · `src/server/db/schema.ts`, `drizzle/*`, `src/modules/catalog/components/catalog-summary.tsx`
- [ ] T2 — Precio sugerido puro, con tests · `src/modules/catalog/pricing.ts`, `pricing.test.ts`
- [ ] T3 — Proveedor en la recepción: buscar o crear, `datalist` · `src/modules/inventory/actions.ts`, `queries.ts`, `components/receipt-form.tsx`, `src/app/(app)/recepciones/nueva/page.tsx`
- [ ] T4 — Pantalla de proveedores · `src/modules/inventory/components/supplier-list.tsx`, `src/app/(app)/proveedores/page.tsx`, `actions.ts` (`updateSupplierPhone`)
- [ ] T5 — Kardex · `src/modules/inventory/queries.ts` (`listMovements`), `components/movement-list.tsx`, `src/app/(app)/productos/[id]/movimientos/page.tsx`, links en `stock-list.tsx` y `product-list.tsx`
- [ ] T6 — Revisión de precios · `src/modules/catalog/queries.ts`, `actions.ts` (`applyPrices`), `components/price-review.tsx`, `src/app/(app)/precios/page.tsx`, `index.ts`
- [ ] T7 — Redirección tras el ingreso y 4.ª alerta en Inicio · `src/modules/inventory/actions.ts`, `components/home-alerts.tsx`, `src/app/(app)/page.tsx`

## Paralelismo
- Grupo 0: T1.
- Luego en paralelo, sin archivos compartidos: [T2 → T6] en catálogo y [T3 → T4 → T5] en inventario.
- Al final: T7, porque toca `actions.ts` de inventario y usa `countPriceReview` de T6.

## Notas
- **A confirmar con el dueño:**
  - Se sugiere con el **último costo**, no con el promedio, porque el precio sigue al proveedor.
  - Solo se marcan los precios **por debajo** del sugerido; bajar precios lo decide él a mano.
  - El redondeo es hacia arriba a S/ 0.10.
- `/precios` no tiene link en la cabecera (ya tiene 7). Se llega por la alerta de Inicio y por la redirección.
- La migración de datos usa SQL a mano dentro del archivo generado: solo `INSERT … SELECT DISTINCT` y `UPDATE`, sin borrar nada.
