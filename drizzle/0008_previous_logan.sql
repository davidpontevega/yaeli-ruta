ALTER TYPE "public"."tipo_movimiento" ADD VALUE 'VENTA';--> statement-breakpoint
ALTER TYPE "public"."estado_pedido" ADD VALUE 'ENTREGADO';--> statement-breakpoint
ALTER TABLE "movimientos_cuenta" ADD COLUMN "pedido_id" uuid;--> statement-breakpoint
ALTER TABLE "pedido_items" ADD COLUMN "cantidad_entregada" integer;--> statement-breakpoint
ALTER TABLE "pedidos" ADD COLUMN "entregado_en" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "movimientos_cuenta" ADD CONSTRAINT "movimientos_cuenta_pedido_id_pedidos_id_fk" FOREIGN KEY ("pedido_id") REFERENCES "public"."pedidos"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pedido_items" ADD CONSTRAINT "pedido_entregado_rango" CHECK ("pedido_items"."cantidad_entregada" between 0 and "pedido_items"."cantidad");