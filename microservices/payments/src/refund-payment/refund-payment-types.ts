import type { Money } from "../shared/money.js";

export type RefundRequest = {
  refundRequestId: string;
  orderId: string;
  amount: Money;
};
