import { sql } from "drizzle-orm";
import { boolean, check, index, integer, jsonb, pgEnum, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";

const id = () => uuid("id").primaryKey().defaultRandom();
const creadoEn = () => timestamp("creado_en", { withTimezone: true }).notNull().defaultNow();

export const rolEnum = pgEnum("rol", ["DUENO", "REPARTIDOR"]);

export const usuarios = pgTable("usuarios", {
  id: id(),
  nombre: text("nombre").notNull().unique(),
  rol: rolEnum("rol").notNull(),
  pinHash: text("pin_hash").notNull(),
  intentosFallidos: integer("intentos_fallidos").notNull().default(0),
  bloqueadoHasta: timestamp("bloqueado_hasta", { withTimezone: true }),
  activo: boolean("activo").notNull().default(true),
  creadoEn: creadoEn(),
});

// La cookie lleva un token aleatorio; aquí solo su SHA-256, así un volcado de la BD no sirve para entrar.
export const sesiones = pgTable(
  "sesiones",
  {
    id: id(),
    usuarioId: uuid("usuario_id")
      .notNull()
      .references(() => usuarios.id),
    tokenHash: text("token_hash").notNull().unique(),
    dispositivo: text("dispositivo"),
    expiraEn: timestamp("expira_en", { withTimezone: true }).notNull(),
    creadoEn: creadoEn(),
  },
  (t) => [index("sesiones_usuario_idx").on(t.usuarioId)],
);

// Append-only. Nunca guardar PIN, tokens ni hashes en `detalles`.
export const auditoria = pgTable(
  "auditoria",
  {
    id: id(),
    actorId: uuid("actor_id").references(() => usuarios.id),
    accion: text("accion").notNull(),
    entidad: text("entidad").notNull(),
    entidadId: text("entidad_id"),
    detalles: jsonb("detalles"),
    creadoEn: creadoEn(),
  },
  (t) => [index("auditoria_entidad_idx").on(t.entidad, t.entidadId)],
);

export type Rol = (typeof rolEnum.enumValues)[number];

// ── Catálogo ────────────────────────────────────────────────────────────────

export const tipoUbicacionEnum = pgEnum("tipo_ubicacion", ["ALMACEN", "VEHICULO"]);

export const ubicaciones = pgTable("ubicaciones", {
  id: id(),
  nombre: text("nombre").notNull().unique(),
  tipo: tipoUbicacionEnum("tipo").notNull(),
  activo: boolean("activo").notNull().default(true),
});

export const categorias = pgTable("categorias", {
  id: id(),
  nombre: text("nombre").notNull().unique(),
});

export const marcas = pgTable("marcas", {
  id: id(),
  nombre: text("nombre").notNull().unique(),
});

// Cantidades siempre en unidad base (entero). Dinero en céntimos (entero).
export const productos = pgTable(
  "productos",
  {
    id: id(),
    sku: text("sku").notNull().unique(),
    nombre: text("nombre").notNull(),
    categoriaId: uuid("categoria_id")
      .notNull()
      .references(() => categorias.id),
    marcaId: uuid("marca_id").references(() => marcas.id),
    unidadBase: text("unidad_base").notNull(),
    stockMinimo: integer("stock_minimo").notNull().default(0),
    costoPromedio: integer("costo_promedio").notNull().default(0),
    ultimoCosto: integer("ultimo_costo").notNull().default(0),
    margenPct: integer("margen_pct").notNull().default(15),
    activo: boolean("activo").notNull().default(true),
    creadoEn: creadoEn(),
  },
  (t) => [index("productos_categoria_idx").on(t.categoriaId)],
);

// Toda venta/compra es por presentación. La de factor 1 es la unidad base y siempre existe.
export const presentaciones = pgTable(
  "presentaciones",
  {
    id: id(),
    productoId: uuid("producto_id")
      .notNull()
      .references(() => productos.id),
    nombre: text("nombre").notNull(),
    factor: integer("factor").notNull(),
    codigoBarras: text("codigo_barras").unique(),
    precioVenta: integer("precio_venta").notNull(),
  },
  (t) => [uniqueIndex("presentaciones_producto_nombre_uq").on(t.productoId, t.nombre), check("factor_positivo", sql`${t.factor} > 0`)],
);
