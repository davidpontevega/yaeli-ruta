CREATE TABLE "fotos_producto" (
	"producto_id" uuid PRIMARY KEY NOT NULL,
	"mime" text NOT NULL,
	"bytes" "bytea" NOT NULL,
	"actualizado_en" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "productos" ADD COLUMN "en_catalogo" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "fotos_producto" ADD CONSTRAINT "fotos_producto_producto_id_productos_id_fk" FOREIGN KEY ("producto_id") REFERENCES "public"."productos"("id") ON DELETE no action ON UPDATE no action;