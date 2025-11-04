import { pgTable, index, foreignKey, unique, bigserial, varchar, boolean, bigint, integer, timestamp, text, check } from "drizzle-orm/pg-core"
import { sql } from "drizzle-orm"



export const users = pgTable("users", {
	id: bigserial({ mode: "bigint" }).primaryKey().notNull(),
	username: varchar({ length: 255 }).notNull(),
	email: varchar({ length: 255 }).notNull(),
	password: varchar({ length: 255 }).notNull(),
	avatarUrl: varchar("avatar_url", { length: 255 }),
	emailConfirmed: boolean("email_confirmed").default(false).notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	country: bigint({ mode: "number" }),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	address: bigint({ mode: "number" }),
	role: varchar({ length: 50 }).default('customer').notNull(),
}, (table) => [
	index("idx_users_address").using("btree", table.address.asc().nullsLast().op("int8_ops")),
	index("idx_users_country").using("btree", table.country.asc().nullsLast().op("int8_ops")),
	index("idx_users_email_confirmed").using("btree", table.emailConfirmed.asc().nullsLast().op("bool_ops")),
	foreignKey({
			columns: [table.address],
			foreignColumns: [addresses.id],
			name: "users_address_addresses_id_fk"
		}).onDelete("set null"),
	foreignKey({
			columns: [table.country],
			foreignColumns: [countries.id],
			name: "users_country_countries_id_fk"
		}).onDelete("set null"),
	unique("users_username_unique").on(table.username),
	unique("users_email_unique").on(table.email),
]);

export const watches = pgTable("watches", {
	id: bigserial({ mode: "bigint" }).primaryKey().notNull(),
	brand: varchar({ length: 255 }).notNull(),
	model: varchar({ length: 255 }).notNull(),
	reference: varchar({ length: 255 }).notNull(),
	serialNumber: varchar("serial_number", { length: 255 }).notNull(),
	year: integer().notNull(),
	size: varchar({ length: 50 }),
	movement: varchar({ length: 100 }),
	glassType: varchar("glass_type", { length: 100 }),
	limited: boolean().default(false).notNull(),
	box: boolean().default(false).notNull(),
	papers: boolean().default(false).notNull(),
	condition: integer().notNull(),
	braceletType: varchar("bracelet_type", { length: 100 }),
	braceletColor: varchar("bracelet_color", { length: 100 }),
	dialColor: varchar("dial_color", { length: 100 }),
	vat: integer(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	productSafetyInfoId: bigint("product_safety_info_id", { mode: "number" }),
}, (table) => [
	index("idx_watches_brand").using("btree", table.brand.asc().nullsLast().op("text_ops")),
	index("idx_watches_condition").using("btree", table.condition.asc().nullsLast().op("int4_ops")),
	index("idx_watches_reference").using("btree", table.reference.asc().nullsLast().op("text_ops")),
	index("idx_watches_year").using("btree", table.year.asc().nullsLast().op("int4_ops")),
	foreignKey({
			columns: [table.productSafetyInfoId],
			foreignColumns: [productSafetyInfo.id],
			name: "watches_product_safety_info_id_product_safety_info_id_fk"
		}).onDelete("set null"),
]);

export const auctions = pgTable("auctions", {
	id: bigserial({ mode: "bigint" }).primaryKey().notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	watchId: bigint("watch_id", { mode: "number" }).notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	startingPrice: bigint("starting_price", { mode: "number" }).notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	currentPrice: bigint("current_price", { mode: "number" }),
	endsAt: timestamp("ends_at", { mode: 'string' }).notNull(),
}, (table) => [
	index("idx_auctions_current_price").using("btree", table.currentPrice.asc().nullsLast().op("int8_ops")),
	index("idx_auctions_ends_at").using("btree", table.endsAt.asc().nullsLast().op("timestamp_ops")),
	index("idx_auctions_watch_id").using("btree", table.watchId.asc().nullsLast().op("int8_ops")),
	foreignKey({
			columns: [table.watchId],
			foreignColumns: [watches.id],
			name: "auctions_watch_id_watches_id_fk"
		}).onDelete("cascade"),
]);

export const blogPosts = pgTable("blog_posts", {
	id: bigserial({ mode: "bigint" }).primaryKey().notNull(),
	title: varchar({ length: 255 }).notNull(),
	content: text().notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	authorId: bigint("author_id", { mode: "number" }),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("idx_blog_posts_author_id").using("btree", table.authorId.asc().nullsLast().op("int8_ops")),
	index("idx_blog_posts_created_at").using("btree", table.createdAt.asc().nullsLast().op("timestamp_ops")),
	foreignKey({
			columns: [table.authorId],
			foreignColumns: [users.id],
			name: "blog_posts_author_id_users_id_fk"
		}).onDelete("set null"),
]);

export const blogMedia = pgTable("blog_media", {
	id: bigserial({ mode: "bigint" }).primaryKey().notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	blogId: bigint("blog_id", { mode: "number" }).notNull(),
	mediaUrl: varchar("media_url", { length: 255 }).notNull(),
}, (table) => [
	index("idx_blog_media_blog_id").using("btree", table.blogId.asc().nullsLast().op("int8_ops")),
	foreignKey({
			columns: [table.blogId],
			foreignColumns: [blogPosts.id],
			name: "blog_media_blog_id_blog_posts_id_fk"
		}).onDelete("cascade"),
]);

export const conversations = pgTable("conversations", {
	id: bigserial({ mode: "bigint" }).primaryKey().notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	customerId: bigint("customer_id", { mode: "number" }).notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	productId: bigint("product_id", { mode: "number" }).notNull(),
	status: text().default('open'),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow(),
}, (table) => [
	index("idx_conversations_created_at").using("btree", table.createdAt.asc().nullsLast().op("timestamp_ops")),
	index("idx_conversations_customer_id").using("btree", table.customerId.asc().nullsLast().op("int8_ops")),
	index("idx_conversations_product_id").using("btree", table.productId.asc().nullsLast().op("int8_ops")),
	index("idx_conversations_status").using("btree", table.status.asc().nullsLast().op("text_ops")),
	foreignKey({
			columns: [table.customerId],
			foreignColumns: [users.id],
			name: "conversations_customer_id_users_id_fk"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.productId],
			foreignColumns: [watches.id],
			name: "conversations_product_id_watches_id_fk"
		}).onDelete("cascade"),
	check("conversations_status_check", sql`status = ANY (ARRAY['open'::text, 'closed'::text, 'pending'::text])`),
]);

export const messages = pgTable("messages", {
	id: bigserial({ mode: "bigint" }).primaryKey().notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	conversationId: bigint("conversation_id", { mode: "number" }).notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	senderId: bigint("sender_id", { mode: "number" }).notNull(),
	senderType: text("sender_type").notNull(),
	content: text().notNull(),
	isRead: boolean("is_read").default(false),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
}, (table) => [
	index("idx_messages_conversation_id").using("btree", table.conversationId.asc().nullsLast().op("int8_ops")),
	index("idx_messages_created_at").using("btree", table.createdAt.asc().nullsLast().op("timestamp_ops")),
	index("idx_messages_is_read").using("btree", table.isRead.asc().nullsLast().op("bool_ops")),
	index("idx_messages_sender_id").using("btree", table.senderId.asc().nullsLast().op("int8_ops")),
	foreignKey({
			columns: [table.conversationId],
			foreignColumns: [conversations.id],
			name: "messages_conversation_id_conversations_id_fk"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.senderId],
			foreignColumns: [users.id],
			name: "messages_sender_id_users_id_fk"
		}).onDelete("cascade"),
	check("messages_sender_type_check", sql`sender_type = ANY (ARRAY['customer'::text, 'seller'::text])`),
]);

export const orderItems = pgTable("order_items", {
	id: bigserial({ mode: "bigint" }).primaryKey().notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	orderId: bigint("order_id", { mode: "number" }).notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	productId: bigint("product_id", { mode: "number" }).notNull(),
	quantity: integer().default(1).notNull(),
}, (table) => [
	index("idx_order_items_order_id").using("btree", table.orderId.asc().nullsLast().op("int8_ops")),
	index("idx_order_items_product_id").using("btree", table.productId.asc().nullsLast().op("int8_ops")),
	foreignKey({
			columns: [table.orderId],
			foreignColumns: [orders.id],
			name: "order_items_order_id_orders_id_fk"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.productId],
			foreignColumns: [products.id],
			name: "order_items_product_id_products_id_fk"
		}).onDelete("cascade"),
]);

export const products = pgTable("products", {
	id: bigserial({ mode: "bigint" }).primaryKey().notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	watchId: bigint("watch_id", { mode: "number" }),
	productType: varchar("product_type", { length: 255 }).notNull(),
	name: varchar({ length: 255 }).notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	priceDkk: bigint("price_dkk", { mode: "number" }).notNull(),
	description: text().notNull(),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	imageId: bigint("image_id", { mode: "number" }),
}, (table) => [
	index("idx_products_created_at").using("btree", table.createdAt.asc().nullsLast().op("timestamp_ops")),
	index("idx_products_name").using("btree", table.name.asc().nullsLast().op("text_ops")),
	index("idx_products_price_dkk").using("btree", table.priceDkk.asc().nullsLast().op("int8_ops")),
	index("idx_products_watch_id").using("btree", table.watchId.asc().nullsLast().op("int8_ops")),
	foreignKey({
			columns: [table.imageId],
			foreignColumns: [productImages.id],
			name: "products_image_id_product_images_id_fk"
		}).onDelete("set null"),
	foreignKey({
			columns: [table.watchId],
			foreignColumns: [watches.id],
			name: "products_watch_id_watches_id_fk"
		}).onDelete("cascade"),
]);

export const orders = pgTable("orders", {
	id: bigserial({ mode: "bigint" }).primaryKey().notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	userId: bigint("user_id", { mode: "number" }).notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	totalPrice: bigint("total_price", { mode: "number" }).notNull(),
	status: varchar({ length: 50 }).notNull(),
	currency: varchar({ length: 10 }).default('DKK').notNull(),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	deliveryAddressId: bigint("delivery_address_id", { mode: "number" }),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	billingAddressId: bigint("billing_address_id", { mode: "number" }),
}, (table) => [
	index("idx_orders_billing_address").using("btree", table.billingAddressId.asc().nullsLast().op("int8_ops")),
	index("idx_orders_created_at").using("btree", table.createdAt.asc().nullsLast().op("timestamp_ops")),
	index("idx_orders_delivery_address").using("btree", table.deliveryAddressId.asc().nullsLast().op("int8_ops")),
	index("idx_orders_status").using("btree", table.status.asc().nullsLast().op("text_ops")),
	index("idx_orders_user_id").using("btree", table.userId.asc().nullsLast().op("int8_ops")),
	foreignKey({
			columns: [table.billingAddressId],
			foreignColumns: [orderAddresses.id],
			name: "orders_billing_address_id_order_addresses_id_fk"
		}).onDelete("set null"),
	foreignKey({
			columns: [table.deliveryAddressId],
			foreignColumns: [orderAddresses.id],
			name: "orders_delivery_address_id_order_addresses_id_fk"
		}).onDelete("set null"),
	foreignKey({
			columns: [table.userId],
			foreignColumns: [users.id],
			name: "orders_user_id_users_id_fk"
		}).onDelete("cascade"),
	check("orders_status_check", sql`(status)::text = ANY ((ARRAY['pending'::character varying, 'paid'::character varying, 'shipped'::character varying, 'completed'::character varying, 'cancelled'::character varying])::text[])`),
]);

export const productImages = pgTable("product_images", {
	id: bigserial({ mode: "bigint" }).primaryKey().notNull(),
	imageUrl: varchar("image_url", { length: 255 }).notNull(),
	isThumbnail: boolean("is_thumbnail").default(false).notNull(),
}, (table) => [
	index("idx_product_images_thumbnail").using("btree", table.isThumbnail.asc().nullsLast().op("bool_ops")),
]);

export const countries = pgTable("countries", {
	id: bigserial({ mode: "bigint" }).primaryKey().notNull(),
	name: varchar({ length: 255 }).notNull(),
	abbreviation: varchar({ length: 10 }).notNull(),
	currency: varchar({ length: 50 }).notNull(),
}, (table) => [
	index("idx_countries_abbreviation").using("btree", table.abbreviation.asc().nullsLast().op("text_ops")),
	index("idx_countries_name").using("btree", table.name.asc().nullsLast().op("text_ops")),
]);

export const addresses = pgTable("addresses", {
	id: bigserial({ mode: "bigint" }).primaryKey().notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	userId: bigint("user_id", { mode: "number" }).notNull(),
	addressLine1: varchar("address_line_1", { length: 255 }).notNull(),
	addressLine2: varchar("address_line_2", { length: 255 }),
	city: varchar({ length: 255 }).notNull(),
	zipCode: varchar("zip_code", { length: 50 }).notNull(),
	stateProvince: varchar("state_province", { length: 255 }),
}, (table) => [
	index("idx_addresses_user_id").using("btree", table.userId.asc().nullsLast().op("int8_ops")),
]);

export const productSafetyInfo = pgTable("product_safety_info", {
	id: bigserial({ mode: "bigint" }).primaryKey().notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	brandId: bigint("brand_id", { mode: "number" }).notNull(),
	brand: varchar({ length: 255 }).notNull(),
	country: varchar({ length: 255 }).notNull(),
	address: varchar({ length: 255 }),
	address2: varchar("address_2", { length: 255 }),
	zipCode: varchar("zip_code", { length: 50 }),
	city: varchar({ length: 255 }),
	stateProvince: varchar("state_province", { length: 255 }),
	phoneNumber: varchar("phone_number", { length: 50 }),
	email: varchar({ length: 255 }),
	website: varchar({ length: 255 }),
}, (table) => [
	index("idx_product_safety_brand").using("btree", table.brand.asc().nullsLast().op("text_ops")),
	index("idx_product_safety_country").using("btree", table.country.asc().nullsLast().op("text_ops")),
]);

export const orderAddresses = pgTable("order_addresses", {
	id: bigserial({ mode: "bigint" }).primaryKey().notNull(),
	addressLine1: varchar("address_line_1", { length: 255 }).notNull(),
	addressLine2: varchar("address_line_2", { length: 255 }),
	city: varchar({ length: 255 }).notNull(),
	zipCode: varchar("zip_code", { length: 50 }).notNull(),
	stateProvince: varchar("state_province", { length: 255 }),
	country: varchar({ length: 255 }).notNull(),
});
