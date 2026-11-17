---
id: 017
title: Estado de cuenta por cliente
status: done
module: accounts
---

# 017 — Estado de cuenta

## Objetivo
El dueño abre el estado de cuenta de un cliente para un periodo, lo guarda como PDF desde el navegador y le manda el resumen por WhatsApp.

## Alcance
Incluye: la página `/clientes/[id]/estado` optimizada para imprimir, con filtro de fechas; el resumen (saldo anterior, entregas, cobros, ajustes, saldo final) y los movimientos con saldo acumulado; el botón "Imprimir / PDF" (`window.print()`); el botón "Enviar por WhatsApp" con el resumen en texto al teléfono del cliente; el enlace desde la ficha `/clientes/[id]/cuenta`.
No incluye: librería de PDF ni generación en el servidor; enlace público para el cliente (la página es solo del dueño); detalle de productos de cada pedido; envío automático.

## Criterios de aceptación
- [x] AC1 — Solo el dueño: `requireUser("DUENO")` en la página. El repartidor es redirigido. El saldo no es un costo, pero el estado de cuenta es una herramienta del dueño, igual que la ficha de 009.
- [x] AC2 — Periodo con dos `<input type="date">` (`desde`, `hasta`) en un formulario GET, sin JS. Por defecto: `hasta` = hoy (Lima), `desde` = hoy − 30 días. Fechas inválidas, `desde > hasta` o `hasta` futura → se usa el periodo por defecto.
- [x] AC3 — Saldo anterior = suma de los movimientos con `fecha < desde`. Los movimientos con `desde ≤ fecha ≤ hasta` se listan del más viejo al más nuevo (fecha, tipo, pedido / medio / nota, monto con signo, saldo después).
- [x] AC4 — Resumen: Saldo anterior · Entregas (SALDO_INICIAL + CARGO) · Cobros (ABONO, en positivo) · Ajustes (AJUSTE, con signo) · Saldo al `hasta`. Se cumple saldo anterior + entregas − cobros + ajustes = saldo final.
- [x] AC5 — Encabezado impreso: `BRAND.company`, nombre y teléfono del cliente, periodo y fecha de emisión. Al imprimir se ocultan la navegación, el filtro y los botones (`print:hidden`). La tabla cabe en A4 vertical.
- [x] AC6 — Sin movimientos en el periodo: se ve el resumen (saldo anterior = saldo final) y el texto "Sin movimientos en este periodo".
- [x] AC7 — "Enviar por WhatsApp" abre `https://wa.me/<51+número>?text=…` (sin número si el cliente no tiene teléfono) con: empresa, cliente, periodo, las 5 cifras del resumen y "Te envío el detalle en PDF". Sin enlace a la app.
- [x] AC8 — La ficha `/clientes/[id]/cuenta` muestra el enlace "Estado de cuenta". Cliente inexistente o id no uuid → `notFound()`.

## Datos
Sin cambios de esquema. Lee `movimientos_cuenta` (009).

## Contratos
- `buildStatement(movements, from, to)` en `account-math.ts` (puro). Entrada: movimientos en orden cronológico `{ type, amount, date, … }`. Salida: `{ opening, charges, payments, adjustments, closing, rows: (m & { balance })[] }`.
- `statementPeriodSchema` en `schemas.ts`: `{ desde?, hasta? }` → `{ from, to }` con el defecto de AC2 (recibe `today`).
- `getStatement(customerId, from, to)` en `queries.ts`: lee todos los movimientos del cliente con la misma consulta de `getAccount` (se extrae un `movementsOf(customerId)` privado en el mismo archivo) y llama `buildStatement`.
- Página: `requireUser("DUENO")`, valida `id` con `z.uuid()`, compone `getCustomer` + `getStatement`.

## Reutilizar
Verificado con Grep:
- `src/modules/accounts/queries.ts` — la consulta de `getAccount` (con `orders.number`); `ACCOUNT_MOVEMENT_LIMIT` no aplica aquí.
- `src/modules/accounts/components/account-view.tsx` — el mapa `TYPE` de etiquetas (se exporta para no copiarlo).
- `src/modules/inventory` (index) — `todayInLima`, `addDays`.
- `src/lib/date.ts` `formatDate`, `src/lib/money.ts` `formatSoles`, `src/lib/payment.ts` `paymentLabel`, `src/lib/brand.ts` `BRAND`.
- `src/modules/customers` — `getCustomer` (trae `phone`).
- `src/components/ui/back-link.tsx` (ya `print:hidden`); nav y header ya son `print:hidden`.
- Patrón de `purchase-form.tsx`: `wa.me/?text=` + `window.print()` + tabla `print:table`.

Nuevo:
- `src/lib/phone.ts` `waNumber(phone)`: hoy es privado en `inventory/components/supplier-list.tsx`; con cuentas son 2 módulos → sube a `lib` (SETUP §1.4).
- `StatementShare` (cliente): no hay un botón de imprimir/compartir reutilizable; es lo único que necesita JS.

## Tareas
- [x] T1 — `buildStatement` puro con test: sin movimientos; todo antes del periodo (solo saldo anterior); movimientos en el borde `desde`/`hasta`; después de `hasta` no cuentan; ajuste negativo; identidad de AC4 · `src/modules/accounts/account-math.ts`, `account-math.test.ts`
- [x] T2 — `waNumber` a `src/lib/phone.ts` con test (9 dígitos → 51…, con espacios, ya con 51) y `supplier-list.tsx` lo importa · `src/lib/phone.ts`, `src/lib/phone.test.ts`, `src/modules/inventory/components/supplier-list.tsx`
- [x] T3 — `statementPeriodSchema` con test del defecto y los inválidos de AC2; `movementsOf` + `getStatement` · `src/modules/accounts/schemas.ts`, `schemas.test.ts`, `queries.ts`
- [x] T4 — `StatementView` (servidor: encabezado, resumen, tabla, filtro GET) y `StatementShare` (`"use client"`: WhatsApp + Imprimir, `print:hidden`); exportar `TYPE` como `MOVEMENT_LABEL` desde `account-view.tsx`; exports en el index · `src/modules/accounts/components/statement-view.tsx`, `statement-share.tsx`, `account-view.tsx`, `index.ts`
- [x] T5 — Página y enlace desde la ficha · `src/app/(app)/clientes/[id]/estado/page.tsx`, `src/app/(app)/clientes/[id]/cuenta/page.tsx`

## Paralelismo
Paralelo: [T1] [T2]. Luego T3 → T4 → T5 (T4 usa T3; T5 usa T4).

## Notas
- PDF = "Imprimir → Guardar como PDF" de Chrome Android; el dueño adjunta el archivo en WhatsApp. Cumple la decisión del PLAN (PDF desde la oficina) sin dependencias.
- ponytail: `getStatement` lee todos los movimientos del cliente para el saldo anterior (como `getAccount`). Si un cliente pasa de miles, el saldo anterior pasa a un `sum` en SQL.

## Plan E2E (BD única de producción: solo filas `__prueba__`, sin SQL destructivo fuera de ellas)
1. Crear ruta `__prueba__ ruta` y clientes `__prueba__ A` (teléfono 987654321) y `__prueba__ B` (sin teléfono). Para A, con la acción/ledger: SALDO_INICIAL S/ 100 hace 60 días, CARGO S/ 50 hace 10 días, ABONO S/ 30 hace 5 días, AJUSTE −S/ 5 hoy.
2. `/clientes/{A}/estado` sin filtro → periodo de 30 días; saldo anterior 100, entregas 50, cobros 30, ajustes −5, saldo final 115; 3 filas con saldo 150 / 120 / 115.
3. `?desde=` hace 90 días → saldo anterior 0, entregas 150. `?desde` > `hasta` y `?hasta` futura → periodo por defecto.
4. Vista de impresión (emulación `print` en el navegador): sin nav, filtro ni botones; encabezado con empresa, cliente y periodo.
5. WhatsApp de A → `wa.me/51987654321?text=` con las 5 cifras. B → `wa.me/?text=` y "Sin movimientos en este periodo".
6. Como repartidor → redirigido. Id inexistente → 404. Enlace "Estado de cuenta" en la ficha de A.
7. Limpieza, siempre por los ids creados: `movimientos_cuenta` y `auditoria` de A y B, luego los clientes y la ruta `__prueba__`.

## Preguntas
1. Periodo por defecto: ¿últimos 30 días (recomendado: corto y predecible) o desde la última vez que el saldo quedó en cero (explica toda la deuda actual, pero puede ser largo)?
2. ¿Basta con texto + PDF adjunto a mano (recomendado), o quieres un enlace público con token para que el cliente lo abra? Eso es una tabla y una ruta sin login más: otro spec.
3. ¿Las entregas muestran solo "Pedido #N" y el monto (recomendado), o también los productos de cada pedido?

> Aprobado por el humano (2026-11-17): todas las decisiones abiertas con la opción recomendada.
