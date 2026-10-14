ALTER TABLE "countries" ADD COLUMN IF NOT EXISTS "vat_rate" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "visible" boolean DEFAULT false NOT NULL;