CREATE TYPE "public"."tipo_movimiento" AS ENUM('INGRESO', 'SALDO_INICIAL');--> statement-breakpoint
CREATE TYPE "public"."tipo_recepcion" AS ENUM('COMPRA', 'SALDO_INICIAL');--> statement-breakpoint
CREATE TABLE "lotes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"producto_id" uuid NOT NULL,
	"vence_el" date,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "lotes_producto_vence_uq" UNIQUE NULLS NOT DISTINCT("producto_id","vence_el")
);
--> statement-breakpoint
CREATE TABLE "recepcion_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"recepcion_id" uuid NOT NULL,
	"presentacion_id" uuid NOT NULL,
	"lote_id" uuid NOT NULL,
	"ubicacion_id" uuid NOT NULL,
	"cantidad" integer NOT NULL,
	"costo" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "recepciones" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tipo" "tipo_recepcion" NOT NULL,
	"proveedor" text,
	"documento" text,
	"total" integer NOT NULL,
	"usuario_id" uuid NOT NULL,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "stock" (
	"ubicacion_id" uuid NOT NULL,
	"lote_id" uuid NOT NULL,
	"cantidad" integer NOT NULL,
	CONSTRAINT "stock_ubicacion_id_lote_id_pk" PRIMARY KEY("ubicacion_id","lote_id"),
	CONSTRAINT "stock_no_negativo" CHECK ("stock"."cantidad" >= 0)
);
--> statement-breakpoint
CREATE TABLE "movimientos_stock" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tipo" "tipo_movimiento" NOT NULL,
	"lote_id" uuid NOT NULL,
	"ubicacion_id" uuid NOT NULL,
	"cantidad" integer NOT NULL,
	"costo_unitario" integer NOT NULL,
	"documento_id" uuid,
	"usuario_id" uuid NOT NULL,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "lotes" ADD CONSTRAINT "lotes_producto_id_productos_id_fk" FOREIGN KEY ("producto_id") REFERENCES "public"."productos"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recepcion_items" ADD CONSTRAINT "recepcion_items_recepcion_id_recepciones_id_fk" FOREIGN KEY ("recepcion_id") REFERENCES "public"."recepciones"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recepcion_items" ADD CONSTRAINT "recepcion_items_presentacion_id_presentaciones_id_fk" FOREIGN KEY ("presentacion_id") REFERENCES "public"."presentaciones"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recepcion_items" ADD CONSTRAINT "recepcion_items_lote_id_lotes_id_fk" FOREIGN KEY ("lote_id") REFERENCES "public"."lotes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recepcion_items" ADD CONSTRAINT "recepcion_items_ubicacion_id_ubicaciones_id_fk" FOREIGN KEY ("ubicacion_id") REFERENCES "public"."ubicaciones"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recepciones" ADD CONSTRAINT "recepciones_usuario_id_usuarios_id_fk" FOREIGN KEY ("usuario_id") REFERENCES "public"."usuarios"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock" ADD CONSTRAINT "stock_ubicacion_id_ubicaciones_id_fk" FOREIGN KEY ("ubicacion_id") REFERENCES "public"."ubicaciones"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock" ADD CONSTRAINT "stock_lote_id_lotes_id_fk" FOREIGN KEY ("lote_id") REFERENCES "public"."lotes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "movimientos_stock" ADD CONSTRAINT "movimientos_stock_lote_id_lotes_id_fk" FOREIGN KEY ("lote_id") REFERENCES "public"."lotes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "movimientos_stock" ADD CONSTRAINT "movimientos_stock_ubicacion_id_ubicaciones_id_fk" FOREIGN KEY ("ubicacion_id") REFERENCES "public"."ubicaciones"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "movimientos_stock" ADD CONSTRAINT "movimientos_stock_usuario_id_usuarios_id_fk" FOREIGN KEY ("usuario_id") REFERENCES "public"."usuarios"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "movimientos_lote_idx" ON "movimientos_stock" USING btree ("lote_id","creado_en");