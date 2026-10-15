import { readFileSync } from "node:fs";
import { Ajv } from "ajv";
import addFormats from "ajv-formats";
import { describe, expect, it } from "vitest";
import { parse } from "yaml";
import { buildPaymentEvent, type PaymentEventData, type PaymentEventType } from "../../src/domain/payment-event.js";
import { ORDER_ID, paymentCompleteData, paymentFailedData, paymentRefundedData } from "../fixtures/payment-events.js";

const asyncApi = parse(readFileSync(new URL("../../../docs/contracts/asyncapi.yaml", import.meta.url), "utf8"));

const ajv = new Ajv({ strict: false, allErrors: true });
addFormats.default(ajv);
ajv.addSchema(asyncApi, "asyncapi");

function contractSchema(name: string) {
  const validate = ajv.getSchema(`asyncapi#/components/schemas/${name}`);
  if (!validate) throw new Error(`asyncapi.yaml has no schema ${name}`);
  return validate;
}

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
