import { describe, expect, it } from "vitest";
import { orderJson } from "../../src/adapters/http/order-json.js";
import { userDeletedSchema } from "../../src/adapters/rabbitmq/user-events.js";
import { ANONYMISED } from "../../src/application/anonymise-user.js";
import { address, reservedOrder } from "../fixtures/orders.js";
import { asyncApi, contractSchema } from "../support/contract.js";

describe("anonymised orders", () => {
  it("still match the contract's Order schema (customer_email is a valid email)", () => {
    const anonymisedAddress = { ...address, ...ANONYMISED };
    const order = reservedOrder({
      customerEmail: ANONYMISED.customerEmail,
      billingAddress: anonymisedAddress,
      deliveryAddress: anonymisedAddress,
    });

    const validate = contractSchema("Order");
    expect(validate(orderJson(order)), JSON.stringify(validate.errors)).toBe(true);
  });

  it("use a reserved domain that can never receive mail", () => {
    expect(ANONYMISED.customerEmail).toMatch(/@[^@]+\.invalid$/);
  });
});

describe("user.events contract", () => {
  it("Orders accepts the contract's example user_deleted", () => {
    const example = asyncApi.components.messages.UserDeleted.examples[0].payload;

    expect(userDeletedSchema.safeParse(example.data).success).toBe(true);
  });
});
