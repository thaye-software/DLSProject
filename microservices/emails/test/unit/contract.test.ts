import { readFileSync } from "node:fs";
import { Ajv } from "ajv";
import addFormats from "ajv-formats";
import { describe, expect, it } from "vitest";
import { parse } from "yaml";
import { orderConfirmedDataSchema } from "../../src/adapters/rabbitmq/order-confirmed.js";
import { orderConfirmedEvent } from "../fixtures/order-confirmed.js";

const asyncApi = parse(readFileSync(new URL("../../../docs/contracts/asyncapi.yaml", import.meta.url), "utf8"));

const ajv = new Ajv({ strict: false, allErrors: true });
addFormats.default(ajv);
ajv.addSchema(asyncApi, "asyncapi");

function contractSchema(name: string) {
  const validate = ajv.getSchema(`asyncapi#/components/schemas/${name}`);
  if (!validate) throw new Error(`asyncapi.yaml has no schema ${name}`);
  return validate;
}

describe("order_confirmed contract", () => {
  it("the fixture Notif consumes is a valid order_confirmed event", () => {
    const validate = contractSchema("OrderConfirmedEvent");

    expect(validate(orderConfirmedEvent), JSON.stringify(validate.errors)).toBe(true);
  });

  it("Notif accepts the example order_confirmed published in the contract", () => {
    const example = asyncApi.components.messages.OrderConfirmed.examples[0].payload;

    expect(orderConfirmedDataSchema.safeParse(example.data).success).toBe(true);
  });
});
