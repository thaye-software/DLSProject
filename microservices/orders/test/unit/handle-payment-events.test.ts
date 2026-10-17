import { describe, expect, it } from "vitest";
import {
  decidePaymentComplete,
  decidePaymentFailed,
  decidePaymentRefunded,
  type PaymentComplete,
} from "../../src/application/handle-payment-events.js";
import { paymentCompleteSchema, paymentFailedSchema, paymentRefundedSchema } from "../../src/adapters/rabbitmq/payment-events.js";
import { ORDER_STATUSES, type OrderStatus } from "../../src/domain/order.js";
import { asyncApi, eventSchema } from "../support/contract.js";
import { reservedOrder, USER_ID } from "../fixtures/orders.js";

const NOW = new Date("2026-10-14T10:04:10Z");
const CAUSATION_ID = "9b2e5c4d-1a3f-4e6b-8c7d-0f1e2d3c4b5a";
const order = reservedOrder();

const payment: PaymentComplete = {
  payment_intent_id: "pi_3Q0abc",
  order_id: order.id,
  user_id: USER_ID,
  amount: { amount_minor: 11_530_000, currency: "DKK" },
  paid_at: "2026-10-14T10:04:09Z",
};

// Deterministic ids, so the produced events can be compared.
function ids() {
  let next = 0;
  return () => `00000000-0000-4000-8000-${String(++next).padStart(12, "0")}`;
}

function expectValidEvent(schema: string, event: unknown) {
  const validate = eventSchema(schema);
  expect(validate(event), JSON.stringify(validate.errors)).toBe(true);
}

describe("decidePaymentComplete", () => {
  it("moves a RESERVED order to PENDING and publishes a contract-valid order_confirmed", () => {
    const decision = decidePaymentComplete(order, payment, CAUSATION_ID, NOW, ids());

    expect(decision.status).toBe("PENDING");
    expect(decision.publish).toHaveLength(1);
    const [event] = decision.publish;
    expectValidEvent("OrderConfirmedEvent", event);
    expect(event).toMatchObject({
      type: "order_confirmed",
      subject: order.id,
      correlationid: order.id,
      causationid: CAUSATION_ID,
      time: NOW.toISOString(),
      data: { order_id: order.id, status: "PENDING", customer_email: "mette@example.com", confirmed_at: NOW.toISOString() },
    });
    expect(event?.data).toMatchObject({ totals: { total: { amount_minor: 11_530_000, currency: "DKK" } } });
  });

  it("confirms a RESERVED order even when expires_at has just passed", () => {
    const late = reservedOrder({ expiresAt: new Date("2026-10-14T10:00:00Z") });

    expect(decidePaymentComplete(late, payment, CAUSATION_ID, NOW, ids()).status).toBe("PENDING");
  });

  it.each([
    { status: "EXPIRED" as const, reason: "paid_after_expiry" },
    { status: "CANCELLED" as const, reason: "cancelled_after_payment" },
  ])("keeps a $status order and requests a refund of the amount paid ($reason)", ({ status, reason }) => {
    const charged = { ...payment, amount: { amount_minor: 11_000_000, currency: "DKK" } };

    const decision = decidePaymentComplete(reservedOrder({ status }), charged, CAUSATION_ID, NOW, ids());

    expect(decision.status).toBeNull();
    const [event] = decision.publish;
    expectValidEvent("RefundRequestedEvent", event);
    expect(event?.data).toMatchObject({ reason, amount: { amount_minor: 11_000_000, currency: "DKK" }, order_id: order.id });
    // The refund request id is a new id, not the event's own id.
    expect((event?.data as { refund_request_id: string }).refund_request_id).not.toBe(event?.id);
  });

  it.each(["PENDING", "PROCESSING", "SHIPPED", "DELIVERED", "RETURNED", "REFUNDED"] as const)(
    "ignores a payment for an order that is already %s",
    (status) => {
      expect(decidePaymentComplete(reservedOrder({ status }), payment, CAUSATION_ID, NOW, ids())).toMatchObject({
        status: null,
        publish: [],
      });
    },
  );
});

describe("decidePaymentFailed", () => {
  it("keeps the order RESERVED and publishes nothing, noting the reason", () => {
    const decision = decidePaymentFailed(order, {
      payment_intent_id: "pi_3Q0abc",
      order_id: order.id,
      failure_code: "card_declined",
      failure_message: "Your card was declined.",
    });

    expect(decision).toMatchObject({ status: null, publish: [] });
    expect(decision.note).toContain("card_declined");
  });
});

describe("decidePaymentRefunded", () => {
  it("leaves an order that is already REFUNDED alone (an admin set it first)", () => {
    expect(decidePaymentRefunded(reservedOrder({ status: "REFUNDED" }))).toMatchObject({ status: null, publish: [] });
  });

  it.each(["EXPIRED", "CANCELLED", "RETURNED"] as const)("moves a %s order to REFUNDED", (status) => {
    expect(decidePaymentRefunded(reservedOrder({ status }))).toMatchObject({ status: "REFUNDED", publish: [] });
  });

  it.each(["RESERVED", "PENDING", "PROCESSING", "SHIPPED", "DELIVERED"] as const)(
    "moves a %s order (refunded directly in Stripe) to REFUNDED and warns that Catalog wasn't told",
    (status) => {
      const decision = decidePaymentRefunded(reservedOrder({ status }));

      expect(decision).toMatchObject({ status: "REFUNDED", publish: [] });
      expect(decision.note).toContain("NOT told");
    },
  );

  it("covers every OrderStatus", () => {
    const covered: OrderStatus[] = ["REFUNDED", "EXPIRED", "CANCELLED", "RETURNED", "RESERVED", "PENDING", "PROCESSING", "SHIPPED", "DELIVERED"];
    expect([...covered].sort()).toEqual([...ORDER_STATUSES].sort());
  });
});

describe("payment.events contract", () => {
  it.each([
    { message: "PaymentComplete", schema: paymentCompleteSchema },
    { message: "PaymentFailed", schema: paymentFailedSchema },
    { message: "PaymentRefunded", schema: paymentRefundedSchema },
  ])("Orders accepts the contract's example $message", ({ message, schema }) => {
    const example = asyncApi.components.messages[message].examples[0].payload;

    expect(schema.safeParse(example.data).success).toBe(true);
  });
});
