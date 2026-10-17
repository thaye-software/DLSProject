import type { Order, OrderStatus } from "../../domain/order.js";

export type InsertResult = { kind: "inserted" } | { kind: "duplicate" };

export type OrderQuery = {
  // null lists every user's orders (admin).
  userId: string | null;
  // Empty means any status.
  statuses: OrderStatus[];
  page: number;
  pageSize: number;
};

export type OrderPage = { orders: Order[]; total: number };

export type OrderRepository = {
  findById(id: string): Promise<Order | null>;
  findByIdempotencyKey(userId: string, idempotencyKey: string): Promise<Order | null>;
  // Newest first.
  list(query: OrderQuery): Promise<OrderPage>;
  // "duplicate" when an order with the same id or (user, idempotency key) already exists.
  insert(order: Order, idempotencyKey: string): Promise<InsertResult>;
};
