---
id: 003
title: Leer la factura o guía del proveedor con IA (foto o PDF) en "Recibir"
status: done
module: inventory
---

# 003 — Leer la factura o guía del proveedor con IA

## Objetivo
En "Recibir", el dueño toma una foto de la factura o guía, o sube el PDF que le llegó por WhatsApp o correo. El sistema lee las
líneas y las pone en el formulario de recepción con producto, presentación, cantidad y costo. Las líneas quedan marcadas como
"sugerido" para que él las revise. Nada se guarda hasta que pulse "Guardar ingreso".

## Contexto
- Decisión del usuario: usar 2 lectores. Este spec usa Gemini (IA, plan gratis, el mismo que lee recetas en Farmacia `src/server/ai/prescription-reader.ts`)
  para fotos y PDF. El spec 004 copia el OCR local de Farmacia (Tesseract, sin internet ni costo) para PDF limpios.
- Los documentos llegan como factura en papel (foto), PDF por WhatsApp o correo, o guía de remisión (sin precios).
  Hay varios proveedores con formatos distintos, por eso no se usan columnas fijas.
- El plan gratis de Gemini permite que Google use lo enviado para mejorar sus productos. Una factura de compra es un documento comercial,
  no contiene datos de salud. Si eso preocupa, se activa la facturación en Google y el código no cambia.

## Alcance
Incluye:
- Botón "Leer factura (foto o PDF)".
- Lectura con Gemini desde el servidor.
- Propuesta de líneas con producto y presentación.
- Aprender cómo escribe cada proveedor un producto (alias).
- Propuesta de proveedor y número de documento.
- Comparar el total leído con el del formulario.

No incluye:
- Guardar la imagen o el PDF.
- OCR local (spec 004).
- Crear productos nuevos desde la lectura (si un producto no existe, se crea primero en Productos).
- Tabla de proveedores (spec 006).

## Criterios de aceptación
- [x] AC1 — El botón solo aparece si el servidor tiene `GEMINI_API_KEY`. Sin la clave, "Recibir" funciona igual que en el spec 002.
- [x] AC2 — Acepta foto (cámara o galería) o PDF.
  - La foto se reduce en el navegador a 1600 px por lado mayor y se convierte a JPEG, lo que quita los metadatos.
  - El PDF se envía tal cual, hasta 4 MB.
  - Cualquier otro tipo o tamaño se rechaza con un mensaje.
- [x] AC3 — `POST /api/recepciones/leer` exige sesión DUENO (si no, 401 o 403) y valida tipo, tamaño y firma de bytes (JPEG o `%PDF`).
  - Permite como máximo 20 lecturas cada 10 minutos por usuario, contadas en `auditoria`; si se pasa, responde 429 con un mensaje.
  - La clave nunca llega al navegador.
- [x] AC4 — Pide a Gemini un JSON con proveedor, número de documento, total y líneas `{ descripción, cantidad, unidad, precioUnitario, total, venceEl }`.
  - Consulta varios modelos a la vez y gana el primero que responde, como en Farmacia; el tiempo máximo es 55 s.
  - La respuesta se valida en una función pura: máximo 80 líneas, se descartan las líneas sin descripción o con cantidad 0 o menor.
- [x] AC5 — Cada línea leída se asocia a un producto y una presentación, en este orden:
  1. Alias aprendido (mismo texto normalizado), que da la presentación exacta.
  2. Parecido de palabras con el nombre del producto (umbral fijo con test); la presentación sale de la unidad leída (CJ/CAJA → caja, UND → unidad, DSP → display…) y si no, la mayor.
  3. Sin coincidencia: la línea sale con el texto leído y un buscador para elegir el producto.
- [x] AC6 — Las líneas leídas se **agregan** al formulario (no borran lo escrito), con la etiqueta "Leído: <texto>" y un estado ("aprendido", "sugerido, revisa" o "elige producto").
  - Costo por presentación: el precio unitario leído; si no viene, total ÷ cantidad; si tampoco, queda vacío y marcado.
  - El vencimiento se toma si se leyó; el piso es el de la última línea.
- [x] AC7 — Se proponen el proveedor y el número de documento si están vacíos. Si se leyó el total del documento, se muestra junto al total del formulario y se resalta si no coinciden.
- [x] AC8 — Al guardar, cada línea que vino de la lectura guarda o actualiza el alias `texto normalizado → presentación`, en la misma transacción que la recepción. La próxima factura igual sale "aprendido".
- [x] AC9 — Hay estados de carga ("Leyendo factura…", con opción de cancelar) y de error ("no disponible", "muy ocupado", "no se entendió"), y el formulario siguiente sigue usable. No se guarda la imagen ni el texto completo; la auditoría registra `document.read` (reserva del cupo) y `document.read_result` con la cantidad de líneas.

## Datos (migración nueva)
- Tabla `alias_lectura`, clave TS `readAliases`:
  - `texto` text, primary key (normalizado).
  - `presentacion_id` FK a `presentaciones`.
  - `actualizado_en`.
- Variables de entorno: `GEMINI_API_KEY` y `GEMINI_MODEL` (opcional), en `.env.example`, en Vercel y en `.env.local`.

## Contratos
- `POST /api/recepciones/leer` (multipart `file`) → `{ supplier, document, total, lines: ReadLine[] }` | `{ error }` con 400/401/403/429/502/503.
- `src/modules/inventory/document-read.ts` (puro):
  - `parseReadResponse(text)` → `ReadDocument | null`.
  - `normalizeText(s)`.
  - `matchLine(line, products, aliases)` → `{ packagingId, status: "alias" | "suggested" | "none" }`.
  - `costFromLine(line)` → céntimos | null.
- `receiptSchema.items[].readText?: string` (≤200). Si viene, `receiveGoods` guarda el alias con upsert.

## Reutilizar
- Lector de Farmacia `prescription-reader.ts`: carrera entre modelos, timeout y manejo de 429/503. Se adapta el prompt y se agrega soporte de PDF.
- `ReceiptForm`, `receiveGoods`, `receiptSchema`, `getLastCosts`, `listLocations` del spec 002; `requireUser`/`getCurrentUser`, `audit`.
- `parseSoles` y `formatSoles`.

## Tareas
- [x] T1 — Tabla `alias_lectura`, migración y variables Gemini en `.env.example` · `src/server/db/schema.ts`, `drizzle/*`, `.env.example`
- [x] T2 — Lógica pura de lectura y asociación, con tests · `src/modules/inventory/document-read.ts`, `document-read.test.ts`
- [x] T3 — Cliente Gemini para imagen o PDF · `src/server/ai/document-reader.ts`
- [x] T4 — Ruta de lectura: sesión, validación, límite de uso, auditoría · `src/app/api/recepciones/leer/route.ts`, `src/modules/inventory/read-limit.ts`, `src/proxy.ts` (401 JSON en `/api/*`)
- [x] T5 — Guardar el alias al recibir · `src/modules/inventory/schemas.ts`, `actions.ts`, `queries.ts` (`listReadAliases`)
- [x] T6 — Botón y lectura en el cliente (reducir foto, enviar, cancelar, errores) · `src/modules/inventory/components/read-document-button.tsx`, `product-picker.tsx` (buscador reutilizado por línea y al final)
- [x] T7 — El formulario acepta líneas leídas (estado, buscador por línea, total leído) y la página pasa `readerEnabled` y los alias · `receipt-form.tsx`, `src/app/(app)/recepciones/nueva/page.tsx`, `index.ts`

## Paralelismo
Grupo 0: T1. Luego en paralelo [T2 → T5], [T3 → T4] y [T6]. Al final T7 (usa T2, T5 y T6).

## Notas
- **IGV, a confirmar:** el costo se toma como aparece en el documento y el total leído sirve de cuadre. Si la factura trae "valor unitario" sin IGV y "precio unitario" con IGV, el prompt pide el precio **con** IGV, porque es lo que el dueño paga.
- La guía de remisión no trae precios: las líneas salen sin costo y él lo completa (o lo llena `getLastCosts`).
- El límite de uso se cuenta en `auditoria` y no en memoria, porque en Vercel cada petición puede llegar a otra instancia.
- **Criterio real (a mano):** 5 facturas y 2 PDF reales. Si menos de 7 de cada 10 líneas salen con el producto correcto en la primera lectura, se revisa el prompt o el umbral.
- Nueva numeración: 003 lector IA · 004 lector PDF local (Tesseract) · 005 vencimientos y stock demo · 006 proveedores, kardex y precio sugerido.

## Implementación
- Migración `drizzle/0003_stale_tusk.sql` (solo crea `alias_lectura`) aplicada en Neon. 18 tests (7 nuevos de `document-read`).
- E2E local sin clave (usuarios y producto temporales, borrados): 401 sin sesión, 403 repartidor, 400 bytes/tamaño, 503 sin clave,
  lectura contada en `auditoria`, 429 al pasar 20, botón oculto sin clave, alias guardado al recibir. **La lectura real con Gemini no se probó: falta `GEMINI_API_KEY`.**
- Desvíos: `src/proxy.ts` responde 401 JSON en `/api/*` sin cookie (antes redirigía al login y el fetch recibía HTML);
  `product-picker.tsx` extraído (lo usan la línea sin producto y el buscador final); `parseReadResponse` sin Zod (validación manual: el JSON de la IA es suelto).
- Review vuelta 1: CAMBIOS. Corregido: lógica de la ruta movida al módulo (`fileType` puro con test en `document-read.ts`,
  `reserveReadSlot`/`recordReadResult` en `read-limit.ts`); `proxy.ts` declarado en T4; AC9 refleja las 2 acciones de auditoría;
  `recordReadResult` no rompe la respuesta si falla; 413 temprano por `Content-Length`; comentario del costo de modelos.
- Review vuelta 2: aprobado. Pendiente a mano: lectura real con Gemini (falta `GEMINI_API_KEY`) y criterio de 5 facturas + 2 PDF.
- Prueba real con Gemini (PDF sintético de 6 líneas, 5 s): proveedor, N°, total, cantidades, empaques y costos correctos. Ajustes tras la prueba: talla normalizada y obligatoria al asociar ("34GR" = "34g"; "Arroz 5KG" ya no se asocia a "Arroz 750g"); el prompt busca el vencimiento dentro de la descripción y el N° junto a FACTURA/BOLETA/GUÍA.
