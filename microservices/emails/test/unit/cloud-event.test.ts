import { describe, expect, it } from "vitest";
import { parseCloudEvent } from "../../src/adapters/rabbitmq/cloud-event.js";

const validEvent = {
  specversion: "1.0",
  id: "0b8f6c3e-2d1a-4e5f-9a8b-7c6d5e4f3a2b",
  source: "/services/orders",
  type: "order_confirmed",
  time: "2026-10-14T10:04:10Z",
  datacontenttype: "application/json",
  subject: "f47ac10b-58cc-4372-a567-0e02b2c3d479",
  dataversion: 1,
  correlationid: "f47ac10b-58cc-4372-a567-0e02b2c3d479",
  causationid: null,
  data: { order_id: "f47ac10b-58cc-4372-a567-0e02b2c3d479" },
};

function bodyOf(value: unknown): Buffer {
  return Buffer.from(JSON.stringify(value));
}

function without(attribute: keyof typeof validEvent): Record<string, unknown> {
  const { [attribute]: _removed, ...rest } = validEvent;
  return rest;
}

describe("parseCloudEvent", () => {
  it("returns the envelope of a valid event", () => {
    expect(parseCloudEvent(bodyOf(validEvent))).toEqual({
      ok: true,
      event: {
        specversion: "1.0",
        id: "0b8f6c3e-2d1a-4e5f-9a8b-7c6d5e4f3a2b",
        source: "/services/orders",
        type: "order_confirmed",
        time: "2026-10-14T10:04:10Z",
        data: { order_id: "f47ac10b-58cc-4372-a567-0e02b2c3d479" },
      },
    });
  });

  it.each([
    { name: "unknown extra attribute is ignored (EP)", body: bodyOf({ ...validEvent, traceparent: "00-abc-01" }) },
    { name: "only the required attributes (EP)", body: bodyOf({ specversion: "1.0", id: "e1", source: "/s", type: "t", time: "2026-10-14T10:04:10Z", data: {} }) },
    { name: "time with offset (EP)", body: bodyOf({ ...validEvent, time: "2026-10-14T12:04:10+02:00" }) },
    { name: "id of one character (BV)", body: bodyOf({ ...validEvent, id: "a" }) },
  ])("$name is accepted", ({ body }) => {
    expect(parseCloudEvent(body).ok).toBe(true);
  });

  it.each([
    { name: "body is not JSON (EP)", body: Buffer.from("order confirmed") },
    { name: "body is a JSON array (EP)", body: bodyOf([validEvent]) },
    { name: "body is a JSON string (EP)", body: bodyOf("order_confirmed") },
    { name: "id missing (EP)", body: bodyOf(without("id")) },
    { name: "id empty, boundary 1 − 1 (BV)", body: bodyOf({ ...validEvent, id: "" }) },
    { name: "id not a string (EP)", body: bodyOf({ ...validEvent, id: 42 }) },
    { name: "type missing (EP)", body: bodyOf(without("type")) },
    { name: "source missing (EP)", body: bodyOf(without("source")) },
    { name: "specversion missing (EP)", body: bodyOf(without("specversion")) },
    { name: "specversion 0.3 (EP)", body: bodyOf({ ...validEvent, specversion: "0.3" }) },
    { name: "time missing (EP)", body: bodyOf(without("time")) },
    { name: "time not a timestamp (EP)", body: bodyOf({ ...validEvent, time: "yesterday" }) },
    { name: "data missing (EP)", body: bodyOf(without("data")) },
  ])("$name is rejected with a reason", ({ body }) => {
    expect(parseCloudEvent(body)).toEqual({ ok: false, reason: expect.stringMatching(/\S/) });
  });
});
