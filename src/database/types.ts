import { InferInsertModel, InferSelectModel } from "drizzle-orm";
import {
  countries,
  addresses,
  productImages,
  watches,
  brands,
  users,
  products,
  orderAddresses,
  orders,
  orderItems,
  blogPosts,
  blogMedia,
  auctions,
  conversations,
  messages,
} from "./schema";

// This file provides convenient TypeScript types for the database models
// generated from the Drizzle schema in `schema.ts`.
// For each table we export two types:
// - <TableName>Model: the type returned when selecting rows (InferSelectModel<Table>)
// - New<TableName>: the type used for inserts/creates (InferSelectModel<Table, 'insert'>)

export type CountryModel = InferSelectModel<typeof countries>;
export type NewCountryModel = InferInsertModel<typeof countries>;

export type AddressModel = InferSelectModel<typeof addresses>;
export type NewAddressModel = InferInsertModel<typeof addresses>;

export type ProductImageModel = InferSelectModel<typeof productImages>;
export type NewProductImageModel = InferInsertModel<typeof productImages>;

export type WatchModel = InferSelectModel<typeof watches>;
export type NewWatchModel = InferInsertModel<typeof watches>;

export type BrandModel = InferSelectModel<typeof brands>;
export type NewBrandModel = InferInsertModel<typeof brands>;

export type UserModel = InferSelectModel<typeof users>;
export type NewUserModel = InferInsertModel<typeof users>;

export type ProductModel = InferSelectModel<typeof products>;
export type NewProductModel = InferInsertModel<typeof products>;

export type OrderAddressModel = InferSelectModel<typeof orderAddresses>;
export type NewOrderAddressModel = InferInsertModel<typeof orderAddresses>;

export type OrderModel = InferSelectModel<typeof orders>;
export type NewOrderModel = InferInsertModel<typeof orders>;

export type OrderItemModel = InferSelectModel<typeof orderItems>;
export type NewOrderItemModel = InferInsertModel<typeof orderItems>;

export type BlogPostModel = InferSelectModel<typeof blogPosts>;
export type NewBlogPostModel = InferInsertModel<typeof blogPosts>;

export type BlogMediaModel = InferSelectModel<typeof blogMedia>;
export type NewBlogMediaModel = InferInsertModel<typeof blogMedia>;

export type AuctionModel = InferSelectModel<typeof auctions>;
export type NewAuctionModel = InferInsertModel<typeof auctions>;

export type ConversationModel = InferSelectModel<typeof conversations>;
export type NewConversationModel = InferInsertModel<typeof conversations>;

export type MessageModel = InferSelectModel<typeof messages>;
export type NewMessageModel = InferInsertModel<typeof messages>;

// Import the specific types directly, e.g.:
// import { WatchModel, NewWatch } from "~/src/database/types";
