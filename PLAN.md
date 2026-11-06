# Plan — Sistema de Stock y Reparto para Distribuidora

Distribuidora de consumo masivo (dulces, galletas, detergente, pañales…).

## 0. Cómo trabaja hoy el negocio

1. El dueño pide mercadería a sus proveedores; llega en camión y se guarda en un
   almacén de **3 pisos**.
2. Los clientes (bodegas, tiendas) **llaman por teléfono** para hacer pedidos; hoy se
   anotan a mano.
3. Hay **rutas fijas** de reparto. En cada cliente se entrega según la lista y se
   **cobra en efectivo**.
4. Rutas lejanas: dueño + ayudante. Rutas cercanas: solo el ayudante (pueden salir
   **dos repartos a la vez**).
5. En la ruta muchas veces **no hay internet**.

Problemas a resolver:
- No sabe qué productos están por vencer → pérdidas.
- Pide al proveedor productos que ya tiene en almacén → capital inmovilizado.
- Pedidos y cobros en papel → errores, sin historial ni cuadre de efectivo.

## 1. Decisiones tomadas

| Tema | Decisión |
|---|---|
| Almacenes | Uno solo, con **ubicaciones** (Piso 1, Piso 2, Piso 3; opcional estante/zona). |
| Lotes y vencimiento | Sí. Salida FEFO (vence primero, sale primero). |
| Comprobantes | Solo control interno. Sin SUNAT. Se imprime/comparte nota de pedido. |
| Precios | El precio de venta sigue al costo del proveedor: cada producto tiene un **margen %**; al recibir mercadería con costo nuevo el sistema **sugiere** el nuevo precio y el dueño lo confirma. Cada pedido guarda el precio con el que se vendió. |
| Precio especial | Opcional por cliente: si el cliente tiene precio especial para un producto se usa ese; si no, el precio general. Solo el dueño los define. |
| Fiado | Sí. Cada cliente tiene **cuenta corriente**: lo entregado y no pagado queda como deuda; los cobros posteriores la reducen. Límite de crédito opcional por cliente (aviso, no bloqueo). |
| Venta en ruta | Sí. Se puede agregar productos a un pedido o venderle a quien no pidió, siempre del stock que lleva el carro. |
| Precios en ruta | Solo el dueño cambia precios o da descuentos. El repartidor cobra el precio cargado. |
| Nota para el cliente | **Imagen (PNG)** de la nota de entrega, generada en el celular aunque no haya señal y enviada con el botón Compartir de Android → WhatsApp (el mensaje sale cuando vuelve la señal). El estado de cuenta (documento largo) se genera en **PDF** desde la oficina. |
| Dispositivos | Celulares Android con Chrome. |
| Celulares | Un celular por hoja de ruta. El del dueño queda libre para almacén y pedidos (ver §6). |
| Login | **Sin Clerk.** Usuarios en la propia base: elige su usuario + **PIN de 4–6 dígitos**. Sesión larga (30 días) en el celular. |
| Sin internet | El módulo de reparto funciona **offline** y sincroniza al volver la señal. |

## 2. Stack

- Next.js 16 + TypeScript estricto, Drizzle ORM + Neon Postgres, deploy en Vercel
  (igual que `../Farmacia/farmacia-next`; se reutiliza layout, tablas, auditoría, FEFO).
- shadcn/ui + Tailwind 4, TanStack Query, React Hook Form + Zod.
- **Mobile-first**: el dueño y el ayudante lo usan desde el celular.
- **PWA instalable** (manifest + service worker propio) para el modo offline.
- Almacenamiento offline en el celular: IndexedDB (librería `idb`, ~1 KB).
- Sin Clerk: auth propia con `node:crypto` (scrypt), sin dependencias extra.

## 3. Login sin correo

- Pantalla: lista de usuarios (botones con nombre) → teclado numérico para el PIN.
- PIN guardado con hash scrypt + sal; nunca en texto plano.
- Tabla `sesiones` (token aleatorio, usuario, expira, dispositivo). Cookie `httpOnly`,
  `secure`, 30 días. Revocable desde el panel del dueño ("cerrar sesión de este celular").
- Protección por ser un PIN corto: **bloqueo de 15 min tras 5 intentos fallidos** por
  usuario, registrado en auditoría.
- Desactivar un usuario (ayudante que se va) invalida todas sus sesiones al instante.
- Offline: no se pide PIN; la app usa la sesión ya abierta. Si la sesión venció al
  sincronizar, pide el PIN y luego sube lo pendiente (no se pierde nada).
- Roles: `DUENO` (todo) y `REPARTIDOR` (ver su hoja de ruta, entregar, vender en ruta,
  cobrar, ver deuda del cliente, consultar stock; **no ve costos ni márgenes**). Se agrega `ALMACENERO` si algún día hace falta.

## 4. Principios del dominio

1. **El stock no se edita, se mueve.** Toda variación es una fila en `movimientos_stock`
   (append-only); el saldo en `stock` se actualiza en la misma transacción y debe
   cuadrar con la suma de movimientos.
2. **Unidad base + presentaciones.** Se guarda en unidad mínima (paquete); presentaciones
   con factor (display = 12, caja = 144). Se compra y vende en cualquier presentación.
3. **El vehículo es una ubicación.** Al cargar el carro, el stock pasa de "Piso 1/2" a
   "Reparto #N". Las entregas offline descuentan solo de ese stock, que nadie más toca
   → no hay conflictos al sincronizar. Lo que no se entregó vuelve al almacén al liquidar.
4. **Dinero en céntimos (enteros)**; cantidades en enteros de unidad base.
5. Toda operación de stock en `db.transaction` con bloqueo de fila; `CHECK (cantidad >= 0)`.
6. Costo promedio ponderado por producto para valorizar inventario y calcular margen.

## 5. Modelo de datos

**Catálogo y stock**

| Tabla | Campos clave |
|---|---|
| `categorias`, `marcas` | nombre |
| `productos` | sku, codigo_barras, nombre, categoria_id, marca_id, unidad_base, stock_minimo, costo_promedio, ultimo_costo, margen_pct, precio_venta, activo |
| `presentaciones` | producto_id, nombre, factor, codigo_barras, precio_venta |
| `historial_precios` | producto_id, costo, precio_venta, fecha, usuario_id |
| `ubicaciones` | nombre, tipo (`ALMACEN` / `VEHICULO`) — ej. Piso 1, Piso 2, Piso 3, Reparto 1, Reparto 2 |
| `lotes` | producto_id, codigo, fecha_vencimiento |
| `stock` | ubicacion_id, lote_id, cantidad (PK compuesta) |
| `movimientos_stock` | fecha, tipo, lote_id, ubicacion_id, cantidad (±), costo_unitario, documento_tipo, documento_id, usuario_id |

**Compras**

| Tabla | Campos clave |
|---|---|
| `proveedores` | ruc, nombre, telefono, productos que surte |
| `ordenes_compra` + detalles | proveedor, estado (`borrador → enviada → recibida`), items en presentación |
| `recepciones` + detalles | orden_id (opcional), nro guía/factura, lote, vencimiento, costo, ubicación (piso) |

**Clientes, pedidos y reparto**

| Tabla | Campos clave |
|---|---|
| `rutas` | nombre, días de visita |
| `clientes` | nombre, negocio, telefono, direccion, referencia, ruta_id, orden_en_ruta, limite_credito, ubicación GPS opcional |
| `precios_cliente` | cliente_id, presentacion_id, precio (solo si tiene precio especial) |
| `pedidos` + detalles | cliente, fecha_entrega, origen (`telefono` / `en_ruta`), estado (`pendiente → en_ruta → entregado / parcial / no_entregado / anulado`), precio unitario guardado |
| `hojas_ruta` | fecha, ruta_id, vehiculo (ubicación), repartidores, estado (`preparando → en_ruta → liquidada`) |
| `entregas` + detalles | pedido_id, cantidad entregada vs pedida, motivo de faltante/rechazo, hora, `client_op_id` (UUID del celular) |
| `movimientos_cuenta` | cliente_id, tipo (`CARGO` por entrega / `ABONO` por cobro / `AJUSTE`), monto, documento, `client_op_id`. Saldo del cliente = suma (append-only, igual que el stock). |
| `cobros` | cliente_id, hoja_ruta_id, monto en efectivo, cobrado_por, `client_op_id` (puede pagar la entrega de hoy y/o deuda anterior) |
| `liquidaciones` | hoja_ruta_id, efectivo esperado, efectivo entregado, diferencia, fiado del día, devolución al almacén |

**Control**: `ajustes` + detalles (merma, rotura, vencido, conteo físico, motivo obligatorio),
`usuarios`, `sesiones`, `audit_logs`.

## 6. Flujo de reparto offline

1. **Preparar hoja de ruta (con internet, en el almacén):** el dueño elige ruta y fecha →
   el sistema junta los pedidos pendientes de esos clientes → genera **lista de picking**
   agrupada por piso y producto, con el lote a sacar (FEFO).
2. **Cargar el carro:** confirmar carga → transferencia de stock almacén → vehículo.
   Opcional: cargar mercadería extra para ventas en el camino.
3. **Descargar al celular:** el repartidor "toma" la hoja de ruta en su celular. La PWA
   guarda en IndexedDB la hoja, clientes (en orden de visita) con su **deuda actual y
   límite de crédito**, pedidos, productos, precios generales y especiales, y el stock
   del vehículo.
4. **En la ruta (sin internet):** por cada cliente:
   - ver pedido y deuda anterior;
   - marcar lo entregado (cantidades, faltantes, rechazos);
   - **agregar productos o vender a quien no pidió** (solo con stock del carro);
   - registrar cuánto paga en efectivo: lo que falte queda como fiado; si paga de más,
     abona a la deuda anterior. Aviso si supera su límite de crédito;
   - siguiente cliente.
   Cada acción se guarda en una **cola local** con un UUID propio. Se muestra en todo
   momento el efectivo acumulado, el fiado del día y el stock que queda en el carro.
5. **Sincronización:** cuando hay señal, la cola se sube sola (y hay botón manual). El
   servidor aplica cada operación en transacción y la ignora si el UUID ya existe
   (reintentos seguros, sin duplicados). Errores quedan visibles en el celular.
6. **Liquidar (de vuelta en el almacén):** sistema calcula efectivo esperado vs. efectivo
   entregado, el fiado del día y la mercadería que debe volver. Lo no entregado regresa
   al almacén y los pedidos no entregados vuelven a `pendiente` para otro día.

**Quién usa qué celular:**
- Una hoja de ruta la maneja **un solo celular a la vez** (el que la tomó). Si van dueño
  y ayudante juntos, registra uno solo. Así nunca hay dos celulares sin señal
  modificando la misma ruta. Para pasarla a otro celular primero se sincroniza.
- Mientras tanto el celular del dueño (con señal) sigue normal: revisa almacén, recibe
  mercadería, toma pedidos por teléfono, ve el avance del reparto a medida que sincroniza.
- Pedidos tomados por teléfono para un cliente de una ruta que ya salió: le llegan al
  repartidor en la próxima sincronización y puede entregarlo si el carro tiene stock;
  si no, queda para el siguiente día de esa ruta.
- Si a futuro salen dos repartos a la vez, ya está cubierto: cada uno con su vehículo
  (ubicación) y su hoja de ruta.

## 6b. Cuentas por cobrar (fiado)

- Saldo por cliente siempre visible (en pedidos, en ruta, en su ficha).
- Estado de cuenta por cliente en PDF: entregas, cobros, saldo (para compartir por WhatsApp).
- Reporte de deudores: quién debe, cuánto y desde cuándo, filtrable por ruta.
- Cobros también desde la oficina (cliente que viene a pagar).

## 7. Funciones que atacan los problemas actuales

- **Vencimientos:** tablero con productos que vencen en ≤ 30 / 60 / 90 días, por piso.
  Picking siempre FEFO. Alerta diaria al abrir la app.
- **Comprar sin duplicar:** al armar la orden de compra, cada producto muestra stock
  actual, lotes con vencimiento, venta promedio semanal y **días de cobertura**. Si
  alcanza para más de N días, advierte. Pantalla de **sugerencia de compra**: productos
  bajo stock mínimo o con cobertura corta, agrupados por proveedor.
- **Pedidos por teléfono:** registro rápido desde el celular: buscar cliente → "repetir
  último pedido" o agregar productos → fecha de entrega (por defecto, el próximo día de
  su ruta).

## 8. Fases

| Fase | Contenido | Entregable | Días aprox. |
|---|---|---|---|
| 0 — Base | Proyecto, BD, login usuario + PIN, sesiones, auditoría, layout mobile, deploy. | Entrar desde el celular. | 2–3 |
| 1 — Catálogo | Productos, presentaciones, categorías, marcas, ubicaciones, importación CSV, búsqueda por nombre/código. | Catálogo cargado. | 2–3 |
| 2 — Compras e inventario | Proveedores, recepción de mercadería con lote/vencimiento/piso, costo promedio, precio sugerido, **inventario inicial**, vista de stock, kardex, **tablero de vencimientos**. | Saber qué hay, dónde y qué vence. | 4–5 |
| 3 — Clientes y pedidos | Rutas, clientes por ruta, precios especiales, pedidos por teléfono, cuenta corriente y cobros en oficina, órdenes de compra con cobertura y sugerencia de compra. | Dejar el papel para pedidos y fiados. | 4–5 |
| 4 — Reparto offline | PWA, hoja de ruta, picking, carga del vehículo, entregas, venta en ruta, cobros y fiado offline, nota de entrega en imagen para WhatsApp, sincronización, liquidación. | Reparto completo sin internet. | 7–9 |
| 5 — Control | Ajustes (merma/rotura/vencidos), conteo físico por piso, devoluciones a proveedor. | Inventario cuadrado con la realidad. | 2–3 |
| 6 — Reportes | Dashboard: ventas por día/ruta/cliente, margen, valor del inventario, productos sin movimiento, cobros por repartidor. Exportar CSV. | Decisiones con datos. | 2–3 |

### Fase 3 dividida en specs (cada uno cabe en una sesión)

| Spec | Contenido | Depende de |
|---|---|---|
| 007 — Rutas y clientes | Rutas con días de visita. Clientes con lo mínimo: nombre, teléfono y ruta; dirección, referencia y límite de crédito en "más opciones". Orden de visita (subir y bajar). Lista por ruta y búsqueda. | — |
| 008 — Pedidos por teléfono | Buscar cliente → "repetir último pedido" o agregar productos con presentación y cantidad. Muestra el stock disponible (avisa, no bloquea). Precio general guardado en cada línea. Fecha de entrega: por defecto el próximo día de su ruta. Lista de pedidos por fecha y ruta; editar o anular mientras esté pendiente. | 007 |
| 009 — Cuenta corriente y cobros | `movimientos_cuenta` append-only. **Deuda inicial** pasada del cuaderno. Cobro en oficina. Ajuste del dueño con motivo. Ficha del cliente con saldo y movimientos. Deudores por ruta con antigüedad. Aviso de límite de crédito en el pedido. | 007 |
| 010 — Entrega desde la oficina (puente) | Marcar un pedido como entregado sin hoja de ruta: descuenta stock del almacén en orden **FEFO**, carga la deuda al cliente y registra lo que pagó. Permite dejar el papel antes de la fase 4. La fase 4 reutiliza la salida FEFO y el cargo. | 008, 009 |
| 011 — Precios especiales | Precio por cliente y presentación (solo el dueño). El pedido lo usa si existe. | 008 |
| 012 — Estado de cuenta | PDF del estado de cuenta por cliente para compartir por WhatsApp. | 009 |
| 013 — Sugerencia de compra | Venta promedio semanal (de las entregas), días de cobertura, productos bajo mínimo o con poca cobertura agrupados por proveedor. Orden de compra simple que se comparte con el proveedor. | 010 (necesita historial de ventas) |

Orden recomendado: 007 → 008 → 009 → 010 (con esto el negocio ya deja el papel) → 011 → 012 → 013.

Orden pensado para dar valor rápido: con la fase 2 el dueño ya ve sus vencimientos
aunque siga repartiendo en papel.

**Fuera de alcance por ahora:** varios almacenes, SUNAT, GPS en vivo del vehículo,
app nativa (la PWA alcanza), pagos digitales.

## 9. Calidad y verificación

- Tests `node:test` de funciones puras: conversión de presentaciones, costo promedio,
  precio sugerido, precio especial vs. general, FEFO, cobertura de días, reparto de un
  cobro entre entrega y deuda, cuadre de liquidación.
- Test de sincronización: la misma operación enviada 2 veces se aplica una sola vez.
- Prueba de campo de la fase 4: celular en modo avión durante una ruta completa →
  sincronizar → stock y efectivo cuadran.
- Consulta de cuadre `stock` vs. `SUM(movimientos_stock)` disponible para el dueño.
- Antes de cerrar cada fase: `npm run typecheck && npm run lint && npm run build`.

## 10. Preguntas abiertas

Ninguna por ahora.
