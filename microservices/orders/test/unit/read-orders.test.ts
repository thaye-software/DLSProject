import { describe, expect, it, vi } from "vitest";
import type { OrderRepository } from "../../src/application/ports/order-repository.js";
import { getOrder, listOrders } from "../../src/application/read-orders.js";
import { reservedOrder, USER_ID } from "../fixtures/orders.js";

const OTHER_USER_ID = "9a8b7c6d-5e4f-4a3b-9c2d-1e0f9a8b7c6d";
const order = reservedOrder();

function repository() {
  return {
    findById: vi.fn<OrderRepository["findById"]>(async (id) => (id === order.id ? order : null)),
    list: vi.fn<OrderRepository["list"]>(async () => ({ orders: [order], total: 1 })),
  };
}

describe("getOrder", () => {
  it.each([
    { name: "the owner", viewer: { userId: USER_ID, isAdmin: false }, expected: order },
    { name: "an admin", viewer: { userId: OTHER_USER_ID, isAdmin: true }, expected: order },
    { name: "another customer", viewer: { userId: OTHER_USER_ID, isAdmin: false }, expected: null },
  ])("returns $expected.id to $name", async ({ viewer, expected }) => {
    await expect(getOrder(order.id, viewer, repository())).resolves.toEqual(expected);
  });

  it("returns null for an order that does not exist", async () => {
    await expect(getOrder(OTHER_USER_ID, { userId: USER_ID, isAdmin: true }, repository())).resolves.toBeNull();
  });
});

describe("listOrders", () => {
  it("limits a customer to their own orders", async () => {
    const orders = repository();

    await listOrders({ viewer: { userId: USER_ID, isAdmin: false }, statuses: ["PENDING"], page: 2, pageSize: 10 }, orders);

    expect(orders.list).toHaveBeenCalledWith({ userId: USER_ID, statuses: ["PENDING"], page: 2, pageSize: 10 });
  });

  it("lists every user's orders for an admin", async () => {
    const orders = repository();

    await listOrders({ viewer: { userId: USER_ID, isAdmin: true }, statuses: [], page: 1, pageSize: 20 }, orders);

    expect(orders.list).toHaveBeenCalledWith({ userId: null, statuses: [], page: 1, pageSize: 20 });
  });
});
