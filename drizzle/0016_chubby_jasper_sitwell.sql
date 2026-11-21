ALTER TABLE "movimientos_cuenta" ADD COLUMN "hoja_ruta_id" uuid;--> statement-breakpoint
ALTER TABLE "hojas_ruta" ADD COLUMN "efectivo_esperado" integer;--> statement-breakpoint
ALTER TABLE "hojas_ruta" ADD COLUMN "efectivo_entregado" integer;--> statement-breakpoint
ALTER TABLE "hojas_ruta" ADD COLUMN "liquidada_en" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "movimientos_cuenta" ADD CONSTRAINT "movimientos_cuenta_hoja_ruta_id_hojas_ruta_id_fk" FOREIGN KEY ("hoja_ruta_id") REFERENCES "public"."hojas_ruta"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "movimientos_cuenta_hoja_ruta_idx" ON "movimientos_cuenta" USING btree ("hoja_ruta_id");