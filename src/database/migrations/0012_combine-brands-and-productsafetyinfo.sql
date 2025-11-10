ALTER TABLE "product_safety_info" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
DROP TABLE "product_safety_info" CASCADE;--> statement-breakpoint
--> statement-breakpoint
DROP INDEX "idx_brands_slug";--> statement-breakpoint
ALTER TABLE "brands" ADD COLUMN "country" varchar(255) DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "brands" ADD COLUMN "address_line_1" varchar(255);--> statement-breakpoint
ALTER TABLE "brands" ADD COLUMN "address_line_2" varchar(255);--> statement-breakpoint
ALTER TABLE "brands" ADD COLUMN "zip_code" varchar(50);--> statement-breakpoint
ALTER TABLE "brands" ADD COLUMN "city" varchar(255);--> statement-breakpoint
ALTER TABLE "brands" ADD COLUMN "state_province" varchar(255);--> statement-breakpoint
ALTER TABLE "brands" ADD COLUMN "phone_number" varchar(50);--> statement-breakpoint
ALTER TABLE "brands" ADD COLUMN "email" varchar(255);--> statement-breakpoint
ALTER TABLE "brands" ADD COLUMN "website" varchar(255);--> statement-breakpoint
ALTER TABLE "brands" DROP COLUMN "slug";--> statement-breakpoint
ALTER TABLE "brands" DROP COLUMN "product_safety_info_id";