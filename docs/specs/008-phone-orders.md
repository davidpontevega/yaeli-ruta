---
id: 008
title: Pedidos por teléfono
status: draft
module: orders (nuevo)
---

# 008 — Pedidos por teléfono

## Objetivo
Cuando un cliente llama, el dueño anota el pedido en el celular en menos de un minuto: busca el cliente, repite su último pedido
o agrega productos, y el sistema pone la fecha de entrega (el próximo día de su ruta) y los precios. Reemplaza el cuaderno de pedidos.

## Alcance
Incluye:
- Crear, editar y anular pedidos mientras estén pendientes (solo el dueño).
- "Repetir último pedido" del cliente.
- Stock disponible por producto, como aviso (no bloquea).
- Lista de pedidos por fecha de entrega y ruta, en orden de visita.

No incluye:
- Entregar el pedido, descontar stock o cargar deuda (spec 010).
- Aviso de límite de crédito (spec 009). Precios especiales (spec 011).
- Hoja de ruta, picking y venta en ruta (fase 4). Nota del pedido en imagen o PDF.

## Criterios de aceptación
- [ ] AC1 — `/pedidos/nuevo` (dueño). El dueño elige el cliente con un buscador por nombre o teléfono, o llega con `?cliente=` desde la lista de clientes (link "Pedido").
  - Al elegirlo se ven su ruta y la fecha de entrega, que por defecto es `nextVisitDate(días de la ruta, hoy en Lima)`. Se puede cambiar, pero no a una fecha pasada.
- [ ] AC2 — Líneas: el buscador de productos agrega el producto con su presentación más grande que tenga precio, y cantidad 1.
  - Por línea se cambian la presentación y la cantidad (1–10000), y se puede quitar.
  - Se ven el precio de la presentación, el subtotal y el total del pedido.
  - El mismo producto y presentación no se repite: se suma a la línea existente.
- [ ] AC3 — "Repetir último pedido" carga las líneas del último pedido no anulado del cliente, con los precios de hoy.
  - Omite las presentaciones de productos inactivos y avisa cuántas omitió.
  - Si el cliente no tiene pedidos, el botón no aparece.
- [ ] AC4 — Disponible por producto = stock en almacenes − lo reservado por pedidos PENDIENTES de otros, en unidades base. Se muestra junto a cada línea en la presentación elegida ("Disp.: 3 caja + 4 und").
  - Si la línea pide más que lo disponible, sale en ámbar "Falta stock". Guardar sigue permitido.
- [ ] AC5 — Al guardar, el servidor recalcula todo: valida cliente activo, presentaciones de productos activos y fecha ≥ hoy.
  - Toma el precio actual de cada presentación (el cliente no manda precios), guarda pedido e ítems con su precio y el total en una transacción, y audita `order.create`.
  - Después va a `/pedidos?fecha=<entrega>`.
- [ ] AC6 — `/pedidos` (dueño). Filtro por fecha de entrega (por defecto, la próxima con pedidos pendientes desde hoy; si no hay, hoy) y por ruta.
  - Agrupa por ruta en orden de visita. Por pedido: N°, cliente, resumen ("3 líneas") y total. Al pie, el total del día.
  - Los anulados se ven tachados con la casilla "Ver anulados".
  - Link "Pedidos" en la cabecera (solo dueño).
- [ ] AC7 — `/pedidos/[id]`: si el pedido está PENDIENTE, abre el mismo formulario para editarlo. Al guardar se reemplazan las líneas y se recalculan precios y total, con auditoría `order.update`.
  - "Anular pedido" pide confirmación, deja el pedido ANULADO y audita `order.cancel`.
  - Un pedido anulado se ve en solo lectura. El repartidor es redirigido por `requireUser("DUENO")`.

## Datos (migración nueva)
- Enum `estado_pedido` (`OrderStatus`): `PENDIENTE`, `ANULADO`. Los specs 010 y 4 agregan valores con `ALTER TYPE … ADD VALUE`.
- `pedidos` (`orders`): id, `numero` serial unique (para hablar: "pedido 12"), `cliente_id` FK, `fecha_entrega` date, `estado`, `total` integer (céntimos),
  `usuario_id` FK, `creado_en`. Índice (`fecha_entrega`, `estado`).
- `pedido_items` (`orderItems`): id, `pedido_id` FK, `presentacion_id` FK, `cantidad` integer > 0 (en presentaciones), `precio` integer (céntimos por presentación).
  Unique (`pedido_id`, `presentacion_id`).

## Contratos
- `src/modules/orders/`:
  - `order-math.ts` (puro, con tests): `orderTotal(lines)`, `mergeLine(lines, line)`, `available(stockBase, reservedBase)`.
  - `schemas.ts`: `orderSchema` → `{ id?, customerId, deliveryOn, lines: [{ packagingId, quantity }] }` (1–80 líneas).
  - `queries.ts`: `listOrders({ date, routeId, includeCancelled })`, `getOrder(id)`, `lastOrderLines(customerId)`, `reservedByProduct(excludeOrderId?)`, `defaultOrderDate()`.
  - `actions.ts`: `saveOrder(state, form)`, `cancelOrder(form)`.
  - `components/order-form.tsx` (cliente), `order-list.tsx`, `order-filters.tsx`.
- Inventario: `warehouseStockByProduct()` → `Record<productId, unidades base>` (solo ubicaciones ALMACEN), exportado en `index.ts`.
- Páginas: `/pedidos`, `/pedidos/nuevo`, `/pedidos/[id]`.

## Reutilizar
- `ProductPicker` (inventario; se exporta para usarlo aquí), `splitByPackaging` y `formatQty` para "3 caja + 4 und", `formatSoles`.
- `listProducts` (catálogo), `listCustomers` y `nextVisitDate` (clientes, se exporta), `todayInLima` (inventario).
- `requireUser`, `audit`. Patrones de `receipt-form.tsx` (líneas en estado del cliente, JSON en un input oculto) y `customer-list.tsx` (filtros GET, grupos por ruta).

## Tareas
- [ ] T1 — Esquema y migración · `src/server/db/schema.ts`, `drizzle/*`
- [ ] T2 — Lógica pura, con tests · `src/modules/orders/order-math.ts`, `order-math.test.ts`
- [ ] T3 — Stock de almacén y exportaciones · `src/modules/inventory/queries.ts`, `inventory/index.ts`, `customers/index.ts`
- [ ] T4 — Esquema y consultas de pedidos · `src/modules/orders/schemas.ts`, `queries.ts`, `index.ts`
- [ ] T5 — Guardar y anular · `src/modules/orders/actions.ts`
- [ ] T6 — Formulario y páginas nuevo y editar · `components/order-form.tsx`, `src/app/(app)/pedidos/nuevo/page.tsx`, `pedidos/[id]/page.tsx`
- [ ] T7 — Lista, filtros, cabecera y link desde clientes · `components/order-list.tsx`, `order-filters.tsx`, `src/app/(app)/pedidos/page.tsx`,
  `src/components/app-header.tsx`, `src/modules/customers/components/customer-list.tsx`

## Paralelismo
Grupo 0: T1. Luego en paralelo T2, T3 y T4. Después T5 → T6 → T7.

## Notas
- Al editar, los precios se toman de nuevo con el precio de hoy. Es lo esperado mientras el pedido no se entrega; el precio queda fijo al entregar (spec 010).
- "Disponible" no reserva stock en la base: es un cálculo para avisar. La reserva real es la salida al entregar.
- ponytail: el buscador de clientes filtra en memoria la lista de activos. Si pasan de ~2000 clientes, se busca en el servidor.
- La cabecera queda con 9 links. Si en el celular no entran, se agrupan en un menú (spec aparte).
