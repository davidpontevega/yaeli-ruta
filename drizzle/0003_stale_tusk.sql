CREATE TABLE "alias_lectura" (
	"texto" text PRIMARY KEY NOT NULL,
	"presentacion_id" uuid NOT NULL,
	"actualizado_en" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "alias_lectura" ADD CONSTRAINT "alias_lectura_presentacion_id_presentaciones_id_fk" FOREIGN KEY ("presentacion_id") REFERENCES "public"."presentaciones"("id") ON DELETE no action ON UPDATE no action;