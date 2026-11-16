/** @jest-environment node */
import { cancelMyOrder } from "@/app/orders/cancelAction";
import { cancelOrder } from "@/services/orderService";
import { GatewayError } from "@/lib/gateway";

jest.mock("server-only", () => ({}));
jest.mock("next/cache", () => ({ revalidatePath: jest.fn() }));
jest.mock("@/lib/gateway", () => {
  class GatewayError extends Error {
    constructor(public status: number, public problem: unknown = null) {
      super(`Gateway error ${status}`);
    }
  }
  return { GatewayError, withLoginRedirect: (f: () => unknown) => f() };
});
jest.mock("@/services/orderService", () => ({ cancelOrder: jest.fn() }));

beforeEach(() => jest.clearAllMocks());

test("cancels the order and revalidates", async () => {
  (cancelOrder as jest.Mock).mockResolvedValue({});
  await expect(cancelMyOrder("o1")).resolves.toBeNull();
  expect(cancelOrder).toHaveBeenCalledWith("o1");
  expect(jest.requireMock("next/cache").revalidatePath).toHaveBeenCalledWith("/orders");
});

test("returns the problem message on a GatewayError", async () => {
  (cancelOrder as jest.Mock).mockRejectedValue(
    new GatewayError(409, { type: "x", title: "Not cancellable", status: 409, detail: "Order is shipped" }),
  );
  await expect(cancelMyOrder("o1")).resolves.toBe("Not cancellable: Order is shipped");
});
