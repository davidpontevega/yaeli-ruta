import "server-only";
import { asc } from "drizzle-orm";
import { db } from "@/server/db";
import { categorias, marcas } from "@/server/db/schema";

export const opcionesCatalogo = () =>
  Promise.all([
    db.select({ id: categorias.id, nombre: categorias.nombre }).from(categorias).orderBy(asc(categorias.nombre)),
    db.select({ id: marcas.id, nombre: marcas.nombre }).from(marcas).orderBy(asc(marcas.nombre)),
  ]);
