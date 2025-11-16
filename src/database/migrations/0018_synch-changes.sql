ALTER TABLE "users" DROP CONSTRAINT "users_country_countries_id_fk";
--> statement-breakpoint
ALTER TABLE "users" DROP CONSTRAINT "users_address_addresses_id_fk";
--> statement-breakpoint
DROP INDEX "idx_users_country";--> statement-breakpoint
DROP INDEX "idx_users_address";--> statement-breakpoint
ALTER TABLE "countries" ADD COLUMN "currency_id" bigint NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "country_id" bigint;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "address_id" bigint;--> statement-breakpoint
ALTER TABLE "countries" ADD CONSTRAINT "countries_currency_id_currencies_id_fk" FOREIGN KEY ("currency_id") REFERENCES "public"."currencies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_country_id_countries_id_fk" FOREIGN KEY ("country_id") REFERENCES "public"."countries"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_address_id_addresses_id_fk" FOREIGN KEY ("address_id") REFERENCES "public"."addresses"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_users_country" ON "users" USING btree ("country_id");--> statement-breakpoint
CREATE INDEX "idx_users_address" ON "users" USING btree ("address_id");--> statement-breakpoint
ALTER TABLE "countries" DROP COLUMN "currency";--> statement-breakpoint
ALTER TABLE "users" DROP COLUMN "country";--> statement-breakpoint
ALTER TABLE "users" DROP COLUMN "address";