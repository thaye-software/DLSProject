ALTER TABLE "orders" DROP CONSTRAINT "orders_status_check";--> statement-breakpoint
DROP INDEX "idx_orders_currency_code";--> statement-breakpoint
ALTER TABLE "orders" ALTER COLUMN "status" SET DATA TYPE varchar(15);--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "currency_id" bigint NOT NULL;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_currency_id_currencies_id_fk" FOREIGN KEY ("currency_id") REFERENCES "public"."currencies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_orders_currency_id" ON "orders" USING btree ("currency_id");--> statement-breakpoint
ALTER TABLE "orders" DROP COLUMN "total_price";--> statement-breakpoint
ALTER TABLE "orders" DROP COLUMN "currency";--> statement-breakpoint
ALTER TABLE "orders" DROP COLUMN "currency_code";--> statement-breakpoint
ALTER TABLE "orders" DROP COLUMN "exchange_rate_used";--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_status_check" CHECK ("orders"."status" IN ('PENDING', 'PROCESSING', 'SHIPPED', 'DELIVERED', 'CANCELLED'));