import { boolean, index, integer, jsonb, pgEnum, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

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
