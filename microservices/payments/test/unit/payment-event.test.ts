import { describe, expect, it } from "vitest";
import { buildPaymentEvent } from "../../src/domain/payment-event.js";
import { ORDER_ID, paymentCompleteData } from "../fixtures/payment-events.js";

function build(stripeEventId: string) {
  return buildPaymentEvent({
    stripeEventId,
    type: "payment_complete",
    orderId: ORDER_ID,
    time: new Date("2026-10-14T10:04:09Z"),
    data: paymentCompleteData,
  });
}

describe("buildPaymentEvent", () => {
  it("wraps the data in a CloudEvents envelope about the order", () => {
    expect(build("evt_1")).toEqual({
      specversion: "1.0",
      id: expect.any(String),
      source: "/services/payment",
      type: "payment_complete",
      time: "2026-10-14T10:04:09.000Z",
      datacontenttype: "application/json",
      subject: ORDER_ID,
      dataversion: 1,
      correlationid: ORDER_ID,
      causationid: null,
      data: paymentCompleteData,
    });
  });

  it("gives a redelivered Stripe event the same id, so Orders can skip the duplicate", () => {
    expect(build("evt_3Q0abc").id).toBe(build("evt_3Q0abc").id);
  });

  it("gives different Stripe events different ids", () => {
    expect(build("evt_3Q0abc").id).not.toBe(build("evt_3Q0abd").id);
  });

  it("uses a version 5 UUID as the id", () => {
    expect(build("evt_1").id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-5[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  });
});
