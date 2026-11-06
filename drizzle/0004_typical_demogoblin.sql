CREATE TABLE "proveedores" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"nombre" text NOT NULL,
	"telefono" text,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "proveedores_nombre_unique" UNIQUE("nombre")
);
--> statement-breakpoint
ALTER TABLE "recepciones" ADD COLUMN "proveedor_id" uuid;--> statement-breakpoint
ALTER TABLE "recepciones" ADD CONSTRAINT "recepciones_proveedor_id_proveedores_id_fk" FOREIGN KEY ("proveedor_id") REFERENCES "public"."proveedores"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
-- Data: suppliers named in existing purchases (first spelling wins, matched ignoring case and extra spaces).
INSERT INTO "proveedores" ("nombre")
SELECT DISTINCT ON (lower(regexp_replace(trim("proveedor"), '\s+', ' ', 'g'))) regexp_replace(trim("proveedor"), '\s+', ' ', 'g')
FROM "recepciones"
WHERE "tipo" = 'COMPRA' AND "proveedor" IS NOT NULL AND trim("proveedor") <> ''
ORDER BY lower(regexp_replace(trim("proveedor"), '\s+', ' ', 'g')), "creado_en"
ON CONFLICT DO NOTHING;--> statement-breakpoint
UPDATE "recepciones" r SET "proveedor_id" = p."id"
FROM "proveedores" p
WHERE r."tipo" = 'COMPRA' AND lower(regexp_replace(trim(r."proveedor"), '\s+', ' ', 'g')) = lower(p."nombre");
