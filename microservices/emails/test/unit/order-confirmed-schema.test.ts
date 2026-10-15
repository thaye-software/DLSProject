import { describe, expect, it } from "vitest";
import { orderConfirmedDataSchema } from "../../src/adapters/rabbitmq/order-confirmed.js";
import { orderConfirmedData } from "../fixtures/order-confirmed.js";

function withItem(changes: Record<string, unknown>) {
  return orderConfirmedData({ items: [{ ...orderConfirmedData().items[0]!, ...changes }] as never });
}

function withTotal(total: unknown) {
  return orderConfirmedData({ totals: { ...orderConfirmedData().totals, total } as never });
}

describe("orderConfirmedDataSchema", () => {
  it("keeps the fields the email needs from the contract example", () => {
    expect(orderConfirmedDataSchema.parse(orderConfirmedData())).toEqual({
      order_id: "f47ac10b-58cc-4372-a567-0e02b2c3d479",
      customer_email: "mette@example.com",
      items: [
        {
          product_name: "Rolex Submariner Date 126610LN",
          quantity: 1,
          thumbnail_url: "https://cdn.example.com/products/126610ln-1.jpg",
        },
      ],
      totals: {
        subtotal: { amount_minor: 11500000, currency: "DKK" },
        shipping: { amount_minor: 30000, currency: "DKK" },
        total: { amount_minor: 11530000, currency: "DKK" },
      },
      billing_address: { first_name: "Mette", middle_name: null, last_name: "Jensen" },
      confirmed_at: "2026-10-14T10:04:10Z",
    });
  });

  it.each([
    { name: "thumbnail_url null (EP)", data: withItem({ thumbnail_url: null }) },
    { name: "quantity 1 (BV)", data: withItem({ quantity: 1 }) },
    { name: "amount 0 øre (BV)", data: withTotal({ amount_minor: 0, currency: "DKK" }) },
    { name: "unknown extra field (EP)", data: { ...orderConfirmedData(), gift_wrap: true } },
  ])("accepts $name", ({ data }) => {
    expect(orderConfirmedDataSchema.safeParse(data).success).toBe(true);
  });

  it.each([
    { name: "customer_email missing (EP)", data: { ...orderConfirmedData(), customer_email: undefined } },
    { name: "customer_email not an email (EP)", data: orderConfirmedData({ customer_email: "mette" }) },
    { name: "order_id not a uuid (EP)", data: orderConfirmedData({ order_id: "order-1" }) },
    { name: "no items, boundary 1 − 1 (BV)", data: orderConfirmedData({ items: [] }) },
    { name: "quantity 0, boundary 1 − 1 (BV)", data: withItem({ quantity: 0 }) },
    { name: "thumbnail_url not a URL (EP)", data: withItem({ thumbnail_url: "image.jpg" }) },
    { name: "amount in kroner as a float (EP)", data: withTotal({ amount_minor: 115300.5, currency: "DKK" }) },
    { name: "amount below 0, boundary 0 − 1 (BV)", data: withTotal({ amount_minor: -1, currency: "DKK" }) },
    { name: "currency not ISO 4217 (EP)", data: withTotal({ amount_minor: 100, currency: "kr" }) },
    { name: "billing last_name missing (EP)", data: orderConfirmedData({ billing_address: { ...orderConfirmedData().billing_address, last_name: undefined } as never }) },
    { name: "confirmed_at not a timestamp (EP)", data: orderConfirmedData({ confirmed_at: "today" }) },
  ])("rejects $name", ({ data }) => {
    expect(orderConfirmedDataSchema.safeParse(data).success).toBe(false);
  });
});
