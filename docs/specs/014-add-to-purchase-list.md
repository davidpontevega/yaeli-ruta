---
id: 014
title: Agregar a la lista desde el producto
status: done
module: purchases + catalog + inventory
---

# 014 — Agregar a la lista

## Objetivo
El dueño toca "Agregar a la lista" en un producto bajo o agotado y queda en el borrador de la lista de su proveedor, sin abrir el formulario de compra.

## Alcance
Incluye: el botón en Productos, Stock y Stock bajo (`/productos`, `/stock`, `/stock?falta=1`); la acción del servidor; el aviso con el enlace a la lista.
No incluye: elegir la presentación o la cantidad antes de agregar (se cambian luego en la lista); agregar productos en estado OK; el sugerido por ventas.

## Criterios de aceptación
- [ ] AC1 — Solo el dueño ve el botón, y solo en productos activos en estado Bajo o Agotado (`stockStatus`). El repartidor no lo ve, y si llama la acción, `requireUser("DUENO")` lo rechaza.
- [ ] AC2 — Si el producto no tiene proveedor, en lugar del botón sale el enlace "Asignar proveedor" a `/productos/{id}`.
- [ ] AC3 — Al tocar el botón, la línea va al borrador más reciente de ese proveedor (`compras.estado = BORRADOR`, de cualquier tipo). Si no hay borrador, se crea una lista `ENVIA_PROVEEDOR` con ese proveedor y sin vehículo, igual que desde `/compras/nueva`.
- [ ] AC4 — La línea tiene:
  - Presentación: la más grande del producto.
  - Cantidad: `max(1, missingToOrder(total, minStock, factor))`.
  - Costo: `defaultCosts()[presentación]`.
  - Flete: 0.
- [ ] AC5 — Si alguna presentación del producto ya está en esa lista, no se agrega otra línea y el aviso dice "Ya estaba en la lista #N · PROVEEDOR".
- [ ] AC6 — Dos toques seguidos o dos pestañas a la vez dejan un solo borrador y una sola línea, sin error de base de datos.
- [ ] AC7 — Si sale bien, el aviso en línea dice "Agregado a la lista #N · PROVEEDOR" con el enlace "Abrir lista" a `/compras/{id}`. Se revalidan `/compras`, `/productos` y `/stock`.
- [ ] AC8 — Producto inexistente, inactivo o sin presentaciones: un aviso de error, sin escribir nada.
- [ ] AC9 — Auditoría en la misma transacción: `purchase.create` si se creó la lista, y `purchase.add_item` con `{ productId, packagingId, quantity }`. Si ya estaba, no se audita.
- [ ] AC10 — Protección contra una lista vieja: si `/compras/{id}` se guarda después de que la lista cambió (por "Agregar a la lista" u otra pestaña), `savePurchase` no escribe nada. El formulario muestra «Esta lista cambió en otra pestaña o con «Agregar a la lista». Recarga para ver los cambios.» y un botón "Recargar" (`location.reload()`).

## Datos
Sin cambios de esquema. Ya existen `compra_items_presentacion_uq (compra_id, presentacion_id)`. Esa regla es por presentación y no por producto, por eso la acción también usa un bloqueo (ver Contratos).
`compras` no tiene columna de actualización. La versión de la lista sale de los ids de sus líneas, sin migración: `savePurchase` borra y vuelve a insertar las líneas (ids `defaultRandom` nuevos), y "Agregar" suma una línea. Cualquier cambio da otra versión.

## Contratos
`addToPurchaseList(_: AddToListState, form: FormData): Promise<AddToListState>` en `src/modules/purchases/actions.ts`:
- Rol: `requireUser("DUENO")`. Entrada: `productId = z.uuid()`.
- Salida: `{ ok: true; purchaseId; number; supplierName; already: boolean } | { ok: false; error: string } | undefined` (se exporta el tipo `AddToListState`).
- Antes de la transacción: `defaultCosts()` (lectura).
- Dentro de `db.transaction`:
  1. Carga el producto (activo, `supplierId`, `minStock`) y sus presentaciones. Sin proveedor → error "Asigna un proveedor al producto".
  2. Bloquea el proveedor con `SELECT … FROM proveedores WHERE id = ? FOR UPDATE`. Así quedan en fila todas las altas para ese proveedor: no se crean dos borradores ni dos líneas.
  3. Busca el borrador más nuevo del proveedor (`ORDER BY creado_en DESC LIMIT 1 FOR UPDATE`; este bloqueo también lo usa `savePurchase`). Si no hay, lo crea.
  4. Si ya hay una línea con alguna presentación del producto, sale con `already: true`.
  5. Suma el total del producto desde `stock` (`stockLevels`) unido con `lotes`, con `quantity > 0` y en todas las ubicaciones, igual que `listStock`. Inserta la línea con `.onConflictDoNothing()` como respaldo y audita.

Versión de la lista (AC10):
- `getPurchase` devuelve `version = listVersion(ids de sus líneas)`.
- El formulario la manda en el JSON (`purchaseSchema.version: z.string().max(10_000).optional()`).
- `savePurchase` con `p.id`, después del `FOR UPDATE` que ya hace: lee los ids actuales y, si `listVersion(...) !== p.version`, lanza `PurchaseError(STALE_LIST_ERROR)`. La constante se exporta de `schemas.ts`, y el formulario la compara para mostrar el botón "Recargar".

## Reutilizar
Verificado con Grep:
- `src/modules/purchases/purchase-math.ts` — `missingToOrder`.
- `src/modules/purchases/queries.ts` — `defaultCosts`, y `listMissingBySupplier` (pasa a usar el helper nuevo).
- `src/modules/purchases/actions.ts` — los patrones de `savePurchase`: `PurchaseError`, el bloqueo `.for("update")` y `audit`.
- `src/server/db` — `db`, `audit`. `src/server/auth.ts` — `requireUser`.
- `src/lib/quantity.ts` — `stockStatus` (las listas ya reciben `status`).
- `src/modules/inventory/queries.ts` — `listStock` (ya trae `supplierId` y `status`). Las páginas ya lo usan.

Nuevo:
- `biggestPackaging(packs)` en `purchase-math.ts`. Hoy es un `reduce` dentro de `listMissingBySupplier` y ahora lo usan dos lugares.
- `listVersion(ids)` en `purchase-math.ts`: `[...ids].sort().join(",")`. No depende del orden y no usa `node:crypto`, porque el formulario cliente también importa `purchase-math`.
- `AddToListButton` (cliente). No existe ningún botón de acción por producto con aviso en línea.

## Tareas
- [x] T1 — `biggestPackaging` y `listVersion` puros, con test:
  - `biggestPackaging`: sin presentaciones → `undefined`; empate → la primera.
  - `listVersion`: mismo resultado en otro orden; cambia si se agrega un id.

  `listMissingBySupplier` pasa a usar `biggestPackaging`, y `getPurchase` devuelve `version` · `src/modules/purchases/purchase-math.ts`, `purchase-math.test.ts`, `queries.ts`
- [x] T2 — Acción `addToPurchaseList` y tipo `AddToListState` · `src/modules/purchases/actions.ts`
- [x] T6 — Protección contra una lista vieja:
  - `version` y `STALE_LIST_ERROR` en el schema.
  - La comprobación en `savePurchase`.
  - El formulario manda `initial.version`. Ante `STALE_LIST_ERROR` muestra el aviso y "Recargar".
  - La página pasa `version` en `initial`.

  Archivos: `src/modules/purchases/schemas.ts`, `actions.ts`, `components/purchase-form.tsx`, `src/app/(app)/compras/[id]/page.tsx`
- [x] T3 — `AddToListButton` (`"use client"`, `useActionState`):
  - Props: `productId` y `hasSupplier`. Sin proveedor, muestra el `Link` "Asignar proveedor".
  - Importa `../actions` por ruta relativa, como `purchase-form.tsx`.
  - Aviso en línea; botón deshabilitado mientras `pending`.
  - Se exporta en el index.

  Archivos: `src/modules/purchases/components/add-to-list-button.tsx`, `src/modules/purchases/index.ts`
- [x] T4 — `ProductList` recibe `buyButton?: (p: { id: string; supplierId: string | null }) => ReactNode` y lo muestra en la barra de acciones si `stock[p.id]` es low o out. La página lo pasa solo si `isOwner` · `src/modules/catalog/components/product-list.tsx`, `src/app/(app)/productos/page.tsx`
- [x] T5 — `StockList`: la misma prop. Se muestra en el detalle desplegado de cada producto low u out, en `/stock` y en `/stock?falta=1` · `src/modules/inventory/components/stock-list.tsx`, `src/app/(app)/stock/page.tsx`

## Paralelismo
Secuencial: T1 → T2 → T6 → T3 (T2 y T6 comparten `actions.ts`). Después, en paralelo: [T4] [T5].

## Notas
- La prop `buyButton` es una función que arma la página. Así catalog e inventory no importan `@/modules/purchases`, y no se forma el ciclo purchases → inventory → catalog → purchases. La acción no viaja como prop: el botón vive en purchases y la importa por ruta relativa. Eso cumple la regla "un archivo cliente no importa un index con server-only".
- ponytail: `defaultCosts()` calcula todas las presentaciones para usar una sola. Conviene filtrar por presentación si se vuelve lento.

## Plan E2E (BD única de producción: solo filas `__prueba__`, sin SQL destructivo fuera de ellas)
1. Crear los proveedores `__prueba__ prov` y `__prueba__ prov2`, y cinco productos con presentaciones `unidad ×1` y `caja ×12`:
   - `__prueba__ A`: mínimo 30, sin stock.
   - `__prueba__ B`: sin mínimo y sin stock.
   - `__prueba__ C`: sin proveedor.
   - `__prueba__ D`: de `prov2`, sin stock.
   - `__prueba__ E`: sin stock.
   A, B y E son de `prov`.
2. A → se crea el borrador #N `ENVIA_PROVEEDOR` con 3 cajas y el costo de `defaultCosts`, y el aviso con el enlace. Tocar A otra vez → "Ya estaba", sigue 1 línea.
3. B → 1 caja en el mismo #N. C → se ve "Asignar proveedor".
4. Dos llamadas a la vez (`Promise.all`) con `__prueba__ D` (`prov2` no tiene borrador) → 1 borrador y 1 línea.
5. Como repartidor: no se ve el botón, y la acción redirige.
6. Lista vieja: cargar `/compras/{id}` del borrador #N, agregar `__prueba__ E` con la acción y luego guardar el formulario viejo → aparece el aviso con "Recargar" y las líneas de #N no cambian. Recargar y guardar → se guarda.
7. Revisar la auditoría `purchase.create` / `purchase.add_item`.
8. Limpieza: borrar `compra_items` y `compras` de los dos proveedores, los `auditoria` de esas entidades, las presentaciones, los productos y los proveedores `__prueba__`, filtrando siempre por esos ids.
