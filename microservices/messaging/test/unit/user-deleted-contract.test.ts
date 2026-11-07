import { describe, expect, it } from "vitest";
import { userDeletedSchema } from "../../src/adapters/rabbitmq/user-events.js";
import { asyncApi } from "../support/contract.js";

describe("user_deleted contract", () => {
  it("Messaging accepts the contract's example user_deleted", () => {
    const example = asyncApi.components.messages.UserDeleted.examples[0].payload.data;
    const result = userDeletedSchema.safeParse(example);

    expect(result.success, JSON.stringify(result.error?.issues)).toBe(true);
  });
});
