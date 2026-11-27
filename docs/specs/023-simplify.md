---
id: 023
title: Simplificar la app — "¿Qué hago hoy?", nombres claros, pedir por proveedor, formularios cortos y pasos del reparto
status: done
module: ui (inventory + purchases + delivery + app shell)
---

# 023 — Simplificar la app

## Objetivo
El dueño abre la app y en una pantalla ve qué atender hoy y qué botón tocar, con nombres que entiende ("Llegó mercadería", "Cerrar ruta"), sin lógica de negocio nueva ni migraciones.

## Alcance
Incluye: Inicio único (alertas de hoy + botones grandes) para celular y PC; renombrar etiquetas (URLs iguales); bloque "Lo que falta, por proveedor" en `/compras` con WhatsApp y "Crear lista"; `<details>` "Más datos" en el formulario de Llegó mercadería; pasos ①–④ en `/reparto/[id]`.
No incluye: offline/PWA, toma de pedidos en ruta offline, notificaciones, repartidor en Reparto (ver Preguntas), crear la lista en un toque sin abrir el formulario, cambios de validación. Formulario de producto: ya tiene "Más opciones (no obligatorio)" — sin cambios.

## Criterios de aceptación
- [ ] AC1 — Inicio (una sola columna, `max-w-3xl`, se borra el bloque de escritorio con KPIs/`TodayOrders`/`MissingList`): saludo → "Hoy" → botones → `ReceivableCard` (si `can("/clientes")`).
- [ ] AC2 — "Hoy" (`HomeAlerts`): vencidos, **vencen esta semana** (≤ 7 días), stock bajo, entregas de hoy (`entregados de total`, `/pedidos`), hojas en ruta hoy (`/reparto`), precios por revisar (dueño). Cada fila solo si `can(href)`; las que están en 0 se agrupan en una línea "Todo bien: …" en lugar de una fila cada una.
- [ ] AC3 — Botones grandes (≥ 72 px, 2 columnas en celular), cada uno solo si `can(href)`: Anotar pedido `/pedidos/nuevo` (Pregunta 1), Llegó mercadería `/recepciones/nueva`, Pedir a proveedores `/compras`, Salir a repartir `/reparto`, Ver mi stock `/stock`, Catálogo `/productos/catalogo`. El repartidor ve solo los suyos (hoy: Ver mi stock) y nunca costos.
- [ ] AC4 — Nombres nuevos en menú (`MENUS` y `SECTIONS`), "+" rápido, títulos, `BackLink` (`NAMES`/`nameOf`) y botones: Ingreso/Ingreso de mercadería → "Llegó mercadería" (corto "Llegó"); Lista(s) de pedido → "Pedir a proveedor" (corto "Pedir"); Picking → "Lista para cargar"; Liquidar/Liquidación/Liquidada → "Cerrar ruta"/"Ruta cerrada"/"Cerrada"; Movimientos/Kardex → "Historial". "Por vencer" igual. `grep -rn "Liquid\|Picking\|Kardex\|Ingreso de\|ista de pedido" src --include=*.tsx` solo deja comentarios/identificadores.
- [ ] AC5 — `/compras` (título "Pedir a proveedor"): arriba "Lo que falta, por proveedor": una tarjeta por proveedor con algo en `listMissingBySupplier()` (orden por nombre), sus líneas `cantidad presentación · producto`, botón "Enviar por WhatsApp" (`wa.me/{waNumber(phone)}?text=…`, sin teléfono `wa.me/?text=…`; texto sin costos) y "Crear lista" → `/compras/nueva?proveedor={id}` (ya precarga). Sin faltantes: "Todo tiene stock". Debajo, las listas guardadas como hoy.
- [ ] AC6 — El texto de WhatsApp sale de una función pura `orderText` y el formulario de lista la usa en su rama sin costos (mismo texto que hoy).
- [ ] AC7 — Llegó mercadería: a la vista producto, cantidad, presentación, vence y dónde lo guardas; dentro de `<details>` "Más datos" por línea: costo y subtotal; en la cabecera: N° guía/factura. El `<details>` de la línea arranca abierto si el costo está vacío (es `required`). Validación y `data` enviados sin cambios.
- [ ] AC8 — `/reparto/[id]`: barra de pasos ① Armar ② Cargar ③ Entregar ④ Cerrar ruta; paso actual = `sheetStep` (abajo), los anteriores con check, `LIQUIDADA` = todos con check.
- [ ] AC9 — Solo la acción del paso actual es `btn-primario`: ② "Cargar vehículo"; ③ "Entregar" de cada pedido pendiente (y "Cerrar ruta" `btn-secundario`); ④ "Cerrar ruta". En `EN_RUTA` el panel "Cerrar ruta" va primero; la carga del vehículo y "Devolver al almacén" van en `<details>` "Ver carga del vehículo".

## Datos
Sin cambios de esquema.

## Contratos
- `src/modules/delivery/sheet-step.ts` (puro): `sheetStep(status: SheetStatus, orders: number): 1 | 2 | 3 | 4 | 5` — `PREPARANDO` 0 → 1, `PREPARANDO` > 0 → 2, `EN_RUTA` > 0 → 3, `EN_RUTA` 0 → 4, `LIQUIDADA` → 5 (terminado). `orders` = pendientes de la hoja (`sheet.orders.length`).
- `src/modules/purchases/order-text.ts` (puro): `orderText(lines: { quantity; packagingName; productName }[], number?: number)` → `"Pedido #N — Distribuidora Yaeli\n2 Caja · Arroz…"`.
- `listMissingBySupplier()` agrega `productName`, `packagingName` (aditivo; consumidores actuales intactos).
- `getAlertCounts()` agrega `within7` (lotes con stock que vencen entre hoy y hoy+7).
- `HomeAlerts` recibe además `today: { count; delivered } | null` y `onRoad: number | null`.

## Reutilizar
Verificado con Grep:
- `src/lib/menus.ts` — `canSee`, `MENUS` (etiquetas); `src/components/app-nav.tsx` — `SECTIONS`, `QUICK`.
- `src/components/ui/back-link.tsx` — `NAMES`, `nameOf`.
- `src/modules/inventory/components/home-alerts.tsx` — `HomeAlerts`; `src/modules/inventory/queries.ts` — `getAlertCounts`, `listSupplierStats` (nombre, teléfono).
- `src/modules/orders` — `todaySummary`; `src/modules/delivery` — `listSheets(todayInLima())` para hojas `EN_RUTA`.
- `src/modules/purchases/queries.ts` — `listMissingBySupplier` (cantidad sugerida, presentación más grande); `/compras/nueva?proveedor=` ya precarga las líneas.
- `src/lib/phone.ts` — `waNumber`; `src/modules/accounts` — `ReceivableCard`.
- `src/modules/delivery/components/` — `LoadActions`, `PickingList`, `SettlementPanel`, `SheetOrders` sin cambios de lógica.
Nuevo: `sheetStep` (no hay mapeo estado → paso), `orderText` (hoy inline en `purchase-form.tsx`), `SupplierOrders` y `SheetStepper` (componentes de vista).

## Tareas
- [x] T1 — `sheetStep` + test (5 casos de Contratos) · `src/modules/delivery/sheet-step.ts`, `sheet-step.test.ts`
- [x] T2 — `orderText` + test (con y sin número, vacío); `purchase-form.tsx` lo usa en la rama sin costos; `listMissingBySupplier` con nombres; export `orderText` · `src/modules/purchases/order-text.ts`, `order-text.test.ts`, `src/modules/purchases/components/purchase-form.tsx`, `src/modules/purchases/queries.ts`, `src/modules/purchases/index.ts`
- [x] T3 — Renombres (AC4) · `src/lib/menus.ts`, `src/components/app-nav.tsx`, `src/components/ui/back-link.tsx`, `src/app/(app)/compras/nueva/page.tsx`, `src/app/(app)/compras/[id]/page.tsx`, `src/app/(app)/proveedores/page.tsx`, `src/app/(app)/recepciones/nueva/page.tsx`, `src/app/(app)/precios/page.tsx`, `src/app/(app)/productos/[id]/movimientos/page.tsx`, `src/modules/catalog/components/product-list.tsx`, `src/modules/inventory/components/movement-list.tsx`, `src/modules/delivery/components/sheet-list.tsx`
- [x] T4 — Inicio (AC1–AC3): `within7`, `HomeAlerts` con filas nuevas y "Todo bien", página nueva · `src/modules/inventory/queries.ts`, `src/modules/inventory/components/home-alerts.tsx`, `src/app/(app)/page.tsx`
- [x] T5 — `SupplierOrders` (AC5) y `/compras` lo compone con `listSupplierStats` + `listMissingBySupplier`; título "Pedir a proveedor" · `src/modules/purchases/components/supplier-orders.tsx`, `src/modules/purchases/index.ts`, `src/app/(app)/compras/page.tsx`
- [x] T6 — "Más datos" en Llegó mercadería (AC7) · `src/modules/inventory/components/receipt-form.tsx`
- [x] T7 — `SheetStepper` + página por pasos (AC8–AC9); renombres de `PickingList` y `SettlementPanel`; botón "Cerrar ruta" secundario si hay pendientes, "Entregar" primario · `src/modules/delivery/components/sheet-stepper.tsx`, `src/modules/delivery/index.ts`, `src/app/(app)/reparto/[id]/page.tsx`, `src/modules/delivery/components/settlement-panel.tsx`, `src/modules/delivery/components/picking-list.tsx`

## Paralelismo
Paralelo: [T1 → T7] [T2 → T5] [T3] [T4] [T6] (T5 tras T2 por `purchases/index.ts`).

## Notas
- `<details>` cerrado con un `required` vacío dentro bloquea el envío sin aviso visible en Chrome ("not focusable"): por eso la línea abre "Más datos" si el costo está vacío (AC7). Revisar también al leer factura (líneas sin costo).
- "Hojas en ruta" usa `listSheets(hoy)`: una hoja `EN_RUTA` de un día anterior no sale en Inicio (sí en `/reparto?fecha=`). Upgrade: query `countOnRoad()` sin fecha si pasa.
- `MENUS.label` también se ve en `/menus` y `/usuarios` (checks): el renombre se refleja ahí sin tocar nada; las `key` no cambian (los `hidden` guardados siguen valiendo).
- `NavTrail` guarda URLs, no nombres: los "Volver a …" ya guardados en la sesión muestran el nombre nuevo.

## Preguntas
1. ¿Botón "Anotar pedido" en Inicio además de los 5? Recomendado: sí, primero — él toma pedidos por teléfono antes de salir y hoy es el botón principal; quitarlo empeora su tarea diaria.
2. ¿Dónde vive "Pedir a proveedores"? Recomendado: arriba de `/compras` (es la entrada del menú "Pedir a proveedor"; `/proveedores` queda como agenda de contactos). Alternativa: reordenar `/proveedores`, que ya agrupa por proveedor pero sin productos ni texto de WhatsApp.
3. El repartidor no ve Reparto (`/reparto/*` y sus acciones exigen `DUENO`). ¿Lo abrimos aquí? Recomendado: no — es un cambio de permisos (acciones, ocultar costos/margen en la hoja y en cerrar ruta) y va en su propio spec junto con offline; aquí solo se muestran los botones que ya puede usar.

**Decisiones (aprobadas 27-nov-2026):** 1 = sí, "Anotar pedido" primero en el inicio; 2 = "Pedir a proveedores" arriba de `/compras`; 3 = repartidor sin acceso a entregar en este spec (va con offline).
