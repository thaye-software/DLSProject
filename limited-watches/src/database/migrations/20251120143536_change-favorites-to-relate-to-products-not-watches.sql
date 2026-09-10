ALTER TABLE "favorites" RENAME COLUMN "watch_id" TO "product_id";--> statement-breakpoint
ALTER TABLE "favorites" DROP CONSTRAINT "favorites_watch_id_watches_id_fk";
--> statement-breakpoint
DROP INDEX "idx_favorites_watch_id";--> statement-breakpoint
ALTER TABLE "favorites" ADD CONSTRAINT "favorites_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_favorites_product_id" ON "favorites" USING btree ("product_id");