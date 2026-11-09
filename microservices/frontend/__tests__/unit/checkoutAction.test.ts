/** @jest-environment node */
import { submitCheckout } from "@/app/orders/actions";
import { createOrder } from "@/services/orderService";
import { GatewayError } from "@/lib/gateway";

jest.mock("server-only", () => ({}));
jest.mock("next/navigation", () => ({
  redirect: jest.fn(() => {
    throw new Error("NEXT_REDIRECT");
  }),
}));
jest.mock("@/lib/gateway", () => {
  class GatewayError extends Error {
    constructor(public status: number, public problem: unknown = null) {
      super(`Gateway error ${status}`);
    }
  }
  return { GatewayError, withLoginRedirect: (f: () => unknown) => f() };
});
jest.mock("@/services/orderService", () => ({ createOrder: jest.fn() }));

const KEY = "7d1b2c3e-0000-4000-8000-000000000001";
const form = (extra: Record<string, string> = {}) => {
  const f = new FormData();
  const all: Record<string, string> = {
    product_id: "p1", idempotency_key: KEY, same_as_billing: "on",
    billing_first_name: "Ann", billing_last_name: "Lee", billing_address_line_1: "St 1",
    billing_city: "Aarhus", billing_zip_code: "8000", billing_country_code: "DK", ...extra,
  };
  for (const [k, v] of Object.entries(all)) f.set(k, v);
  return f;
};

beforeEach(() => jest.clearAllMocks());

test("rejects a missing or invalid idempotency key without calling Orders", async () => {
  const f = form({ idempotency_key: "nope" });
  const state = await submitCheckout({}, f);
  expect(state.error).toBeTruthy();
  expect(createOrder).not.toHaveBeenCalled();
});

test("passes the submitted key to createOrder", async () => {
  (createOrder as jest.Mock).mockResolvedValue({ order_id: "o1" });
  await expect(submitCheckout({}, form())).rejects.toThrow("NEXT_REDIRECT");
  expect((createOrder as jest.Mock).mock.calls[0][1]).toBe(KEY);
});

test("on a problem error it returns the message, the typed values and the key", async () => {
  (createOrder as jest.Mock).mockRejectedValue(
    new GatewayError(409, { type: "t", title: "Product not available", status: 409, detail: "Product not available." }),
  );
  const state = await submitCheckout({}, form());
  expect(state.error).toBe("Product not available: Product not available.");
  expect(state.idempotencyKey).toBe(KEY);
  expect(state.values).toMatchObject({ billing_first_name: "Ann", billing_city: "Aarhus" });
});
