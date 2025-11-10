ALTER TABLE "brands" ADD COLUMN "slug" text NOT NULL;--> statement-breakpoint
ALTER TABLE "watches" ADD COLUMN "slug" text NOT NULL;--> statement-breakpoint
ALTER TABLE "brands" ADD CONSTRAINT "brands_slug_unique" UNIQUE("slug");--> statement-breakpoint
ALTER TABLE "watches" ADD CONSTRAINT "watches_slug_unique" UNIQUE("slug");