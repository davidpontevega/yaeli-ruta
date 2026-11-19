---
id: 019
title: Catálogo de productos para clientes
status: done
module: catalog
---

# 019 — Catálogo para clientes

## Objetivo
El dueño consigue y sube una foto por producto (archivo, portapapeles o enlace) y genera en el celular las imágenes del catálogo (por categoría, sin precios) para WhatsApp, sin Canva.

## Alcance
Incluye: foto por producto (subir, pegar, desde enlace, reemplazar, quitar) en Neon; botón "Buscar foto" (Google Imágenes); `GET /api/productos/[id]/foto`; miniaturas; check "Mostrar en catálogo"; `/productos/catalogo` (selección, faltantes, vista previa, compartir); `/productos/fotos` "Completar fotos"; dibujo en `<canvas>`.
No incluye: precios, API de búsqueda automática de imágenes, quitar fondo automático, más de una foto por producto, enlace público, PDF, plantillas/colores/logo, `sharp` u otra dependencia de imágenes.

## Decisiones (aprobadas)
Talla sacada del final del nombre (sin campo nuevo) · páginas JPEG 0.9 · serif del sistema (Georgia, "Noto Serif", serif).

## Criterios de aceptación
- [ ] AC1 — Solo el dueño sube/pega/descarga/quita fotos y abre `/productos/catalogo` y `/productos/fotos` (`requireUser("DUENO")`). `GET /api/productos/[id]/foto`: cualquier sesión (`getCurrentUser`, si no → 401); sin foto → 404.
- [ ] AC2 — Toda imagen (archivo png/jpg/webp, portapapeles o enlace) pasa por el mismo pipeline cliente: `<canvas>` a máx. 600 px lado mayor, `image/webp` 0.85 (si el navegador da otro tipo, se envía ese); > 200 KB → reintento 480 y 360 px; si sigue grande, "La foto es muy pesada". Luego `saveProductPhoto`.
- [ ] AC3 — Servidor: ≤ 200 KB y tipo por bytes mágicos (webp/png/jpeg; ignora `type` del cliente). Inválido → error sin escribir. Reemplazar = upsert; quitar = delete. Auditoría en la tx (`product.photo_set` `{ mime, size, source }`, `product.photo_delete`).
- [ ] AC4 — Foto servida con su `mime`, `Cache-Control: private, max-age=31536000, immutable`, `ETag` = `updated_at`; URLs con `?v=<updated_at ms>`. `If-None-Match` igual → 304.
- [ ] AC5 — Miniatura 40 px en `ProductList` y en el formulario (`loading="lazy"`); sin foto → `IconTile`.
- [ ] AC6 — `productos.en_catalogo` (default true), check "Mostrar en catálogo". Entran al catálogo: activos, con foto y con el check.
- [ ] AC7 — "Buscar foto" abre pestaña nueva (`target="_blank" rel="noopener"`) a `https://www.google.com/search?tbm=isch&tbs=ic:trans&q=${encodeURIComponent(name)}`.
- [ ] AC8 — "Pegar foto": `navigator.clipboard.read()` busca el primer tipo `image/*`; si no hay API/permiso o no hay imagen → mensaje "Copia una imagen o pégala aquí (Ctrl+V / mantener pulsado)". Fallback: zona enfocable (`tabIndex=0`) con evento `paste` (`clipboardData.files`). El input de archivo se mantiene.
- [ ] AC9 — "Pegar enlace": campo URL → `fetchImageFromUrl`. Rechaza: no `https:`, credenciales en URL, puerto ≠ 443/vacío, host que resuelve a IP privada/loopback/link-local/CGNAT/metadata/multicast/no especificada (IPv4 e IPv6, incl. `::ffff:` mapeadas, ULA `fc00::/7`, `fe80::/10`); > 3 redirecciones (cada `Location` se revalida igual); > 8 s; > 5 MB (corta al pasar); `content-type` no `image/*`; bytes no webp/png/jpeg → "Formato no soportado: usa PNG, JPG o WEBP" (GIF/AVIF caen aquí). OK → base64 al cliente → pipeline AC2.
- [ ] AC10 — `/productos/fotos`: productos activos con `en_catalogo` y sin foto, uno a la vez: nombre, categoría, "N de M", Buscar / Pegar foto / Pegar enlace / Subir archivo, "Saltar"; al guardar avanza solo. Al terminar → `EmptyState` "Todos tienen foto". Enlazada desde Productos y desde los faltantes de `/productos/catalogo`.
- [ ] AC11 — `/productos/catalogo`: categorías con check (todas marcadas), "N con foto · M sin foto"; faltantes con enlace a `/productos/[id]` y botón "Completar fotos". Botón "Catálogo para clientes" en `/productos` (dueño) y entrada en menú + (`app-nav.tsx`).
- [ ] AC12 — Páginas 1080×1920, fondo `#FAF8F5`: título = categoría (serif bold, centrado), máx. 5 filas; tarjeta gris claro redondeada con nombre (y talla en 2.ª línea) y foto sobre el borde, alternando derecha/izquierda (fila 0 derecha; reinicia por página). Más de 5 → "Aceites (2)"… Pie: `BRAND.company`. Orden por nombre.
- [ ] AC13 — `splitLabel(nombre)`: "Aceite Cocinero 900 ml" → "Aceite Cocinero" / "900 ml" (ml, l, lt, g, gr, kg, cc, oz, un, und, "x 12"). Sin talla → nombre en ≤ 2 líneas con "…". Presentaciones no se usan.
- [ ] AC14 — Antes de dibujar: `document.fonts.load` y `img.decode()` de todas; una foto que falla se omite. Vista previa con `<img>` (object URL). "Compartir": JPEG 0.9; `navigator.canShare({ files })` → `share` (`catalogo-aceites-1.jpg`…); si no, descarga secuencial con `<a download>`. Nada que dibujar → `EmptyState` y botón deshabilitado.

## Datos
Migración aditiva (`npm run db:generate`; solo `CREATE TABLE`, `ADD COLUMN`):
| Tabla · columna (TS) | tipo | constraint |
|---|---|---|
| `productos.en_catalogo` (`showInCatalog`) | boolean | NOT NULL default true |
| `fotos_producto` (`productPhotos`) · `producto_id` (`productId`) | uuid | PK, FK `productos` |
| · `mime` | text | NOT NULL |
| · `bytes` | bytea (`customType`; drizzle 0.45 no trae `bytea`) | NOT NULL |
| · `actualizado_en` (`updatedAt`) | timestamptz | NOT NULL default now() |

## Contratos
- `catalog-pages.ts` (puro): `splitLabel(name) → { title; size: string | null }`; `paginateCatalog(groups, perPage = 5) → { title; rows: { productId; photoVersion; title; size; side: "left" | "right" }[] }[]`.
- `photo.ts` (puro): `imageMime(bytes) → "image/webp" | "image/png" | "image/jpeg" | null`; `PHOTO_MAX_BYTES = 200 * 1024`; `REMOTE_MAX_BYTES = 5 * 1024 * 1024`.
- `image-url.ts` (puro): `parseImageUrl(raw) → { ok: true; url: URL } | { ok: false; error }` (https, sin credenciales, puerto 443); `isPublicIp(ip: string) → boolean` (usa `node:net` `isIP`; IPv4/IPv6 por rangos).
- `fetch-image.ts` (`server-only`): `downloadImage(url) → { mime; bytes } | { error }` con `node:https.request` y opción `lookup` que llama `dns.lookup` y rechaza si `!isPublicIp` (cierra DNS rebinding: la IP validada es la conectada); redirect manual ≤ 3 con `parseImageUrl` por salto; `timeout` 8 s; aborta al pasar 5 MB.
- `actions.ts`: `saveProductPhoto(_: FormState, form)` (`productId` uuid, `file` File, `source` "file" | "paste" | "url") y `deleteProductPhoto(form)` — DUENO, `db.transaction` + `audit`, `revalidatePath("/productos")` y del producto. `fetchImageFromUrl({ url: z.string().max(2000) }) → { ok: true; mime; base64 } | { ok: false; error }` — DUENO, sin escritura ni audit.
- `queries.ts`: `listProducts`/`getProductWithPackagings` agregan `photoVersion: number | null` (left join, sin `bytes`) y `showInCatalog`; `getProductPhoto(id)`; `getCatalogSheet() → { categoryId; category; products: { id; name; photoVersion }[] }[]` (activos con `en_catalogo`). `/productos/fotos` filtra `photoVersion === null` de esta misma query.
- `productSchema` agrega `showInCatalog: z.boolean()`; `persistProduct` lo guarda.
- `src/app/api/productos/[id]/foto/route.ts` `GET`: valida `z.uuid()`, `getProductPhoto` vía el index.

## Reutilizar
Verificado con Grep/Glob:
- `src/modules/catalog/{actions,queries,schemas,index}.ts`, `components/product-form.tsx`, `components/product-list.tsx`.
- `src/app/api/recepciones/leer/route.ts` — patrón Route Handler con `getCurrentUser` y `fail(status, msg)`.
- `src/server/auth.ts`, `src/server/db` (`db`, `audit`), `src/lib/form-state.ts`, `src/lib/brand.ts`.
- `src/components/ui/` — `EmptyState`, `BackLink`, `IconTile` (`avatar.tsx`); clases `.tarjeta`, `.lista`, `.fila`, `.chip`, `.btn-primario`. `src/components/app-nav.tsx` — menú +.
- `package.json` sin librería de imágenes: reducción solo en cliente (no se agrega `sharp`). `inventory/document-read.ts` `fileType` solo jpeg/pdf: no sirve.

## Tareas
- [x] T1 — Schema + migración aditiva (revisar SQL: sin DROP/ALTER TYPE) · `src/server/db/schema.ts`, `drizzle/0012_*.sql`, `drizzle/meta/*`
- [x] T2 — Puros + tests: `splitLabel` (sin talla, "1.5 L", "x 12"), `paginateCatalog` (0/5/6/11, alternancia, "(2)", vacías omitidas), `imageMime` (webp/png/jpeg/gif/avif/basura), `parseImageUrl`/`isPublicIp` (http, credenciales, puerto, 127/8, 10/8, 172.16/12, 192.168/16, 169.254.169.254, 100.64/10, 0.0.0.0, ::1, fe80::, fc00::, ::ffff:10.0.0.1, IP pública ok) · `src/modules/catalog/catalog-pages.ts`, `catalog-pages.test.ts`, `photo.ts`, `photo.test.ts`, `image-url.ts`, `image-url.test.ts`
- [x] T3 — Queries, `showInCatalog`, `downloadImage`, acciones `saveProductPhoto`/`deleteProductPhoto`/`fetchImageFromUrl`, export de `getProductPhoto`/`getCatalogSheet` · `src/modules/catalog/queries.ts`, `schemas.ts`, `actions.ts`, `fetch-image.ts`, `index.ts`
- [x] T4 — Route Handler GET con ETag/304 · `src/app/api/productos/[id]/foto/route.ts`
- [x] T5 — `ProductPhoto` (`"use client"`; props `productId`, `name`, `photoVersion`, `onSaved?`): pipeline AC2, Buscar/Pegar foto/Pegar enlace/Subir/Quitar, zona de pegado, miniatura; check "Mostrar en catálogo"; montarlo en la edición · `src/modules/catalog/components/product-photo.tsx`, `product-form.tsx`, `src/app/(app)/productos/[id]/page.tsx`
- [x] T6 — Miniatura en la lista · `src/modules/catalog/components/product-list.tsx`
- [x] T7 — `CatalogBuilder` (checks, conteos, faltantes + "Completar fotos", dibujo, vista previa, compartir) · `src/modules/catalog/components/catalog-builder.tsx`
- [x] T8 — `PhotoFiller` (`"use client"`: índice en estado, `ProductPhoto` con `key={id}` y `onSaved` → siguiente, "Saltar", "N de M", `EmptyState` al final) · `src/modules/catalog/components/photo-filler.tsx`
- [x] T9 — Páginas `catalogo` y `fotos`, exports de `ProductPhoto`, `CatalogBuilder`, `PhotoFiller`, botones en Productos y menú + · `src/app/(app)/productos/catalogo/page.tsx`, `src/app/(app)/productos/fotos/page.tsx`, `src/app/(app)/productos/page.tsx`, `src/components/app-nav.tsx`, `src/modules/catalog/index.ts`

## Paralelismo
Secuencial: T1 → T2 → T3. Paralelo: [T4] [T5] [T6] [T7]. Luego T8 (usa T5) → T9. `index.ts` solo lo tocan T3 y T9 (secuenciales).

## Notas
- `/catalogo` ya es Ajustes: páginas en `/productos/catalogo` y `/productos/fotos` (estáticos ganan a `[id]`).
- Bytes en Neon ≈ 40 MB para 500 productos; `listProducts` nunca selecciona `bytes`. ponytail: miles de fotos → Blob storage.
- Server Actions aceptan 1 MB por defecto: subida de 200 KB cabe; la respuesta base64 de `fetchImageFromUrl` (≤ ~6.7 MB) no tiene ese límite.
- Fotos dibujadas desde la misma origen (`/api/...`) y las remotas pasan por base64 → `Blob`: el canvas no queda "tainted".
- `clipboard.read()` exige contexto seguro y, en Firefox/iOS, puede no existir: por eso el fallback `paste`.
- Repartidor: ve miniaturas, no las páginas de catálogo ni fotos.

## Plan E2E (BD de producción: solo filas `__prueba__`)
1. Categoría `__prueba__ Aceites` con 6 productos `__prueba__ Aceite N 900 ml`; subir PNG transparente, pegar una imagen del portapapeles, pegar enlace https público; desmarcar "Mostrar en catálogo" en otro.
2. Enlaces rechazados: `http://…`, `https://127.0.0.1/x.png`, `https://169.254.169.254/`, un GIF público → mensajes claros.
3. Miniaturas; `GET` foto → 200 + ETag; `If-None-Match` → 304; repartidor → 200; sin sesión → 401. Texto renombrado `.png` → error.
4. `/productos/fotos`: "1 de M", Saltar, guardar avanza. `/productos/catalogo`: conteos, "Aceites (2)", alternancia, compartir en Android / descargas en PC.
5. Limpieza por ids: `fotos_producto`, `auditoria`, `presentaciones`, productos y categoría `__prueba__`.
