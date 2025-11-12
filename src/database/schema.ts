import {
  pgTable,
  bigserial,
  varchar,
  boolean,
  bigint,
  index,
  integer,
  text,
  timestamp,
  check,
  uuid,
  decimal
} from "drizzle-orm/pg-core";
import { relations, sql } from "drizzle-orm";

export const countries = pgTable(
  "countries",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    name: varchar("name", { length: 255 }).notNull(),
    abbreviation: varchar("abbreviation", { length: 10 }).notNull(),
    currency: varchar("currency", { length: 50 }).notNull(),
  },
  (table) => [
    index("idx_countries_name").on(table.name),
    index("idx_countries_abbreviation").on(table.abbreviation),
  ]
);

export const addresses = pgTable(
  "addresses",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    userId: uuid("user_id").notNull(),
    address1: varchar("address_line_1", { length: 255 }).notNull(),
    address2: varchar("address_line_2", { length: 255 }),
    city: varchar("city", { length: 255 }).notNull(),
    zipCode: varchar("zip_code", { length: 50 }).notNull(),
    stateProvince: varchar("state_province", { length: 255 }),
  },
  (table) => [index("idx_addresses_user_id").on(table.userId)]
);

export const productImages = pgTable(
  "product_images",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    productId: bigint("product_id", { mode: "number" }).references(
      () => products.id,
      { onDelete: "cascade" }
    ),
    imageUrl: varchar("image_url", { length: 255 }).notNull(),
    isThumbnail: boolean("is_thumbnail").notNull().default(false),
  },
  (table) => [index("idx_product_images_thumbnail").on(table.isThumbnail)]
);

export const products = pgTable(
  "products",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    productType: varchar("product_type", { length: 255 }).notNull(),
    name: varchar("name", { length: 255 }).notNull(),
    priceDkk: bigint("price_dkk", { mode: "number" }).notNull(),
    description: text("description").notNull(),
    stock: integer("stock").notNull().default(0),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => [
    index("idx_products_name").on(table.name),
    index("idx_products_created_at").on(table.createdAt),
    index("idx_products_price_dkk").on(table.priceDkk),
  ]
);

export const brands = pgTable(
  "brands",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    slug: text("slug").notNull().unique(),
    name: varchar("name", { length: 255 }).notNull().unique(),
    country: varchar("country", { length: 255 }).notNull().default(""),
    addressLine1: varchar("address_line_1", { length: 255 }),
    addressLine2: varchar("address_line_2", { length: 255 }),
    zipCode: varchar("zip_code", { length: 50 }),
    city: varchar("city", { length: 255 }),
    stateProvince: varchar("state_province", { length: 255 }),
    phoneNumber: varchar("phone_number", { length: 50 }),
    email: varchar("email", { length: 255 }),
    website: varchar("website", { length: 255 }),
  },
  (table) => [index("idx_brands_name").on(table.name)]
);

export const users = pgTable(
  "users",
  {
    id: uuid("id").primaryKey(),
    username: varchar("username", { length: 255 }).notNull().unique(),
    email: varchar("email", { length: 255 }).notNull().unique(),
    avatarUrl: text("avatar_url"),
    role: varchar("role", { length: 50 }).notNull().default("customer"),
    country: bigint("country", { mode: "number" }).references(
      () => countries.id,
      { onDelete: "set null" }
    ),
    addressId: bigint("address", { mode: "number" }).references(
      () => addresses.id,
      { onDelete: "set null" }
    ),
  },
  (table) => [
    index("idx_users_country").on(table.country),
    index("idx_users_address").on(table.addressId),
  ]
);

export const watches = pgTable(
  "watches",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    productId: bigint("product_id", { mode: "number" })
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
    brandId: bigint("brand_id", { mode: "number" })
      .notNull()
      .references(() => brands.id, { onDelete: "cascade" }),
    model: varchar("model", { length: 255 }).notNull(),
    slug: text("slug").notNull().unique(), // should be constructed from brand+model+id
    reference: varchar("reference", { length: 255 }).notNull(),
    serialNumber: varchar("serial_number", { length: 255 }).notNull(),
    year: integer("year").notNull(),
    size: varchar("size", { length: 50 }),
    movement: varchar("movement", { length: 100 }),
    glassType: varchar("glass_type", { length: 100 }),
    limited: boolean("limited").notNull().default(false),
    box: boolean("box").notNull().default(false),
    papers: boolean("papers").notNull().default(false),
    condition: integer("condition").notNull(),
    braceletType: varchar("bracelet_type", { length: 100 }),
    braceletColor: varchar("bracelet_color", { length: 100 }),
    dialColor: varchar("dial_color", { length: 100 }),
    vat: integer("vat"),
  },
  (table) => [
    index("idx_watches_product_id").on(table.productId),
    index("idx_watches_brand").on(table.brandId),
    index("idx_watches_reference").on(table.reference),
    index("idx_watches_year").on(table.year),
    index("idx_watches_condition").on(table.condition),
  ]
);

export const orderAddresses = pgTable(
  "order_addresses",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    address1: varchar("address_line_1", { length: 255 }).notNull(),
    address2: varchar("address_line_2", { length: 255 }),
    city: varchar("city", { length: 255 }).notNull(),
    zipCode: varchar("zip_code", { length: 50 }).notNull(),
    stateProvince: varchar("state_province", { length: 255 }),
    country: varchar("country", { length: 255 }).notNull(),
  },
  (table) => []
);

export const orders = pgTable(
  "orders",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    totalPrice: bigint("total_price", { mode: "number" }).notNull(),
    status: varchar("status", { length: 50 }).notNull(),
    currency: varchar("currency", { length: 10 }).notNull().default("DKK"),

    // Currency fields
    currencyCode: varchar("currency_code", { length: 3 })
      .notNull()
      .default("DKK"),
    exchangeRateUsed: decimal("exchange_rate_used", { precision: 10, scale: 6 })
      .notNull()
      .default("1.000000"),
    totalPriceDkk: decimal("total_price_dkk", {
      precision: 12,
      scale: 2,
    }).notNull(),
    totalPriceCurrency: decimal("total_price_currency", {
      precision: 12,
      scale: 2,
    }).notNull(),

    deliveryAddressId: bigint("delivery_address_id", {
      mode: "number",
    }).references(() => orderAddresses.id, { onDelete: "set null" }),
    billingAddressId: bigint("billing_address_id", {
      mode: "number",
    }).references(() => orderAddresses.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => [
    index("idx_orders_user_id").on(table.userId),
    index("idx_orders_status").on(table.status),
    index("idx_orders_created_at").on(table.createdAt),
    index("idx_orders_delivery_address").on(table.deliveryAddressId),
    index("idx_orders_billing_address").on(table.billingAddressId),
    index("idx_orders_currency_code").on(table.currencyCode), // NEW INDEX
    check(
      "orders_status_check",
      sql`${table.status} IN ('pending', 'paid', 'shipped', 'completed', 'cancelled')`
    ),
  ]
);

export const orderItems = pgTable(
  "order_items",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    orderId: bigint("order_id", { mode: "number" })
      .notNull()
      .references(() => orders.id, { onDelete: "cascade" }),
    productId: bigint("product_id", { mode: "number" })
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
    quantity: integer("quantity").notNull().default(1),
  },
  (table) => [
    index("idx_order_items_order_id").on(table.orderId),
    index("idx_order_items_product_id").on(table.productId),
  ]
);

export const blogPosts = pgTable(
  "blog_posts",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    title: varchar("title", { length: 255 }).notNull(),
    content: text("content").notNull(),
    authorId: uuid("author_id").references(
      () => users.id,
      { onDelete: "set null" }
    ),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => [
    index("idx_blog_posts_author_id").on(table.authorId),
    index("idx_blog_posts_created_at").on(table.createdAt),
  ]
);

export const blogMedia = pgTable(
  "blog_media",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    blogId: bigint("blog_id", { mode: "number" })
      .notNull()
      .references(() => blogPosts.id, { onDelete: "cascade" }),
    mediaUrl: varchar("media_url", { length: 255 }).notNull(),
  },
  (table) => [index("idx_blog_media_blog_id").on(table.blogId)]
);

export const auctions = pgTable(
  "auctions",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    watchId: bigint("watch_id", { mode: "number" })
      .notNull()
      .references(() => watches.id, { onDelete: "cascade" }),
    startingPrice: bigint("starting_price", { mode: "number" }).notNull(),
    currentPrice: bigint("current_price", { mode: "number" }),
    endsAt: timestamp("ends_at").notNull(),
  },
  (table) => [
    index("idx_auctions_watch_id").on(table.watchId),
    index("idx_auctions_ends_at").on(table.endsAt),
    index("idx_auctions_current_price").on(table.currentPrice),
  ]
);

export const conversations = pgTable(
  "conversations",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    customerId: uuid("customer_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    productId: bigint("product_id", { mode: "number" })
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
    status: text("status").default("open"), // open, closed, pending
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
  },
  (table) => [
    index("idx_conversations_customer_id").on(table.customerId),
    index("idx_conversations_product_id").on(table.productId),
    index("idx_conversations_status").on(table.status),
    index("idx_conversations_created_at").on(table.createdAt),
    check(
      "conversations_status_check",
      sql`${table.status} IN ('open', 'closed', 'pending')`
    ),
  ]
);

export const messages = pgTable(
  "messages",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    conversationId: bigint("conversation_id", { mode: "number" })
      .notNull()
      .references(() => conversations.id, { onDelete: "cascade" }),
    senderId: bigint("sender_id", { mode: "number" })
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    senderType: text("sender_type").notNull(), // 'customer' or 'seller'
    content: text("content").notNull(),
    isRead: boolean("is_read").default(false),
    createdAt: timestamp("created_at").defaultNow(),
  },
  (table) => [
    index("idx_messages_conversation_id").on(table.conversationId),
    index("idx_messages_sender_id").on(table.senderId),
    index("idx_messages_created_at").on(table.createdAt),
    index("idx_messages_is_read").on(table.isRead),
    check(
      "messages_sender_type_check",
      sql`${table.senderType} IN ('customer', 'seller')`
    ),
  ]
);

export const currencies = pgTable(
  "currencies",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    code: varchar("code", { length: 3 }).notNull().unique(),
    exchangeRate: decimal("exchange_rate", {
      precision: 10,
      scale: 6,
    }).notNull(),
    isActive: boolean("is_active").notNull().default(true),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => [
    index("idx_currencies_code").on(table.code),
    index("idx_currencies_is_active").on(table.isActive),
  ]
);

export const currencyHistory = pgTable(
  "currency_history",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    currencyId: bigint("currency_id", { mode: "number" })
      .notNull()
      .references(() => currencies.id, { onDelete: "cascade" }),
    exchangeRate: decimal("exchange_rate", {
      precision: 10,
      scale: 6,
    }).notNull(),
    changedAt: timestamp("changed_at").notNull().defaultNow(),
    changedBy: varchar("changed_by", { length: 255 }),
  },
  (table) => [
    index("idx_currency_history_currency_id").on(table.currencyId),
    index("idx_currency_history_changed_at").on(table.changedAt),
  ]
);

//----------------------------------------------------------------  Relations --------------------------------------------------------------------

export const countriesRelations = relations(countries, ({ many }) => ({
  users: many(users),
}));

export const usersRelations = relations(users, ({ one, many }) => ({
  country: one(countries, {
    fields: [users.country],
    references: [countries.id],
  }),
  address: one(addresses, {
    fields: [users.addressId],
    references: [addresses.id],
  }),
  orders: many(orders),
  blogPosts: many(blogPosts),
  conversations: many(conversations),
  sentMessages: many(messages),
}));

export const addressesRelations = relations(addresses, ({ many }) => ({
  users: many(users),
}));

export const productsRelations = relations(products, ({ one, many }) => ({
  watch: one(watches, {
    fields: [products.id],
    references: [watches.productId],
  }),
  orderItems: many(orderItems),
  productImages: many(productImages),
}));

export const brandsRelations = relations(brands, ({ many }) => ({
  watches: many(watches),
}));

export const watchesRelations = relations(watches, ({ one, many }) => ({
  product: one(products, {
    fields: [watches.productId],
    references: [products.id],
  }),
  brand: one(brands, {
    fields: [watches.brandId],
    references: [brands.id],
  }),
  auctions: many(auctions),
  conversations: many(conversations),
}));

export const productImagesRelations = relations(productImages, ({ one }) => ({
  product: one(products, {
    fields: [productImages.productId],
    references: [products.id],
  }),
}));

export const ordersRelations = relations(orders, ({ one, many }) => ({
  user: one(users, {
    fields: [orders.userId],
    references: [users.id],
  }),
  orderItems: many(orderItems),
  deliveryAddress: one(orderAddresses, {
    fields: [orders.deliveryAddressId],
    references: [orderAddresses.id],
    relationName: "deliveryAddress",
  }),
  billingAddress: one(orderAddresses, {
    fields: [orders.billingAddressId],
    references: [orderAddresses.id],
    relationName: "billingAddress",
  }),
  currency: one(currencies, {
    fields: [orders.currencyCode],
    references: [currencies.code],
  }),
}));

export const orderAddressesRelations = relations(
  orderAddresses,
  ({ many }) => ({
    deliveryOrders: many(orders, { relationName: "deliveryAddress" }),
    billingOrders: many(orders, { relationName: "billingAddress" }),
  })
);

export const orderItemsRelations = relations(orderItems, ({ one }) => ({
  order: one(orders, {
    fields: [orderItems.orderId],
    references: [orders.id],
  }),
  product: one(products, {
    fields: [orderItems.productId],
    references: [products.id],
  }),
}));

export const blogPostsRelations = relations(blogPosts, ({ one, many }) => ({
  author: one(users, {
    fields: [blogPosts.authorId],
    references: [users.id],
  }),
  media: many(blogMedia),
}));

export const blogMediaRelations = relations(blogMedia, ({ one }) => ({
  blogPost: one(blogPosts, {
    fields: [blogMedia.blogId],
    references: [blogPosts.id],
  }),
}));

export const auctionsRelations = relations(auctions, ({ one }) => ({
  watch: one(watches, {
    fields: [auctions.watchId],
    references: [watches.id],
  }),
}));

export const conversationsRelations = relations(
  conversations,
  ({ one, many }) => ({
    customer: one(users, {
      fields: [conversations.customerId],
      references: [users.id],
    }),
    product: one(products, {
      fields: [conversations.productId],
      references: [products.id],
    }),
    messages: many(messages),
  })
);

export const messagesRelations = relations(messages, ({ one }) => ({
  conversation: one(conversations, {
    fields: [messages.conversationId],
    references: [conversations.id],
  }),
  sender: one(users, {
    fields: [messages.senderId],
    references: [users.id],
  }),
}));

export const currenciesRelations = relations(currencies, ({ many }) => ({
  history: many(currencyHistory),
  orders: many(orders),
}));

export const currencyHistoryRelations = relations(
  currencyHistory,
  ({ one }) => ({
    currency: one(currencies, {
      fields: [currencyHistory.currencyId],
      references: [currencies.id],
    }),
  })
);
