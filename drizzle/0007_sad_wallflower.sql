CREATE TYPE "public"."tipo_movimiento_cuenta" AS ENUM('SALDO_INICIAL', 'CARGO', 'ABONO', 'AJUSTE');--> statement-breakpoint
CREATE TYPE "public"."medio_pago" AS ENUM('EFECTIVO', 'YAPE', 'PLIN', 'TRANSFERENCIA');--> statement-breakpoint
CREATE TABLE "movimientos_cuenta" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"cliente_id" uuid NOT NULL,
	"tipo" "tipo_movimiento_cuenta" NOT NULL,
	"monto" integer NOT NULL,
	"fecha" date NOT NULL,
	"medio" "medio_pago",
	"nota" text,
	"usuario_id" uuid NOT NULL,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "monto_no_cero" CHECK ("movimientos_cuenta"."monto" <> 0)
);
--> statement-breakpoint
ALTER TABLE "movimientos_cuenta" ADD CONSTRAINT "movimientos_cuenta_cliente_id_clientes_id_fk" FOREIGN KEY ("cliente_id") REFERENCES "public"."clientes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "movimientos_cuenta" ADD CONSTRAINT "movimientos_cuenta_usuario_id_usuarios_id_fk" FOREIGN KEY ("usuario_id") REFERENCES "public"."usuarios"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "movimientos_cuenta_cliente_idx" ON "movimientos_cuenta" USING btree ("cliente_id","fecha");--> statement-breakpoint
CREATE UNIQUE INDEX "movimientos_cuenta_saldo_inicial_uq" ON "movimientos_cuenta" USING btree ("cliente_id") WHERE "movimientos_cuenta"."tipo" = 'SALDO_INICIAL';