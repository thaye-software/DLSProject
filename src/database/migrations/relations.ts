import { relations } from "drizzle-orm/relations";
import { addresses, users, countries, productSafetyInfo, watches, auctions, blogPosts, blogMedia, conversations, messages, orders, orderItems, products, productImages, orderAddresses } from "./schema";

export const usersRelations = relations(users, ({one, many}) => ({
	address: one(addresses, {
		fields: [users.address],
		references: [addresses.id]
	}),
	country: one(countries, {
		fields: [users.country],
		references: [countries.id]
	}),
	blogPosts: many(blogPosts),
	conversations: many(conversations),
	messages: many(messages),
	orders: many(orders),
}));

export const addressesRelations = relations(addresses, ({many}) => ({
	users: many(users),
}));

export const countriesRelations = relations(countries, ({many}) => ({
	users: many(users),
}));

export const watchesRelations = relations(watches, ({one, many}) => ({
	productSafetyInfo: one(productSafetyInfo, {
		fields: [watches.productSafetyInfoId],
		references: [productSafetyInfo.id]
	}),
	auctions: many(auctions),
	conversations: many(conversations),
	products: many(products),
}));

export const productSafetyInfoRelations = relations(productSafetyInfo, ({many}) => ({
	watches: many(watches),
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
	watch: one(watches, {
		fields: [conversations.productId],
		references: [watches.id]
	}),
	messages: many(messages),
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
	orderAddress_billingAddressId: one(orderAddresses, {
		fields: [orders.billingAddressId],
		references: [orderAddresses.id],
		relationName: "orders_billingAddressId_orderAddresses_id"
	}),
	orderAddress_deliveryAddressId: one(orderAddresses, {
		fields: [orders.deliveryAddressId],
		references: [orderAddresses.id],
		relationName: "orders_deliveryAddressId_orderAddresses_id"
	}),
	user: one(users, {
		fields: [orders.userId],
		references: [users.id]
	}),
}));

export const productsRelations = relations(products, ({one, many}) => ({
	orderItems: many(orderItems),
	productImage: one(productImages, {
		fields: [products.imageId],
		references: [productImages.id]
	}),
	watch: one(watches, {
		fields: [products.watchId],
		references: [watches.id]
	}),
}));

export const productImagesRelations = relations(productImages, ({many}) => ({
	products: many(products),
}));

export const orderAddressesRelations = relations(orderAddresses, ({many}) => ({
	orders_billingAddressId: many(orders, {
		relationName: "orders_billingAddressId_orderAddresses_id"
	}),
	orders_deliveryAddressId: many(orders, {
		relationName: "orders_deliveryAddressId_orderAddresses_id"
	}),
}));