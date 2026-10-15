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

export interface PaymentProvider {
  createIntent(intent: NewPaymentIntent): Promise<CreatedPaymentIntent>;
  latestRefund(chargeId: string): Promise<RefundedPayment | null>;
}
