import { describe, expect, it } from "vitest";
import { buildPaymentEvent, type PaymentEventData, type PaymentEventType } from "../../src/domain/payment-event.js";
import { orderReferenceSchema } from "../../src/adapters/rabbitmq/order-events.js";
import { asyncApi, contractSchema } from "../support/contract.js";
import { ORDER_ID, paymentCompleteData, paymentFailedData, paymentRefundedData } from "../fixtures/payment-events.js";

function build<T extends PaymentEventType>(type: T, data: PaymentEventData[T]) {
  return buildPaymentEvent({ stripeEventId: "evt_3Q0abc", type, orderId: ORDER_ID, time: new Date("2026-10-14T10:04:09Z"), data });
}

describe("payment.events contract", () => {
  it.each([
    { name: "payment_complete", schema: "PaymentCompleteEvent", event: build("payment_complete", paymentCompleteData) },
    { name: "payment_failed", schema: "PaymentFailedEvent", event: build("payment_failed", paymentFailedData) },
    { name: "payment_failed without failure details", schema: "PaymentFailedEvent", event: build("payment_failed", { ...paymentFailedData, failure_code: null, failure_message: null }) },
    { name: "payment_refunded", schema: "PaymentRefundedEvent", event: build("payment_refunded", paymentRefundedData) },
    { name: "payment_refunded without a refund request", schema: "PaymentRefundedEvent", event: build("payment_refunded", { ...paymentRefundedData, refund_request_id: null }) },
  ])("a built $name event is a valid $schema", ({ schema, event }) => {
    const validate = contractSchema(schema);

    expect(validate(event), JSON.stringify(validate.errors)).toBe(true);
  });
});

describe("order.events contract", () => {
  it.each(["OrderCancelled", "OrderExpired"])("Payment accepts the example %s published in the contract", (message) => {
    const example = asyncApi.components.messages[message].examples[0].payload;

    expect(orderReferenceSchema.safeParse(example.data).success).toBe(true);
  });
});
