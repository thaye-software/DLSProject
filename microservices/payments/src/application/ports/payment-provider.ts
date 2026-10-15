import type { Money } from "../../domain/money.js";

export type NewPaymentIntent = {
  orderId: string;
  userId: string;
  amount: Money;
};

export type CreatedPaymentIntent = {
  paymentIntentId: string;
  clientSecret: string;
  amount: Money;
};

export type RefundedPayment = {
  paymentIntentId: string;
  orderId: string;
  userId: string;
  refundId: string;
  refundRequestId: string | null;
  amount: Money;
  refundedAt: Date;
};

export type FoundPaymentIntent = {
  id: string;
  status: string;
};

export type CancelIntentResult = "cancelled" | "not_cancellable";

export type NewRefund = {
  paymentIntentId: string;
  amount: Money;
  refundRequestId: string;
};

export type CreatedRefund = {
  refundId: string;
};

export interface PaymentProvider {
  createIntent(intent: NewPaymentIntent): Promise<CreatedPaymentIntent>;
  findIntentByOrderId(orderId: string): Promise<FoundPaymentIntent | null>;
  cancelIntent(paymentIntentId: string): Promise<CancelIntentResult>;
  refund(refund: NewRefund): Promise<CreatedRefund>;
  latestRefund(chargeId: string): Promise<RefundedPayment | null>;
}
