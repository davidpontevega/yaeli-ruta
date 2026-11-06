---
id: 004
title: Leer el PDF de la factura en el celular, sin internet ni IA
status: done
module: inventory
---

# 004 — Lector local de PDF (y foto sin internet)

## Objetivo
Leer el PDF de la factura en el propio celular, sin internet, sin costo y sin enviarlo a nadie. La IA (spec 003) queda para fotos
y para PDF escaneados cuando hay internet.

## Contexto
- Las facturas electrónicas que llegan por WhatsApp o correo casi siempre traen **capa de texto** (se puede seleccionar el texto).
  Ese texto se lee exacto con `pdfjs-dist`, sin OCR: no hay errores de lectura, solo hay que armar la tabla.
- El OCR de Farmacia (Tesseract, columnas por encabezado) se usa solo cuando el PDF es una imagen escaneada o la foto se lee sin internet.
  En Farmacia leía bien una cotización limpia y mal las fotos de celular. Aquí es un respaldo, no el camino principal.
- Las líneas leídas entran al formulario igual que las de la IA: `ReadDocument` → `matchLine` → "aprendido / sugerido / elige producto".

## Alcance
Incluye:
- PDF con texto: lectura local de las posiciones de las palabras, encabezados, columnas y filas.
- PDF escaneado o foto sin internet: Tesseract en el navegador, sobre la página entera, con el mismo armado de tabla.
- Un solo botón que elige el lector.

No incluye:
- Lectura columna por columna con caracteres permitidos, plantillas por proveedor y enderezar fotos (los specs 008 y 009 de Farmacia).
- Visor de la imagen junto al formulario.

## Criterios de aceptación
- [x] AC1 — El botón "Leer factura (foto o PDF)" aparece siempre, aunque no haya `GEMINI_API_KEY`. El lector se elige así:
  - **PDF**: primero la capa de texto. Si da al menos 1 línea, termina ahí. Si no, usa la IA cuando hay clave e internet; si no, Tesseract.
  - **Foto**: la IA cuando hay clave e internet; si no, Tesseract.
  - El aviso dice qué lector se usó ("Leído en el celular" o "Leído con IA").
- [x] AC2 — PDF con texto de 1 a 10 páginas: se leen todas y las filas se juntan. Un PDF de 1 página con texto se lee sin internet en menos de 3 segundos en un celular de gama media.
- [x] AC3 — Encabezados: se busca la línea con más rótulos conocidos. Para armar la tabla hacen falta cantidad, descripción y (precio o importe).
  - Cantidad: CANT.
  - Unidad: UM, U.M., UNID, UNIDAD, MEDIDA.
  - Descripción: DESCRIPCION, DETALLE, PRODUCTO.
  - Precio: P.UNIT, PRECIO, V.UNIT, VALOR UNIT.
  - Importe: IMPORTE, TOTAL, SUBTOTAL, VALOR VENTA.
  - Vencimiento: VCTO, VENCE, F.V., EXP.
  - Si no los encuentra: "No se encontró la tabla del documento; prueba con la IA o llena a mano", y el formulario sigue usable.
- [x] AC4 — Filas:
  - Cada línea bajo el encabezado con cantidad > 0 y descripción es una fila. Las palabras van a la columna en la que cae su centro.
  - Una línea solo con texto en descripción continúa la descripción de la fila anterior.
  - La tabla termina en la primera línea de pie: OP. GRAVADA, SUB TOTAL, IGV, TOTAL, SON:, IMPORTE TOTAL.
- [x] AC5 — Si hay "precio con IGV" y "valor sin IGV", se usa el con IGV, igual que en el spec 003.
  - Se reutilizan los conversores de montos y fechas del spec 003: la coma decimal y la de miles funcionan y las fechas inválidas dan `null`.
  - Del texto completo se proponen el número de comprobante (`[FBET]\w{3}-\d+`), el total (línea "TOTAL" o "IMPORTE TOTAL") y el emisor (primera línea con "S.A.C.", "S.A.", "E.I.R.L." o "S.R.L.").
- [x] AC6 — Tesseract corre en un worker, con avance ("Leyendo página 1 de 2…") y cancelable.
  - El motor y el idioma se descargan una vez y el navegador los guarda. Sin internet y sin esa descarga previa, avisa: "Primero lee una factura con internet".
  - Se cargan solo al usarse; no pesan en la página.
- [x] AC7 — Nada sale del celular en el camino local: sin petición al servidor ni auditoría. Las líneas se agregan al formulario y nada se guarda hasta "Guardar ingreso".

## Datos
Sin migración. Dependencias nuevas, solo del cliente: `pdfjs-dist` y `tesseract.js`, las mismas versiones que Farmacia.

## Contratos
- `table-read.ts` (puro, con tests): `groupLines(words)`, `findTableHeader(lines)` → columnas | null, `linesToDocument(words, fullText)` → `ReadDocument | null`.
  `Word = { text, x0, x1, y0, y1 }`.
- `pdf-text.ts` (cliente): `pdfWords(file)` → `{ pages: Word[][], text }`, y `renderPage(file, n)` → canvas.
- `ocr-words.ts` (cliente): `ocrWords(canvas, signal, onProgress)` → `Word[]` (Tesseract `spa`).
- `read-local.ts` (cliente): `readLocal(file, { signal, onProgress, allowOcr })` → `ReadDocument | null`.

## Reutilizar
- De Farmacia: `src/lib/ocr/layout.ts` (`groupLines` y la idea de `findHeader`) y `src/lib/ocr/pdf.ts` (worker de pdfjs y render), adaptados.
  `src/lib/ocr/engine.ts`: crear y terminar el worker, `untilAborted` y la cancelación.
- Del spec 003: `ReadDocument`, `matchLine`, `costFromLine` y los conversores `toCents` / `toIsoDate` (se exportan), `ReadDocumentButton` y `addRead` de `ReceiptForm`.

## Tareas
- [x] T1 — Dependencias `pdfjs-dist` y `tesseract.js` · `package.json`
- [x] T2 — Armado de tabla puro, con tests (encabezados, columnas, filas, continuación, pie, datos del documento) · `src/modules/inventory/table-read.ts`, `table-read.test.ts`, `document-read.ts` (exportar conversores)
- [x] T3 — Palabras y render de PDF con pdfjs · `src/modules/inventory/pdf-text.ts`
- [x] T4 — OCR de página con Tesseract · `src/modules/inventory/ocr-words.ts`
- [x] T5 — Orquestador local · `src/modules/inventory/read-local.ts`
- [x] T6 — Botón: elegir el lector, avance y aviso del lector usado; botón siempre visible · `read-document-button.tsx`, `receipt-form.tsx`, `src/app/(app)/recepciones/nueva/page.tsx`

## Paralelismo
Grupo 0: T1. Después, en paralelo: [T2], [T3] y [T4]. Al final: T5 y luego T6.

## Notas
- **Prueba real (a mano):** 2 PDF de facturas electrónicas reales (con texto) y 1 escaneado, cuando lleguen los comprobantes.
  Para el PDF con texto se espera que todas las líneas salgan bien.
- El PDF sintético usado en el spec 003 sirve de prueba automática de la capa de texto (pdfjs funciona en Node).
- ponytail: Tesseract en página entera (una pasada). Si el escaneado lee mal, se porta la lectura por columnas de Farmacia (spec aparte).

## Implementación
- 31 tests (7 nuevos de `table-read`). Build OK; el worker de pdfjs se publica en `.next/static/media`.
- Prueba en Node con pdfjs (misma extracción que `pdf-text.ts`) sobre 2 PDF sintéticos:
  - Monoespaciado con la fila entera en un solo texto: 2/2 líneas, vencimiento leído dentro de la descripción.
  - Proporcional con una celda por texto (como una factura electrónica): 2/2 líneas, "Precio Unit." elegido sobre "Valor Unit." y la descripción continuada.
  - Proveedor, N° y total correctos. 1 s la primera vez (carga) y 10 ms después.
- **Sin probar (requiere navegador):** el camino Tesseract (PDF escaneado o foto sin internet) y la cancelación. Tesseract descarga
  el motor y el idioma del CDN la primera vez; después usa la caché del navegador.
- Desvíos: el contrato `readLocal` quedó en 2 funciones (`readPdfText` y `readWithOcr`) porque el botón decide entre ellas y la IA.
  `toCents`, `toIsoDate` y `toQuantity` se exportan desde `document-read.ts`. Si la IA responde 503 o no hay red, se pasa al lector local.
  El límite local es de 15 MB (4 MB para la IA).
- Review vuelta 1: CAMBIOS. Corregido: el pie de tabla se reconoce por palabra completa (SONDA o TOTALMENTE ya no cortan la tabla) aunque caiga en la columna de cantidad;
  en las páginas de continuación se ignora el membrete y nada después de la página con el pie; el emisor "S.A." se detecta; el total y `toCents` aceptan
  "1.234,50"; las cantidades con decimales distintos de 0 ("1.5") quedan en 0 para que el usuario las corrija ("2.000" → 2); se descarta el resultado si se canceló;
  el texto de "sin tabla" sigue el AC3; nota ponytail sobre los límites de columna. 4 tests nuevos (35 en total).
- Review vuelta 2: aprobado. Decisión: una fila con cantidad ilegible entra con 0 (no se pierde la línea; el formulario exige corregirla) — ajusta AC4.
  Pendiente a mano: Tesseract y cancelación en navegador; confirmar con facturas reales que "2,000" significa 2 unidades.
