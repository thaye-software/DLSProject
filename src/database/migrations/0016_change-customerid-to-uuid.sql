ALTER TABLE "conversations" DROP CONSTRAINT "conversations_product_id_watches_id_fk";
--> statement-breakpoint
DROP INDEX IF EXISTS "idx_users_email_confirmed";--> statement-breakpoint
ALTER TABLE "addresses" ALTER COLUMN "user_id" SET DATA TYPE uuid USING (user_id::uuid);--> statement-breakpoint
ALTER TABLE "blog_posts" ALTER COLUMN "author_id" SET DATA TYPE uuid USING (author_id::uuid);--> statement-breakpoint
ALTER TABLE "conversations" ALTER COLUMN "customer_id" SET DATA TYPE uuid USING (customer_id::uuid);--> statement-breakpoint
ALTER TABLE "orders" ALTER COLUMN "user_id" SET DATA TYPE uuid USING (user_id::uuid);--> statement-breakpoint
ALTER TABLE "users" ALTER COLUMN "id" SET DATA TYPE uuid USING (id::uuid);--> statement-breakpoint
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "users" DROP COLUMN IF EXISTS "password";--> statement-breakpoint
ALTER TABLE "users" DROP COLUMN IF EXISTS "email_confirmed";