import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { Broker } from "../support/broker.js";
import { availabilityOf, seedProduct } from "../support/catalog.js";
import { signUp, signUpAdmin, type Customer } from "../support/customers.js";
import { placeOrder, startPayment, stripeConfirmsPayment, waitForStatus } from "../support/orders.js";

let broker: Broker;
let admin: Customer;

beforeAll(async () => {
  broker = await Broker.connect();
  admin = await signUpAdmin();
});

afterAll(async () => {
  await broker.close();
});

async function paidOrder(customer: Customer, productId: string): Promise<string> {
  const order = await placeOrder(customer, [productId]);
  await stripeConfirmsPayment(broker, await startPayment(customer, order.order_id), customer);
  await waitForStatus(customer.api, order.order_id, "PENDING");
  return order.order_id;
}

function changeStatus(by: Customer, orderId: string, status: string) {
  return by.api.call("orders", "PATCH", `/orders/${orderId}/status`, { body: { status } });
}

describe("fulfilling an order (admin via Auth/Users role → Orders → Catalog)", () => {
  it("ships and delivers a paid order, and puts a returned watch back on sale", async () => {
    const customer = await signUp();
    const watch = await seedProduct();
    const orderId = await paidOrder(customer, watch.productId);
    await vi.waitFor(async () => expect(await availabilityOf(watch.productId)).toBe("sold"), { timeout: 20_000 });

    for (const status of ["PROCESSING", "SHIPPED", "DELIVERED", "RETURNED"]) {
      const response = await changeStatus(admin, orderId, status);
      expect(response.status, `${status}: ${JSON.stringify(response.body)}`).toBe(200);
      expect(response.body.status).toBe(status);
    }

    expect((await customer.api.call("orders", "GET", `/orders/${orderId}`)).body.status).toBe("RETURNED");
    await vi.waitFor(async () => expect(await availabilityOf(watch.productId)).toBe("available"), { timeout: 20_000 });
  });

  it("forbids a customer from changing the status of their own order with 403", async () => {
    const customer = await signUp();
    const orderId = await paidOrder(customer, (await seedProduct()).productId);

    const response = await changeStatus(customer, orderId, "SHIPPED");

    expect(response.status).toBe(403);
    expect((await customer.api.call("orders", "GET", `/orders/${orderId}`)).body.status).toBe("PENDING");
  });

  it("refuses to ship an order that was never paid with 409", async () => {
    const order = await placeOrder(await signUp(), [(await seedProduct()).productId]);

    const response = await changeStatus(admin, order.order_id, "SHIPPED");

    expect(response.status).toBe(409);
    expect(response.body.type).toBe("https://limitedwatches.dk/problems/invalid_status_transition");
  });

  it("shows an admin any customer's order, but hides it from other customers", async () => {
    const owner = await signUp();
    const order = await placeOrder(owner, [(await seedProduct()).productId]);

    const asAdmin = await admin.api.call("orders", "GET", `/orders/${order.order_id}`);
    const asStranger = await (await signUp()).api.call("orders", "GET", `/orders/${order.order_id}`);

    expect(asAdmin.status).toBe(200);
    expect(asAdmin.body.customer_email).toBe(owner.email);
    expect(asStranger.status).toBe(404);
  });
});
