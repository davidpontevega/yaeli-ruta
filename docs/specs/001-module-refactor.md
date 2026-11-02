---
id: 001
title: Refactor a módulos de dominio en inglés
status: done
module: shared
---

# 001 — Refactor a módulos de dominio en inglés

## Objetivo
El código de las fases 0–1 cumple `docs/SETUP.md` §1 sin cambiar ningún comportamiento visible.

## Alcance
Incluye: mover lógica, consultas, actions y formularios de `src/app/` a `src/modules/{auth,users,catalog}`;
renombrar archivos e identificadores al inglés; exports de `schema.ts` en inglés.
No incluye: cambios de UI, textos, URLs, nombres SQL, cookie, reglas de negocio ni features nuevas.

`catalog` (y no `products`): agrupa productos, presentaciones, categorías, marcas y ubicaciones,
que se editan juntos y comparten actions.

## Criterios de aceptación
- [ ] AC1 — `npm run typecheck && npm run lint && npm test && npm run build` en verde.
- [ ] AC2 — `npm run db:generate` responde "No schema changes" (sin migración nueva).
- [ ] AC3 — `/login`, `/`, `/usuarios`, `/productos`, `/productos/nuevo`, `/productos/[id]`, `/catalogo` renderizan igual que antes.
- [ ] AC4 — Login con PIN, bloqueo, primer dueño, salir, CRUD de usuarios, crear/editar producto (código automático) y agregar categoría/marca/ubicación funcionan igual.
- [ ] AC5 — Ningún archivo de `src/app/` contiene consultas Drizzle, Server Actions ni formularios.
- [ ] AC6 — Los 3 tests existentes (PIN, dinero, código) siguen pasando con sus nombres nuevos.
- [ ] AC7 — `grep -rE "requerirUsuario|usuarioActual|formatSoles\(|dinero" src` solo encuentra `formatSoles` en `src/lib/money.ts` y sus usos.

## Datos
Sin cambios de esquema. Se renombran solo las claves TS de Drizzle; el SQL queda igual:
`usuarios`→`users` (`nombre`→`name: text("nombre")`, …), `sesiones`→`sessions`, `auditoria`→`auditLog`,
`ubicaciones`→`locations`, `categorias`→`categories`, `marcas`→`brands`, `productos`→`products`,
`presentaciones`→`packagings`, `rolEnum`→`roleEnum`, `Rol`→`Role`. Valores de enum (`DUENO`…) sin cambio.

## Contratos
| Antes | Después |
|---|---|
| `src/server/auth.ts`: `requerirUsuario`, `usuarioActual`, `crearSesion`, `cerrarSesion`, `UsuarioActual` | mismo archivo: `requireUser`, `getCurrentUser`, `createSession`, `destroySession`, `CurrentUser` |
| `src/server/auth-cookie.ts` `COOKIE_SESION` | `SESSION_COOKIE` (valor `"yr_sesion"` intacto) |
| `src/server/db/index.ts` `auditar`, `esDuplicado` | `audit`, `isUniqueViolation` |
| `src/lib/dinero.ts` | `src/lib/money.ts` (`parseSoles`, `formatSoles`, `toSolesInput`) |
| `src/lib/pin.ts` | `src/modules/auth/pin.ts` (`hashPin`, `verifyPin`, `afterFailedAttempt`, `MAX_ATTEMPTS`, `LOCK_MS`) |
| `src/lib/sku.ts` | `src/modules/catalog/sku.ts` (`skuPrefix`, `nextSku`) |
| `src/lib/brand.ts` `{nombre, empresa}` | `{ name, company }` |

Cada módulo expone en `index.ts` solo lo que usan las páginas (server). Los componentes
`"use client"` del módulo se importan entre sí por ruta relativa, nunca vía `index.ts`
(el barrel mezcla código de servidor).

## Reutilizar
- `src/server/db/index.ts` (cliente, `Tx`), `src/server/auth.ts` — se renombran, no se reescriben.
- Clases `.btn-primario`, `.btn-secundario`, `.campo`, `.tarjeta` de `globals.css` — tal cual.
- Ningún componente nuevo: solo se mueven y renombran los existentes.

## Tareas
- [x] T1 — Renombres compartidos y actualización de todas sus referencias (typecheck verde al cerrar) ·
  `src/server/db/schema.ts`, `src/server/db/index.ts`, `src/server/auth.ts`, `src/server/auth-cookie.ts`,
  `src/proxy.ts`, `src/lib/dinero.ts`→`money.ts` (+test), `src/lib/brand.ts`, `src/app/layout.tsx`,
  `scripts/seed-demo.ts`, y los imports en los archivos de `src/app/**` existentes.
- [x] T2 — Módulo `auth` + shell · `src/modules/auth/{pin.ts,pin.test.ts,actions.ts,queries.ts,index.ts}`,
  `src/modules/auth/components/{login-form.tsx,first-owner-form.tsx}`, `src/components/app-header.tsx`,
  `src/app/login/page.tsx`, `src/app/(app)/layout.tsx`, `src/app/(app)/page.tsx`; borrar `src/app/login/{forms,actions}.ts(x)`, `src/lib/pin*`.
- [x] T3 — Módulo `users` · `src/modules/users/{actions.ts,queries.ts,index.ts}`,
  `src/modules/users/components/{user-list.tsx,new-user-form.tsx,change-pin-form.tsx}`,
  `src/app/(app)/usuarios/page.tsx`; borrar `src/app/(app)/usuarios/{forms,actions}.ts(x)`.
- [x] T4 — Módulo `catalog` (lógica) · `src/modules/catalog/{sku.ts,sku.test.ts,schemas.ts,actions.ts,queries.ts,index.ts}`;
  borrar `src/lib/sku*`, `src/app/(app)/productos/{actions,opciones}.ts`.
- [x] T5 — Módulo `catalog` (UI y páginas) · `src/modules/catalog/components/{product-list.tsx,product-filters.tsx,product-form.tsx,catalog-summary.tsx,add-name-form.tsx}`,
  `src/app/(app)/productos/{page.tsx,nuevo/page.tsx,[id]/page.tsx}`, `src/app/(app)/catalogo/page.tsx`;
  borrar `src/app/(app)/productos/producto-form.tsx`, `src/app/(app)/catalogo/agregar-form.tsx`.
- [x] T6 — Docs · `docs/SETUP.md` (quitar "Estado actual"), `CLAUDE.md` (nombres nuevos de auth y actions).

Verificación final: AC1, AC2 y prueba manual de AC4 en `npm run dev`.

## Paralelismo
Grupo 0 (secuencial): T1 · Paralelo: [T2] [T3] [T4→T5] · Al final: T6.
T1 deja `src/app/**` compilando con los nombres nuevos; T2–T5 solo tocan sus archivos listados.

## Notas
- `login/actions.ts` exporta `salir`, que usa el layout: pasa a `signOut` en `modules/auth` (T2 dueño de ambos).
- `cambiarActivoProducto` y `agregarNombre` viven hoy en `productos/actions.ts`; ambos van a `modules/catalog/actions.ts` (T4).
- Los textos de error en español de los actions no cambian (AC3/AC4).

## Revisión (vuelta 1/1 · APROBADO)
- typecheck ✓ · lint ✓ · test 7/7 ✓ · build ✓ · `db:generate` "No schema changes" ✓ · AC5/AC7 grep ✓.
- AC3/AC4 contra servidor local con usuario temporal: 7 rutas 200, crear producto (código GAL-007 automático,
  2 presentaciones), editar, ocultar, crear usuario, agregar categoría, auditoría y sesión falsa → 307 ✓.
- Desvíos aceptados: `src/lib/form-state.ts` (tipo usado por 3 módulos) y `src/components/ui/pin-input.tsx`
  (input de PIN repetido 3 veces) no estaban listados; nombres de acciones de auditoría ahora en inglés.
- No probado de punta a punta: acción `signIn` (requiere elegir usuario en el navegador); su lógica solo se renombró.
