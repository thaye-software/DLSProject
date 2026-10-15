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

export interface PaymentProvider {
  createIntent(intent: NewPaymentIntent): Promise<CreatedPaymentIntent>;
}
