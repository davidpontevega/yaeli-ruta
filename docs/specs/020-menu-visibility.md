---
id: 020
title: Menús visibles por usuario
status: done
module: users + auth + nav
---

# 020 — Menús visibles por usuario

## Objetivo
Un administrador puede elegir, por usuario, qué pantallas del menú ve, para mostrarle el sistema a un cliente solo con, por ejemplo, Productos y Catálogo para clientes.

## Alcance
Incluye: `usuarios.es_admin` y `usuarios.menus_ocultos`; la página `/menus` (solo admin) y su tarjeta en Ajustes; el filtro en `SideNav`, `SectionNav` (y su menú +), `SectionTabs`, el inicio y los enlaces de Ajustes; el bloqueo en el servidor dentro de `requireUser`; el chip "Admin" en Usuarios.
No incluye: dar o quitar admin desde la app (ver P2); ocultar botones dentro de las pantallas (un enlace interno hacia una pantalla oculta redirige); permisos por acción; ocultar la API (`/api/*`).

## Claves de menú (`src/lib/menus.ts`, puro)
Orden = orden de "primera pantalla permitida". `owner` = solo DUENO (sale de aquí; se quita `ownerOnly` de `app-nav.tsx`).
| clave | prefijos de URL | owner |
|---|---|---|
| `inicio` | `/` (exacto) | |
| `pedidos` | `/pedidos` | sí |
| `clientes` | `/clientes`, `/deudores`, `/rutas` | sí |
| `stock` | `/stock` | |
| `vencimientos` | `/vencimientos` | |
| `compras` | `/compras`, `/proveedores` | sí |
| `recepciones` | `/recepciones` | sí |
| `productos` | `/productos`, `/precios` | |
| `catalogo` | `/productos/catalogo`, `/productos/fotos` | sí |
| `ajustes` | `/catalogo` | sí |
| `usuarios` | `/usuarios` | sí |
Gana el prefijo más largo: `/productos/catalogo` → `catalogo`, `/productos/123` → `productos`. Las subpáginas heredan. `/menus`, `/api/*` y rutas sin prefijo → `null` (nunca se ocultan). Las acciones rápidas del "+" no tienen clave propia: se ven si su pantalla se ve (`/deudores` → `clientes`, etc.).

## Criterios de aceptación
- [ ] AC1 — Sin cambios para los usuarios actuales: `menus_ocultos = '{}'` → ven lo mismo que hoy.
- [ ] AC2 — Con una clave oculta, su pantalla no sale en `SideNav`, `SectionNav`, `SectionTabs` ni en el "+"; una sección sin pestañas desaparece; si no queda ninguna acción rápida, no sale el "+".
- [ ] AC3 — En `/`: botones "Nuevo pedido" (`pedidos`) y "Lista de pedido" (`compras`), `ReceivableCard` (`clientes`), `TodayCard`/`TodayOrders`/Kpi entregas (`pedidos`), Kpi y fila de stock (`stock`), vencimientos (`vencimientos`), precios por revisar y su aviso (`productos`), `MissingList` (`stock`) solo se muestran si su clave se ve. En Ajustes, las tarjetas "Usuarios y PIN" (`usuarios`) y "Proveedores" (`compras`) igual.
- [ ] AC4 — Servidor: `requireUser` lee la ruta (cabecera `x-yr-path` que pone `proxy.ts`, sobrescribiendo la del cliente) y, si su clave está oculta, hace `redirect(firstAllowed(role, hidden))`. Vale para páginas y Server Actions (el POST va a la URL de la página). `/` oculto → redirige igual.
- [ ] AC5 — `/menus` y `saveHiddenMenus` exigen admin (`requireAdmin()`; si no → `/`). La página lista los usuarios (enlaces `?usuario=<id>`) y, del elegido, un check por clave que su rol permite, agrupados como en el menú; "Guardar".
- [ ] AC6 — `sanitizeHidden`: descarta claves desconocidas o que el rol ya no ve, deduplica; a un admin no se le puede ocultar `ajustes` (entrada a Menús); debe quedar ≥ 1 clave visible, si no → error "Deja al menos una pantalla".
- [ ] AC7 — Auditoría en la misma transacción: `user.set_hidden_menus` con `{ hidden, previous }`, `entityId` = usuario. Usuario inexistente → error sin escribir.
- [ ] AC8 — En `/usuarios`, chip "Admin" junto al rol. En Ajustes, tarjeta "Menús" solo si `me.isAdmin`.
- [ ] AC9 — El cambio vale en la siguiente petición del usuario (`getCurrentUser` lee la BD cada vez); no hace falta cerrar su sesión.

## Datos
Migración aditiva (`npm run db:generate`; solo `ADD COLUMN`):
| `usuarios` · columna (TS) | tipo | constraint |
|---|---|---|
| `es_admin` (`isAdmin`) | boolean | NOT NULL default false |
| `menus_ocultos` (`hiddenMenus`) | text[] | NOT NULL default `'{}'` |
Lista de ocultos (no de permitidos): las pantallas nuevas salen visibles sin migrar datos y los usuarios actuales quedan igual.

**Primer admin (paso manual en el deploy, con confirmación del humano):** el humano dice el nombre; el agente principal corre `UPDATE usuarios SET es_admin = true WHERE nombre = '<nombre>' AND activo RETURNING id, nombre;` y comprueba que devolvió 1 fila. No va en la migración (el nombre no está en el repo y la migración solo cambia esquema).

## Contratos
- `src/lib/menus.ts`: `MenuKey`; `MENUS: { key; label; owner?: boolean; href; prefixes: string[] }[]`; `menuKeyFor(path) → MenuKey | null`; `canSee(path, role, hidden) → boolean` (rol + ocultos; `null` → true); `firstAllowed(role, hidden) → string` (href; `"/login"` si no hay ninguna); `sanitizeHidden(keys, role, isAdmin) → { ok: true; hidden: MenuKey[] } | { ok: false; error }`.
- `src/server/auth.ts`: `CurrentUser` agrega `isAdmin`, `hiddenMenus`; `requireUser` agrega el chequeo AC4 tras el de rol; `requireAdmin()`.
- `src/modules/users/actions.ts`: `saveHiddenMenus(_: FormState, form)` — `{ userId: z.uuid(), hidden: z.array(z.string()) }` (`form.getAll("hidden")`), `requireAdmin`, lee el usuario con `FOR UPDATE`, `sanitizeHidden`, update + `audit` en `db.transaction`, `revalidatePath("/menus")`.
- `src/modules/users/queries.ts`: `listUsersWithSessions` agrega `isAdmin`, `hiddenMenus`.

## Reutilizar
Verificado con Grep/Glob:
- `src/components/app-nav.tsx` — `SECTIONS`, `QUICK`, `visible(role)` → `visible(role, hidden)` con `canSee`.
- `src/server/auth.ts` — `getCurrentUser` (cache), `requireUser`. `src/proxy.ts` — `NextResponse.next({ request: { headers } })` (docs Next 16, `proxy.md`).
- `src/modules/users/{actions,queries,index}.ts`, `components/user-list.tsx` (chip como `ROLE_LABEL`).
- `src/modules/catalog/components/catalog-summary.tsx` — arreglo `links` de Ajustes.
- `src/modules/inventory/components/home-alerts.tsx`; `src/server/db` (`db`, `audit`); `src/lib/form-state.ts`; `src/components/ui/back-link.tsx`.
Nuevo: `src/lib/menus.ts` (lo usan el cliente, el servidor y 3 módulos: va en `lib/`), `MenuVisibilityForm`, `/menus`.

## Tareas
- [x] T1 — Columnas + migración aditiva (revisar SQL: solo `ADD COLUMN`) · `src/server/db/schema.ts`, `drizzle/0013_*.sql`, `drizzle/meta/*`
- [x] T2 — `menus.ts` + test: `menuKeyFor` (`/`, `/productos/catalogo`, `/productos/9/movimientos`, `/precios`, `/deudores/inicial`, `/catalogo`, `/menus`, `/api/x`, `/productosx`), `canSee` (rol, oculto, null), `firstAllowed` (inicio oculto → siguiente; repartidor; todo oculto → `/login`), `sanitizeHidden` (desconocida, dup, admin+`ajustes`, todo oculto) · `src/lib/menus.ts`, `src/lib/menus.test.ts`
- [x] T3 — `proxy.ts` pone `x-yr-path`; `getCurrentUser` selecciona las 2 columnas; chequeo en `requireUser`; `requireAdmin` · `src/proxy.ts`, `src/server/auth.ts`
- [x] T4 — Navs con `hidden`: `visible(role, hidden)`, `QUICK` filtrado, "+" solo si queda alguna; pestaña "Catálogo" (`/productos/catalogo`) en "Más" (P1); layout y header pasan `user.hiddenMenus` · `src/components/app-nav.tsx`, `src/components/app-header.tsx`, `src/app/(app)/layout.tsx`
- [x] T5 — Inicio (AC3): `can = (href) => canSee(href, role, hidden)`; no consultar datos de bloques ocultos; `HomeAlerts` recibe `can` y filtra · `src/app/(app)/page.tsx`, `src/modules/inventory/components/home-alerts.tsx`
- [x] T6 — Usuarios: query, `saveHiddenMenus`, chip "Admin", `MenuVisibilityForm` (`"use client"`, `useActionState`, `ajustes` deshabilitado si el usuario es admin), export · `src/modules/users/queries.ts`, `actions.ts`, `components/user-list.tsx`, `components/menu-visibility-form.tsx`, `index.ts`
- [x] T7 — Página `/menus` y Ajustes (tarjeta "Menús" si admin; links filtrados con `canSee`) · `src/app/(app)/menus/page.tsx`, `src/app/(app)/catalogo/page.tsx`, `src/modules/catalog/components/catalog-summary.tsx`

## Paralelismo
Secuencial: T1 → T2 → T3. Paralelo: [T4] [T5] [T6]. Luego T7 (usa el export de T6).

## Notas
- ponytail: ocultar no es un límite de seguridad. Los IDs de Server Action son globales: un POST armado a mano desde una URL visible ejecuta una acción de una pantalla oculta. La barrera real sigue siendo el rol (`requireUser("DUENO")`); para un cliente de demo, crearlo como REPARTIDOR si no debe escribir nada de dueño (P3).
- `requireUser` también corre en el layout: un redirect allí es válido. Rol incorrecto → `/` → si `inicio` está oculto, segundo redirect a `firstAllowed`. Sin bucle: `firstAllowed` nunca devuelve una clave oculta.
- Sin `x-yr-path` (ruta fuera del matcher) no se chequea: el matcher ya cubre todo `(app)`.

## Preguntas abiertas
- P1 — Sin "Productos", el Catálogo en escritorio solo se alcanza desde Productos (el "+" es solo del celular). Recomendado: agregar la pestaña "Catálogo" en "Más" para todos los dueños. Alternativa: mostrar el "+" también en `SideNav`.
- P2 — ¿Dar/quitar admin desde `/usuarios`? Recomendado: no; un segundo admin se pone con el mismo `UPDATE` manual. Así siempre queda ≥ 1 admin sin lógica extra.
- P3 — ¿Rol del usuario del cliente? Recomendado: DUENO con menús ocultos (puede ver Catálogo, que es solo dueño), sabiendo la nota ponytail. Alternativa: REPARTIDOR (más seguro, pero no ve Catálogo).

## Decisiones del humano (19-nov-2026)
- P1: sí — pestaña "Catálogo" (catálogo para clientes) en la sección "Más" para todos los dueños.
- P2: no — es_admin no se cambia desde la app; solo por UPDATE manual.
- P3: el cliente (usuario JOAQUIN) es DUENO sin es_admin: no ve "Menús" ni puede ocultar/mostrar menús. DAVID es el único admin (superadmin) con control total.
