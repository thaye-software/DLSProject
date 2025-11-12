ALTER TABLE "countries" ADD COLUMN "currency_id" bigint NOT NULL;--> statement-breakpoint
ALTER TABLE "countries" ADD CONSTRAINT "countries_currency_id_currencies_id_fk" FOREIGN KEY ("currency_id") REFERENCES "public"."currencies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "countries" DROP COLUMN "currency";