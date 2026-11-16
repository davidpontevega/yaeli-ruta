---
id: 009
title: Cuenta corriente, deuda inicial y cobros en oficina
status: done
module: accounts (nuevo)
---

# 009 — Fiado y cobros

## Objetivo
Saber cuánto debe cada cliente y desde cuándo, sin cuaderno.
1. Pasar una sola vez la deuda que hoy está anotada.
2. Registrar los cobros que se hacen en la oficina.
3. Ver quién debe.

Las entregas (spec 010) y el reparto (fase 4) cargan y cobran sobre esta misma cuenta.

## Alcance
Incluye:
- Movimientos de cuenta append-only. El saldo es la suma de los movimientos.
- Deuda inicial en lote, por ruta.
- Cobro en oficina y ajuste con motivo.
- Ficha del cliente con saldo y movimientos.
- Deudores por ruta con antigüedad.
- Aviso de límite de crédito en el pedido.

No incluye:
- Cargo por entrega (spec 010).
- Cobros en ruta y liquidación del repartidor (fase 4).
- Estado de cuenta en PDF (spec 012).
- Anular o editar movimientos: un error se corrige con un ajuste.

## Criterios de aceptación
- [x] AC1 — `/deudores/inicial` (dueño): clientes activos **sin deuda inicial**, por ruta y en orden de visita, cada uno con un campo de monto (S/).
  - Arriba va una sola fecha, "Fecha del cuaderno", por defecto hoy y no futura.
  - "Guardar" crea un movimiento SALDO_INICIAL por cada monto > 0, en una transacción, con auditoría `account.initial` por cliente.
  - Un cliente solo puede tener una deuda inicial (índice único). Los guardados salen de la lista.
- [x] AC2 — Ficha `/clientes/[id]/cuenta` (dueño):
  - Saldo grande ("Debe S/ 120.50" en rojo, o "Al día"), límite de crédito si tiene, y antigüedad ("debe desde hace 23 días").
  - Debajo, los últimos 100 movimientos del más nuevo al más viejo: fecha, tipo, monto con signo, medio o nota, y saldo después del movimiento.
  - Se llega desde el saldo en la lista de clientes y desde Deudores.
- [x] AC3 — Cobro en la ficha: monto (S/) y medio (Efectivo, Yape, Plin o Transferencia; por defecto Efectivo).
  - No puede ser mayor que el saldo: "El cliente debe S/ X".
  - Crea un ABONO con fecha de hoy (Lima) y audita `account.payment`.
  - Bloquea la fila del cliente para que dos cobros a la vez no pasen el saldo.
- [x] AC4 — Ajuste en la ficha, dentro de `<details>` "Ajustar saldo": monto con signo (+ sube la deuda, − la baja) y motivo obligatorio (3–200).
  - Crea un AJUSTE y audita `account.adjust` con monto y motivo.
  - El saldo no puede quedar negativo.
- [x] AC5 — `/deudores` (dueño): clientes con saldo > 0, filtro por ruta, ordenados por antigüedad (el más antiguo primero).
  - Por cliente: nombre, ruta, teléfono (`tel:`), saldo, antigüedad en días y una marca "Pasó su límite" si saldo > límite.
  - Al pie, el total por cobrar.
  - Link a "Cargar deuda inicial".
- [x] AC6 — Antigüedad = días desde el cargo más viejo que sigue sin pagar, con los abonos aplicados en orden FIFO a los cargos más viejos.
  - Los AJUSTE positivos cuentan como cargo y los negativos como abono.
  - Es lógica pura, con tests.
- [x] AC7 — En el formulario de pedido (nuevo y editar), junto al cliente, se muestra "Debe S/ X" y, si tiene límite, "Límite S/ Y".
  - Si saldo + total del pedido > límite: aviso ámbar "Con este pedido pasa su límite". No bloquea.
- [x] AC8 — La lista de clientes muestra el saldo de cada uno (link a la ficha).
  - La pestaña "Deudores" se suma a Ventas (Pedidos · Clientes · Deudores · Rutas).
  - El repartidor es redirigido en todas las pantallas nuevas.

## Datos (migración nueva)
- Enum `tipo_movimiento_cuenta` (`AccountMovementType`): `SALDO_INICIAL`, `CARGO`, `ABONO`, `AJUSTE`. CARGO lo usa el spec 010.
- Enum `medio_pago` (`PaymentMethod`): `EFECTIVO`, `YAPE`, `PLIN`, `TRANSFERENCIA`.
- `movimientos_cuenta` (`accountMovements`):
  - Columnas: id, `cliente_id` FK, `tipo`, `monto` integer con signo (céntimos; + deuda, − pago; CHECK ≠ 0), `fecha` date, `medio` null (solo ABONO), `nota` null, `usuario_id` FK, `creado_en`.
  - Índice (`cliente_id`, `fecha`). Índice único parcial (`cliente_id`) WHERE `tipo = 'SALDO_INICIAL'`.
  - Append-only, igual que `movimientos_stock`.

## Contratos
- `src/modules/accounts/`:
  - `account-math.ts` (puro, con tests): `debtSince(movements)` → fecha ISO | null, con FIFO. Usa `daysUntil` para la antigüedad.
  - `schemas.ts`: `initialDebtsSchema`, `paymentSchema`, `adjustmentSchema`.
  - `queries.ts`:
    - `balancesByCustomer(customerIds?)` → `Record<id, céntimos>`.
    - `getAccount(customerId)` → saldo, límite, antigüedad y movimientos con saldo acumulado.
    - `listDebtors({ routeId })`.
    - `listWithoutInitialDebt({ routeId })`.
  - `actions.ts`: `saveInitialDebts(state, form)`, `registerPayment(state, form)`, `adjustBalance(state, form)`.
  - `components/`: `account-view.tsx`, `payment-form.tsx`, `adjustment-form.tsx`, `debtor-list.tsx`, `initial-debt-form.tsx`.
- Páginas: `/clientes/[id]/cuenta`, `/deudores`, `/deudores/inicial`.
- Pedidos: `OrderForm` recibe `account: { balance, creditLimit }`. Clientes: `CustomerList` recibe `balances`.

## Reutilizar
- `requireUser`, `audit`, `solesSchema`, `formatSoles`, `formatDate`, `todayInLima`, `daysUntil` (inventario; se exporta).
- `listCustomers` y `listRoutes` (clientes), y `CustomerFilters` para el filtro por ruta.
- Patrones: kardex `movement-list.tsx` (saldo acumulado con función de ventana), `supplier-phone-form.tsx` (formulario corto) y `app-nav.tsx` (pestaña nueva).

## Tareas
- [x] T1 — Esquema y migración · `src/server/db/schema.ts`, `drizzle/*`
- [x] T2 — Antigüedad FIFO pura, con tests · `src/modules/accounts/account-math.ts`, `account-math.test.ts`
- [x] T3 — Esquemas, consultas e index · `src/modules/accounts/schemas.ts`, `queries.ts`, `index.ts`, `src/modules/inventory/index.ts`
- [x] T4 — Acciones: deuda inicial, cobro y ajuste · `src/modules/accounts/actions.ts`
- [x] T5 — Ficha con cobro y ajuste · `components/account-view.tsx`, `payment-form.tsx`, `adjustment-form.tsx`, `src/app/(app)/clientes/[id]/cuenta/page.tsx`
- [x] T6 — Deuda inicial en lote · `components/initial-debt-form.tsx`, `src/app/(app)/deudores/inicial/page.tsx`
- [x] T7 — Deudores, pestaña y saldo en clientes · `components/debtor-list.tsx`, `src/app/(app)/deudores/page.tsx`, `src/components/app-nav.tsx`,
  `src/modules/customers/components/customer-list.tsx`, `src/app/(app)/clientes/page.tsx`
- [x] T8 — Aviso de límite en el pedido · `src/modules/orders/components/order-form.tsx`, `src/app/(app)/pedidos/nuevo/page.tsx`, `pedidos/[id]/page.tsx`

## Paralelismo
Grupo 0: T1. Luego en paralelo T2 y T3. Después T4 → T5 → T6. Al final T7 y T8 en paralelo (no comparten archivos).

## Notas
- **Confirmado por el dueño (16-nov-2026):**
  - El cobro no puede pasar el saldo (sin saldo a favor). Si un cliente paga por adelantado, se registra cuando se entregue.
  - Medios de pago: Efectivo, Yape, Plin y Transferencia.
  - La deuda inicial lleva una sola fecha para todos (la del cuaderno). Si quiere la antigüedad real por cliente, se agrega una fecha por fila.
- Monto con signo en una sola columna: el saldo es `sum(monto)`, sin `CASE`.
- ponytail: el saldo se calcula sumando cada vez (sin columna de saldo). Si pasa de ~100 mil movimientos, se agrega un saldo materializado.

## Implementación
- Migración `drizzle/0007_sad_wallflower.sql` (2 enums y `movimientos_cuenta` con CHECK ≠ 0 e índice único parcial) aplicada en Neon. Solo agrega.
- 48 tests (3 nuevos de `debtSince`). E2E local 24/24 (usuarios, ruta, 3 clientes y movimientos temporales, borrados):
  - Deuda inicial en lote: fecha futura y monto inválido rechazados; se guardan 2 de 3 (vacío se omite); los guardados salen de la lista; una segunda carga solo toma al que faltaba.
  - Ficha: "Debe S/ 150.50", "hace 40 días", límite; cobro mayor al saldo rechazado; cobro con Plin; ajuste sin signo o que deja negativo rechazado; ajuste +10 con motivo.
  - Deudores ordenados por antigüedad, "Pasó su límite" y total por cobrar; saldo en la lista de clientes; deuda, límite y "pasa su límite" en el pedido.
  - Auditoría `account.initial|payment|adjust`. Repartidor redirigido en las 3 pantallas. Pestaña "Deudores" en Ventas.
- Desvíos:
  - `formatDate` pasó a `src/lib/date.ts` (lo usan inventario y cuentas). `daysUntil` se exporta desde inventario.
  - Filtro de ruta propio (`RouteFilter` en `debtor-list.tsx`) en vez de `CustomerFilters`, que trae búsqueda e inactivos que aquí no van.
  - El formulario de cobro solo aparece si el cliente debe. El ajuste siempre está disponible.
  - Tope de S/ 1 millón por movimiento.
- Review vuelta 1: APROBADO con menores. Hechos: la deuda inicial solo se guarda a clientes activos (ids inexistentes o inactivos se ignoran; re-E2E OK);
  mensaje "Cliente inválido" para ids manipulados. Aceptado: cambiar el filtro de ruta en deuda inicial descarta lo escrito y no guardado.
