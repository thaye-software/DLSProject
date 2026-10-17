import { describe, expect, it, vi } from "vitest";
import type { CreateOrderRequest, CreateOrderResult } from "../../src/application/create-order.js";
import { contractSchema, openApi } from "../support/contract.js";
import { serve } from "../support/serve.js";
import { address, addressJson, IDEMPOTENCY_KEY, PRODUCT_ID, reservedOrder, USER_ID } from "../fixtures/orders.js";

const validBody = {
  items: [{ product_id: PRODUCT_ID, quantity: 1 }],
  offer_token: null,
  billing_address: addressJson,
  delivery_address: addressJson,
};

const gatewayHeaders = {
  "x-user-id": USER_ID,
  "x-user-email": "mette@example.com",
  "idempotency-key": IDEMPOTENCY_KEY,
};

async function postOrder({
  result = { outcome: "created", order: reservedOrder() } as CreateOrderResult | Error,
  headers = gatewayHeaders as Record<string, string | undefined>,
  body = validBody as unknown,
} = {}) {
  const createOrder = vi.fn(async (_request: CreateOrderRequest) => {
    if (result instanceof Error) throw result;
    return result;
  });
  const baseUrl = await serve({ createOrder });
  const definedHeaders = Object.fromEntries(Object.entries(headers).filter(([, value]) => value !== undefined)) as Record<string, string>;
  const response = await fetch(`${baseUrl}/orders`, {
    method: "POST",
    headers: { "content-type": "application/json", ...definedHeaders },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
  return { response, json: await response.json(), createOrder };
}

function expectProblem(json: unknown, code: string) {
  const validate = contractSchema("Problem");
  expect(validate(json), JSON.stringify(validate.errors)).toBe(true);
  expect((json as { type: string }).type).toBe(`https://limitedwatches.dk/problems/${code}`);
}

describe("POST /orders", () => {
  it("answers 201 with an Order that matches the contract", async () => {
    const { response, json } = await postOrder();

    expect(response.status).toBe(201);
    const validate = contractSchema("Order");
    expect(validate(json), JSON.stringify(validate.errors)).toBe(true);
    const example = openApi.paths["/orders"].post.responses["201"].content["application/json"].example;
    // Same instants; toISOString always prints milliseconds.
    const iso = (value: string) => new Date(value).toISOString();
    expect(json).toEqual({ ...example, created_at: iso(example.created_at), expires_at: iso(example.expires_at) });
  });

  it("passes the gateway's user, the key and the converted body to the use case", async () => {
    const { createOrder } = await postOrder();

    expect(createOrder).toHaveBeenCalledWith({
      userId: USER_ID,
      customerEmail: "mette@example.com",
      idempotencyKey: IDEMPOTENCY_KEY,
      items: [{ productId: PRODUCT_ID, quantity: 1 }],
      billingAddress: address,
      deliveryAddress: address,
    });
  });

  it("accepts the contract's example request", async () => {
    const example = openApi.paths["/orders"].post.requestBody.content["application/json"].example;

    const { response } = await postOrder({ body: example });

    expect(response.status).toBe(201);
  });

  it("answers 201 with the stored order for a replayed Idempotency-Key", async () => {
    const { response, json } = await postOrder({ result: { outcome: "replayed", order: reservedOrder({ status: "PENDING" }) } });

    expect(response.status).toBe(201);
    expect(json.status).toBe("PENDING");
    expect(json.expires_at).toBeNull();
  });

  it("answers 409 product_unavailable with the unavailable product ids", async () => {
    const { response, json } = await postOrder({ result: { outcome: "unavailable", productIds: [PRODUCT_ID] } });

    expect(response.status).toBe(409);
    expectProblem(json, "product_unavailable");
    expect(json.unavailable_product_ids).toEqual([PRODUCT_ID]);
  });

  it("answers 502 when Catalog or the database fails", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);

    const { response, json } = await postOrder({ result: new Error("catalog down") });

    expect(response.status).toBe(502);
    expectProblem(json, "upstream_unavailable");
  });

  it.each([
    { name: "X-User-Id missing", headers: { ...gatewayHeaders, "x-user-id": undefined } },
    { name: "X-User-Id not a UUID", headers: { ...gatewayHeaders, "x-user-id": "mette" } },
    { name: "X-User-Email missing", headers: { ...gatewayHeaders, "x-user-email": undefined } },
  ])("answers 401 when $name", async ({ headers }) => {
    const { response, json, createOrder } = await postOrder({ headers });

    expect(response.status).toBe(401);
    expectProblem(json, "unauthorized");
    expect(createOrder).not.toHaveBeenCalled();
  });

  it.each([
    { name: "Idempotency-Key missing", headers: { ...gatewayHeaders, "idempotency-key": undefined }, body: validBody },
    { name: "Idempotency-Key not a UUID", headers: { ...gatewayHeaders, "idempotency-key": "abc" }, body: validBody },
    { name: "no items", body: { ...validBody, items: [] } },
    { name: "quantity 0", body: { ...validBody, items: [{ product_id: PRODUCT_ID, quantity: 0 }] } },
    { name: "a repeated product", body: { ...validBody, items: [validBody.items[0], validBody.items[0]] } },
    { name: "offer_token missing", body: { ...validBody, offer_token: undefined } },
    { name: "an offer_token (not supported yet)", body: { ...validBody, offer_token: "signed-offer" } },
    { name: "a lower-case country code", body: { ...validBody, billing_address: { ...addressJson, country_code: "dk" } } },
    { name: "a blank first name", body: { ...validBody, delivery_address: { ...addressJson, first_name: "  " } } },
    { name: "middle_name left out", body: { ...validBody, delivery_address: { ...addressJson, middle_name: undefined } } },
    { name: "an unknown field", body: { ...validBody, total: 1 } },
    { name: "invalid JSON", body: "{" },
  ])("answers 422 for $name", async ({ headers, body }) => {
    const { response, json, createOrder } = await postOrder({ headers, body });

    expect(response.status).toBe(422);
    expectProblem(json, "validation_error");
    expect(createOrder).not.toHaveBeenCalled();
  });
});
