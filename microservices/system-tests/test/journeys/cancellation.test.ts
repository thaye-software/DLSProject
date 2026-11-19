import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { Broker, type EventLog } from "../support/broker.js";
import { availabilityOf, seedProduct } from "../support/catalog.js";
import { signUp } from "../support/customers.js";
import { createOrder, placeOrder, startPayment, stripeConfirmsPayment, waitForStatus } from "../support/orders.js";

let broker: Broker;
let orderEvents: EventLog;

beforeAll(async () => {
  broker = await Broker.connect();
  orderEvents = await broker.listen("order.events", ["order_cancelled", "refund_requested"]);
});

afterAll(async () => {
  await broker.close();
});

describe("cancelling an unpaid order (Orders → Catalog + Payment)", () => {
  it("cancels the order and puts the watch back on sale for the next customer", async () => {
    const customer = await signUp();
    const watch = await seedProduct();
    const order = await placeOrder(customer, [watch.productId]);

    const cancelled = await customer.api.call("orders", "POST", `/orders/${order.order_id}/cancel`);

    expect(cancelled.status).toBe(200);
    expect(cancelled.body.status).toBe("CANCELLED");
    const event = await orderEvents.first("order_cancelled", (data) => data.order_id === order.order_id);
    expect(event.data.reason).toBe("customer_request");
    await vi.waitFor(async () => expect(await availabilityOf(watch.productId)).toBe("available"), { timeout: 20_000 });
    expect((await createOrder((await signUp()).api, [watch.productId])).status).toBe(201);
  });

  it("refuses payment for a cancelled order with 409", async () => {
    const customer = await signUp();
    const order = await placeOrder(customer, [(await seedProduct()).productId]);
    await customer.api.call("orders", "POST", `/orders/${order.order_id}/cancel`);

    const response = await customer.api.call("payment", "POST", "/payments", { body: { order_id: order.order_id } });

    expect(response.status).toBe(409);
    expect(response.body.type).toBe("https://limitedwatches.dk/problems/order_not_payable");
  });

  it("answers a repeated cancel with the cancelled order and releases the stock only once", async () => {
    const customer = await signUp();
    const order = await placeOrder(customer, [(await seedProduct()).productId]);
    await customer.api.call("orders", "POST", `/orders/${order.order_id}/cancel`);
    await orderEvents.first("order_cancelled", (data) => data.order_id === order.order_id);

    const again = await customer.api.call("orders", "POST", `/orders/${order.order_id}/cancel`);

    expect(again.status).toBe(200);
    expect(again.body.status).toBe("CANCELLED");
    const followUp = await placeOrder(customer, [(await seedProduct()).productId]);
    await customer.api.call("orders", "POST", `/orders/${followUp.order_id}/cancel`);
    await orderEvents.first("order_cancelled", (data) => data.order_id === followUp.order_id);
    expect(orderEvents.all().filter((event) => event.type === "order_cancelled" && event.data.order_id === order.order_id)).toHaveLength(1);
  });

  it("refuses a customer's cancel once the order is paid with 409", async () => {
    const customer = await signUp();
    const order = await placeOrder(customer, [(await seedProduct()).productId]);
    await stripeConfirmsPayment(broker, await startPayment(customer, order.order_id), customer);
    await waitForStatus(customer.api, order.order_id, "PENDING");

    const response = await customer.api.call("orders", "POST", `/orders/${order.order_id}/cancel`);

    expect(response.status).toBe(409);
    expect(response.body.type).toBe("https://limitedwatches.dk/problems/order_not_cancellable");
  });

  it("answers 404 when a customer tries to cancel someone else's order, and leaves it RESERVED", async () => {
    const owner = await signUp();
    const order = await placeOrder(owner, [(await seedProduct()).productId]);

    const response = await (await signUp()).api.call("orders", "POST", `/orders/${order.order_id}/cancel`);

    expect(response.status).toBe(404);
    expect((await owner.api.call("orders", "GET", `/orders/${order.order_id}`)).body.status).toBe("RESERVED");
  });

  it("asks Payment to refund a payment that lands after the customer cancelled", async () => {
    const customer = await signUp();
    const order = await placeOrder(customer, [(await seedProduct()).productId]);
    const payment = await startPayment(customer, order.order_id);
    await customer.api.call("orders", "POST", `/orders/${order.order_id}/cancel`);

    await stripeConfirmsPayment(broker, payment, customer);

    const refund = await orderEvents.first("refund_requested", (data) => data.order_id === order.order_id);
    expect(refund.data).toMatchObject({ reason: "cancelled_after_payment", amount: { amount_minor: order.totals.total.amount_minor, currency: "DKK" } });
    expect((await customer.api.call("orders", "GET", `/orders/${order.order_id}`)).body.status).toBe("CANCELLED");
  });
});
