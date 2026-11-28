---
id: 025
title: Entregar y cobrar sin señal
status: done
module: delivery + orders (sync), auth (salir)
---

# 025 — Entregar y cobrar sin señal

## Objetivo
Un repartidor (o el dueño) marca entregas y cobros de su hoja `EN_RUTA` sin señal; se suben solos al volver la señal, una sola vez cada uno, descontando del vehículo igual que la entrega con señal.

## Alcance
Incluye: formulario "Entregar" por pedido en `/mi-ruta` (cantidades por línea, cobro con medio o fiado); cola en IndexedDB; `POST /api/mi-ruta/sync` idempotente; contador "N por subir", "Subido", rechazados; hoja local actualizada al instante; aviso al salir con pendientes.
No incluye: pedidos nuevos sin señal (026), cobro suelto sin pedido (cobrar deuda vieja = subir lo pagado en la entrega, como hoy), motivo de no entrega, Background Sync API, anular en ruta.

## Criterios de aceptación
- [ ] AC1 — En una hoja `EN_RUTA`, cada pedido `PENDIENTE` tiene botón grande "Entregar": líneas con − / + (por defecto lo pedido, máx. lo pedido), "Entregar todo", total en vivo, "Pagó (S/)" vacío = fiado, botones de medio (`PAYMENT_METHODS`), deuda que queda. Sin precios de costo ni margen. Hojas `PREPARANDO` no muestran "Entregar".
- [ ] AC2 — "No entregado" no crea operación: el pedido queda `PENDIENTE` y lo resuelve la liquidación (spec 022), igual que con señal.
- [ ] AC3 — Validación local idéntica a la del servidor: al menos una línea > 0, entregado ≤ pedido, pagado ≤ deuda local + total. Al guardar: op con `id = crypto.randomUUID()` en la cola; el pedido pasa a "Entregado (por subir)" y la deuda del cliente se recalcula (`applyQueue`), con o sin señal.
- [ ] AC4 — Sincroniza al abrir `/mi-ruta`, en el evento `online`, al guardar una op con señal y con botón "Subir ahora". Un envío a la vez (flag en memoria). Error de red/5xx → ops siguen "por subir". Tras sincronizar se vuelve a descargar la hoja (spec 024).
- [ ] AC5 — `POST /api/mi-ruta/sync` `{ ops }` (1–50): sin sesión → 401; `canSee("/mi-ruta")` falso → 403; Zod inválido → 400. Cada op en su propia transacción, en orden; respuesta por op `{ id, result: "ok" | "duplicate" | "rejected", reason? }`.
- [ ] AC6 — Idempotencia: primer paso de la tx = `INSERT operaciones_offline (id …) ON CONFLICT DO NOTHING RETURNING`; sin fila → `duplicate` sin tocar nada. Rechazo = rollback (el id no queda guardado; reintentar vuelve a evaluar). Dos envíos simultáneos del mismo id: la PK serializa, el segundo responde `duplicate`. Nunca doble descuento de stock ni doble abono.
- [ ] AC7 — Permisos y conflictos (rechazos, texto tal cual):
  - Pedido con `hoja_ruta_id` ≠ op o hoja no `EN_RUTA` → "La hoja ya se liquidó; el dueño debe entregarlo desde Pedidos".
  - `REPARTIDOR` y `hojas_ruta.repartidor_id ≠ me.id` → "Esta hoja no es tuya".
  - Pedido `ENTREGADO`/`ANULADO` → "El pedido ya no está pendiente" (otro lo entregó o anuló con señal).
  - Falta en el vehículo → mensaje actual de `deliverOrder` ("Falta stock de X en el vehículo: hay …"); nada se guarda.
  - Pagado > deuda + total → mensaje actual ("Lo pagado no puede pasar de S/ …").
- [ ] AC8 — `ok`: stock sale del vehículo de la hoja (FEFO, `dispatchStock` con `fromId`), `CARGO` + `ABONO` con `sheetId` (cuenta en la liquidación), `audit` `order.deliver` en la misma tx con `details` + `{ offline: true, opId }`. Actor = usuario de la sesión.
- [ ] AC9 — Cola UI: chip "N por subir" (ámbar), "Subido" (verde) en pedidos con op `ok`/`duplicate`, rechazados en tarjeta roja arriba (cliente, pedido #, motivo) con "Entendido" que la quita. Ops subidas se borran de la cola al abrir otro día.
- [ ] AC10 — Sesión vencida: 401 → cola intacta, "Sesión vencida: entra con tu PIN para subir N entregas" + enlace `/login`. Al volver a `/mi-ruta` con el mismo usuario se sube sola.
- [ ] AC11 — Otro usuario en el mismo celular: la cola guarda `userId`; solo se leen/suben/muestran ops del usuario de la página. Si hay ops ajenas: solo aviso "Hay entregas de otro usuario sin subir; que entre él con su PIN para subirlas" (sin datos). Al cambiar de usuario se borra solo la hoja guardada, no la cola.
- [ ] AC12 — "Salir" con ops propias por subir → `askFirst` rojo "Tienes N entregas sin subir. Si sales se pierden." (Cancelar por defecto). Sin pendientes, igual que hoy (`clearOfflineData`).

**Prueba:** (a) Chrome: hoja `EN_RUTA` descargada → Network Offline → entregar 1 pedido parcial con S/ 5 Yape y otro fiado → "2 por subir", deuda local actualizada; Online → "Subido", stock del vehículo baja una vez (kardex `VENTA`), 2 `CARGO` y 1 `ABONO` con hoja. (b) Reenviar el mismo POST desde DevTools (Copy as fetch) → `duplicate`, sin movimientos nuevos. (c) Entregar offline, entregar el mismo pedido online desde `/pedidos/[id]/entregar`, volver online → rechazado con motivo. (d) Liquidar antes de sincronizar → rechazado. (e) Borrar cookie offline, volver online → aviso de sesión; login → se sube. (f) iPhone Safari (app instalada) y Android Chrome: modo avión, entregar, cerrar app, abrir con señal → se sube.

## Datos
Migración aditiva (`npm run db:generate`; revisar que solo tenga `CREATE TABLE` + FKs):
| Tabla · columna | tipo | constraint |
|---|---|---|
| `operaciones_offline.id` (`offlineOps`) | uuid | PK (id del celular, sin default) |
| `.usuario_id` | uuid | not null, FK `usuarios.id` |
| `.pedido_id` | uuid | not null, FK `pedidos.id` |
| `.creado_en` | timestamptz | not null default now() |
Cliente: IndexedDB `yaeli-ruta` versión 2, store nuevo `queue` (clave = op id).

## Contratos
- `src/modules/orders/deliver.ts` (server-only): `deliverInTx(tx, { orderId, lines: {packagingId, delivered}[], paid, method }, actorId, extra?)` → `{ routeSheetId?: string }`; lanza `DeliveryError` (exportada) con el texto. Es el cuerpo actual de `deliverOrder`; `deliverOrder` queda como parseo + `db.transaction(tx => deliverInTx(…))` + redirect.
- `src/modules/delivery/schemas.ts`: `offlineOpSchema` `{ id: uuid, sheetId: uuid, orderId: uuid, lines (como deliverySchema), paid: int ≥ 0 céntimos, method: enum PAYMENT_METHOD_IDS }`; `syncSchema = { ops: array(1..50) }`.
- `src/modules/delivery/sync.ts` (server-only): `syncOps(me, ops)` → `SyncResult[]`; por op: tx → insert id → lock pedido (`FOR UPDATE`) → chequeos AC7 → `deliverInTx`.
- `src/app/api/mi-ruta/sync/route.ts` `POST` → `{ results }` | `{ error }`; `Cache-Control: no-store`. Patrón de `GET /api/mi-ruta`.
- `src/lib/offline-store.ts`: `putOp(op)`, `readOps()`, `deleteOps(ids)`, `clearRoute()` (solo la clave `today`).
- `RouteOrder.lines[]` gana `packagingId` (sin costos; test de lista blanca sigue).

## Reutilizar
Verificado con Grep:
- `src/modules/orders/actions.ts` — cuerpo de `deliverOrder` (se mueve a `deliverInTx`, no se reescribe), `sheetOf`.
- `src/modules/inventory/dispatch.ts` — `dispatchStock` (vía `deliverInTx`); `src/modules/accounts/ledger.ts` — `lockedBalance`, `addCharge`, `addPayment`.
- `src/modules/orders/schemas.ts` — `deliverySchema.shape.lines`; `src/lib/payment.ts` — `PAYMENT_METHODS`, `PAYMENT_METHOD_IDS`.
- `src/server/auth.ts` — `getCurrentUser`; `src/lib/menus.ts` — `canSee`; `src/server/db` — `audit`, `db`, `Tx`.
- `src/lib/money.ts` — `parseSoles`, `formatSoles`; `src/components/ui/confirm.ts` — `askFirst`.
- `src/modules/delivery/components/my-route.tsx`, `route-snapshot.ts`, `src/lib/offline-store.ts` (spec 024).
Nuevo: `offline-queue.ts` puro (no hay lógica de cola); `offline-deliver-form.tsx` (`DeliveryForm` está atado a la Server Action; se copia su patrón de − / +, no el componente). Sin dependencias nuevas.

## Tareas
- [x] T1 — Tabla `offlineOps`; `db:generate` y revisar SQL · `src/server/db/schema.ts`, `drizzle/0018_*.sql`, `drizzle/meta/*`
- [x] T2 — `offline-queue.ts` puro: tipo `OfflineOp` (+ `userId`, `at`, `state: "pending"|"sent"|"rejected"`, `reason?`); `validateOp(order, debt, op)` (AC3); `applyQueue(sheets, ops)` (pedido → ENTREGADO local, deuda += total − pagado; rechazadas no aplican); `applyResults(ops, results)`; `ownOps(ops, userId)`; `staleSent(ops, today)`. Test de cada una · `src/modules/delivery/offline-queue.ts`, `offline-queue.test.ts`
- [x] T3 — Extraer `deliverInTx` + `DeliveryError`; `deliverOrder` lo usa sin cambiar conducta · `src/modules/orders/deliver.ts`, `src/modules/orders/actions.ts`
- [x] T4 — `packagingId` en líneas del snapshot · `src/modules/delivery/route-snapshot.ts`, `route-snapshot.test.ts`, `src/modules/delivery/queries.ts`
- [x] T5 — `offlineOpSchema`/`syncSchema`, `syncOps`, route handler (AC5–AC8) · `src/modules/delivery/schemas.ts`, `src/modules/delivery/sync.ts`, `src/app/api/mi-ruta/sync/route.ts`
- [x] T6 — Store `queue` (versión 2, crea stores faltantes en `onupgradeneeded`), `putOp`/`readOps`/`deleteOps`/`clearRoute` · `src/lib/offline-store.ts`
- [x] T7 — UI (AC1–AC4, AC9–AC11): formulario, contador, subir, rechazados, `clearRoute` en vez de `clearOfflineData` al cambiar de usuario · `src/modules/delivery/components/offline-deliver-form.tsx`, `src/modules/delivery/components/my-route.tsx`
- [x] T8 — Aviso al salir con pendientes (AC12) · `src/modules/auth/components/sign-out-button.tsx`

## Paralelismo
T1 → Paralelo: [T2] [T3] [T4] [T6] → T5 (usa T1, T3) → T7 (usa T2, T4, T6) → T8.

## Notas
- `deliveredAt` y la fecha de `CARGO`/`ABONO` son las del momento de subir, no de entregar. ponytail: válido porque la hoja debe seguir `EN_RUTA` (mismo día en la práctica); si hace falta la hora real, pasar `op.at` a `deliverInTx`.
- Rechazo por "pagado > deuda": la deuda local puede estar vieja (pago en oficina mientras ruta). Se rechaza entera y el dueño la entrega con señal; raro con 1–2 hojas por día.
- iOS no tiene Background Sync: por eso `online` + al abrir + botón. Safari puede borrar IndexedDB de sitios no instalados tras 7 días sin uso; instalada (024) no aplica.
- El SW ya ignora no-GET (`public/sw.js`): el POST va directo a la red.

## Preguntas
1. ¿Cobro suelto sin entrega (cliente paga deuda vieja y no tiene pedido hoy)? Recomendado: no en 025; todo cliente de la hoja tiene pedido y el cobro de la entrega ya admite hasta deuda + total.
2. ¿Qué hacer con ops de otro usuario en el celular? Recomendado: guardarlas ocultas y solo avisar (AC11); se suben cuando su dueño vuelve a entrar, o se pierden si él toca "Salir".
3. Falta de stock en el vehículo al subir: ¿rechazar toda la entrega o guardar lo que alcance? Recomendado: rechazar entera (misma regla que con señal); el dueño corrige con la entrega online.

## Decisiones (aprobado 2026-11-28)
1. Cobrar deuda vieja sin pedido: fuera de 025.
2. Operaciones de otro usuario en el celular: ocultas, solo aviso; se suben cuando ese usuario vuelve a entrar.
3. Falta stock en el vehículo al subir: se rechaza la entrega completa, igual que en línea.

## Notas de implementación
- Archivos extra: `src/app/(app)/layout.tsx` y `src/components/app-header.tsx` (pasan `userId` a `SignOutButton`); exports en `src/modules/orders/index.ts` y `src/modules/delivery/index.ts`.
- AC12 matizado: "Salir" conserva las operaciones pendientes de otros usuarios (decisión 2); borra todo lo demás.
- "Salir" lee la cola en el momento del clic; si la lectura falla, avisa igual.
