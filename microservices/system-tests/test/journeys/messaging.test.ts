import { randomUUID } from "node:crypto";
import { beforeAll, describe, expect, it } from "vitest";
import { seedProduct } from "../support/catalog.js";
import { signUp, signUpAdmin, type Customer } from "../support/customers.js";

let admin: Customer;

beforeAll(async () => {
  admin = await signUpAdmin();
});

function send(sender: Customer, conversationId: string, content: string) {
  return sender.api.call("messaging", "POST", `/conversations/${conversationId}/messages`, { body: { content }, headers: { "idempotency-key": randomUUID() } });
}

describe("asking about a watch (Messaging → Catalog)", () => {
  it("opens a chat named after the Catalog product, and the shop answers in it", async () => {
    const customer = await signUp();
    const watch = await seedProduct();

    const opened = await customer.api.call("messaging", "POST", "/conversations", { body: { product_id: watch.productId } });
    expect(opened.status).toBe(201);
    expect(opened.body).toMatchObject({ product_id: watch.productId, product_name: watch.name, customer_user_id: customer.id });
    const conversationId = opened.body.conversation_id;

    expect((await send(customer, conversationId, "Is the box included?")).status).toBe(201);
    expect((await send(admin, conversationId, "Yes, box and papers.")).status).toBe(201);

    const history = await customer.api.call("messaging", "GET", `/conversations/${conversationId}/messages`);
    expect(history.status).toBe(200);
    expect(history.body.items.map((message: { content: string }) => message.content).sort()).toEqual(["Is the box included?", "Yes, box and papers."]);
  });

  it("answers 404 for a chat about a product Catalog does not have", async () => {
    const response = await (await signUp()).api.call("messaging", "POST", "/conversations", { body: { product_id: randomUUID() } });

    expect(response.status).toBe(404);
  });

  it("forbids another customer from writing in someone else's chat with 403", async () => {
    const owner = await signUp();
    const opened = await owner.api.call("messaging", "POST", "/conversations", { body: { product_id: (await seedProduct()).productId } });

    const response = await send(await signUp(), opened.body.conversation_id, "Hello?");

    expect(response.status).toBe(403);
  });
});
