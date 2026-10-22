import { describe, expect, it } from "vitest";
import { availabilityPublication } from "../../src/adapters/rabbitmq/publisher.js";
import { availabilityEvent, type AvailabilityReason } from "../../src/domain/availability-event.js";
import type { Availability } from "../../src/domain/product.js";

const PRODUCT_ID = "8d1d4c2a-77a5-4a2f-b0f4-2f3d0e7b9c55";
const ORDER_ID = "f47ac10b-58cc-4372-a567-0e02b2c3d479";
const EVENT_ID = "0b8f6c3e-2d1a-4e5f-9a8b-7c6d5e4f3a2b";
const AT = new Date("2026-10-14T10:00:05.000Z");

function stored(reason: AvailabilityReason, availability: Availability, previousAvailability: Availability, stock: number) {
  const payload = availabilityEvent({
    id: EVENT_ID,
    productId: PRODUCT_ID,
    orderId: ORDER_ID,
    time: AT,
    version: 5,
    availability,
    previousAvailability,
    stock,
    reason,
    causationId: null,
  });
  return { id: payload.id, type: payload.type, payload };
}

describe("availabilityPublication", () => {
  it.each([
    { reason: "order_reserved" as const, availability: "reserved" as const, previousAvailability: "available" as const, stock: 0 },
    { reason: "order_released" as const, availability: "available" as const, previousAvailability: "reserved" as const, stock: 1 },
  ])("keeps $reason from the outbox payload on the catalog envelope", ({ reason, availability, previousAvailability, stock }) => {
    const event = stored(reason, availability, previousAvailability, stock);
    const publication = availabilityPublication(event);

    expect(publication).toMatchObject({
      exchange: "catalog.events",
      routingKey: "product_availability_changed",
      contentType: "application/cloudevents+json",
      persistent: true,
      messageId: EVENT_ID,
    });
    expect(publication.routingKey).toBe(publication.body.type);
    expect(publication.body).toEqual({
      specversion: "1.0",
      id: EVENT_ID,
      source: "/services/catalog",
      type: "product_availability_changed",
      time: "2026-10-14T10:00:05.000Z",
      datacontenttype: "application/json",
      subject: PRODUCT_ID,
      dataversion: 1,
      correlationid: ORDER_ID,
      causationid: null,
      data: {
        product_id: PRODUCT_ID,
        version: 5,
        availability,
        previous_availability: previousAvailability,
        stock,
        reason,
        order_id: ORDER_ID,
        changed_at: "2026-10-14T10:00:05.000Z",
      },
    });
  });
});
