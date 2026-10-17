import { describe, expect, it } from "vitest";
import {
  ADMIN_TARGET_STATUSES,
  decideCustomerCancel,
  decideStatusChange,
  type AdminTargetStatus,
} from "../../src/application/change-order.js";
import { ORDER_STATUSES, type OrderStatus } from "../../src/domain/order.js";
import { reservedOrder, USER_ID } from "../fixtures/orders.js";
import { eventSchema } from "../support/contract.js";

const NOW = new Date("2026-10-15T09:00:00Z");
const ADMIN_ID = "7a6b5c4d-3e2f-4a1b-9c8d-7e6f5a4b3c2d";
const OTHER_USER_ID = "9a8b7c6d-5e4f-4a3b-9c2d-1e0f9a8b7c6d";

function ids() {
  let next = 0;
  return () => `00000000-0000-4000-8000-${String(++next).padStart(12, "0")}`;
}

function expectValid(schema: string, event: unknown) {
  const validate = eventSchema(schema);
  expect(validate(event), JSON.stringify(validate.errors)).toBe(true);
}

describe("decideCustomerCancel", () => {
  it("cancels the owner's RESERVED order with a contract-valid order_cancelled (unpaid)", () => {
    const decision = decideCustomerCancel(reservedOrder(), USER_ID, NOW, ids());

    expect(decision).toMatchObject({ kind: "change", status: "CANCELLED" });
    if (decision.kind !== "change") return;
    expect(decision.publish).toHaveLength(1);
    expectValid("OrderCancelledEvent", decision.publish[0]);
    expect(decision.publish[0]?.data).toMatchObject({
      previous_status: "RESERVED",
      reason: "customer_request",
      was_paid: false,
      items: [{ product_id: reservedOrder().items[0]!.productId, quantity: 1 }],
      cancelled_at: NOW.toISOString(),
    });
  });

  it("answers not_found for someone else's order", () => {
    expect(decideCustomerCancel(reservedOrder(), OTHER_USER_ID, NOW, ids())).toEqual({ kind: "reject", reason: "not_found" });
  });

  it("keeps an order that is already CANCELLED (idempotent)", () => {
    expect(decideCustomerCancel(reservedOrder({ status: "CANCELLED" }), USER_ID, NOW, ids())).toEqual({ kind: "keep" });
  });

  it.each(ORDER_STATUSES.filter((status) => status !== "RESERVED" && status !== "CANCELLED"))(
    "refuses to cancel a %s order",
    (status) => {
      expect(decideCustomerCancel(reservedOrder({ status }), USER_ID, NOW, ids())).toEqual({ kind: "reject", reason: "not_cancellable" });
    },
  );
});

describe("decideStatusChange", () => {
  // Every allowed (from → to) pair; every other pair must be refused.
  const ALLOWED: Record<AdminTargetStatus, OrderStatus[]> = {
    PROCESSING: ["PENDING"],
    SHIPPED: ["PROCESSING"],
    DELIVERED: ["SHIPPED"],
    RETURNED: ["DELIVERED"],
    CANCELLED: ["PENDING", "PROCESSING", "SHIPPED", "DELIVERED"],
    REFUNDED: ["PENDING", "PROCESSING", "SHIPPED", "DELIVERED", "RETURNED"],
  };
  const pairs = ADMIN_TARGET_STATUSES.flatMap((to) => ORDER_STATUSES.map((from) => ({ from, to })));

  it.each(pairs.filter(({ from, to }) => ALLOWED[to].includes(from)))("allows $from → $to", ({ from, to }) => {
    expect(decideStatusChange(reservedOrder({ status: from }), to, ADMIN_ID, NOW, ids())).toMatchObject({ kind: "change", status: to });
  });

  it.each(pairs.filter(({ from, to }) => from === to))("keeps a $from order set to $to again (no-op)", ({ from, to }) => {
    expect(decideStatusChange(reservedOrder({ status: from }), to, ADMIN_ID, NOW, ids())).toEqual({ kind: "keep" });
  });

  it.each(pairs.filter(({ from, to }) => from !== to && !ALLOWED[to].includes(from)))("refuses $from → $to", ({ from, to }) => {
    expect(decideStatusChange(reservedOrder({ status: from }), to, ADMIN_ID, NOW, ids())).toEqual({
      kind: "reject",
      reason: "invalid_transition",
    });
  });

  it("publishes a contract-valid order_status_changed naming the admin", () => {
    const decision = decideStatusChange(reservedOrder({ status: "PROCESSING" }), "SHIPPED", ADMIN_ID, NOW, ids());

    if (decision.kind !== "change") throw new Error("expected a change");
    expect(decision.publish.map((event) => event.type)).toEqual(["order_status_changed"]);
    expectValid("OrderStatusChangedEvent", decision.publish[0]);
    expect(decision.publish[0]?.data).toMatchObject({ previous_status: "PROCESSING", status: "SHIPPED", changed_by: ADMIN_ID });
  });

  it("cancels a paid order: order_cancelled (admin, paid) plus a refund of the total", () => {
    const decision = decideStatusChange(reservedOrder({ status: "SHIPPED" }), "CANCELLED", ADMIN_ID, NOW, ids());

    if (decision.kind !== "change") throw new Error("expected a change");
    const [cancelled, refund] = decision.publish;
    expectValid("OrderCancelledEvent", cancelled);
    expectValid("RefundRequestedEvent", refund);
    expect(cancelled?.data).toMatchObject({ reason: "admin", was_paid: true, previous_status: "SHIPPED" });
    expect(refund?.data).toMatchObject({ reason: "cancelled_after_payment", amount: { amount_minor: 11_530_000, currency: "DKK" } });
  });

  it("refunds an order: order_status_changed (so Catalog puts the stock back) plus a refund of the total", () => {
    const decision = decideStatusChange(reservedOrder({ status: "DELIVERED" }), "REFUNDED", ADMIN_ID, NOW, ids());

    if (decision.kind !== "change") throw new Error("expected a change");
    const [changed, refund] = decision.publish;
    expectValid("OrderStatusChangedEvent", changed);
    expectValid("RefundRequestedEvent", refund);
    expect(changed?.data).toMatchObject({ previous_status: "DELIVERED", status: "REFUNDED" });
    expect(refund?.data).toMatchObject({ reason: "admin", amount: { amount_minor: 11_530_000, currency: "DKK" } });
  });

  it("gives every event and refund request its own id", () => {
    const decision = decideStatusChange(reservedOrder({ status: "PENDING" }), "REFUNDED", ADMIN_ID, NOW, ids());

    if (decision.kind !== "change") throw new Error("expected a change");
    const allIds = decision.publish.flatMap((event) => [event.id, (event.data as { refund_request_id?: string }).refund_request_id]);
    const defined = allIds.filter(Boolean);
    expect(new Set(defined).size).toBe(defined.length);
  });
});
