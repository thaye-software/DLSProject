import type { Money } from "../shared/money.js";

export type PaymentSession = {
  payment_intent_id: string;
  order_id: string;
  amount: Money;
  client_secret: string;
  expires_at: string;
};

export type CreatePaymentSessionResult =
  | { outcome: "created"; session: PaymentSession }
  | { outcome: "not_found" }
  | { outcome: "not_payable" };
