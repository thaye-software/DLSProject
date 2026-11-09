/** @jest-environment node */
import { gatewayFetch } from "@/lib/gateway";
import { cancelOrder, createOrder, getOrder, listOrders, updateOrderStatus } from "@/services/orderService";
import { createPayment } from "@/services/paymentService";

jest.mock("server-only", () => ({}));
jest.mock("@/lib/gateway", () => ({ gatewayFetch: jest.fn().mockResolvedValue({}) }));

const fetchMock = gatewayFetch as jest.Mock;
beforeEach(() => fetchMock.mockClear());

const KEY = "7d1b2c3e-0000-4000-8000-000000000001";
const address = {
  first_name: "A",
  middle_name: null,
  last_name: "B",
  address_line_1: "Street 1",
  address_line_2: null,
  city: "Aarhus",
  zip_code: "8000",
  state_province: null,
  country_code: "DK",
};

test("createOrder posts to /orders with offer_token null and the passed Idempotency-Key", async () => {
  await createOrder({ items: [{ product_id: "p1", quantity: 1 }], billing_address: address, delivery_address: address }, KEY);
  const [path, init] = fetchMock.mock.calls[0];
  expect(path).toBe("/orders");
  expect(init.method).toBe("POST");
  expect(init.body).toMatchObject({ offer_token: null, items: [{ product_id: "p1", quantity: 1 }] });
  expect(init.headers["idempotency-key"]).toBe(KEY);
});

test("createOrder forces offer_token null even if a caller smuggles one in", async () => {
  await createOrder({ items: [], billing_address: address, delivery_address: address, offer_token: "x" } as never, KEY);
  expect(fetchMock.mock.calls[0][1].body.offer_token).toBeNull();
});

test("createPayment posts { order_id } to /payments", async () => {
  await createPayment("o1");
  expect(fetchMock).toHaveBeenCalledWith("/payments", { method: "POST", body: { order_id: "o1" } });
});

test("updateOrderStatus uses PATCH /orders/o1/status", async () => {
  await updateOrderStatus("o1", { status: "SHIPPED" });
  expect(fetchMock).toHaveBeenCalledWith("/orders/o1/status", { method: "PATCH", body: { status: "SHIPPED" } });
});

test("cancelOrder uses POST /orders/o1/cancel", async () => {
  await cancelOrder("o1");
  expect(fetchMock).toHaveBeenCalledWith("/orders/o1/cancel", { method: "POST" });
});

test("getOrder and listOrders", async () => {
  await getOrder("o1");
  expect(fetchMock).toHaveBeenCalledWith("/orders/o1");
  await listOrders(2);
  expect(fetchMock).toHaveBeenCalledWith("/orders", { query: { page: 2 } });
});
