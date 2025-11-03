CREATE TABLE "order_addresses" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"address_line_1" varchar(255) NOT NULL,
	"address_line_2" varchar(255),
	"city" varchar(255) NOT NULL,
	"zip_code" varchar(50) NOT NULL,
	"state_province" varchar(255),
	"country" varchar(255) NOT NULL
);
--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "delivery_address_id" bigint;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "billing_address_id" bigint;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_delivery_address_id_order_addresses_id_fk" FOREIGN KEY ("delivery_address_id") REFERENCES "public"."order_addresses"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_billing_address_id_order_addresses_id_fk" FOREIGN KEY ("billing_address_id") REFERENCES "public"."order_addresses"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_orders_delivery_address" ON "orders" USING btree ("delivery_address_id");--> statement-breakpoint
CREATE INDEX "idx_orders_billing_address" ON "orders" USING btree ("billing_address_id");