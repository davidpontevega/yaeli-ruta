---
id: 003
title: Leer la factura o guía del proveedor con IA (foto o PDF) en "Recibir"
status: draft
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
- [ ] AC1 — El botón solo aparece si el servidor tiene `GEMINI_API_KEY`. Sin la clave, "Recibir" funciona igual que en el spec 002.
- [ ] AC2 — Acepta foto (cámara o galería) o PDF.
  - La foto se reduce en el navegador a 1600 px por lado mayor y se convierte a JPEG, lo que quita los metadatos.
  - El PDF se envía tal cual, hasta 4 MB.
  - Cualquier otro tipo o tamaño se rechaza con un mensaje.
- [ ] AC3 — `POST /api/recepciones/leer` exige sesión DUENO (si no, 401 o 403) y valida tipo, tamaño y firma de bytes (JPEG o `%PDF`).
  - Permite como máximo 20 lecturas cada 10 minutos por usuario, contadas en `auditoria`; si se pasa, responde 429 con un mensaje.
  - La clave nunca llega al navegador.
- [ ] AC4 — Pide a Gemini un JSON con proveedor, número de documento, total y líneas `{ descripción, cantidad, unidad, precioUnitario, total, venceEl }`.
  - Consulta varios modelos a la vez y gana el primero que responde, como en Farmacia; el tiempo máximo es 55 s.
  - La respuesta se valida en una función pura: máximo 80 líneas, se descartan las líneas sin descripción o con cantidad 0 o menor.
- [ ] AC5 — Cada línea leída se asocia a un producto y una presentación, en este orden:
  1. Alias aprendido (mismo texto normalizado), que da la presentación exacta.
  2. Parecido de palabras con el nombre del producto (umbral fijo con test); la presentación sale de la unidad leída (CJ/CAJA → caja, UND → unidad, DSP → display…) y si no, la mayor.
  3. Sin coincidencia: la línea sale con el texto leído y un buscador para elegir el producto.
- [ ] AC6 — Las líneas leídas se **agregan** al formulario (no borran lo escrito), con la etiqueta "Leído: <texto>" y un estado ("aprendido", "sugerido, revisa" o "elige producto").
  - Costo por presentación: el precio unitario leído; si no viene, total ÷ cantidad; si tampoco, queda vacío y marcado.
  - El vencimiento se toma si se leyó; el piso es el de la última línea.
- [ ] AC7 — Se proponen el proveedor y el número de documento si están vacíos. Si se leyó el total del documento, se muestra junto al total del formulario y se resalta si no coinciden.
- [ ] AC8 — Al guardar, cada línea que vino de la lectura guarda o actualiza el alias `texto normalizado → presentación`, en la misma transacción que la recepción. La próxima factura igual sale "aprendido".
- [ ] AC9 — Hay estados de carga ("Leyendo factura…", con opción de cancelar) y de error ("no disponible", "muy ocupado", "no se entendió"), y el formulario siguiente sigue usable. No se guarda la imagen ni el texto completo; la auditoría registra `document.read` con la cantidad de líneas.

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
- [ ] T1 — Tabla `alias_lectura`, migración y variables Gemini en `.env.example` · `src/server/db/schema.ts`, `drizzle/*`, `.env.example`
- [ ] T2 — Lógica pura de lectura y asociación, con tests · `src/modules/inventory/document-read.ts`, `document-read.test.ts`
- [ ] T3 — Cliente Gemini para imagen o PDF · `src/server/ai/document-reader.ts`
- [ ] T4 — Ruta de lectura: sesión, validación, límite de uso, auditoría · `src/app/api/recepciones/leer/route.ts`
- [ ] T5 — Guardar el alias al recibir · `src/modules/inventory/schemas.ts`, `actions.ts`, `queries.ts` (`listReadAliases`)
- [ ] T6 — Botón y lectura en el cliente (reducir foto, enviar, cancelar, errores) · `src/modules/inventory/components/read-document-button.tsx`
- [ ] T7 — El formulario acepta líneas leídas (estado, buscador por línea, total leído) y la página pasa `readerEnabled` y los alias · `receipt-form.tsx`, `src/app/(app)/recepciones/nueva/page.tsx`, `index.ts`

## Paralelismo
Grupo 0: T1. Luego en paralelo [T2 → T5], [T3 → T4] y [T6]. Al final T7 (usa T2, T5 y T6).

## Notas
- **IGV, a confirmar:** el costo se toma como aparece en el documento y el total leído sirve de cuadre. Si la factura trae "valor unitario" sin IGV y "precio unitario" con IGV, el prompt pide el precio **con** IGV, porque es lo que el dueño paga.
- La guía de remisión no trae precios: las líneas salen sin costo y él lo completa (o lo llena `getLastCosts`).
- El límite de uso se cuenta en `auditoria` y no en memoria, porque en Vercel cada petición puede llegar a otra instancia.
- **Criterio real (a mano):** 5 facturas y 2 PDF reales. Si menos de 7 de cada 10 líneas salen con el producto correcto en la primera lectura, se revisa el prompt o el umbral.
- Nueva numeración: 003 lector IA · 004 lector PDF local (Tesseract) · 005 vencimientos y stock demo · 006 proveedores, kardex y precio sugerido.
