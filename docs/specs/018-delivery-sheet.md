---
id: 018
title: Hoja de ruta y picking
status: done
module: delivery (nuevo) + orders
---

# 018 — Hoja de ruta y picking

## Objetivo
El dueño arma la hoja de ruta de una ruta y fecha con un vehículo, y obtiene la lista de picking por piso con el lote FEFO a sacar, para cargar el carro sin papel.

## Alcance
Incluye: tabla `hojas_ruta` (solo se usa `PREPARANDO`); crear, agregar/quitar pedidos y eliminar la hoja; lista `/reparto` por fecha; detalle `/reparto/[id]` con pedidos en orden de visita, picking imprimible y por WhatsApp, peso vs capacidad; pestaña "Reparto" en Ventas.
No incluye: mover stock (carga del vehículo = spec siguiente), `EN_RUTA`/`LIQUIDADA`, repartidores en la hoja, lotes alternativos, reservar stock entre hojas, offline.

## Criterios de aceptación
- [ ] AC1 — Solo el dueño: `requireUser("DUENO")` en las 2 páginas y las 4 acciones. El repartidor no ve la pestaña.
- [ ] AC2 — Crear: ruta + fecha (≥ hoy, Lima) + vehículo (`ubicaciones` tipo `VEHICULO`, activo). En una transacción se crea la hoja y se le asignan los pedidos `PENDIENTE` con esa `fecha_entrega`, de clientes de esa ruta y sin hoja. Puede quedar vacía. Redirige al detalle.
- [ ] AC3 — Un pedido está en máximo una hoja (`pedidos.hoja_ruta_id`). Dos hojas de la misma ruta y fecha (dos vehículos) no comparten pedidos: la asignación filtra `hoja_ruta_id IS NULL`.
- [ ] AC4 — Detalle: pedidos `PENDIENTE` de la hoja ordenados por `orden_en_ruta` y número (cliente, #, líneas, total) con "Quitar"; debajo, "Pedidos sin hoja" (misma ruta y fecha, pendientes, sin hoja) con "Agregar". Solo si la hoja está `PREPARANDO`; si no, error sin escribir.
- [ ] AC5 — Picking: suma por producto (cantidad × factor) de los pedidos pendientes de la hoja, aplica `fefoPick` sobre el stock de pisos `ALMACEN`, y agrupa por piso → producto, con "vence dd/mm/aaaa" o "sin fecha" y la cantidad en presentaciones (`formatQty`). Un solo lote sugerido por tramo, sin alternativas.
- [ ] AC6 — Stock insuficiente: se sugiere lo que hay y el producto sale en "Falta" con la cantidad faltante (aviso, no bloquea).
- [ ] AC7 — Peso = Σ cantidad × `peso_gramos` de las líneas; "N líneas sin peso" si faltan. Si el vehículo tiene `capacidad_kg` se muestra peso / capacidad y un chip ámbar al pasarla (solo aviso).
- [ ] AC8 — "Imprimir / PDF" y "Enviar por WhatsApp" (`wa.me/?text=` con hoja, ruta, fecha, vehículo y el picking por piso). Al imprimir solo queda encabezado + picking.
- [ ] AC9 — "Eliminar hoja" (confirmación) en `PREPARANDO`: libera todos sus pedidos (`hoja_ruta_id = null`) y borra la hoja en la misma transacción.
- [ ] AC10 — Editar un pedido y cambiarle la fecha lo saca de su hoja. Anulado o entregado desde la oficina sigue enlazado pero no cuenta (todo filtra `PENDIENTE`).
- [ ] AC11 — Auditoría en la misma tx, `entity: "delivery_sheet"`: `sheet.create` `{ routeId, date, vehicleId, orderIds }`, `sheet.add_order` / `sheet.remove_order` `{ orderId }`, `sheet.delete` `{ orderIds }`.
- [ ] AC12 — `/reparto?fecha=` filtra por fecha (defecto `defaultOrderDate()`); estado vacío si no hay hojas. Id no uuid o inexistente → `notFound()`.

## Datos
Migración aditiva con `npm run db:generate` (solo `CREATE TYPE`, `CREATE TABLE`, `ADD COLUMN`, `ADD CONSTRAINT`, `CREATE INDEX`):
| Tabla · columna (TS) | tipo | constraint |
|---|---|---|
| enum `estado_hoja_ruta` (`sheetStatusEnum`) | `PREPARANDO`, `EN_RUTA`, `LIQUIDADA` | — |
| `hojas_ruta` (`deliverySheets`) · `id` | uuid | PK `id()` |
| · `numero` (`number`) | serial | unique |
| · `fecha` (`date`) | date (string) | NOT NULL, index |
| · `ruta_id` (`routeId`) / `vehiculo_id` (`vehicleId`) / `usuario_id` (`userId`) | uuid | NOT NULL, FK `rutas` / `ubicaciones` / `usuarios` |
| · `estado` (`status`) | enum | NOT NULL default `PREPARANDO` |
| · `creado_en` | timestamptz | `createdAt()` |
| `pedidos.hoja_ruta_id` (`sheetId`) | uuid | NULL, FK `hojas_ruta`, index |

## Contratos
`src/modules/delivery/picking.ts` (puro): `buildPicking(lines: { productId; productName; quantity; factor; weightGrams: number | null }[], lots: (StockLot & { productId })[])` → `{ floors: { locationId; locationName; items: { productId; productName; expiresOn; baseQty }[] }[]; short: { productId; productName; missing }[]; weight: { grams; noWeight } }`. Pisos por nombre, productos por nombre.
`schemas.ts`: `createSheetSchema { routeId: z.uuid(), date: z.iso.date(), vehicleId: z.uuid() }`, `sheetOrderSchema { sheetId, orderId }`, `sheetIdSchema`.
`actions.ts` — `(_: FormState, form: FormData) => Promise<FormState>`, DUENO, `db.transaction` + `audit`; las de una hoja existente la leen `FOR UPDATE` y exigen `PREPARANDO`:
- `createSheet` → redirect `/reparto/{id}` · `addSheetOrder` / `removeSheetOrder` (`UPDATE … RETURNING`; 0 filas → error) → `revalidatePath` · `deleteSheet` → redirect `/reparto?fecha=`.
`queries.ts`: `listSheets(date)` (ruta, vehículo, nº pedidos, total) · `getSheet(id)` (cabecera + `capacityKg`, pedidos, candidatos) · `getPicking(sheetId)` (líneas + `warehouseLots` + presentaciones por producto → `buildPicking`).
`src/modules/inventory/queries.ts`: `warehouseLots(productIds)` → `(StockLot & { productId })[]`, pisos `ALMACEN`, cantidad > 0.

## Reutilizar
Verificado con Grep:
- `src/modules/inventory/fefo.ts` — `fefoPick`, `StockLot` (exportar en el index); `todayInLima`.
- `src/lib/quantity.ts` — `formatQty`. `src/lib/weight.ts` — `formatKg`. `src/lib/date.ts` — `formatDate`. `src/lib/money.ts` — `formatSoles`.
- `src/modules/purchases/purchase-math.ts` — `lineWeight` (sube a `src/lib/weight.ts`: ahora lo usan 2 módulos).
- `src/modules/accounts/components/statement-share.tsx` — es genérico (`waHref` + `window.print()`): sube a `src/components/ui/share-buttons.tsx` como `ShareButtons`.
- `src/modules/purchases` — `listVehicles` (con `capacityKg`). `src/modules/customers` — `listRoutes`. `src/modules/orders` — `defaultOrderDate`.
- `src/components/ui/` — `Stat`, `EmptyState`, `BackLink`, `Avatar`/`IconTile`; clases `.tarjeta`, `.lista`, `.fila`, `.chip`, `.filtros`, `.grupos`.
- `src/server/db` — `db`, `audit`, `Tx`; `src/lib/form-state.ts` — `FormState`.

Nuevo: módulo `src/modules/delivery` (fase 4: hoja, entregas en ruta, liquidación). No existe nada de hojas.

## Tareas
- [x] T1 — `sheetStatusEnum`, `deliverySheets`, `orders.sheetId` + índices; `npm run db:generate` y revisar el SQL (solo aditivo) · `src/server/db/schema.ts`, `drizzle/0012_*.sql`, `drizzle/meta/*`
- [x] T2 — Subir `lineWeight` a `lib/weight.ts` (+ casos en el test) y `StatementShare` → `ShareButtons`; actualizar imports y borrar el archivo viejo · `src/lib/weight.ts`, `src/lib/weight.test.ts`, `src/modules/purchases/purchase-math.ts`, `src/modules/purchases/components/purchase-form.tsx`, `src/components/ui/share-buttons.tsx`, `src/modules/accounts/components/statement-share.tsx`, `src/modules/accounts/components/statement-view.tsx`
- [x] T3 — `warehouseLots`; exportar `fefoPick`, `StockLot`, `warehouseLots` · `src/modules/inventory/queries.ts`, `src/modules/inventory/index.ts`
- [x] T4 — `buildPicking` + test: mismo producto en varios pedidos y presentaciones se suma; parte en 2 lotes por vencimiento; sin fecha al final; empate por nombre de piso; stock corto → parcial + `missing`; sin stock → todo falta; peso con `noWeight`; sin líneas · `src/modules/delivery/picking.ts`, `picking.test.ts`
- [x] T5 — Schemas + 4 acciones; `saveOrder` pone `sheetId: null` si cambia `deliveryOn` · `src/modules/delivery/schemas.ts`, `actions.ts`, `src/modules/orders/actions.ts`
- [x] T6 — `listSheets`, `getSheet`, `getPicking`; index con queries · `src/modules/delivery/queries.ts`, `index.ts`
- [x] T7 — `SheetList` (+ filtro GET de fecha), `SheetForm` (cliente), `SheetOrders` (cliente: quitar/agregar/eliminar), `PickingList` (servidor, `print:table`, `ShareButtons`, peso/capacidad); exports · `src/modules/delivery/components/sheet-list.tsx`, `sheet-form.tsx`, `sheet-orders.tsx`, `picking-list.tsx`, `src/modules/delivery/index.ts`
- [x] T8 — Páginas y pestaña "Reparto" (ownerOnly, ícono camión) en Ventas · `src/app/(app)/reparto/page.tsx`, `src/app/(app)/reparto/[id]/page.tsx`, `src/components/app-nav.tsx`

## Paralelismo
Paralelo: [T1] [T2] [T3]. Luego [T4] (usa T2, T3) y [T5] (usa T1). Luego T6 → T7 → T8 (T7 toca `delivery/index.ts` después de T6).

## Notas
- ponytail: el picking lee el stock actual sin descontar otras hojas del mismo día; dos hojas pueden sugerir el mismo lote. El control real es la transferencia al vehículo (spec siguiente).
- La spec siguiente (carga) debe bloquear editar, anular y entregar desde oficina los pedidos de una hoja `EN_RUTA`.

## Plan E2E (BD única de producción: solo filas `__prueba__`, sin SQL destructivo fuera de ellas)
1. Por la app: ruta `__prueba__ ruta`, clientes C1 (orden 1) y C2 (orden 2), producto `__prueba__ P` (unidad ×1, caja ×12, caja 5 kg), dos ingresos en Piso 1 y Piso 2 con vencimientos distintos, vehículo con capacidad 10 kg. Pedidos de C2 y C1 para mañana. Anotar ids.
2. Crear hoja → C1 antes que C2; picking toma primero el lote que vence antes; peso > 10 kg → chip ámbar.
3. Pedido > stock → sale en "Falta". Nuevo pedido de C1 → aparece en "sin hoja" → Agregar. Quitar → vuelve a candidatos. Segunda hoja misma ruta/fecha → vacía.
4. Cambiar la fecha de un pedido → sale de la hoja. Imprimir: solo encabezado + picking. WhatsApp con el texto.
5. Eliminar hoja → pedidos sin hoja. Repartidor → redirigido; acciones rechazadas.
6. Limpieza por ids: `auditoria`, `pedidos.hoja_ruta_id = null`, `hojas_ruta`, `pedido_items`, `pedidos`, `movimientos_stock`, `stock`, `lotes`, `recepcion_items`, `recepciones`, `presentaciones`, `productos`, `clientes`, `rutas`. Sin `TRUNCATE`/`DROP` ni `DELETE` sin `WHERE id IN (…)`.

## Preguntas
1. Cancelar hoja: ¿borrarla (recomendado: en `PREPARANDO` no movió nada) o un estado `ANULADA` para el historial?
2. Cambiar la fecha de un pedido con hoja: ¿lo saca de la hoja (recomendado) o bloquea el cambio?
3. ¿Agregar acceso "Armar hoja de ruta" al "+" rápido? Recomendado: no por ahora; basta la pestaña.

**Decisiones (aprobadas 19-nov-2026):** 1 = borrar la hoja; 2 = cambiar la fecha la saca de la hoja; 3 = no va en el "+".
