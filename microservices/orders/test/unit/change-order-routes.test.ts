import { describe, expect, it, vi } from "vitest";
import type { AppDependencies } from "../../src/adapters/http/app.js";
import { contractSchema, openApi } from "../support/contract.js";
import { serve } from "../support/serve.js";
import { reservedOrder, USER_ID } from "../fixtures/orders.js";

const ORDER_ID = "f47ac10b-58cc-4372-a567-0e02b2c3d479";
const customer = { "x-user-id": USER_ID, "x-user-role": "customer" };
const admin = { "x-user-id": USER_ID, "x-user-role": "admin" };

async function call(
  method: string,
  path: string,
  { headers = {}, body, dependencies = {} }: { headers?: Record<string, string>; body?: unknown; dependencies?: Partial<AppDependencies> } = {},
) {
  const baseUrl = await serve(dependencies);
  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers: { "content-type": "application/json", ...headers },
    body: body === undefined ? undefined : typeof body === "string" ? body : JSON.stringify(body),
  });
  return { response, json: await response.json() };
}

function expectProblem(json: unknown, status: number, code: string, response: Response) {
  expect(response.status).toBe(status);
  const validate = contractSchema("Problem");
  expect(validate(json), JSON.stringify(validate.errors)).toBe(true);
  expect((json as { type: string }).type).toBe(`https://limitedwatches.dk/problems/${code}`);
}

describe("POST /orders/{order_id}/cancel", () => {
  const cancel = (options: Parameters<typeof call>[2]) => call("POST", `/orders/${ORDER_ID}/cancel`, options);

  it("answers 200 with the cancelled order, matching the contract", async () => {
    const cancelOrder = vi.fn(async () => ({ kind: "done" as const, order: reservedOrder({ status: "CANCELLED" }) }));

    const { response, json } = await cancel({ headers: customer, dependencies: { cancelOrder } });

    expect(response.status).toBe(200);
    const validate = contractSchema("Order");
    expect(validate(json), JSON.stringify(validate.errors)).toBe(true);
    expect(json.status).toBe("CANCELLED");
    expect(json.expires_at).toBeNull();
    expect(cancelOrder).toHaveBeenCalledWith(ORDER_ID, { userId: USER_ID, isAdmin: false });
  });

  it.each([
    { name: "the order is missing", result: { kind: "not_found" as const } },
    { name: "it is someone else's", result: { kind: "rejected" as const, reason: "not_found" as const } },
  ])("answers 404 when $name", async ({ result }) => {
    const { response, json } = await cancel({ headers: customer, dependencies: { cancelOrder: async () => result } });

    expectProblem(json, 404, "not_found", response);
  });

  it("answers 409 order_not_cancellable for a paid order", async () => {
    const { response, json } = await cancel({
      headers: customer,
      dependencies: { cancelOrder: async () => ({ kind: "rejected", reason: "not_cancellable" }) },
    });

    expectProblem(json, 409, "order_not_cancellable", response);
  });

  it("answers 404 for an id that is not a UUID, without calling the use case", async () => {
    const cancelOrder = vi.fn();

    const { response } = await call("POST", "/orders/abc/cancel", { headers: customer, dependencies: { cancelOrder } });

    expect(response.status).toBe(404);
    expect(cancelOrder).not.toHaveBeenCalled();
  });

  it("answers 401 without X-User-Id", async () => {
    const { response, json } = await cancel({});

    expectProblem(json, 401, "unauthorized", response);
  });
});

describe("PATCH /orders/{order_id}/status", () => {
  const patch = (options: Parameters<typeof call>[2]) => call("PATCH", `/orders/${ORDER_ID}/status`, options);

  it("answers 200 with the updated order for the contract's example request", async () => {
    const example = openApi.paths["/orders/{order_id}/status"].patch.requestBody.content["application/json"].example;
    const changeOrderStatus = vi.fn(async () => ({ kind: "done" as const, order: reservedOrder({ status: "SHIPPED" }) }));

    const { response, json } = await patch({ headers: admin, body: example, dependencies: { changeOrderStatus } });

    expect(response.status).toBe(200);
    const validate = contractSchema("Order");
    expect(validate(json), JSON.stringify(validate.errors)).toBe(true);
    expect(changeOrderStatus).toHaveBeenCalledWith(ORDER_ID, "SHIPPED", { userId: USER_ID, isAdmin: true });
  });

  it("answers 403 to a customer, without calling the use case", async () => {
    const changeOrderStatus = vi.fn();

    const { response, json } = await patch({ headers: customer, body: { status: "SHIPPED" }, dependencies: { changeOrderStatus } });

    expectProblem(json, 403, "forbidden", response);
    expect(changeOrderStatus).not.toHaveBeenCalled();
  });

  it("answers 401 without X-User-Id", async () => {
    const { response, json } = await patch({ body: { status: "SHIPPED" } });

    expectProblem(json, 401, "unauthorized", response);
  });

  it("answers 404 for an unknown order", async () => {
    const { response, json } = await patch({
      headers: admin,
      body: { status: "SHIPPED" },
      dependencies: { changeOrderStatus: async () => ({ kind: "not_found" }) },
    });

    expectProblem(json, 404, "not_found", response);
  });

  it("answers 409 invalid_status_transition for a change that isn't allowed", async () => {
    const { response, json } = await patch({
      headers: admin,
      body: { status: "DELIVERED" },
      dependencies: { changeOrderStatus: async () => ({ kind: "rejected", reason: "invalid_transition" }) },
    });

    expectProblem(json, 409, "invalid_status_transition", response);
  });

  it.each([
    { name: "a status only the system sets (PENDING)", body: { status: "PENDING" } },
    { name: "RESERVED", body: { status: "RESERVED" } },
    { name: "an unknown status", body: { status: "LOST" } },
    { name: "no status", body: {} },
    { name: "an extra field", body: { status: "SHIPPED", note: "x" } },
    { name: "invalid JSON", body: "{" },
  ])("answers 422 for $name", async ({ body }) => {
    const changeOrderStatus = vi.fn();

    const { response, json } = await patch({ headers: admin, body, dependencies: { changeOrderStatus } });

    expectProblem(json, 422, "validation_error", response);
    expect(changeOrderStatus).not.toHaveBeenCalled();
  });
});
