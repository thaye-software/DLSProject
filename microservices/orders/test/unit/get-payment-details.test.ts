import { describe, expect, it } from "vitest";
import { getPaymentDetails } from "../../src/application/get-payment-details.js";
import type { Order } from "../../src/domain/order.js";
import { reservedOrder, USER_ID } from "../fixtures/orders.js";

const EXPIRES_AT = new Date("2026-10-14T10:30:00Z");

function lookup(order: Order | null, now: Date) {
  return getPaymentDetails("f47ac10b-58cc-4372-a567-0e02b2c3d479", { orders: { findById: async () => order }, now: () => now });
}

describe("getPaymentDetails", () => {
  it("returns the total as the amount due for a RESERVED order before it expires", async () => {
    const order = reservedOrder({ expiresAt: EXPIRES_AT });

    await expect(lookup(order, new Date("2026-10-14T10:29:59Z"))).resolves.toEqual({
      outcome: "payable",
      details: { orderId: order.id, userId: USER_ID, status: "RESERVED", amountDueDkk: 11_530_000, expiresAt: EXPIRES_AT },
    });
  });

  it("answers not_found for an unknown order", async () => {
    await expect(lookup(null, new Date("2026-10-14T10:00:00Z"))).resolves.toEqual({ outcome: "not_found" });
  });

  it.each([
    { name: "at the exact expiry time (boundary)", now: "2026-10-14T10:30:00Z" },
    { name: "after it expired, before the sweeper ran", now: "2026-10-14T10:31:00Z" },
  ])("answers not_payable for a RESERVED order $name", async ({ now }) => {
    await expect(lookup(reservedOrder({ expiresAt: EXPIRES_AT }), new Date(now))).resolves.toEqual({ outcome: "not_payable" });
  });

  it.each(["EXPIRED", "PENDING", "PROCESSING", "SHIPPED", "DELIVERED", "CANCELLED", "RETURNED", "REFUNDED"] as const)(
    "answers not_payable for a %s order",
    async (status) => {
      await expect(lookup(reservedOrder({ status }), new Date("2026-10-14T10:00:00Z"))).resolves.toEqual({
        outcome: "not_payable",
      });
    },
  );
});
