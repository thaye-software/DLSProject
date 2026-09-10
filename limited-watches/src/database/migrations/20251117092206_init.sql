CREATE TABLE "addresses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"address_line_1" varchar(255) NOT NULL,
	"address_line_2" varchar(255),
	"city" varchar(255) NOT NULL,
	"zip_code" varchar(50) NOT NULL,
	"state_province" varchar(255)
);
--> statement-breakpoint
CREATE TABLE "auctions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"watch_id" uuid NOT NULL,
	"starting_price" bigint NOT NULL,
	"current_price" bigint,
	"ends_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "blog_media" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"blog_id" uuid NOT NULL,
	"media_url" varchar(255) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "blog_posts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" varchar(255) NOT NULL,
	"content" text NOT NULL,
	"author_id" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "brands" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"name" varchar(255) NOT NULL,
	"country" varchar(255) DEFAULT '' NOT NULL,
	"address_line_1" varchar(255),
	"address_line_2" varchar(255),
	"zip_code" varchar(50),
	"city" varchar(255),
	"state_province" varchar(255),
	"phone_number" varchar(50),
	"email" varchar(255),
	"website" varchar(255),
	CONSTRAINT "brands_slug_unique" UNIQUE("slug"),
	CONSTRAINT "brands_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "conversations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"customer_id" uuid NOT NULL,
	"product_id" uuid NOT NULL,
	"status" text DEFAULT 'open',
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "conversations_status_check" CHECK ("conversations"."status" IN ('open', 'closed', 'pending'))
);
--> statement-breakpoint
CREATE TABLE "countries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(255) NOT NULL,
	"abbreviation" varchar(10) NOT NULL,
	"currency_id" uuid NOT NULL
);
--> statement-breakpoint
CREATE TABLE "currencies" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" varchar(3) NOT NULL,
	"exchange_rate" numeric(10, 6) NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "currencies_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "currency_history" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"currency_id" uuid NOT NULL,
	"exchange_rate" numeric(10, 6) NOT NULL,
	"changed_at" timestamp DEFAULT now() NOT NULL,
	"changed_by" varchar(255)
);
--> statement-breakpoint
CREATE TABLE "favorites" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"watch_id" uuid NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"conversation_id" uuid NOT NULL,
	"sender_id" uuid NOT NULL,
	"sender_type" text NOT NULL,
	"content" text NOT NULL,
	"is_read" boolean DEFAULT false,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "messages_sender_type_check" CHECK ("messages"."sender_type" IN ('customer', 'seller'))
);
--> statement-breakpoint
CREATE TABLE "order_addresses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"first_name" varchar(255),
	"middle_name" varchar(255),
	"last_name" varchar(255),
	"address_line_1" varchar(255) NOT NULL,
	"address_line_2" varchar(255),
	"city" varchar(255) NOT NULL,
	"zip_code" varchar(50) NOT NULL,
	"state_province" varchar(255),
	"country" varchar(255) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "order_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"order_id" uuid NOT NULL,
	"product_id" uuid NOT NULL,
	"quantity" integer DEFAULT 1 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "orders" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"status" varchar(15) NOT NULL,
	"currency_id" uuid NOT NULL,
	"total_price_dkk" numeric(12, 2) NOT NULL,
	"total_price_currency" numeric(12, 2) NOT NULL,
	"delivery_address_id" uuid,
	"billing_address_id" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "orders_status_check" CHECK ("orders"."status" IN ('PENDING', 'PROCESSING', 'SHIPPED', 'DELIVERED', 'CANCELLED'))
);
--> statement-breakpoint
CREATE TABLE "product_images" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"product_id" uuid,
	"image_url" varchar(255) NOT NULL,
	"is_thumbnail" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "products" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"product_type" varchar(255) NOT NULL,
	"name" varchar(255) NOT NULL,
	"price_dkk" bigint NOT NULL,
	"description" text NOT NULL,
	"stock" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY NOT NULL,
	"username" varchar(255) NOT NULL,
	"first_name" varchar(255),
	"middle_name" varchar(255),
	"last_name" varchar(255),
	"phone" varchar(20),
	"email" varchar(255) NOT NULL,
	"avatar_url" text,
	"role" varchar(50) DEFAULT 'customer' NOT NULL,
	"country_id" uuid,
	"address_id" uuid,
	CONSTRAINT "users_username_unique" UNIQUE("username"),
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "watches" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"product_id" uuid NOT NULL,
	"brand_id" uuid NOT NULL,
	"model" varchar(255) NOT NULL,
	"slug" text NOT NULL,
	"reference" varchar(255) NOT NULL,
	"serial_number" varchar(255) NOT NULL,
	"year" integer NOT NULL,
	"size" varchar(50),
	"movement" varchar(100),
	"glass_type" varchar(100),
	"limited" boolean DEFAULT false NOT NULL,
	"box" boolean DEFAULT false NOT NULL,
	"papers" boolean DEFAULT false NOT NULL,
	"condition" integer NOT NULL,
	"bracelet_type" varchar(100),
	"bracelet_color" varchar(100),
	"dial_color" varchar(100),
	"vat" integer,
	CONSTRAINT "watches_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
ALTER TABLE "auctions" ADD CONSTRAINT "auctions_watch_id_watches_id_fk" FOREIGN KEY ("watch_id") REFERENCES "public"."watches"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "blog_media" ADD CONSTRAINT "blog_media_blog_id_blog_posts_id_fk" FOREIGN KEY ("blog_id") REFERENCES "public"."blog_posts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "blog_posts" ADD CONSTRAINT "blog_posts_author_id_users_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_customer_id_users_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "countries" ADD CONSTRAINT "countries_currency_id_currencies_id_fk" FOREIGN KEY ("currency_id") REFERENCES "public"."currencies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "currency_history" ADD CONSTRAINT "currency_history_currency_id_currencies_id_fk" FOREIGN KEY ("currency_id") REFERENCES "public"."currencies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "favorites" ADD CONSTRAINT "favorites_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "favorites" ADD CONSTRAINT "favorites_watch_id_watches_id_fk" FOREIGN KEY ("watch_id") REFERENCES "public"."watches"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_conversation_id_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."conversations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_sender_id_users_id_fk" FOREIGN KEY ("sender_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_currency_id_currencies_id_fk" FOREIGN KEY ("currency_id") REFERENCES "public"."currencies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_delivery_address_id_order_addresses_id_fk" FOREIGN KEY ("delivery_address_id") REFERENCES "public"."order_addresses"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_billing_address_id_order_addresses_id_fk" FOREIGN KEY ("billing_address_id") REFERENCES "public"."order_addresses"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_images" ADD CONSTRAINT "product_images_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_country_id_countries_id_fk" FOREIGN KEY ("country_id") REFERENCES "public"."countries"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_address_id_addresses_id_fk" FOREIGN KEY ("address_id") REFERENCES "public"."addresses"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "watches" ADD CONSTRAINT "watches_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "watches" ADD CONSTRAINT "watches_brand_id_brands_id_fk" FOREIGN KEY ("brand_id") REFERENCES "public"."brands"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_addresses_user_id" ON "addresses" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_auctions_watch_id" ON "auctions" USING btree ("watch_id");--> statement-breakpoint
CREATE INDEX "idx_auctions_ends_at" ON "auctions" USING btree ("ends_at");--> statement-breakpoint
CREATE INDEX "idx_auctions_current_price" ON "auctions" USING btree ("current_price");--> statement-breakpoint
CREATE INDEX "idx_blog_media_blog_id" ON "blog_media" USING btree ("blog_id");--> statement-breakpoint
CREATE INDEX "idx_blog_posts_author_id" ON "blog_posts" USING btree ("author_id");--> statement-breakpoint
CREATE INDEX "idx_blog_posts_created_at" ON "blog_posts" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "idx_brands_name" ON "brands" USING btree ("name");--> statement-breakpoint
CREATE INDEX "idx_conversations_customer_id" ON "conversations" USING btree ("customer_id");--> statement-breakpoint
CREATE INDEX "idx_conversations_product_id" ON "conversations" USING btree ("product_id");--> statement-breakpoint
CREATE INDEX "idx_conversations_status" ON "conversations" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_conversations_created_at" ON "conversations" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "idx_countries_name" ON "countries" USING btree ("name");--> statement-breakpoint
CREATE INDEX "idx_countries_abbreviation" ON "countries" USING btree ("abbreviation");--> statement-breakpoint
CREATE INDEX "idx_currencies_code" ON "currencies" USING btree ("code");--> statement-breakpoint
CREATE INDEX "idx_currencies_is_active" ON "currencies" USING btree ("is_active");--> statement-breakpoint
CREATE INDEX "idx_currency_history_currency_id" ON "currency_history" USING btree ("currency_id");--> statement-breakpoint
CREATE INDEX "idx_currency_history_changed_at" ON "currency_history" USING btree ("changed_at");--> statement-breakpoint
CREATE INDEX "idx_favorites_user_id" ON "favorites" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_favorites_watch_id" ON "favorites" USING btree ("watch_id");--> statement-breakpoint
CREATE INDEX "idx_messages_conversation_id" ON "messages" USING btree ("conversation_id");--> statement-breakpoint
CREATE INDEX "idx_messages_sender_id" ON "messages" USING btree ("sender_id");--> statement-breakpoint
CREATE INDEX "idx_messages_created_at" ON "messages" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "idx_messages_is_read" ON "messages" USING btree ("is_read");--> statement-breakpoint
CREATE INDEX "idx_order_items_order_id" ON "order_items" USING btree ("order_id");--> statement-breakpoint
CREATE INDEX "idx_order_items_product_id" ON "order_items" USING btree ("product_id");--> statement-breakpoint
CREATE INDEX "idx_orders_user_id" ON "orders" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_orders_status" ON "orders" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_orders_created_at" ON "orders" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "idx_orders_delivery_address" ON "orders" USING btree ("delivery_address_id");--> statement-breakpoint
CREATE INDEX "idx_orders_billing_address" ON "orders" USING btree ("billing_address_id");--> statement-breakpoint
CREATE INDEX "idx_orders_currency_id" ON "orders" USING btree ("currency_id");--> statement-breakpoint
CREATE INDEX "idx_product_images_thumbnail" ON "product_images" USING btree ("is_thumbnail");--> statement-breakpoint
CREATE INDEX "idx_products_name" ON "products" USING btree ("name");--> statement-breakpoint
CREATE INDEX "idx_products_created_at" ON "products" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "idx_products_price_dkk" ON "products" USING btree ("price_dkk");--> statement-breakpoint
CREATE INDEX "idx_users_country" ON "users" USING btree ("country_id");--> statement-breakpoint
CREATE INDEX "idx_users_address" ON "users" USING btree ("address_id");--> statement-breakpoint
CREATE INDEX "idx_watches_product_id" ON "watches" USING btree ("product_id");--> statement-breakpoint
CREATE INDEX "idx_watches_brand" ON "watches" USING btree ("brand_id");--> statement-breakpoint
CREATE INDEX "idx_watches_reference" ON "watches" USING btree ("reference");--> statement-breakpoint
CREATE INDEX "idx_watches_year" ON "watches" USING btree ("year");--> statement-breakpoint
CREATE INDEX "idx_watches_condition" ON "watches" USING btree ("condition");