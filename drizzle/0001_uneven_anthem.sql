CREATE TYPE "public"."tipo_ubicacion" AS ENUM('ALMACEN', 'VEHICULO');--> statement-breakpoint
CREATE TABLE "categorias" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"nombre" text NOT NULL,
	CONSTRAINT "categorias_nombre_unique" UNIQUE("nombre")
);
--> statement-breakpoint
CREATE TABLE "marcas" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"nombre" text NOT NULL,
	CONSTRAINT "marcas_nombre_unique" UNIQUE("nombre")
);
--> statement-breakpoint
CREATE TABLE "presentaciones" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"producto_id" uuid NOT NULL,
	"nombre" text NOT NULL,
	"factor" integer NOT NULL,
	"codigo_barras" text,
	"precio_venta" integer NOT NULL,
	CONSTRAINT "presentaciones_codigo_barras_unique" UNIQUE("codigo_barras"),
	CONSTRAINT "factor_positivo" CHECK ("presentaciones"."factor" > 0)
);
--> statement-breakpoint
CREATE TABLE "productos" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"sku" text NOT NULL,
	"nombre" text NOT NULL,
	"categoria_id" uuid NOT NULL,
	"marca_id" uuid,
	"unidad_base" text NOT NULL,
	"stock_minimo" integer DEFAULT 0 NOT NULL,
	"costo_promedio" integer DEFAULT 0 NOT NULL,
	"ultimo_costo" integer DEFAULT 0 NOT NULL,
	"margen_pct" integer DEFAULT 15 NOT NULL,
	"activo" boolean DEFAULT true NOT NULL,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "productos_sku_unique" UNIQUE("sku")
);
--> statement-breakpoint
CREATE TABLE "ubicaciones" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"nombre" text NOT NULL,
	"tipo" "tipo_ubicacion" NOT NULL,
	"activo" boolean DEFAULT true NOT NULL,
	CONSTRAINT "ubicaciones_nombre_unique" UNIQUE("nombre")
);
--> statement-breakpoint
ALTER TABLE "presentaciones" ADD CONSTRAINT "presentaciones_producto_id_productos_id_fk" FOREIGN KEY ("producto_id") REFERENCES "public"."productos"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "productos" ADD CONSTRAINT "productos_categoria_id_categorias_id_fk" FOREIGN KEY ("categoria_id") REFERENCES "public"."categorias"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "productos" ADD CONSTRAINT "productos_marca_id_marcas_id_fk" FOREIGN KEY ("marca_id") REFERENCES "public"."marcas"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "presentaciones_producto_nombre_uq" ON "presentaciones" USING btree ("producto_id","nombre");--> statement-breakpoint
CREATE INDEX "productos_categoria_idx" ON "productos" USING btree ("categoria_id");