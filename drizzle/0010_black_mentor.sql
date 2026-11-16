CREATE TYPE "public"."estado_compra" AS ENUM('BORRADOR', 'RECIBIDA', 'ANULADA');--> statement-breakpoint
CREATE TYPE "public"."tipo_compra" AS ENUM('ENVIA_PROVEEDOR', 'RECOJO');--> statement-breakpoint
CREATE TABLE "compra_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"compra_id" uuid NOT NULL,
	"presentacion_id" uuid NOT NULL,
	"cantidad" integer NOT NULL,
	"costo" integer NOT NULL,
	"flete" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "compra_items_presentacion_uq" UNIQUE("compra_id","presentacion_id"),
	CONSTRAINT "compra_cantidad_positiva" CHECK ("compra_items"."cantidad" > 0),
	CONSTRAINT "compra_costo_no_negativo" CHECK ("compra_items"."costo" >= 0 and "compra_items"."flete" >= 0)
);
--> statement-breakpoint
CREATE TABLE "compras" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"numero" serial NOT NULL,
	"tipo" "tipo_compra" NOT NULL,
	"proveedor_id" uuid,
	"vehiculo_id" uuid,
	"estado" "estado_compra" DEFAULT 'BORRADOR' NOT NULL,
	"recepcion_id" uuid,
	"usuario_id" uuid NOT NULL,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "compras_numero_unique" UNIQUE("numero")
);
--> statement-breakpoint
ALTER TABLE "ubicaciones" ADD COLUMN "capacidad_kg" integer;--> statement-breakpoint
ALTER TABLE "compra_items" ADD CONSTRAINT "compra_items_compra_id_compras_id_fk" FOREIGN KEY ("compra_id") REFERENCES "public"."compras"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "compra_items" ADD CONSTRAINT "compra_items_presentacion_id_presentaciones_id_fk" FOREIGN KEY ("presentacion_id") REFERENCES "public"."presentaciones"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "compras" ADD CONSTRAINT "compras_proveedor_id_proveedores_id_fk" FOREIGN KEY ("proveedor_id") REFERENCES "public"."proveedores"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "compras" ADD CONSTRAINT "compras_vehiculo_id_ubicaciones_id_fk" FOREIGN KEY ("vehiculo_id") REFERENCES "public"."ubicaciones"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "compras" ADD CONSTRAINT "compras_recepcion_id_recepciones_id_fk" FOREIGN KEY ("recepcion_id") REFERENCES "public"."recepciones"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "compras" ADD CONSTRAINT "compras_usuario_id_usuarios_id_fk" FOREIGN KEY ("usuario_id") REFERENCES "public"."usuarios"("id") ON DELETE no action ON UPDATE no action;