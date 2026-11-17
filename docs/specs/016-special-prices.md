---
id: 016
title: Precios especiales por cliente
status: approved
module: customers + orders
---

# 016 — Precios especiales

## Objetivo
El dueño define un precio especial por cliente y presentación, y el pedido por teléfono lo cobra en lugar del precio general.

## Alcance
Incluye: la sección "Precios especiales" en `/clientes/{id}` (ver, agregar o cambiar, quitar); su uso en `OrderForm` y `saveOrder`; el chip "precio especial".
No incluye: precios por ruta o por grupo de clientes; descuentos en %; recalcular los pedidos pendientes que ya existen; el chip en `OrderSummary` o en la entrega (la línea no guarda de dónde salió el precio, ver P3).

## Criterios de aceptación
- [ ] AC1 — Solo el dueño ve y cambia los precios especiales: la página y las dos acciones usan `requireUser("DUENO")`.
- [ ] AC2 — En `/clientes/{id}` se listan los precios especiales del cliente: producto · presentación · general (tachado) → especial · "Quitar". Si no hay, sale un estado vacío.
- [ ] AC3 — Para agregar: buscar el producto (`ProductPicker`) → elegir la presentación → escribir el precio en soles → Guardar. Si esa presentación ya tenía precio especial, se reemplaza (una sola fila, por el `UNIQUE`).
- [ ] AC4 — Un precio ≤ 0, inválido o mayor que `MAX_PRICE`, o un cliente o presentación que no existe: aviso de error, sin escribir nada.
- [ ] AC5 — En `OrderForm`, la presentación con precio especial usa ese precio en la línea, en el selector, en el chip `c/caja` y en el total. Además muestra el chip "precio especial". Las otras usan el precio general.
- [ ] AC6 — `saveOrder` toma el precio de cada línea con `priceFor` y datos de la BD (`sellablePackagings` + los precios especiales del cliente) dentro de la transacción. El formulario no manda precios, y si llega uno, Zod lo descarta. Al editar, el cliente sale del pedido en la BD (`orders.customerId`) y no del JSON.
- [ ] AC7 — `pedido_items.precio` guarda el precio aplicado, igual que hoy. Quitar o cambiar un precio especial no toca los pedidos ya guardados. Un pedido pendiente toma el precio nuevo solo cuando se vuelve a guardar (eso ya pasa hoy con el precio general).
- [ ] AC8 — Auditoría en la misma transacción, con `entity: "customer"` y `entityId` = cliente:
  - `customer_price.set` con `{ packagingId, price, previous }` (`previous` es `null` si no había precio).
  - `customer_price.delete` con `{ packagingId, price }`.
- [ ] AC9 — Repartidor: hoy no entra a `/pedidos` ni a `/clientes`, así que no cambia nada. Decisión: el precio especial es un precio de venta y no un costo. En la fase 4, el repartidor verá el precio de la línea (sea general o especial) porque cobra. Nunca verá costos ni márgenes.

## Datos
Migración aditiva (solo `CREATE TABLE`), con `npm run db:generate`:
| Tabla `precios_cliente` (`customerPrices`) | tipo | constraint |
|---|---|---|
| `id` | uuid | PK `defaultRandom` (helper `id()`) |
| `cliente_id` (`customerId`) | uuid | NOT NULL, FK `clientes` |
| `presentacion_id` (`packagingId`) | uuid | NOT NULL, FK `presentaciones` |
| `precio` (`price`) | integer (céntimos) | NOT NULL, `CHECK (precio > 0)` |
`UNIQUE precios_cliente_uq (cliente_id, presentacion_id)`. No hace falta otro índice: el unique empieza por `cliente_id`.

## Contratos
`src/modules/orders/order-math.ts` (puro; lo importan el formulario y el servidor):
- `priceFor(p: { id: string; salePrice: number }, special: Record<string, number>): { price: number; special: boolean }`.

`src/modules/customers/queries.ts`:
- `listSpecialPrices(customerId)` → `{ packagingId, productName, packagingName, salePrice, price }[]`, ordenado por producto.
- `specialPriceMap(q: Tx | typeof db, customerId)` → `Record<packagingId, price>`. `saveOrder` lo usa con `tx`, y las páginas de pedido con `db`.

`src/modules/customers/actions.ts`, los dos `(_: FormState, form: FormData) => Promise<FormState>`, con `requireUser("DUENO")` y `db.transaction` + `audit`:
- `saveSpecialPrice`: `specialPriceSchema = { customerId: z.uuid(), packagingId: z.uuid(), price: solesSchema.refine(v => v > 0 && v <= MAX_PRICE) }`. Comprueba que existan el cliente y la presentación, lee el precio anterior y hace `insert … onConflictDoUpdate` sobre el unique.
- `deleteSpecialPrice`: `{ customerId, packagingId }` → `delete … returning`. Si no borró nada, devuelve un error y no audita.
- Las dos llaman a `revalidatePath(`/clientes/${customerId}`)`.

## Reutilizar
Verificado con Grep:
- `src/modules/orders/queries.ts` — `sellablePackagings(tx, ids)` (`FOR SHARE`, solo productos activos).
- `src/modules/orders/order-math.ts` — `orderTotal`, y ahí va `priceFor`.
- `src/modules/orders/actions.ts` — el `FOR UPDATE` de `saveOrder` sobre `orders`: se agrega `customerId` a ese select.
- `src/components/ui/product-picker.tsx` — `ProductPicker`. `src/modules/catalog` — `listProducts` (trae las presentaciones con `salePrice`).
- `src/lib/money-schema.ts` — `solesSchema`. `src/lib/money.ts` — `formatSoles`, `toSolesInput`. `src/lib/form-state.ts` — `FormState`.
- `src/server/db` — `db`, `audit`, `Tx`. `src/server/auth.ts` — `requireUser`.
- `src/components/ui/empty-state.tsx` — estado vacío.

Nuevo: la tabla, `priceFor`, las 2 queries, las 2 acciones y `SpecialPrices` (cliente). No existe nada parecido.
`MAX_PRICE = 100_000_000` (S/ 1 000 000) en `order-math.ts`: evita que la cantidad × precio pase de `MAX_TOTAL`.

## Tareas
- [ ] T1 — Tabla `customerPrices` y migración `npm run db:generate` (revisar que solo tenga `CREATE TABLE` / `ADD CONSTRAINT`) · `src/server/db/schema.ts`, `drizzle/0011_*.sql`, `drizzle/meta/*`
- [ ] T2 — `priceFor` + `MAX_PRICE` y su test:
  - Sin especial → general, `special: false`.
  - Con especial → ese precio, `special: true`.
  - Especial de otra presentación → general.
  - Especial mayor que el general → igual se aplica.

  Archivos: `src/modules/orders/order-math.ts`, `order-math.test.ts`
- [ ] T3 — `listSpecialPrices`, `specialPriceMap`, `specialPriceSchema`, `saveSpecialPrice`, `deleteSpecialPrice`. Exportar las queries · `src/modules/customers/queries.ts`, `schemas.ts`, `actions.ts`, `index.ts`
- [ ] T4 — `saveOrder`:
  - El cliente sale de `cur.customerId` al editar, o de `o.customerId` al crear.
  - Precio: `priceFor(pack, await specialPriceMap(tx, customerId))`.

  Archivos: `src/modules/orders/actions.ts`
- [ ] T5 — `OrderForm`:
  - Recibe `specialPrices: Record<string, number>` y usa `priceFor` en `priced`, el selector, el subtotal y el chip `c/…`.
  - Chip `bg-violet-50 text-violet-800` "precio especial".
  - Las dos páginas pasan `specialPriceMap(db, customer.id)`.

  Archivos: `src/modules/orders/components/order-form.tsx`, `src/app/(app)/pedidos/nuevo/page.tsx`, `src/app/(app)/pedidos/[id]/page.tsx`
- [ ] T6 — `SpecialPrices` (`"use client"`, dos `useActionState`):
  - La lista y el formulario para agregar (picker → `<select>` de presentación → precio).
  - Se exporta en el index.
  - `/clientes/[id]` lo compone debajo de `CustomerForm`, con `listSpecialPrices` y `listProducts`.

  Archivos: `src/modules/customers/components/special-prices.tsx`, `src/modules/customers/index.ts`, `src/app/(app)/clientes/[id]/page.tsx`

## Paralelismo
Secuencial: T1 → T2 → T3. Después, en paralelo: [T4] [T5] [T6]. No comparten archivos: T6 toca `customers/index.ts` después de T3.

## Notas
- `saveOrder` al editar no compara `o.customerId` con el cliente del pedido. Por eso T4 toma el cliente de la BD: si no, alguien podría aplicar los precios especiales de otro cliente.
- ponytail: `specialPriceMap` se lee en la transacción sin `FOR SHARE`. Si el dueño cambia un precio mientras guarda un pedido, el pedido queda con el valor anterior. Con un solo dueño eso no importa; conviene bloquear si un día hay varios dueños.
- orders → customers es una dependencia nueva, y no forma ciclo: customers no importa ningún módulo.

## Plan E2E (BD única de producción: solo filas `__prueba__`, sin SQL destructivo fuera de ellas)
1. Crear por la app la ruta `__prueba__ ruta`, los clientes `__prueba__ C1` y `__prueba__ C2`, y el producto `__prueba__ P` con `unidad ×1` a S/ 1.00 y `caja ×12` a S/ 10.00. Anotar sus ids.
2. En `/clientes/{C1}`: caja a S/ 9.00 → aparece. Luego caja a S/ 8.50 → sigue 1 fila, y la auditoría tiene `previous: 900`. Probar 0 y "abc" → error, sin cambios.
3. Nuevo pedido de C1: caja → S/ 8.50 con el chip; unidad → S/ 1.00 sin chip. Guardar → `pedido_items.precio` queda en 850 y 100, y el total cuadra.
4. Manipular: hacer POST a `saveOrder` con `price: 1` en las líneas → se ignora. Editar el pedido de C1 mandando `customerId` = C2 → los precios siguen siendo los de C1.
5. Pedido de C2: caja a S/ 10.00, sin chip.
6. Quitar el precio especial de C1 → el pedido pendiente sigue en 850. Volver a guardarlo → queda en 1000.
7. Como repartidor: `/clientes/{C1}` redirige, y las dos acciones se rechazan.
8. Limpieza solo con los ids anotados, en este orden: `auditoria` (`entity_id` de los pedidos y clientes `__prueba__`), `pedido_items`, `pedidos`, `precios_cliente`, `presentaciones`, `productos`, `clientes`, `rutas`. Sin `TRUNCATE`, `DROP` ni `DELETE` sin `WHERE id IN (…)`.

## Preguntas abiertas
- P1 — ¿Dónde se gestionan? Recomendado: una sección en `/clientes/{id}` (editar cliente). La alternativa es `/clientes/{id}/cuenta` (la ficha con el saldo).
- P2 — ¿Hay que avisar en la lista de clientes cuáles tienen precios especiales? Recomendado: no por ahora.
- P3 — ¿Mostrar "precio especial" también en pedidos guardados y en la entrega? Haría falta la columna aditiva `pedido_items.precio_especial boolean default false`. Recomendado: no por ahora; si se necesita, se agrega en la fase 4.

> Aprobado por el humano (2026-11-17): todas las decisiones abiertas con la opción recomendada.
