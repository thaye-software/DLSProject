import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { Broker, type EventLog } from "../support/broker.js";
import { availabilityOf, seedProduct } from "../support/catalog.js";
import { signUp } from "../support/customers.js";
import { createOrder, placeOrder, startPayment, statusOf, stripeConfirmsPayment, stripeDeclinesPayment, waitForStatus } from "../support/orders.js";
import { serviceLogs } from "../support/stack.js";

let broker: Broker;
let orderEvents: EventLog;

beforeAll(async () => {
  broker = await Broker.connect();
  orderEvents = await broker.listen("order.events", ["order_confirmed"]);
});

afterAll(async () => {
  await broker.close();
});

describe("checkout (Orders → Catalog → Payment → Orders → Catalog + Notif)", () => {
  it("reserves, takes payment, confirms the order, sells the watch and emails the customer", async () => {
    const customer = await signUp();
    const watch = await seedProduct({ priceMinor: 4_250_000 });

    const order = await placeOrder(customer, [watch.productId]);
    expect(order.status).toBe("RESERVED");
    expect(order.totals.total).toEqual({ amount_minor: 4_280_000, currency: "DKK" });
    expect(await availabilityOf(watch.productId)).toBe("reserved");

    const payment = await startPayment(customer, order.order_id);
    expect(payment.payment_intent_id).toBe(`pi_fake_${order.order_id.replaceAll("-", "")}`);
    expect(payment.amount).toEqual({ amount_minor: 4_280_000, currency: "DKK" });

    await stripeConfirmsPayment(broker, payment, customer);

    await waitForStatus(customer.api, order.order_id, "PENDING");
    const confirmed = await orderEvents.first("order_confirmed", (data) => data.order_id === order.order_id);
    expect(confirmed.data.customer_email).toBe(customer.email);
    await vi.waitFor(async () => expect(await availabilityOf(watch.productId)).toBe("sold"), { timeout: 20_000 });
    await vi.waitFor(
      async () => expect(await serviceLogs("notif")).toMatch(new RegExp(`"orderId":"${order.order_id}".*Order confirmation email sent`)),
      { timeout: 20_000, interval: 500 },
    );
  });

  it("refuses a second customer the same reserved watch with 409 and names the product", async () => {
    const watch = await seedProduct();
    await placeOrder(await signUp(), [watch.productId]);

    const response = await createOrder((await signUp()).api, [watch.productId]);

    expect(response.status).toBe(409);
    expect(response.body.unavailable_product_ids).toEqual([watch.productId]);
  });

  it("answers a retried order with the same Idempotency-Key with the first order and reserves stock once", async () => {
    const customer = await signUp();
    const watch = await seedProduct({ stock: 2 });
    const idempotencyKey = randomUUID();

    const first = await createOrder(customer.api, [watch.productId], idempotencyKey);
    const retry = await createOrder(customer.api, [watch.productId], idempotencyKey);

    expect(first.status).toBe(201);
    expect(retry.body.order_id).toBe(first.body.order_id);
    const anotherCustomer = await createOrder((await signUp()).api, [watch.productId]);
    expect(anotherCustomer.status).toBe(201);
  });

  it("keeps the order RESERVED and the watch held after a declined card, so the customer can pay again", async () => {
    const customer = await signUp();
    const watch = await seedProduct();
    const order = await placeOrder(customer, [watch.productId]);
    const payment = await startPayment(customer, order.order_id);

    await stripeDeclinesPayment(broker, payment, customer);

    await vi.waitFor(
      async () => expect(await serviceLogs("orders")).toMatch(new RegExp(`payment_failed .*order ${order.order_id} payment attempt failed \\(card_declined\\)`)),
      { timeout: 20_000, interval: 500 },
    );
    expect(await statusOf(customer.api, order.order_id)).toBe("RESERVED");
    expect(await availabilityOf(watch.productId)).toBe("reserved");
    expect((await startPayment(customer, order.order_id)).payment_intent_id).toBe(payment.payment_intent_id);
  });

  it("answers 404 when a customer tries to pay someone else's order", async () => {
    const owner = await signUp();
    const order = await placeOrder(owner, [(await seedProduct()).productId]);

    const response = await (await signUp()).api.call("payment", "POST", "/payments", { body: { order_id: order.order_id } });

    expect(response.status).toBe(404);
  });

  it("answers 404 for a payment on an order that does not exist", async () => {
    const response = await (await signUp()).api.call("payment", "POST", "/payments", { body: { order_id: randomUUID() } });

    expect(response.status).toBe(404);
  });
});
