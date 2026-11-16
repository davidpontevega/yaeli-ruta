ALTER TABLE "presentaciones" ADD COLUMN "peso_gramos" integer;--> statement-breakpoint
ALTER TABLE "productos" ADD COLUMN "proveedor_id" uuid;--> statement-breakpoint
ALTER TABLE "productos" ADD CONSTRAINT "productos_proveedor_id_proveedores_id_fk" FOREIGN KEY ("proveedor_id") REFERENCES "public"."proveedores"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "presentaciones" ADD CONSTRAINT "peso_positivo" CHECK ("presentaciones"."peso_gramos" > 0);--> statement-breakpoint
-- Data: each product takes the supplier of its latest purchase (COMPRA) that has one.
UPDATE "productos" p SET "proveedor_id" = last."proveedor_id"
FROM (
  SELECT DISTINCT ON (pr."producto_id") pr."producto_id", r."proveedor_id"
  FROM "recepcion_items" ri
  JOIN "recepciones" r ON r."id" = ri."recepcion_id"
  JOIN "presentaciones" pr ON pr."id" = ri."presentacion_id"
  WHERE r."tipo" = 'COMPRA' AND r."proveedor_id" IS NOT NULL
  ORDER BY pr."producto_id", r."creado_en" DESC
) last
WHERE last."producto_id" = p."id";
