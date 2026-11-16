---
id: 013
title: Lista de compra con peso, flete y costo
status: done
module: purchases (nuevo) + inventory + catalog
---

# 013 — Lista de compra

## Objetivo
Reemplazar la hoja del cuaderno con la que el dueño compra (Cantidad · Producto · Peso · Flete · Costo). Hay dos casos:
1. **El proveedor envía**: la lista se le pasa al vendedor por WhatsApp.
2. **Voy con mi camión**: el dueño la lleva al mercado o a varios proveedores. Ve si el peso entra en el vehículo y anota el flete de cada línea.

Al llegar, la lista se convierte en el ingreso. El flete de cada línea se suma al costo de esa línea, así el % de ganancia se calcula sobre el costo real.

## Alcance
Incluye:
- Lista de compra en borrador: tipo, proveedor, vehículo y líneas con cantidad, presentación, costo y flete.
- Totales: peso contra la capacidad del vehículo, mercadería, flete y total.
- "Agregar lo que falta" de un proveedor, según el stock mínimo (spec 011).
- Compartir por WhatsApp e imprimir.
- "Recibir esta compra": llena el formulario de Recibir con el costo ya cargado con su flete.
- Capacidad en kg de cada vehículo.

No incluye:
- Sugerencia por ventas y cobertura (spec 014).
- Cuentas por pagar al proveedor.
- Varios ingresos parciales para una misma lista: se recibe una vez.

## Criterios de aceptación
- [x] AC1 — Pestaña "Compras" en Almacén (solo el dueño). `/compras` lista las compras más nuevas primero, con:
  - N°, fecha, tipo ("Envía proveedor" o "Recojo"), proveedor o vehículo, N° de líneas, peso total, total y estado (Borrador, Recibida o Anulada).
  - Botón "+ Nueva compra".
- [x] AC2 — Formulario (`/compras/nueva` y `/compras/[id]` en borrador):
  - Tipo con dos botones; por defecto "Envía proveedor".
  - Proveedor (select; obligatorio si envía el proveedor).
  - Vehículo (select de ubicaciones VEHICULO, solo en "Recojo").
  - Líneas con el buscador de productos (`ProductPicker`): cantidad, presentación (por defecto la más grande), costo S/ por presentación y, solo en Recojo, flete S/ de la línea.
  - El costo viene lleno con el último ingreso de esa presentación (`getLastCosts`); si no hay, con último costo × factor.
- [x] AC3 — Por línea se ven el peso (cantidad × peso de la presentación, o "sin peso") y el subtotal. Arriba, siempre visibles:
  - **Peso total** ("1 238 kg / 1 500 kg", con barra en rojo si pasa la capacidad; sin capacidad, solo el peso).
  - **Mercadería**, **Flete** y **Total**.
  - El aviso "N productos sin peso" cuando corresponde.
- [x] AC4 — "Agregar lo que falta" (con un proveedor elegido) agrega sus productos activos en estado Bajo o Agotado.
  - Cantidad = lo que falta para el mínimo, redondeado hacia arriba en la presentación más grande (`missingToOrder`). Un agotado sin mínimo agrega 1.
  - No duplica líneas que ya existen.
- [x] AC5 — Guardar valida en el servidor y guarda la lista y sus líneas en una transacción, con auditoría `purchase.create|update`.
  - Valida: presentaciones de productos activos, cantidad de 1 a 100 000, costo y flete ≥ 0, proveedor obligatorio si envía el proveedor, y vehículo de tipo VEHICULO.
  - Editar reemplaza las líneas y solo se permite en Borrador.
  - "Anular" pide confirmación, deja la lista Anulada y audita `purchase.cancel`.
- [x] AC6 — Compartir y llevar:
  - "Enviar por WhatsApp" abre `wa.me` con el texto de la lista: una línea "6 caja · Aceite Sello 1L" por producto. Si envía el proveedor, va sin costos.
  - "Imprimir" usa la impresión del navegador; la cabecera y la barra inferior no salen en papel.
- [x] AC7 — "Recibir esta compra" (en Borrador) lleva a `/recepciones/nueva?compra=<id>`. El formulario de Recibir viene con el tipo COMPRA, el proveedor y una línea por ítem:
  - Presentación, cantidad, piso por defecto (el primero) y vencimiento vacío.
  - Costo = costo + flete ÷ cantidad, redondeado al céntimo (`landedUnitCost`).

  Al guardar el ingreso, en la misma transacción la compra queda Recibida y apunta a su recepción. Si ya no está en Borrador, el ingreso se rechaza: "La compra ya fue recibida o anulada".
- [x] AC8 — Capacidad del vehículo: en Catálogo, cada ubicación VEHICULO tiene un campo "Carga máx. kg" editable, auditado como `location.capacity`.
- [x] AC9 — Lógica pura con tests: `lineWeight`, `purchaseTotals`, `landedUnitCost`, `missingToOrder`. El repartidor es redirigido en todas las pantallas nuevas.

## Datos (migración nueva)
- `ubicaciones.capacidad_kg` integer null.
- Enums `tipo_compra` (`ENVIA_PROVEEDOR`, `RECOJO`) y `estado_compra` (`BORRADOR`, `RECIBIDA`, `ANULADA`).
- `compras` (`purchases`): id, `numero` serial unique, `tipo`, `proveedor_id` null FK, `vehiculo_id` null FK a `ubicaciones`, `estado`, `recepcion_id` null FK, `usuario_id`, `creado_en`.
- `compra_items` (`purchaseItems`): id, `compra_id` FK, `presentacion_id` FK, `cantidad` > 0, `costo` ≥ 0 (céntimos por presentación), `flete` ≥ 0 (céntimos por línea).
  Unique (`compra_id`, `presentacion_id`).

## Contratos
- `src/modules/purchases/`:
  - `purchase-math.ts` (puro, con tests).
  - `schemas.ts`, `queries.ts` (`listPurchases`, `getPurchase`, `missingForSupplier`), `actions.ts` (`savePurchase`, `cancelPurchase`).
  - `components/purchase-form.tsx`, `purchase-list.tsx`.
  - `index.ts`.
- Inventario:
  - `ReceiptForm` recibe `initial?: { supplier, lines, purchaseId }`.
  - `receiveGoods` acepta `purchaseId` y marca la compra Recibida.
  - Página de Recibir: lee `?compra=`.
- Catálogo: `setLocationCapacity` y el campo en `catalog-summary`.

## Reutilizar
- `ProductPicker`, `listProducts`, `getLastCosts`, `listLocations`, `listCatalogOptions` (proveedores), `listStock` (estado del spec 011), `stockStatus`, `formatKg`, `parseSoles`, `formatSoles`, `requireUser` y `audit`.
- Patrones de `order-form.tsx` (líneas en el cliente, JSON en un input oculto, anular con confirmación) y `order-list.tsx`.

## Tareas
- [x] T1 — Esquema y migración · `src/server/db/schema.ts`, `drizzle/*`
- [x] T2 — Lógica pura con tests · `src/modules/purchases/purchase-math.ts`, `purchase-math.test.ts`
- [x] T3 — Capacidad del vehículo en Catálogo · `src/modules/catalog/actions.ts`, `components/catalog-summary.tsx`, `queries.ts`
- [x] T4 — Esquemas, consultas y acciones de compras · `src/modules/purchases/schemas.ts`, `queries.ts`, `actions.ts`, `index.ts`
- [x] T5 — Formulario con totales, "Agregar lo que falta", WhatsApp e imprimir · `components/purchase-form.tsx`, `src/app/(app)/compras/nueva/page.tsx`, `compras/[id]/page.tsx`
- [x] T6 — Lista y pestaña · `components/purchase-list.tsx`, `src/app/(app)/compras/page.tsx`, `src/components/app-nav.tsx`, `src/app/globals.css` (impresión)
- [x] T7 — Recibir desde la compra · `src/modules/inventory/components/receipt-form.tsx`, `actions.ts`, `schemas.ts`, `src/app/(app)/recepciones/nueva/page.tsx`

## Paralelismo
Grupo 0: T1. Luego en paralelo T2 y T3. Después T4 → T5 → T6. T7 al final, porque toca inventario y depende de T4.

## Notas
- Decisiones del dueño: el flete se escribe a mano por línea y se paga aparte del costo de la mercadería, pero se suma al costo del producto al recibir. Tiene 2 vehículos (furgón y camión) con capacidad por definir; sin capacidad, la lista muestra solo el peso.
- El costo de cada línea es por presentación, igual que en Recibir. El "Costo" del cuaderno es el total de la línea, que aquí se ve como subtotal.
- ponytail: se recibe la lista completa una sola vez. Si llega incompleta, el dueño ajusta las cantidades en Recibir antes de guardar.

## Implementación
- Migración `drizzle/0010_black_mentor.sql` (`ubicaciones.capacidad_kg`, enums, `compras`, `compra_items` con CHECKs) aplicada en Neon. Solo agrega.
- 59 tests (4 nuevos de `purchase-math`). E2E local 20/20 (proveedor, vehículo, productos, compras y recepción temporales, borrados):
  - Capacidad 1500 kg desde Catálogo. "Lo que falta" propone 3 cajas para un agotado con mínimo 30 (factor 12).
  - Rechazos: Envía proveedor sin proveedor; un piso usado como vehículo.
  - Envía proveedor: guarda sin vehículo y con flete 0, aunque el formulario mande flete. El WhatsApp va sin costos.
  - Recojo: totales 95 kg / 1,500 kg, mercadería S/ 450.00, flete S/ 24.00, total S/ 474.00. Lista con estado. Editar reemplaza las líneas.
  - Recibir: formulario prellenado con 69.00 (65 + 24 ÷ 6). Al guardar, la compra queda RECIBIDA con su recepción y el último costo pasa a 5.75 por unidad. Un segundo ingreso con la misma compra se rechaza; solo existe una recepción. La vista recibida es de solo lectura.
  - Anular, auditoría `purchase.create|update|cancel` y `location.capacity`. El repartidor es redirigido.
- Desvíos:
  - `listMissingBySupplier` calcula lo que falta de todos los proveedores al cargar la página, y el formulario filtra por el proveedor elegido (sin otra consulta).
  - `defaultCosts` junta el último ingreso por presentación con el último costo × factor.
  - `listProducts` y `listStock` devuelven `supplierId`; los `packagings` de `listStock` incluyen `id`.
  - "Recojo" permite "Varios proveedores" (proveedor vacío).
  - En papel se ocultan la cabecera y la barra con `print:hidden`, sin CSS global.
  - `receiveGoods` va dentro de un try/catch para revertir con mensaje: el diff de `inventory/actions.ts` es grande solo por la sangría (con `git diff -w` son +22 −1).
- Review vuelta 1: CAMBIOS (1 mayor). Corregido:
  - Un borrador con un producto que se desactivó después ya no pierde la línea en silencio: se carga con inactivos, la línea se ve marcada "inactivo: quítalo para guardar" y el servidor rechaza el guardado. El buscador solo ofrece productos activos.
  - Recibir con `purchaseId` exige tipo COMPRA.
  - Si la compra ya fue recibida o anulada, la página de Recibir avisa.
  - `setLocationCapacity` audita solo si cambió una fila.
  - `PurchaseType` viene del esquema. El JSDoc de `receiveGoods` está en su lugar y `print:hidden` va al final de las clases.

  Re-E2E 3/3.
- Review vuelta 2: APROBADO.
