import { relations } from "drizzle-orm/relations";
import { users, favorites, watches, auctions, blogPosts, blogMedia, conversations, products, messages, orders, orderItems, countries, addresses, productImages, orderAddresses, currencies, currencyHistory, brands } from "./schema";

export const favoritesRelations = relations(favorites, ({one}) => ({
	user: one(users, {
		fields: [favorites.userId],
		references: [users.id]
	}),
	watch: one(watches, {
		fields: [favorites.watchId],
		references: [watches.id]
	}),
}));

export const usersRelations = relations(users, ({one, many}) => ({
	favorites: many(favorites),
	blogPosts: many(blogPosts),
	conversations: many(conversations),
	messages: many(messages),
	country: one(countries, {
		fields: [users.country],
		references: [countries.id]
	}),
	address: one(addresses, {
		fields: [users.address],
		references: [addresses.id]
	}),
	orders: many(orders),
}));

export const watchesRelations = relations(watches, ({one, many}) => ({
	favorites: many(favorites),
	auctions: many(auctions),
	product: one(products, {
		fields: [watches.productId],
		references: [products.id]
	}),
	brand: one(brands, {
		fields: [watches.brandId],
		references: [brands.id]
	}),
}));

export const auctionsRelations = relations(auctions, ({one}) => ({
	watch: one(watches, {
		fields: [auctions.watchId],
		references: [watches.id]
	}),
}));

export const blogPostsRelations = relations(blogPosts, ({one, many}) => ({
	user: one(users, {
		fields: [blogPosts.authorId],
		references: [users.id]
	}),
	blogMedias: many(blogMedia),
}));

export const blogMediaRelations = relations(blogMedia, ({one}) => ({
	blogPost: one(blogPosts, {
		fields: [blogMedia.blogId],
		references: [blogPosts.id]
	}),
}));

export const conversationsRelations = relations(conversations, ({one, many}) => ({
	user: one(users, {
		fields: [conversations.customerId],
		references: [users.id]
	}),
	product: one(products, {
		fields: [conversations.productId],
		references: [products.id]
	}),
	messages: many(messages),
}));

export const productsRelations = relations(products, ({many}) => ({
	conversations: many(conversations),
	orderItems: many(orderItems),
	productImages: many(productImages),
	watches: many(watches),
}));

export const messagesRelations = relations(messages, ({one}) => ({
	conversation: one(conversations, {
		fields: [messages.conversationId],
		references: [conversations.id]
	}),
	user: one(users, {
		fields: [messages.senderId],
		references: [users.id]
	}),
}));

export const orderItemsRelations = relations(orderItems, ({one}) => ({
	order: one(orders, {
		fields: [orderItems.orderId],
		references: [orders.id]
	}),
	product: one(products, {
		fields: [orderItems.productId],
		references: [products.id]
	}),
}));

export const ordersRelations = relations(orders, ({one, many}) => ({
	orderItems: many(orderItems),
	orderAddress_deliveryAddressId: one(orderAddresses, {
		fields: [orders.deliveryAddressId],
		references: [orderAddresses.id],
		relationName: "orders_deliveryAddressId_orderAddresses_id"
	}),
	orderAddress_billingAddressId: one(orderAddresses, {
		fields: [orders.billingAddressId],
		references: [orderAddresses.id],
		relationName: "orders_billingAddressId_orderAddresses_id"
	}),
	user: one(users, {
		fields: [orders.userId],
		references: [users.id]
	}),
}));

export const countriesRelations = relations(countries, ({many}) => ({
	users: many(users),
}));

export const addressesRelations = relations(addresses, ({many}) => ({
	users: many(users),
}));

export const productImagesRelations = relations(productImages, ({one}) => ({
	product: one(products, {
		fields: [productImages.productId],
		references: [products.id]
	}),
}));

export const orderAddressesRelations = relations(orderAddresses, ({many}) => ({
	orders_deliveryAddressId: many(orders, {
		relationName: "orders_deliveryAddressId_orderAddresses_id"
	}),
	orders_billingAddressId: many(orders, {
		relationName: "orders_billingAddressId_orderAddresses_id"
	}),
}));

export const currencyHistoryRelations = relations(currencyHistory, ({one}) => ({
	currency: one(currencies, {
		fields: [currencyHistory.currencyId],
		references: [currencies.id]
	}),
}));

export const currenciesRelations = relations(currencies, ({many}) => ({
	currencyHistories: many(currencyHistory),
}));

export const brandsRelations = relations(brands, ({many}) => ({
	watches: many(watches),
}));