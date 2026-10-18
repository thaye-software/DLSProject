import { buildOrderEvent, dkk, type OrderEvent } from "../domain/order-event.js";
import type { Order, OrderStatus } from "../domain/order.js";
import type { CommandDecision, CommandResult, OrderCommandStore } from "./ports/order-command-store.js";
import type { Viewer } from "./read-orders.js";

export type ChangeOrderDependencies = {
  store: OrderCommandStore;
  now: () => Date;
  newId: () => string;
};

// The statuses an admin may set; RESERVED, EXPIRED and PENDING are set only by Orders itself.
export const ADMIN_TARGET_STATUSES = ["PROCESSING", "SHIPPED", "DELIVERED", "CANCELLED", "RETURNED", "REFUNDED"] as const;
export type AdminTargetStatus = (typeof ADMIN_TARGET_STATUSES)[number];

// Forward only. RETURNED can't be CANCELLED: the stock already went back when it was returned, and
// order_cancelled would make Catalog put it back a second time; a returned order is REFUNDED instead.
const ALLOWED_FROM: Record<AdminTargetStatus, readonly OrderStatus[]> = {
  PROCESSING: ["PENDING"],
  SHIPPED: ["PROCESSING"],
  DELIVERED: ["SHIPPED"],
  RETURNED: ["DELIVERED"],
  CANCELLED: ["PENDING", "PROCESSING", "SHIPPED", "DELIVERED"],
  REFUNDED: ["PENDING", "PROCESSING", "SHIPPED", "DELIVERED", "RETURNED"],
};

const itemQuantities = (order: Order) => order.items.map((line) => ({ product_id: line.productId, quantity: line.quantity }));

export function orderCancelled(order: Order, reason: "customer_request" | "admin", now: Date, newId: () => string) {
  return buildOrderEvent({
    id: newId(),
    type: "order_cancelled",
    orderId: order.id,
    time: now,
    causationId: null,
    data: {
      order_id: order.id,
      user_id: order.userId,
      previous_status: order.status,
      reason,
      items: itemQuantities(order),
      // Only RESERVED orders are unpaid; everything an admin can cancel was paid.
      was_paid: order.status !== "RESERVED",
      cancelled_at: now.toISOString(),
    },
  });
}

function refundRequested(order: Order, reason: "cancelled_after_payment" | "admin", now: Date, newId: () => string) {
  return buildOrderEvent({
    id: newId(),
    type: "refund_requested",
    orderId: order.id,
    time: now,
    causationId: null,
    data: {
      refund_request_id: newId(),
      order_id: order.id,
      user_id: order.userId,
      amount: dkk(order.totalPriceDkk),
      reason,
      requested_at: now.toISOString(),
    },
  });
}

export type CancelRejection = "not_found" | "not_cancellable";

export function decideCustomerCancel(order: Order, userId: string, now: Date, newId: () => string): CommandDecision<CancelRejection> {
  // Someone else's order looks the same as a missing one, so ids can't be probed.
  if (order.userId !== userId) return { kind: "reject", reason: "not_found" };
  if (order.status === "CANCELLED") return { kind: "keep" };
  if (order.status !== "RESERVED") return { kind: "reject", reason: "not_cancellable" };
  return { kind: "change", status: "CANCELLED", publish: [orderCancelled(order, "customer_request", now, newId)] };
}

export type StatusChangeRejection = "invalid_transition";

export function decideStatusChange(
  order: Order,
  target: AdminTargetStatus,
  adminId: string,
  now: Date,
  newId: () => string,
): CommandDecision<StatusChangeRejection> {
  if (order.status === target) return { kind: "keep" };
  if (!ALLOWED_FROM[target].includes(order.status)) return { kind: "reject", reason: "invalid_transition" };

  let publish: OrderEvent[];
  if (target === "CANCELLED") {
    publish = [orderCancelled(order, "admin", now, newId), refundRequested(order, "cancelled_after_payment", now, newId)];
  } else {
    const statusChanged = buildOrderEvent({
      id: newId(),
      type: "order_status_changed",
      orderId: order.id,
      time: now,
      causationId: null,
      data: {
        order_id: order.id,
        user_id: order.userId,
        previous_status: order.status,
        status: target,
        items: itemQuantities(order),
        changed_by: adminId,
        changed_at: now.toISOString(),
      },
    });
    publish = target === "REFUNDED" ? [statusChanged, refundRequested(order, "admin", now, newId)] : [statusChanged];
  }
  return { kind: "change", status: target, publish };
}

export function cancelOrder(orderId: string, viewer: Viewer, { store, now, newId }: ChangeOrderDependencies): Promise<CommandResult<CancelRejection>> {
  return store.change(orderId, (order) => decideCustomerCancel(order, viewer.userId, now(), newId));
}

// The caller has already checked that the viewer is an admin.
export function changeOrderStatus(
  orderId: string,
  target: AdminTargetStatus,
  admin: Viewer,
  { store, now, newId }: ChangeOrderDependencies,
): Promise<CommandResult<StatusChangeRejection>> {
  return store.change(orderId, (order) => decideStatusChange(order, target, admin.userId, now(), newId));
}
