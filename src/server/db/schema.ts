import { sql } from "drizzle-orm";
import { boolean, check, date, index, integer, jsonb, pgEnum, pgTable, primaryKey, text, timestamp, unique, uniqueIndex, uuid } from "drizzle-orm/pg-core";

// TS keys in English; SQL names stay in Spanish (already migrated). Renaming a SQL name = new migration.

const id = () => uuid("id").primaryKey().defaultRandom();
const createdAt = () => timestamp("creado_en", { withTimezone: true }).notNull().defaultNow();

export const roleEnum = pgEnum("rol", ["DUENO", "REPARTIDOR"]);
export type Role = (typeof roleEnum.enumValues)[number];

export const users = pgTable("usuarios", {
  id: id(),
  name: text("nombre").notNull().unique(),
  role: roleEnum("rol").notNull(),
  pinHash: text("pin_hash").notNull(),
  failedAttempts: integer("intentos_fallidos").notNull().default(0),
  lockedUntil: timestamp("bloqueado_hasta", { withTimezone: true }),
  active: boolean("activo").notNull().default(true),
  createdAt: createdAt(),
});

// The cookie holds a random token; only its SHA-256 is stored, so a DB dump is useless to log in.
export const sessions = pgTable(
  "sesiones",
  {
    id: id(),
    userId: uuid("usuario_id")
      .notNull()
      .references(() => users.id),
    tokenHash: text("token_hash").notNull().unique(),
    device: text("dispositivo"),
    expiresAt: timestamp("expira_en", { withTimezone: true }).notNull(),
    createdAt: createdAt(),
  },
  (t) => [index("sesiones_usuario_idx").on(t.userId)],
);

// Append-only. Never store PINs, tokens or hashes in `details`.
export const auditLog = pgTable(
  "auditoria",
  {
    id: id(),
    actorId: uuid("actor_id").references(() => users.id),
    action: text("accion").notNull(),
    entity: text("entidad").notNull(),
    entityId: text("entidad_id"),
    details: jsonb("detalles"),
    createdAt: createdAt(),
  },
  (t) => [index("auditoria_entidad_idx").on(t.entity, t.entityId)],
);

// ── Catalog ─────────────────────────────────────────────────────────────────

export const locationTypeEnum = pgEnum("tipo_ubicacion", ["ALMACEN", "VEHICULO"]);
export type LocationType = (typeof locationTypeEnum.enumValues)[number];

export const locations = pgTable("ubicaciones", {
  id: id(),
  name: text("nombre").notNull().unique(),
  type: locationTypeEnum("tipo").notNull(),
  active: boolean("activo").notNull().default(true),
});

export const categories = pgTable("categorias", {
  id: id(),
  name: text("nombre").notNull().unique(),
});

export const brands = pgTable("marcas", {
  id: id(),
  name: text("nombre").notNull().unique(),
});

// Quantities always in base units (integer). Money in céntimos (integer).
export const products = pgTable(
  "productos",
  {
    id: id(),
    sku: text("sku").notNull().unique(),
    name: text("nombre").notNull(),
    categoryId: uuid("categoria_id")
      .notNull()
      .references(() => categories.id),
    brandId: uuid("marca_id").references(() => brands.id),
    baseUnit: text("unidad_base").notNull(),
    minStock: integer("stock_minimo").notNull().default(0),
    averageCost: integer("costo_promedio").notNull().default(0),
    lastCost: integer("ultimo_costo").notNull().default(0),
    marginPct: integer("margen_pct").notNull().default(15),
    active: boolean("activo").notNull().default(true),
    createdAt: createdAt(),
  },
  (t) => [index("productos_categoria_idx").on(t.categoryId)],
);

// Every sale/purchase is by packaging. The one with factor 1 is the base unit and always exists.
export const packagings = pgTable(
  "presentaciones",
  {
    id: id(),
    productId: uuid("producto_id")
      .notNull()
      .references(() => products.id),
    name: text("nombre").notNull(),
    factor: integer("factor").notNull(),
    barcode: text("codigo_barras").unique(),
    salePrice: integer("precio_venta").notNull(),
  },
  (t) => [uniqueIndex("presentaciones_producto_nombre_uq").on(t.productId, t.name), check("factor_positivo", sql`${t.factor} > 0`)],
);

// ── Inventory ───────────────────────────────────────────────────────────────

export const movementTypeEnum = pgEnum("tipo_movimiento", ["INGRESO", "SALDO_INICIAL"]);
export const receiptTypeEnum = pgEnum("tipo_recepcion", ["COMPRA", "SALDO_INICIAL"]);
export type ReceiptType = (typeof receiptTypeEnum.enumValues)[number];

// One lot per product + expiry date (null = no expiry). NULLS NOT DISTINCT so "no expiry" is also a single lot.
export const lots = pgTable(
  "lotes",
  {
    id: id(),
    productId: uuid("producto_id")
      .notNull()
      .references(() => products.id),
    expiresOn: date("vence_el", { mode: "string" }),
    createdAt: createdAt(),
  },
  (t) => [unique("lotes_producto_vence_uq").on(t.productId, t.expiresOn).nullsNotDistinct()],
);

// Current balance per location and lot, in base units. Movements are the history; this is the fast read.
export const stockLevels = pgTable(
  "stock",
  {
    locationId: uuid("ubicacion_id")
      .notNull()
      .references(() => locations.id),
    lotId: uuid("lote_id")
      .notNull()
      .references(() => lots.id),
    quantity: integer("cantidad").notNull(),
  },
  (t) => [primaryKey({ columns: [t.locationId, t.lotId] }), check("stock_no_negativo", sql`${t.quantity} >= 0`)],
);

export const stockMovements = pgTable(
  "movimientos_stock",
  {
    id: id(),
    type: movementTypeEnum("tipo").notNull(),
    lotId: uuid("lote_id")
      .notNull()
      .references(() => lots.id),
    locationId: uuid("ubicacion_id")
      .notNull()
      .references(() => locations.id),
    quantity: integer("cantidad").notNull(), // signed, base units
    unitCost: integer("costo_unitario").notNull(), // céntimos per base unit
    documentId: uuid("documento_id"),
    userId: uuid("usuario_id")
      .notNull()
      .references(() => users.id),
    createdAt: createdAt(),
  },
  (t) => [index("movimientos_lote_idx").on(t.lotId, t.createdAt)],
);

// Created on the fly when a purchase names a supplier (matched ignoring case and extra spaces).
export const suppliers = pgTable("proveedores", {
  id: id(),
  name: text("nombre").notNull().unique(),
  phone: text("telefono"),
  createdAt: createdAt(),
});

export const receipts = pgTable("recepciones", {
  id: id(),
  type: receiptTypeEnum("tipo").notNull(),
  supplier: text("proveedor"), // text as written (history); supplierId is the link
  supplierId: uuid("proveedor_id").references(() => suppliers.id),
  document: text("documento"),
  total: integer("total").notNull(),
  userId: uuid("usuario_id")
    .notNull()
    .references(() => users.id),
  createdAt: createdAt(),
});

export const receiptItems = pgTable("recepcion_items", {
  id: id(),
  receiptId: uuid("recepcion_id")
    .notNull()
    .references(() => receipts.id),
  packagingId: uuid("presentacion_id")
    .notNull()
    .references(() => packagings.id),
  lotId: uuid("lote_id")
    .notNull()
    .references(() => lots.id),
  locationId: uuid("ubicacion_id")
    .notNull()
    .references(() => locations.id),
  quantity: integer("cantidad").notNull(), // in packagings
  cost: integer("costo").notNull(), // céntimos per packaging
});

// How a supplier writes a product on its documents (normalized text) → the packaging the owner confirmed. Learned on each receipt.
export const readAliases = pgTable("alias_lectura", {
  text: text("texto").primaryKey(),
  packagingId: uuid("presentacion_id")
    .notNull()
    .references(() => packagings.id),
  updatedAt: timestamp("actualizado_en", { withTimezone: true }).notNull().defaultNow(),
});
