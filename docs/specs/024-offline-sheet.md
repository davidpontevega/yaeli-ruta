---
id: 024
title: Ver la hoja sin señal — PWA y "Mi ruta de hoy"
status: done
module: delivery + app shell (auth, menus)
---

# 024 — Ver la hoja sin señal

## Objetivo
Un repartidor (o el dueño) instala la app en el celular, descarga con señal su hoja de hoy y la consulta sin señal (clientes en orden, deuda, pedidos y carga), para repartir sin papel aunque no haya cobertura.

## Alcance
Incluye: PWA instalable (manifest + íconos del logo + service worker propio); columna `repartidor_id` en la hoja (elegida al armarla, cambiable mientras no esté `LIQUIDADA`); `GET /api/mi-ruta`; pantalla `/mi-ruta` que guarda en IndexedDB y lee de ahí; indicador sin señal y "Descargado a las HH:MM"; refresco al volver la señal; borrar datos al salir; menú nuevo (spec 020).
No incluye: entregar/cobrar sin señal (025), pedidos sin señal (026), notificaciones push, `experimental.useOffline`, cola de sincronización.

## Criterios de aceptación
- [ ] AC1 — Chrome Android ofrece "Instalar app": `manifest.webmanifest` válido (nombre `BRAND`, `display: standalone`, `start_url: "/"`, `theme_color #0f766e`, íconos PNG 192 y 512). DevTools › Application › Manifest sin errores.
- [ ] AC2 — `/sw.js` se sirve sin cookie (fuera del matcher de `src/proxy.ts`) con `Cache-Control: no-cache, no-store, must-revalidate`; se registra desde el layout `(app)` con `scope: "/"`.
- [ ] AC3 — `GET /api/mi-ruta`: sin sesión → 401; `canSee("/mi-ruta")` falso → 403. Hojas = `EN_RUTA` (cualquier fecha) o `PREPARANDO` con `fecha = todayInLima()`. `DUENO` ve todas; `REPARTIDOR` solo las de `repartidor_id = me.id`. Nunca `LIQUIDADA`.
- [ ] AC4 — Por hoja: número, estado, ruta, vehículo, repartidor; clientes en `orden_en_ruta` con teléfono, dirección, referencia y deuda actual (`balancesByCustomer`); sus pedidos no anulados (número, estado, total, líneas: producto, presentación, cantidad, precio de venta); resumen de carga (producto, cantidad en presentaciones, vence, faltantes, peso). El JSON no tiene `costo`, `costo_promedio`, margen ni `%` (lo verifica el test de T2).
- [ ] AC5 — `/mi-ruta` con señal: descarga al abrir, al volver la señal (`online`) y con botón "Actualizar"; guarda `{ userId, downloadedAt, sheets }` en IndexedDB y guarda en Cache Storage `/mi-ruta` + los `script[src]`, `link[rel=stylesheet]` y fuentes precargadas de la página.
- [ ] AC6 — Sin señal: navegar a `/mi-ruta` sirve el HTML guardado; cualquier otra navegación redirige a `/mi-ruta` si está guardada (si no, texto "Sin señal"). Se ven los datos de IndexedDB, chip "Sin señal" y "Descargado a las HH:MM" (y la fecha si no es hoy). La navegación con señal espera la red máx. 5 s y luego usa lo guardado.
- [ ] AC7 — Sesión: vencida sin señal → los datos siguen legibles. Con señal y 401 → se conservan los datos y sale "Sesión vencida: entra con tu PIN para actualizar" con enlace a `/login`. Si el `userId` guardado ≠ usuario de la página, se borra antes de mostrar.
- [ ] AC8 — "Salir" (header y menú lateral) borra la base IndexedDB y el caché del SW antes de cerrar sesión.
- [ ] AC9 — Estados: sin datos y sin señal → "Descarga tu hoja con señal antes de salir"; sin hojas → "No tienes hoja de ruta para hoy"; error de red mostrado, no tragado.
- [ ] AC10 — Armar hoja: select "Quién reparte" (dueño = vacío, o un `REPARTIDOR` activo); en `/reparto/[id]` se cambia mientras no esté `LIQUIDADA`. Auditoría `sheet.driver` `{ driverId }`.

**Prueba offline:** (a) Chrome escritorio: abrir `/mi-ruta`, DevTools › Network › Offline, recargar y abrir `/` → datos + "Sin señal"; Application › Service Workers activo, IndexedDB `yaeli-ruta` con la hoja. Borrar la cookie `yr_sesion` estando offline → sigue legible; volver online → aviso de sesión. (b) Celular real: instalar desde Chrome, abrir "Mi ruta de hoy" con señal, modo avión, cerrar la app del todo y abrirla desde el ícono → datos. Quitar modo avión → hora de descarga se actualiza. (c) Repartidor sin hoja asignada → estado vacío; su JSON (DevTools › Network) no trae hojas ajenas ni costos. (d) Salir → IndexedDB y Cache Storage vacíos.

## Datos
Migración aditiva (`npm run db:generate`; revisar que solo tenga `ADD COLUMN` + FK):
| Tabla · columna | tipo | constraint |
|---|---|---|
| `hojas_ruta.repartidor_id` (`driverId`) | uuid | null, FK `usuarios.id`; null = reparte el dueño |
Cliente (no BD): IndexedDB `yaeli-ruta`, store `route`, clave `"today"`. Cache Storage `yr-shell-v1`.

## Contratos
- `src/modules/delivery/queries.ts`: `getMyRoute(user: { id; role }, today)` → `RouteSnapshot["sheets"]`; `listDrivers()` → `{ id, name }[]` (REPARTIDOR activos).
- `src/app/api/mi-ruta/route.ts` `GET` → `{ downloadedAt: string; userId: string; sheets }` | `{ error }` 401/403. `Cache-Control: no-store`.
- `src/modules/delivery/actions.ts`: `createSheet` acepta `driverId` (opcional, uuid de REPARTIDOR activo); `setSheetDriver(_: FormState, form)` DUENO, `{ sheetId, driverId? }`, falla si `LIQUIDADA`.
- `src/lib/offline-store.ts` (navegador): `saveRoute(snapshot)`, `readRoute()`, `clearOfflineData()` (borra la base y `yr-shell-*`), `cacheShell(urls)`.

## Reutilizar
Verificado con Grep:
- `src/server/auth.ts` — `getCurrentUser` (route handler, patrón de `src/app/api/productos/[id]/foto/route.ts`), `requireUser`.
- `src/lib/menus.ts` — `MENUS`, `canSee`; `src/components/app-nav.tsx` ya pinta desde `canSee`.
- `src/modules/accounts` — `balancesByCustomer(ids)` (deuda actual).
- `src/modules/delivery/queries.ts` — `getPicking(sheetId)` (carga del vehículo en `EN_RUTA`, picking en `PREPARANDO`); `listSheets`/`getSheet` como patrón de joins.
- `src/modules/inventory` — `todayInLima`; `src/lib/quantity.ts` — `formatQty`; `src/lib/money.ts` — formato de soles; `src/lib/brand.ts` — `BRAND`.
- `src/components/ui/empty-state.tsx` — estados vacíos. `src/app/icon.svg` — origen de los PNG.
Nuevo: `route-snapshot.ts` (no hay armado de hoja para el celular), `offline-store.ts` en `lib/` (lo usan `delivery` y `auth`), `public/sw.js` (sin dependencias: IndexedDB nativo, ~1 store, `idb` no se justifica aún).

## Tareas
- [x] T1 — `driverId` en `deliverySheets`; `db:generate` y revisar SQL · `src/server/db/schema.ts`, `drizzle/0017_*.sql`, `drizzle/meta/*`
- [x] T2 — `buildRouteSnapshot(rows, balances, pickings, packs)` puro: agrupa por hoja → cliente (orden de visita) → pedido → líneas, resume carga con `formatQty`, lista blanca de campos; test (orden, deuda 0 por defecto, pedidos anulados fuera, sin claves de costo) · `src/modules/delivery/route-snapshot.ts`, `route-snapshot.test.ts`
- [x] T3 — `getMyRoute`, `listDrivers` y route handler (AC3, AC4) · `src/modules/delivery/queries.ts`, `index.ts`, `src/app/api/mi-ruta/route.ts`
- [x] T4 — Quién reparte (AC10) · `src/modules/delivery/schemas.ts`, `actions.ts`, `components/sheet-form.tsx`, `components/driver-select.tsx`, `src/app/(app)/reparto/page.tsx`, `src/app/(app)/reparto/[id]/page.tsx`
- [x] T5 — PWA: manifest, íconos (exportados una vez del SVG, sin dependencia), SW (navegación red→caché con 5 s, `/_next/static` e íconos caché→red, borra cachés viejos en `activate`), matcher y headers (AC1, AC2, AC6) · `src/app/manifest.ts`, `public/icon-192.png`, `public/icon-512.png`, `public/sw.js`, `src/proxy.ts`, `next.config.ts`
- [x] T6 — `offline-store.ts` con IndexedDB y Cache Storage nativos · `src/lib/offline-store.ts`
- [x] T7 — `MyRoute` (cliente: descarga, lee, indicador, sesión vencida, estados) + página + menú `mi-ruta` "Mi ruta de hoy" (grupo Ventas, todos los roles, después de `clientes`) + caso en test de menús · `src/modules/delivery/components/my-route.tsx`, `index.ts`, `src/app/(app)/mi-ruta/page.tsx`, `src/lib/menus.ts`, `src/lib/menus.test.ts`
- [x] T8 — `SignOutButton` (llama `clearOfflineData()` y envía `signOut`) y `SwRegister` en el layout (AC2, AC8) · `src/modules/auth/components/sign-out-button.tsx`, `src/modules/auth/index.ts`, `src/components/app-header.tsx`, `src/app/(app)/layout.tsx`, `src/components/sw-register.tsx`

## Paralelismo
T1 → Paralelo: [T2] [T5] [T6] → Paralelo: [T3] [T4] (no comparten archivos: T3 `queries.ts`/`index.ts`, T4 el resto) → T7 → T8. T3 y T7 tocan `delivery/index.ts`: secuencial.

## Notas
- Docs Next 16 usadas: `node_modules/next/dist/docs/01-app/02-guides/progressive-web-apps.md` (manifest, registro del SW con `updateViaCache: "none"`, headers de `/sw.js`); `.../03-file-conventions/01-metadata/manifest.md` (`app/manifest.ts` es un Route Handler especial cacheado → `/manifest.webmanifest`, ya fuera del matcher); `.../02-guides/offline-support.md` (`experimental.useOffline` solo cubre navegaciones suaves y Server Actions; "full offline loads would need a service worker" → no se activa: es experimental y no sirve para abrir la app en frío).
- El SW no escribe en caché: solo lee. Lo guarda el cliente al descargar (AC5), así el primer uso funciona aunque el SW aún no controlara la página. Tras un deploy, la siguiente descarga reemplaza el caché (chunks nuevos).
- El HTML guardado incluye el layout del usuario (nombre, menús); por eso se borra al salir y se valida `userId` (AC7).
- ponytail: un repartidor desactivado sigue leyendo su hoja sin señal hasta reconectar o salir; aceptable por ser solo lectura del día. Revocar en caliente requeriría borrado remoto (fuera de alcance).
- `getPicking` por hoja = N consultas; con 1–2 hojas por día no importa.

## Preguntas
1. ¿Quién reparte se elige solo al armar o también después? Recomendado: al armar y cambiable en el detalle hasta `LIQUIDADA` (el dueño decide a veces en la mañana); vacío = dueño.
2. ¿IndexedDB nativo o `idb` (PLAN §2)? Recomendado: nativo ahora (un store, una clave, ~30 líneas); reevaluar `idb` en 025 si la cola lo pide.
3. Datos de un día anterior sin sincronizar: ¿borrar al abrir o mostrar con aviso? Recomendado: mostrar con "Descargado el DD/MM" hasta la siguiente descarga o al salir (025 necesitará esos datos si quedó algo sin subir).

## Decisiones (aprobado 2026-11-28)
1. Repartidor se elige al armar la hoja y se puede cambiar en el detalle hasta `LIQUIDADA`; vacío = dueño.
2. IndexedDB nativo, sin `idb`.
3. Datos de un día anterior se muestran con "Descargado el DD/MM" hasta la siguiente descarga o al salir.
