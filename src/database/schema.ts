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
  decimal,
} from "drizzle-orm/pg-core";
import { relations, sql } from "drizzle-orm";

export const countries = pgTable(
  "countries",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: varchar("name", { length: 255 }).notNull(),
    abbreviation: varchar("abbreviation", { length: 10 }).notNull(),
    currencyId: uuid("currency_id")
      .notNull()
      .references(() => currencies.id, { onDelete: "cascade" }),
    vatRate: integer("vat_rate").notNull().default(0),
  },
  (table) => [
    index("idx_countries_name").on(table.name),
    index("idx_countries_abbreviation").on(table.abbreviation),
  ]
);

export const addresses = pgTable(
  "addresses",
  {
    id: uuid("id").primaryKey().defaultRandom(),
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
    id: uuid("id").primaryKey().defaultRandom(),
    productId: uuid("product_id").references(() => products.id, {
      onDelete: "cascade",
    }),
    imageUrl: varchar("image_url", { length: 255 }).notNull(),
    isThumbnail: boolean("is_thumbnail").notNull().default(false),
  },
  (table) => [index("idx_product_images_thumbnail").on(table.isThumbnail)]
);

export const products = pgTable(
  "products",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    productType: varchar("product_type", { length: 255 }).notNull(),
    name: varchar("name", { length: 255 }).notNull(),
    priceDkk: bigint("price_dkk", { mode: "number" }).notNull(),
    description: text("description").notNull(),
    stock: integer("stock").notNull().default(0),
    visible: boolean("visible").notNull().default(false),
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
    id: uuid("id").primaryKey().defaultRandom(),
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
    firstName: varchar("first_name", { length: 255 }),
    middleName: varchar("middle_name", { length: 255 }),
    lastName: varchar("last_name", { length: 255 }),
    phone: varchar("phone", { length: 20 }),
    email: varchar("email", { length: 255 }).notNull().unique(),
    avatarUrl: text("avatar_url"),
    role: varchar("role", { length: 50 }).notNull().default("customer"),
    countryId: uuid("country_id").references(() => countries.id, {
      onDelete: "set null",
    }),
    addressId: uuid("address_id").references(() => addresses.id, {
      onDelete: "set null",
    }),
  },
  (table) => [
    index("idx_users_country").on(table.countryId),
    index("idx_users_address").on(table.addressId),
  ]
);

export const favorites = pgTable(
  "favorites",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    productId: uuid("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => [
    index("idx_favorites_user_id").on(table.userId),
    index("idx_favorites_product_id").on(table.productId),
  ]
);

export const watches = pgTable(
  "watches",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    internalId: text("internal_id").notNull().default(""),
    productId: uuid("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
    brandId: uuid("brand_id")
      .notNull()
      .references(() => brands.id, { onDelete: "cascade" }),
    model: varchar("model", { length: 255 }).notNull(),
    slug: text("slug").notNull().unique(), // should be constructed from brand+model+id
    reference: varchar("reference", { length: 255 }).notNull(),
    serialNumber: varchar("serial_number", { length: 255 }).notNull(),
    year: integer("year").notNull(),
    size: integer("size"),
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
    id: uuid("id").primaryKey().defaultRandom(),
    firstName: varchar("first_name", { length: 255 }),
    middleName: varchar("middle_name", { length: 255 }),
    lastName: varchar("last_name", { length: 255 }),
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
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    status: varchar("status", { length: 15 }).notNull(),
    currencyId: uuid("currency_id")
      .references(() => currencies.id)
      .notNull(),
    shippingPriceDkk: decimal("shipping_price_dkk", {
      precision: 12,
      scale: 2,
    }).notNull().default("0"),
    shippingPriceCurrency: decimal("shipping_price_currency", {
      precision: 12,
      scale: 2,
    }).notNull().default("0"),
    totalPriceDkk: decimal("total_price_dkk", {
      precision: 12,
      scale: 2,
    }).notNull(),
    totalPriceCurrency: decimal("total_price_currency", {
      precision: 12,
      scale: 2,
    }).notNull(),

    deliveryAddressId: uuid("delivery_address_id").references(
      () => orderAddresses.id,
      { onDelete: "set null" }
    ),
    billingAddressId: uuid("billing_address_id").references(
      () => orderAddresses.id,
      { onDelete: "set null" }
    ),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => [
    index("idx_orders_user_id").on(table.userId),
    index("idx_orders_status").on(table.status),
    index("idx_orders_created_at").on(table.createdAt),
    index("idx_orders_delivery_address").on(table.deliveryAddressId),
    index("idx_orders_billing_address").on(table.billingAddressId),
    index("idx_orders_currency_id").on(table.currencyId), // NEW INDEX
    check(
      "orders_status_check",
      sql`${table.status} IN ('RESERVED', 'EXPIRED', 'PENDING', 'PROCESSING', 'SHIPPED', 'DELIVERED', 'CANCELLED')`
    ),
  ]
);

export const orderItems = pgTable(
  "order_items",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orderId: uuid("order_id")
      .notNull()
      .references(() => orders.id, { onDelete: "cascade" }),
    productId: uuid("product_id")
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
    id: uuid("id").primaryKey().defaultRandom(),
    title: varchar("title", { length: 255 }).notNull(),
    content: text("content").notNull(),
    authorId: uuid("author_id").references(() => users.id, {
      onDelete: "set null",
    }),
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
    id: uuid("id").primaryKey().defaultRandom(),
    blogId: uuid("blog_id")
      .notNull()
      .references(() => blogPosts.id, { onDelete: "cascade" }),
    mediaUrl: varchar("media_url", { length: 255 }).notNull(),
  },
  (table) => [index("idx_blog_media_blog_id").on(table.blogId)]
);

export const auctions = pgTable(
  "auctions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    watchId: uuid("watch_id")
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
    id: uuid("id").primaryKey().defaultRandom(),
    customerId: uuid("customer_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    productId: uuid("product_id")
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
    id: uuid("id").primaryKey().defaultRandom(),
    conversationId: uuid("conversation_id")
      .notNull()
      .references(() => conversations.id, { onDelete: "cascade" }),
    senderId: uuid("sender_id")
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
    id: uuid("id").primaryKey().defaultRandom(),
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
    id: uuid("id").primaryKey().defaultRandom(),
    currencyId: uuid("currency_id")
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

export const countriesRelations = relations(countries, ({ many, one }) => ({
  users: many(users),
  currency: one(currencies, {
    fields: [countries.currencyId],
    references: [currencies.id],
  }),
}));

export const usersRelations = relations(users, ({ one, many }) => ({
  country: one(countries, {
    fields: [users.countryId],
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
    fields: [orders.currencyId],
    references: [currencies.id],
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
  countries: many(countries),
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

export const favoritesRelations = relations(favorites, ({ one }) => ({
  user: one(users, {
    fields: [favorites.userId],
    references: [users.id],
  }),
  product: one(products, {
    fields: [favorites.productId],
    references: [products.id],
  }),
}));
