CREATE TABLE "brands" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"name" varchar(255) NOT NULL,
	"slug" varchar(255),
	"product_safety_info_id" bigint,
	CONSTRAINT "brands_name_unique" UNIQUE("name")
);
--> statement-breakpoint
ALTER TABLE "watches" RENAME COLUMN "brand" TO "brand_id";--> statement-breakpoint
DROP INDEX "idx_product_safety_brand";--> statement-breakpoint
DROP INDEX "idx_watches_brand";--> statement-breakpoint
ALTER TABLE "brands" ADD CONSTRAINT "brands_product_safety_info_id_product_safety_info_id_fk" FOREIGN KEY ("product_safety_info_id") REFERENCES "public"."product_safety_info"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_brands_name" ON "brands" USING btree ("name");--> statement-breakpoint
CREATE INDEX "idx_brands_slug" ON "brands" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "idx_watches_brand" ON "watches" USING btree ("brand_id");--> statement-breakpoint
ALTER TABLE "product_safety_info" DROP COLUMN "brand_id";--> statement-breakpoint
ALTER TABLE "product_safety_info" DROP COLUMN "brand";