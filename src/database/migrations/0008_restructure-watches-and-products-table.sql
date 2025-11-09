ALTER TABLE "products" DROP CONSTRAINT "products_watch_id_watches_id_fk";
--> statement-breakpoint
DROP INDEX "idx_products_watch_id";--> statement-breakpoint
ALTER TABLE "watches" ADD COLUMN "product_id" bigint NOT NULL;--> statement-breakpoint
ALTER TABLE "watches" ADD CONSTRAINT "watches_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_watches_product_id" ON "watches" USING btree ("product_id");--> statement-breakpoint
ALTER TABLE "products" DROP COLUMN "watch_id";