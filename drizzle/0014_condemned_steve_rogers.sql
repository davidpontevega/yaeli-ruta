CREATE TYPE "public"."estado_hoja_ruta" AS ENUM('PREPARANDO', 'EN_RUTA', 'LIQUIDADA');--> statement-breakpoint
CREATE TABLE "hojas_ruta" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"numero" serial NOT NULL,
	"fecha" date NOT NULL,
	"ruta_id" uuid NOT NULL,
	"vehiculo_id" uuid NOT NULL,
	"usuario_id" uuid NOT NULL,
	"estado" "estado_hoja_ruta" DEFAULT 'PREPARANDO' NOT NULL,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "hojas_ruta_numero_unique" UNIQUE("numero")
);
--> statement-breakpoint
ALTER TABLE "pedidos" ADD COLUMN "hoja_ruta_id" uuid;--> statement-breakpoint
ALTER TABLE "hojas_ruta" ADD CONSTRAINT "hojas_ruta_ruta_id_rutas_id_fk" FOREIGN KEY ("ruta_id") REFERENCES "public"."rutas"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hojas_ruta" ADD CONSTRAINT "hojas_ruta_vehiculo_id_ubicaciones_id_fk" FOREIGN KEY ("vehiculo_id") REFERENCES "public"."ubicaciones"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hojas_ruta" ADD CONSTRAINT "hojas_ruta_usuario_id_usuarios_id_fk" FOREIGN KEY ("usuario_id") REFERENCES "public"."usuarios"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "hojas_ruta_fecha_idx" ON "hojas_ruta" USING btree ("fecha");--> statement-breakpoint
ALTER TABLE "pedidos" ADD CONSTRAINT "pedidos_hoja_ruta_id_hojas_ruta_id_fk" FOREIGN KEY ("hoja_ruta_id") REFERENCES "public"."hojas_ruta"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "pedidos_hoja_ruta_idx" ON "pedidos" USING btree ("hoja_ruta_id");