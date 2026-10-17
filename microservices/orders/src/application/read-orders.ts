import type { Order, OrderStatus } from "../domain/order.js";
import type { OrderPage, OrderRepository } from "./ports/order-repository.js";

export type Viewer = { userId: string; isAdmin: boolean };

// null when the order doesn't exist or belongs to someone else, so a customer can't probe other users' order ids.
export async function getOrder(orderId: string, viewer: Viewer, orders: Pick<OrderRepository, "findById">): Promise<Order | null> {
  const order = await orders.findById(orderId);
  if (!order) return null;
  return viewer.isAdmin || order.userId === viewer.userId ? order : null;
}

export type ListOrdersRequest = {
  viewer: Viewer;
  statuses: OrderStatus[];
  page: number;
  pageSize: number;
};

// A customer only ever sees their own orders; an admin sees everyone's.
export function listOrders({ viewer, statuses, page, pageSize }: ListOrdersRequest, orders: Pick<OrderRepository, "list">): Promise<OrderPage> {
  return orders.list({ userId: viewer.isAdmin ? null : viewer.userId, statuses, page, pageSize });
}
