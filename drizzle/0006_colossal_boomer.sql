CREATE TYPE "public"."estado_pedido" AS ENUM('PENDIENTE', 'ANULADO');--> statement-breakpoint
CREATE TABLE "pedido_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"pedido_id" uuid NOT NULL,
	"presentacion_id" uuid NOT NULL,
	"cantidad" integer NOT NULL,
	"precio" integer NOT NULL,
	CONSTRAINT "pedido_items_presentacion_uq" UNIQUE("pedido_id","presentacion_id"),
	CONSTRAINT "pedido_cantidad_positiva" CHECK ("pedido_items"."cantidad" > 0)
);
--> statement-breakpoint
CREATE TABLE "pedidos" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"numero" serial NOT NULL,
	"cliente_id" uuid NOT NULL,
	"fecha_entrega" date NOT NULL,
	"estado" "estado_pedido" DEFAULT 'PENDIENTE' NOT NULL,
	"total" integer NOT NULL,
	"usuario_id" uuid NOT NULL,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "pedidos_numero_unique" UNIQUE("numero")
);
--> statement-breakpoint
ALTER TABLE "pedido_items" ADD CONSTRAINT "pedido_items_pedido_id_pedidos_id_fk" FOREIGN KEY ("pedido_id") REFERENCES "public"."pedidos"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pedido_items" ADD CONSTRAINT "pedido_items_presentacion_id_presentaciones_id_fk" FOREIGN KEY ("presentacion_id") REFERENCES "public"."presentaciones"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pedidos" ADD CONSTRAINT "pedidos_cliente_id_clientes_id_fk" FOREIGN KEY ("cliente_id") REFERENCES "public"."clientes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pedidos" ADD CONSTRAINT "pedidos_usuario_id_usuarios_id_fk" FOREIGN KEY ("usuario_id") REFERENCES "public"."usuarios"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "pedidos_entrega_estado_idx" ON "pedidos" USING btree ("fecha_entrega","estado");