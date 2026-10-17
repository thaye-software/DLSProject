import { describe, expect, it, vi } from "vitest";
import type { AppDependencies } from "../../src/adapters/http/app.js";
import { contractSchema, openApi } from "../support/contract.js";
import { serve } from "../support/serve.js";
import { reservedOrder, USER_ID } from "../fixtures/orders.js";

const ORDER_ID = "f47ac10b-58cc-4372-a567-0e02b2c3d479";
const customer = { "x-user-id": USER_ID, "x-user-role": "customer" };
const admin = { "x-user-id": USER_ID, "x-user-role": "admin" };

function expectContract(schema: string, json: unknown) {
  const validate = contractSchema(schema);
  expect(validate(json), JSON.stringify(validate.errors)).toBe(true);
}

async function get(path: string, headers: Record<string, string>, dependencies: Partial<AppDependencies> = {}) {
  const baseUrl = await serve(dependencies);
  const response = await fetch(`${baseUrl}${path}`, { headers });
  return { response, json: await response.json() };
}

describe("GET /orders/{order_id}", () => {
  it("answers 200 with the contract's example order", async () => {
    const getOrder = vi.fn(async () => reservedOrder());

    const { response, json } = await get(`/orders/${ORDER_ID}`, customer, { getOrder });

    expect(response.status).toBe(200);
    expectContract("Order", json);
    const example = openApi.paths["/orders/{order_id}"].get.responses["200"].content["application/json"].example;
    const iso = (value: string) => new Date(value).toISOString();
    expect(json).toEqual({ ...example, created_at: iso(example.created_at), expires_at: iso(example.expires_at) });
  });

  it.each([
    { name: "a customer", headers: customer, isAdmin: false },
    { name: "an admin", headers: admin, isAdmin: true },
    { name: "a user without a role", headers: { "x-user-id": USER_ID }, isAdmin: false },
  ])("passes $name to the use case as the viewer", async ({ headers, isAdmin }) => {
    const getOrder = vi.fn(async () => reservedOrder());

    await get(`/orders/${ORDER_ID}`, headers, { getOrder });

    expect(getOrder).toHaveBeenCalledWith(ORDER_ID, { userId: USER_ID, isAdmin });
  });

  it.each([
    { name: "the order is missing or someone else's", path: `/orders/${ORDER_ID}` },
    { name: "the id is not a UUID", path: "/orders/not-a-uuid" },
  ])("answers 404 when $name", async ({ path }) => {
    const { response, json } = await get(path, customer, { getOrder: async () => null });

    expect(response.status).toBe(404);
    expectContract("Problem", json);
    expect(json.type).toBe("https://limitedwatches.dk/problems/not_found");
  });

  it("answers 401 without X-User-Id", async () => {
    const { response, json } = await get(`/orders/${ORDER_ID}`, {});

    expect(response.status).toBe(401);
    expect(json.type).toBe("https://limitedwatches.dk/problems/unauthorized");
  });

  it("answers 500 problem+json when the database fails", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);

    const { response, json } = await get(`/orders/${ORDER_ID}`, customer, {
      getOrder: async () => {
        throw new Error("database down");
      },
    });

    expect(response.status).toBe(500);
    expectContract("Problem", json);
  });
});

describe("GET /orders", () => {
  it("answers 200 with an OrderPage that matches the contract", async () => {
    const listOrders = vi.fn(async () => ({ orders: [reservedOrder({ status: "PENDING" })], total: 1 }));

    const { response, json } = await get("/orders", customer, { listOrders });

    expect(response.status).toBe(200);
    expectContract("OrderPage", json);
    expect(json).toMatchObject({ page: 1, page_size: 20, total: 1 });
    expect(json.items[0].expires_at).toBeNull();
  });

  it.each([
    { name: "no parameters → defaults", query: "", statuses: [], page: 1, pageSize: 20 },
    { name: "one status", query: "?status=PENDING", statuses: ["PENDING"], page: 1, pageSize: 20 },
    { name: "a repeated status", query: "?status=PENDING&status=SHIPPED", statuses: ["PENDING", "SHIPPED"], page: 1, pageSize: 20 },
    { name: "page and page_size", query: "?page=3&page_size=100", statuses: [], page: 3, pageSize: 100 },
    { name: "page_size 1 (boundary)", query: "?page_size=1", statuses: [], page: 1, pageSize: 1 },
  ])("passes $name to the use case", async ({ query, statuses, page, pageSize }) => {
    const listOrders = vi.fn(async () => ({ orders: [], total: 0 }));

    await get(`/orders${query}`, admin, { listOrders });

    expect(listOrders).toHaveBeenCalledWith({ viewer: { userId: USER_ID, isAdmin: true }, statuses, page, pageSize });
  });

  it.each([
    { name: "an unknown status", query: "?status=SHIPPING" },
    { name: "page 0", query: "?page=0" },
    { name: "page_size 101", query: "?page_size=101" },
    { name: "page_size 0", query: "?page_size=0" },
    { name: "a fractional page", query: "?page=1.5" },
    { name: "a text page", query: "?page=two" },
  ])("answers 422 for $name", async ({ query }) => {
    const listOrders = vi.fn(async () => ({ orders: [], total: 0 }));

    const { response, json } = await get(`/orders${query}`, customer, { listOrders });

    expect(response.status).toBe(422);
    expectContract("Problem", json);
    expect(listOrders).not.toHaveBeenCalled();
  });

  it("answers 401 without X-User-Id", async () => {
    const { response } = await get("/orders", { "x-user-role": "admin" });

    expect(response.status).toBe(401);
  });
});
