CREATE TABLE "precios_cliente" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"cliente_id" uuid NOT NULL,
	"presentacion_id" uuid NOT NULL,
	"precio" integer NOT NULL,
	CONSTRAINT "precios_cliente_uq" UNIQUE("cliente_id","presentacion_id"),
	CONSTRAINT "precio_cliente_positivo" CHECK ("precios_cliente"."precio" > 0)
);
--> statement-breakpoint
ALTER TABLE "precios_cliente" ADD CONSTRAINT "precios_cliente_cliente_id_clientes_id_fk" FOREIGN KEY ("cliente_id") REFERENCES "public"."clientes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "precios_cliente" ADD CONSTRAINT "precios_cliente_presentacion_id_presentaciones_id_fk" FOREIGN KEY ("presentacion_id") REFERENCES "public"."presentaciones"("id") ON DELETE no action ON UPDATE no action;