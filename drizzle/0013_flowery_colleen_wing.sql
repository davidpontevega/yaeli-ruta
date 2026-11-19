ALTER TABLE "usuarios" ADD COLUMN "es_admin" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "usuarios" ADD COLUMN "menus_ocultos" text[] DEFAULT '{}'::text[] NOT NULL;