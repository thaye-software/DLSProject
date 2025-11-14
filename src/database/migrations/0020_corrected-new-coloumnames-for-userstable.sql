ALTER TABLE "users" ALTER COLUMN "first_name" SET DATA TYPE varchar(255);--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "middle_name" varchar(255);--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "last_name" varchar(255);--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "phone" varchar(20);