import { randomUUID } from "node:crypto";
import { expect, vi } from "vitest";
import type { Broker } from "./broker.js";
import type { Customer } from "./customers.js";
import type { ApiResponse, Gateway } from "./gateway.js";

export const SHIPPING_MINOR = 30_000;

const ADDRESS = {
  first_name: "Mette",
  middle_name: null,
  last_name: "Jensen",
  address_line_1: "Nørregade 12",
  address_line_2: null,
  city: "København K",
  zip_code: "1165",
  state_province: null,
  country_code: "DK",
};

const STATUS_TIMEOUT_MS = 20_000;

export function orderRequest(productIds: string[]) {
  return {
    items: productIds.map((product_id) => ({ product_id, quantity: 1 })),
    offer_token: null,
    billing_address: ADDRESS,
    delivery_address: ADDRESS,
  };
}

export function createOrder(api: Gateway, productIds: string[], idempotencyKey: string = randomUUID()): Promise<ApiResponse> {
  return api.call("orders", "POST", "/orders", { body: orderRequest(productIds), headers: { "idempotency-key": idempotencyKey } });
}

export async function placeOrder(customer: Customer, productIds: string[]): Promise<{ order_id: string; status: string; totals: { total: { amount_minor: number } } }> {
  const response = await createOrder(customer.api, productIds);
  expect(response.status, JSON.stringify(response.body)).toBe(201);
  return response.body;
}

export async function statusOf(api: Gateway, orderId: string): Promise<string> {
  const response = await api.call("orders", "GET", `/orders/${orderId}`);
  if (response.status !== 200) throw new Error(`GET /orders/${orderId} answered ${response.status}`);
  return response.body.status;
}

export async function waitForStatus(api: Gateway, orderId: string, status: string): Promise<void> {
  await vi.waitFor(async () => expect(await statusOf(api, orderId)).toBe(status), { timeout: STATUS_TIMEOUT_MS, interval: 200 });
}

// Payment runs with PAYMENT_PROVIDER=fake, which has no Stripe webhook route, so the test publishes the
// payment_complete that Payment would publish after Stripe's payment_intent.succeeded.
export function stripeConfirmsPayment(broker: Broker, payment: { payment_intent_id: string; order_id: string; amount: { amount_minor: number } }, customer: Customer) {
  return broker.publish("payment.events", "/services/payment", "payment_complete", payment.order_id, {
    payment_intent_id: payment.payment_intent_id,
    order_id: payment.order_id,
    user_id: customer.id,
    amount: { amount_minor: payment.amount.amount_minor, currency: "DKK" },
    paid_at: new Date().toISOString(),
  });
}

export function stripeDeclinesPayment(broker: Broker, payment: { payment_intent_id: string; order_id: string; amount: { amount_minor: number } }, customer: Customer) {
  return broker.publish("payment.events", "/services/payment", "payment_failed", payment.order_id, {
    payment_intent_id: payment.payment_intent_id,
    order_id: payment.order_id,
    user_id: customer.id,
    amount: { amount_minor: payment.amount.amount_minor, currency: "DKK" },
    failure_code: "card_declined",
    failure_message: "Your card was declined.",
    failed_at: new Date().toISOString(),
  });
}

export async function startPayment(customer: Customer, orderId: string): Promise<{ payment_intent_id: string; order_id: string; amount: { amount_minor: number; currency: string } }> {
  const response = await customer.api.call("payment", "POST", "/payments", { body: { order_id: orderId } });
  expect(response.status, JSON.stringify(response.body)).toBe(201);
  return response.body;
}
