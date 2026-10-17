import type { OrderStatus } from "../domain/order.js";
import type { OrderRepository } from "./ports/order-repository.js";

export type PaymentDetails = {
  orderId: string;
  userId: string;
  status: OrderStatus;
  amountDueDkk: number;
  expiresAt: Date;
};

export type PaymentDetailsResult =
  | { outcome: "payable"; details: PaymentDetails }
  | { outcome: "not_found" }
  | { outcome: "not_payable" };

export type PaymentDetailsDependencies = {
  orders: Pick<OrderRepository, "findById">;
  now: () => Date;
};

// Only a RESERVED order whose reservation hasn't run out can be paid. The expiry sweeper may not
// have marked it EXPIRED yet, so the time is checked here too.
export async function getPaymentDetails(
  orderId: string,
  { orders, now }: PaymentDetailsDependencies,
): Promise<PaymentDetailsResult> {
  const order = await orders.findById(orderId);
  if (!order) return { outcome: "not_found" };
  if (order.status !== "RESERVED" || !order.expiresAt || order.expiresAt <= now()) return { outcome: "not_payable" };

  return {
    outcome: "payable",
    details: {
      orderId: order.id,
      userId: order.userId,
      status: order.status,
      amountDueDkk: order.totalPriceDkk,
      expiresAt: order.expiresAt,
    },
  };
}
