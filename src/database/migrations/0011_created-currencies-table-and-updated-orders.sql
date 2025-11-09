CREATE TABLE "currencies" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"code" varchar(3) NOT NULL,
	"exchange_rate" numeric(10, 6) NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "currencies_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "currency_history" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"currency_id" bigint NOT NULL,
	"exchange_rate" numeric(10, 6) NOT NULL,
	"changed_at" timestamp DEFAULT now() NOT NULL,
	"changed_by" varchar(255)
);
--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "currency_code" varchar(3) DEFAULT 'DKK' NOT NULL;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "exchange_rate_used" numeric(10, 6) DEFAULT '1.000000' NOT NULL;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "total_price_dkk" numeric(12, 2) NOT NULL;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "total_price_currency" numeric(12, 2) NOT NULL;--> statement-breakpoint
ALTER TABLE "currency_history" ADD CONSTRAINT "currency_history_currency_id_currencies_id_fk" FOREIGN KEY ("currency_id") REFERENCES "public"."currencies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_currencies_code" ON "currencies" USING btree ("code");--> statement-breakpoint
CREATE INDEX "idx_currencies_is_active" ON "currencies" USING btree ("is_active");--> statement-breakpoint
CREATE INDEX "idx_currency_history_currency_id" ON "currency_history" USING btree ("currency_id");--> statement-breakpoint
CREATE INDEX "idx_currency_history_changed_at" ON "currency_history" USING btree ("changed_at");--> statement-breakpoint
CREATE INDEX "idx_orders_currency_code" ON "orders" USING btree ("currency_code");