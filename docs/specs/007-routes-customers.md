---
id: 007
title: Rutas y clientes
status: draft
module: customers (nuevo)
---

# 007 — Rutas y clientes

## Objetivo
Pasar al sistema las rutas de reparto y los clientes de cada una, en el orden en que se visitan. Es la base de los pedidos (008),
la cuenta corriente (009) y la hoja de ruta (fase 4).

## Alcance
Incluye:
- Rutas con nombre y días de visita.
- Clientes con lo mínimo: nombre, teléfono y ruta. En "Más opciones": dirección, referencia y límite de crédito.
- Orden de visita dentro de la ruta (subir y bajar).
- Lista por ruta, búsqueda y desactivar cliente.

No incluye:
- GPS ni mapa.
- Deuda, saldo y cobros (spec 009).
- Precios especiales (spec 011).
- Importar clientes desde Excel: se cargan a mano (pocos campos).

## Criterios de aceptación
- [ ] AC1 — `/rutas` (dueño): lista de rutas con sus días ("Lun · Jue") y N° de clientes activos.
  - Crear y editar con nombre (único sin distinguir mayúsculas) y días con checks Lun…Dom (al menos 1).
  - Se llega desde un link en `/clientes`.
- [ ] AC2 — `/clientes` (dueño): clientes activos agrupados por ruta, en orden de visita, con nombre, teléfono (link `tel:`) y dirección si tiene.
  - Filtro por ruta y búsqueda por nombre o teléfono (sin tildes ni mayúsculas).
  - Botón "Nuevo cliente". Link "Clientes" en la cabecera (solo dueño).
  - Sin rutas creadas: aviso "Primero crea una ruta" con link a `/rutas`.
- [ ] AC3 — Nuevo y editar cliente: nombre, teléfono y ruta visibles; dirección, referencia y límite de crédito (S/, vacío = sin límite) dentro de `<details>` "Más opciones".
  - Teléfono: 9 dígitos o vacío (se guardan solo los dígitos).
  - Un cliente nuevo, o uno que cambia de ruta, queda **al final** del orden de esa ruta.
  - Nombre repetido en la misma ruta: aviso, no bloquea (puede haber dos "Bodega Rosa").
- [ ] AC4 — Orden de visita: en el filtro de una ruta, cada cliente tiene botones ↑ y ↓ que lo cambian con el vecino, en una transacción.
  - El orden queda sin huecos (1, 2, 3…), aunque se desactiven o muevan clientes.
- [ ] AC5 — Desactivar o reactivar cliente desde editar. Los inactivos no salen en la lista (casilla "Ver inactivos") ni en el orden de la ruta.
  - No se borran: tendrán pedidos y deuda.
- [ ] AC6 — Auditoría `route.create|update`, `customer.create|update|reorder`. El repartidor que entra a `/rutas` o `/clientes` es redirigido por `requireUser("DUENO")`.

## Datos (migración nueva)
- `rutas` (`routes`): id, `nombre` text unique, `dias` smallint[] (1 = lunes … 7 = domingo), `creado_en`.
- `clientes` (`customers`): id, `nombre`, `telefono` null, `direccion` null, `referencia` null, `ruta_id` FK, `orden_en_ruta` integer,
  `limite_credito` integer null (céntimos), `activo` boolean default true, `creado_en`. Índice (`ruta_id`, `orden_en_ruta`).
- `orden_en_ruta` sin unique: el reordenamiento lo mantiene compacto dentro de la transacción.

## Contratos
- `src/modules/customers/`:
  - `schemas.ts`: `routeSchema`, `customerSchema` (Zod; usa `solesSchema` para el límite).
  - `route-days.ts` (puro, con tests): `formatDays([1,4])` → "Lun · Jue", `nextVisitDate(days, fromIso)` → fecha ISO (lo usa 008).
  - `queries.ts`: `listRoutes()`, `listCustomers({ q, routeId, includeInactive })`, `getCustomer(id)`.
  - `actions.ts`: `saveRoute(state, form)`, `saveCustomer(state, form)`, `moveCustomer(form)` (id + "up"/"down").
  - `components/`: `route-list.tsx`, `route-form.tsx`, `customer-list.tsx`, `customer-form.tsx`.
  - `index.ts` exporta lo que usan las páginas.
- Páginas: `/rutas`, `/clientes`, `/clientes/nuevo`, `/clientes/[id]`.

## Reutilizar
- `requireUser`, `audit`, `isUniqueViolation`, `solesSchema`, `formatSoles`, `toSolesInput`, `todayInLima` (inventario, `expiry.ts`).
- Búsqueda sin tildes: el mismo criterio que `listProducts` del catálogo.
- Patrones: lista con filtros de `product-filters.tsx` y `product-list.tsx`; formulario con `useActionState` de `product-form.tsx`; formulario corto de `add-name-form.tsx`.
- `LINKS` de `app-header.tsx` (se agrega "Clientes").

## Tareas
- [ ] T1 — Esquema y migración · `src/server/db/schema.ts`, `drizzle/*`
- [ ] T2 — Días de ruta puros, con tests · `src/modules/customers/route-days.ts`, `route-days.test.ts`
- [ ] T3 — Esquemas, consultas e index · `src/modules/customers/schemas.ts`, `queries.ts`, `index.ts`
- [ ] T4 — Rutas: acción, componentes y página · `actions.ts` (`saveRoute`), `components/route-list.tsx`, `route-form.tsx`, `src/app/(app)/rutas/page.tsx`
- [ ] T5 — Cliente: acción y formulario · `actions.ts` (`saveCustomer`), `components/customer-form.tsx`, `src/app/(app)/clientes/nuevo/page.tsx`, `clientes/[id]/page.tsx`
- [ ] T6 — Lista, filtros y orden de visita · `actions.ts` (`moveCustomer`), `components/customer-list.tsx`, `src/app/(app)/clientes/page.tsx`
- [ ] T7 — Link en la cabecera · `src/components/app-header.tsx`

## Paralelismo
Grupo 0: T1. Luego T2 y T3 en paralelo. Después T4 → T5 → T6 en serie (comparten `actions.ts`). T7 en cualquier momento.

## Notas
- Decisiones del dueño (16-nov-2026): se hace el spec 010 (entrega desde la oficina); **solo el dueño** toma pedidos por teléfono;
  la deuda actual está en un cuaderno, por cliente, y se carga como "deuda inicial" en el spec 009.
- ponytail: subir/bajar de a uno. Si una ruta pasa de ~40 clientes y reordenar se hace pesado, arrastrar y soltar (spec aparte).
- La cabecera queda con 8 links; si en el celular no entran, se agrupan en un menú (spec aparte).
