import { beforeAll, describe, expect, it, vi } from "vitest";
import { availabilityOf, seedProduct } from "../support/catalog.js";
import { signUp, signUpAdmin, type Customer } from "../support/customers.js";
import { placeOrder } from "../support/orders.js";

let admin: Customer;

beforeAll(async () => {
  admin = await signUpAdmin();
});

describe("deleting an account (Users → user_deleted → Orders → Catalog, Messaging; Auth)", () => {
  it("cancels the unpaid order, frees the watch, anonymises orders and chats, and locks the account out", async () => {
    const customer = await signUp();
    const watch = await seedProduct();
    const order = await placeOrder(customer, [watch.productId]);
    const conversation = await customer.api.call("messaging", "POST", "/conversations", { body: { product_id: watch.productId } });
    expect(conversation.status).toBe(201);

    const deleted = await customer.api.call("users", "DELETE", "/users/me");
    expect(deleted.status).toBe(204);

    const afterDeletion = await customer.api.call("orders", "GET", "/orders");
    expect(afterDeletion.status).toBe(401);
    expect(afterDeletion.body.type).toBe("https://limitedwatches.dk/problems/account_deleted");

    await vi.waitFor(
      async () => {
        const seenByAdmin = await admin.api.call("orders", "GET", `/orders/${order.order_id}`);
        expect(seenByAdmin.body).toMatchObject({
          status: "CANCELLED",
          customer_email: "deleted-user@anonymised.invalid",
          delivery_address: { first_name: "Deleted", last_name: "User", address_line_1: "Deleted", city: "København K" },
        });
      },
      { timeout: 20_000, interval: 250 },
    );
    await vi.waitFor(async () => expect(await availabilityOf(watch.productId)).toBe("available"), { timeout: 20_000 });
    await vi.waitFor(
      async () => {
        const conversations = await admin.api.call("messaging", "GET", "/conversations");
        const chat = conversations.body.items.find((item: { conversation_id: string }) => item.conversation_id === conversation.body.conversation_id);
        expect(chat?.customer_display_name).toBe("Deleted User");
      },
      { timeout: 20_000, interval: 250 },
    );
  });

  it("keeps a deleted account out, even from creating its profile again", async () => {
    const customer = await signUp();
    await customer.api.call("users", "DELETE", "/users/me");

    const recreated = await customer.api.call("users", "POST", "/users", { body: { username: `${customer.username}x` } });

    expect(recreated.status).toBe(401);
    expect(recreated.body.type).toBe("https://limitedwatches.dk/problems/account_deleted");
  });
});
